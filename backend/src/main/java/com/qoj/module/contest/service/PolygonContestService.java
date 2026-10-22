package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.enums.AudienceType;
import com.qoj.module.contest.dto.ContestCreateRequest;
import com.qoj.module.contest.dto.ContestProblemCaseScoreRequest;
import com.qoj.module.contest.dto.ContestProblemRequest;
import com.qoj.module.contest.dto.PolygonImportRequest;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestProblemCaseScore;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemCaseScoreMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import com.qoj.common.exception.BizException;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import static com.qoj.module.contest.service.PolygonPackageReader.escape;
import static com.qoj.module.contest.service.PolygonPackageReader.invalid;

@Service
public class PolygonContestService {
    private final PolygonPackageReader reader;
    private final ObjectMapper json;
    private final ProblemMapper problems;
    private final ProblemTestCaseMapper cases;
    private final ProblemService problemService;
    private final ContestService contestService;
    private final ContestMapper contests;
    private final ContestProblemMapper contestProblems;
    private final ContestProblemCaseScoreMapper scores;
    private final ContestAccessPolicy policy;

    public PolygonContestService(PolygonPackageReader reader, ObjectMapper json, ProblemMapper problems,
        ProblemTestCaseMapper cases, ProblemService problemService, ContestService contestService,
        ContestMapper contests, ContestProblemMapper contestProblems, ContestProblemCaseScoreMapper scores,
        ContestAccessPolicy policy) {
        this.reader = reader; this.json = json; this.problems = problems; this.cases = cases;
        this.problemService = problemService; this.contestService = contestService; this.contests = contests;
        this.contestProblems = contestProblems; this.scores = scores; this.policy = policy;
    }

    public record PreviewProblem(String label, String title, int timeLimit, int memoryLimit, int testCount, int sampleCount, boolean checker) {}
    public record Preview(String title, List<PreviewProblem> problems, List<String> warnings) {}
    public record Imported(long contestId, int problemCount, List<String> warnings) {}

    private void requireImport() {
        if (!"SUPER_ADMIN".equals(CurrentUser.required().role())) throw new BizException(403, "仅超级管理员可导入 Polygon 比赛");
    }

    public Preview preview(MultipartFile file) {
        requireImport();
        var pack = reader.read(file);
        return new Preview(pack.title(), pack.problems().stream().map(p -> new PreviewProblem(
            p.label(), p.title(), p.timeLimit(), p.memoryLimit(), p.tests().size(), p.samples().size(), p.checkerSource() != null
        )).toList(), pack.warnings());
    }

    /** All problems, tests and the new contest commit or roll back together. */
    @Transactional
    public Imported importContest(MultipartFile file, PolygonImportRequest request) {
        requireImport();
        var pack = reader.read(file);
        var owner = CurrentUser.required();
        List<ContestProblemRequest> selected = new ArrayList<>();
        int order = 0;
        for (var source : pack.problems()) {
            Problem p = new Problem();
            p.title = source.title(); p.statement = source.statement(); p.inputFormat = ""; p.outputFormat = "";
            p.checkerSource = source.checkerSource();
            p.timeLimit = source.timeLimit(); p.memoryLimit = source.memoryLimit(); p.difficulty = 1;
            p.tags = "[]"; p.sampleCases = "[]"; p.accessScope = "PRIVATE"; p.isPublic = false;
            p.studentPublishStatus = "DRAFT"; p.ownerAccountType = owner.accountType(); p.ownerId = owner.id();
            p.acRate = BigDecimal.ZERO; p.isDeleted = false;
            problems.insert(p);
            List<ProblemTestCase> hidden = new ArrayList<>();
            List<ContestProblemCaseScoreRequest> caseScores = new ArrayList<>();
            boolean hasPoints = source.tests().stream().anyMatch(t -> t.points() != null);
            if (hasPoints && source.tests().stream().anyMatch(t -> t.points() == null)) throw invalid(source.label() + "：测试点分数必须全部指定或全部省略");
            for (int i = 0; i < source.tests().size(); i++) {
                var test = source.tests().get(i);
                hidden.add(testCase(i + 1, test.input(), test.output(), ""));
                int points = hasPoints ? test.points() : 100 / source.tests().size() + (i < 100 % source.tests().size() ? 1 : 0);
                caseScores.add(new ContestProblemCaseScoreRequest(i + 1, points));
            }
            List<ProblemTestCase> samples = new ArrayList<>();
            for (var sample : source.samples()) samples.add(testCase(samples.size() + 1, sample.input(), sample.output(), sample.explanation()));
            problemService.replaceTestCases(p.id, samples, true);
            problemService.replaceTestCases(p.id, hidden, false);
            selected.add(new ContestProblemRequest(p.id, source.label(), caseScores.stream().mapToInt(ContestProblemCaseScoreRequest::score).sum(), order++, caseScores));
        }
        String title = request.title() == null || request.title().isBlank() ? pack.title() : request.title().trim();
        if (title.length() > 200) throw invalid("比赛标题超过 200 字符");
        var created = contestService.create(new ContestCreateRequest(
            title, "", request.durationMinutes(), request.startTime(), request.startTime().plusMinutes(request.durationMinutes()),
            request.type(), AudienceType.ALL, 0L, List.of(), false, null, false, null, null, null,
            false, true, false, false, false, false, false, true, "PUBLIC", null, selected, null
        ));
        return new Imported(created.id(), selected.size(), pack.warnings());
    }

    private ProblemTestCase testCase(int no, String input, String output, String explanation) {
        ProblemTestCase test = new ProblemTestCase();
        test.caseNo = no; test.inputData = input; test.outputData = output; test.explanation = explanation; test.publicInput = "";
        return test;
    }

    @Transactional(readOnly = true)
    public byte[] exportContest(long id) {
        Contest contest = contests.selectById(id);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) throw new BizException(404, "比赛不存在");
        if (!policy.can(CurrentUser.required(), Permission.UPDATE, contest)) throw new BizException(403, "无权导出该比赛的隐藏数据");
        List<ContestProblem> selected = contestProblems.selectList(new QueryWrapper<ContestProblem>().eq("contest_id", id).orderByAsc("display_order", "id"));
        if (selected.isEmpty() || selected.size() > 100) throw invalid("导出需要 1 至 100 道题目");
        try (var output = new ByteArrayOutputStream(); var zip = new ZipOutputStream(output)) {
            long[] total = {0};
            StringBuilder manifest = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><contest><names><name language=\"english\" value=\"")
                .append(escape(contest.title)).append("\"/></names><problems>");
            var labels = new HashSet<String>();
            for (ContestProblem item : selected) {
                String label = PolygonPackageReader.label(item.label);
                if (!labels.add(label)) throw invalid("重复题号 " + label);
                Problem p = item.problemId == null ? null : problems.selectById(item.problemId);
                if (p == null || Boolean.TRUE.equals(p.isDeleted)) throw invalid(label + "：原题已删除，无法导出完整数据");
                if (p.communicationConfig != null && !p.communicationConfig.isBlank()) throw invalid(label + "：暂不支持导出通信题");
                List<ProblemTestCase> all = cases.selectByProblemId(p.id);
                List<ProblemTestCase> hidden = all.stream().filter(t -> !Boolean.TRUE.equals(t.sample)).toList();
                if (hidden.isEmpty() || hidden.size() > 5000) throw invalid(label + "：导出需要 1 至 5000 个隐藏测试");
                var samples = all.stream().filter(t -> Boolean.TRUE.equals(t.sample)).map(t -> new ProblemSampleCaseRequest(t.inputData, t.outputData, t.explanation)).toList();
                var caseScores = scores.selectList(new QueryWrapper<ContestProblemCaseScore>().eq("contest_id", id).eq("problem_id", item.id));
                String base = "problems/" + label + "/";
                manifest.append("<problem index=\"").append(escape(label)).append("\" url=\"").append(base.substring(0, base.length() - 1)).append("\"/>");
                StringBuilder descriptor = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><problem short-name=\"")
                    .append(label).append("\" revision=\"1\"><names><name language=\"english\" value=\"").append(escape(p.title))
                    .append("\"/></names><statements><statement language=\"english\" type=\"text/html\" path=\"statements/english/problem.html\"/></statements>")
                    .append("<judging input-file=\"\" output-file=\"\"><testset name=\"tests\"><time-limit>").append(p.timeLimit)
                    .append("</time-limit><memory-limit>").append(p.memoryLimit.longValue() * 1024 * 1024)
                    .append("</memory-limit><test-count>").append(hidden.size()).append("</test-count><input-path-pattern>tests/%03d</input-path-pattern>")
                    .append("<answer-path-pattern>tests/%03d.a</answer-path-pattern><tests>");
                for (int i = 0; i < hidden.size(); i++) {
                    var test = hidden.get(i);
                    int fallback = 100 / hidden.size() + (i < 100 % hidden.size() ? 1 : 0);
                    int points = caseScores.stream().filter(s -> Objects.equals(s.caseNo, test.caseNo)).map(s -> s.score).filter(Objects::nonNull).findFirst().orElse(fallback);
                    boolean sample = samples.stream().anyMatch(s -> Objects.equals(s.input(), test.inputData) && Objects.equals(s.output(), test.outputData));
                    descriptor.append("<test method=\"manual\" sample=\"").append(sample).append("\" points=\"").append(points).append("\"/>");
                    String stem = String.format(java.util.Locale.ROOT, "tests/%03d", i + 1);
                    put(zip, base + stem, test.inputData, total);
                    put(zip, base + stem + ".a", test.outputData, total);
                }
                descriptor.append("</tests></testset></judging><files><resources><file path=\"files/testlib.h\" type=\"h.g++\"/></resources></files>")
                    .append("<assets><checker type=\"testlib\"><source path=\"files/check.cpp\" type=\"cpp.g++\"/></checker></assets></problem>");
                put(zip, base + "problem.xml", descriptor.toString(), total);
                String html = "<!doctype html><html><head><meta charset=\"UTF-8\"><title>" + escape(p.title) + "</title></head><body>" + nullToEmpty(p.statement)
                    + (nullToEmpty(p.inputFormat).isBlank() ? "" : "<h2>Input</h2>" + p.inputFormat)
                    + (nullToEmpty(p.outputFormat).isBlank() ? "" : "<h2>Output</h2>" + p.outputFormat) + "</body></html>";
                put(zip, base + "statements/english/problem.html", html, total);
                put(zip, base + "qoj-samples.json", json.writeValueAsString(samples), total);
                put(zip, base + "files/check.cpp", nullToEmpty(p.checkerSource).isBlank() ? DEFAULT_CHECKER : p.checkerSource, total);
                try (var header = getClass().getResourceAsStream("/judge/testlib.h")) {
                    if (header == null) throw new IllegalStateException("缺少 testlib.h");
                    put(zip, base + "files/testlib.h", header.readAllBytes(), total);
                }
            }
            manifest.append("</problems></contest>");
            put(zip, "contest.xml", manifest.toString(), total);
            zip.finish();
            return output.toByteArray();
        } catch (BizException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Polygon 导出失败", e); }
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s; }
    private static void put(ZipOutputStream zip, String path, String content, long[] total) throws java.io.IOException {
        put(zip, path, nullToEmpty(content).getBytes(StandardCharsets.UTF_8), total);
    }
    private static void put(ZipOutputStream zip, String path, byte[] bytes, long[] total) throws java.io.IOException {
        total[0] += bytes.length;
        if (bytes.length > 16 * 1024 * 1024 || total[0] > PolygonPackageReader.MAX_BYTES) throw invalid("导出包超过 64MiB 或单文件超过 16MiB");
        zip.putNextEntry(new ZipEntry(path)); zip.write(bytes); zip.closeEntry();
    }

    // Matches QOJ's default whitespace-separated token comparison.
    private static final String DEFAULT_CHECKER = """
        #include "testlib.h"
        int main(int argc, char* argv[]) {
            registerTestlibCmd(argc, argv);
            while (!ans.seekEof()) {
                if (ouf.seekEof() || ouf.readToken() != ans.readToken()) quitf(_wa, "Token mismatch");
            }
            if (!ouf.seekEof()) quitf(_wa, "Extra output");
            quitf(_ok, "Tokens match");
        }
        """;
}

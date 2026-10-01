package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.vo.AdminChatFileVO;
import com.qoj.module.problem.dto.ProblemDraftBasicRequest;
import com.qoj.module.problem.dto.ProblemDraftTestCasesRequest;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.service.ProblemDraftService;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reviewable plans keep original case data separate from model-generated statement metadata. */
@Service
public class AdminChatImportService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final AdminChatFileService files;
    private final ProblemDraftService drafts;
    private final Validator validator;
    private final org.springframework.beans.factory.ObjectProvider<AdminChatAgentService> agent;

    public AdminChatImportService(JdbcTemplate jdbc, ObjectMapper json, AdminChatFileService files,
                                  ProblemDraftService drafts, Validator validator,
                                  org.springframework.beans.factory.ObjectProvider<AdminChatAgentService> agent) {
        this.jdbc = jdbc; this.json = json; this.files = files; this.drafts = drafts; this.validator = validator;
        this.agent = agent;
    }

    public Plan preview(PreviewRequest request) {
        if (!Boolean.FALSE.equals(request.useAi())) return agent.getObject().preparePlan(request);
        long owner = files.ownerId();
        if (request.fileIds().stream().distinct().count() != request.fileIds().size()) throw new BizException(400, "上传文件重复");
        var metadata = files.validate(owner, "user", request.fileIds().stream().map(id -> new AdminChatFileVO(id, null, null, null)).toList(), false);
        String sourceKey = sourceKey(request.fileIds(), request.instructions());
        var existing = jdbc.query("SELECT id, plan_json, result_json FROM admin_ai_chat_imports WHERE owner_admin_id = ? AND source_key = ?",
            (rs, row) -> new StoredPlan(rs.getString("id"), rs.getString("plan_json"), rs.getString("result_json")), owner, sourceKey);
        if (!existing.isEmpty()) return readPlan(existing.get(0));

        var sources = new ArrayList<Source>();
        var warnings = new ArrayList<String>();
        for (var file : metadata) {
            var bundle = files.bundle(owner, file.id());
            warnings.addAll(bundle.warnings());
            for (var entry : bundle.entries()) sources.add(new Source(new Reference(file.id(), entry.path()), entry));
        }
        var anchors = new LinkedHashMap<String, List<Source>>();
        for (var source : sources) {
            if (isMetadata(source.entry().path())) anchors.computeIfAbsent(parent(source.entry().path()), key -> new ArrayList<>()).add(source);
        }
        if (anchors.isEmpty()) {
            for (var source : sources) if (isStatement(source)) anchors.computeIfAbsent(parent(source.entry().path()), key -> new ArrayList<>());
        }
        if (anchors.isEmpty()) anchors.put("", new ArrayList<>());
        if (anchors.size() > 20) throw new BizException(400, "一次最多整理 20 道题，请分批上传");
        var grouped = new LinkedHashMap<String, List<Source>>();
        for (String anchor : anchors.keySet()) grouped.put(anchor, new ArrayList<>());
        for (var source : sources) {
            String best = anchors.keySet().stream().filter(anchor -> anchor.isEmpty() || source.entry().path().startsWith(anchor + "/"))
                .max(Comparator.comparingInt(String::length)).orElse(null);
            if (best == null && anchors.size() == 1) best = anchors.keySet().iterator().next();
            if (best == null) { warnings.add(source.entry().path() + " 未匹配到题目目录，请核对归属后单独上传"); continue; }
            grouped.get(best).add(source);
        }
        var candidates = new ArrayList<Candidate>();
        for (var group : grouped.entrySet()) {
            var groupWarnings = new ArrayList<String>();
            var meta = group.getValue().stream().filter(source -> isMetadata(source.entry().path())).toList();
            var documents = group.getValue().stream().filter(this::isStatement).toList();
            String fallbackTitle = group.getKey().isBlank() ? (documents.isEmpty() ? metadata.get(0).name() : leaf(documents.get(0).entry().path())) : leaf(group.getKey());
            JsonNode parsed = json.createObjectNode();
            if (meta.size() > 1) groupWarnings.add("同目录存在多份题目 JSON，请核对题面和测试数据是否属于同一题");
            if (!meta.isEmpty()) {
                try { parsed = json.readTree(meta.get(0).entry().text()); }
                catch (Exception e) { groupWarnings.add("题目 JSON 解析失败，请手动补充题面"); }
            }
            String documentText = documents.stream().map(source -> source.entry().text()).collect(java.util.stream.Collectors.joining("\n\n"));
            if (documents.size() > 1 && meta.isEmpty()) groupWarnings.add("同目录包含多份文档，请核对是否混入其他题目或题解");
            ProblemDraftBasicRequest basic = basic(parsed, fallbackTitle, documentText, groupWarnings);
            var mappings = pair(group.getValue(), groupWarnings);
            if (mappings.isEmpty()) groupWarnings.add("没有找到输入测试文件，请同时上传 .in/.out、.ans 或 input/output 文本数据");
            if (basic.statement().isBlank()) groupWarnings.add("缺少题面，请在导入前填写");
            var options = group.getValue().stream().filter(source -> caseKind(source.entry().path()) != null && source.entry().kind().equals("text"))
                .map(source -> new CaseOption(source.reference(), source.entry().size(), caseKind(source.entry().path()))).toList();
            candidates.add(new Candidate(UUID.randomUUID().toString(), basic, mappings, options,
                group.getValue().stream().map(source -> source.reference()).toList(), List.copyOf(groupWarnings)));
        }
        return savePlan(owner, sourceKey, metadata, candidates, warnings);
    }

    public Plan createAgentPlan(List<AdminChatFileVO> metadata, JsonNode analysis, String instructions) {
        long owner = files.ownerId();
        metadata = files.validate(owner, "user", metadata, false);
        var sources = new ArrayList<Source>();
        var warnings = new ArrayList<String>();
        for (var file : metadata) {
            var bundle = files.bundle(owner, file.id());
            warnings.addAll(bundle.warnings());
            for (var entry : bundle.entries()) sources.add(new Source(new Reference(file.id(), entry.path()), entry));
        }
        var candidates = candidates(sources, warnings, analysis);
        String key = sourceKey(metadata.stream().map(AdminChatFileVO::id).toList(), "ReAct\n" + instructions + "\n" + write(analysis));
        return savePlan(owner, key, metadata, candidates, warnings);
    }

    public Plan detail(String id) {
        var rows = jdbc.query("SELECT id, plan_json, result_json FROM admin_ai_chat_imports WHERE id = ? AND owner_admin_id = ?",
            (rs, row) -> new StoredPlan(rs.getString("id"), rs.getString("plan_json"), rs.getString("result_json")), id, files.ownerId());
        if (rows.isEmpty()) throw new BizException(404, "导入方案不存在");
        return readPlan(rows.get(0));
    }

    private List<Candidate> candidates(List<Source> sources, List<String> warnings, JsonNode response) {
        if (response == null || !response.path("problems").isArray() || response.path("problems").isEmpty()) throw new BizException(502, "AI 未识别出题目，请补充题面或说明文件内容后重试");
        if (response.path("problems").size() > 20) throw new BizException(400, "一次最多整理 20 道题，请分批上传");
        if (response.path("warnings").isArray()) for (var warning : response.path("warnings")) warnings.add(warning.asText());
        warnings.add("AI 已识别题目分组与数据配对，请核对后导入；测试原文不由 AI 生成");
        var candidates = new ArrayList<Candidate>();
        var usedInputs = new java.util.HashSet<Reference>();
        for (var problem : response.path("problems")) {
            var candidateWarnings = new ArrayList<String>();
            var selectedSources = new java.util.LinkedHashSet<Reference>();
            if (problem.path("sources").isArray()) for (var source : problem.path("sources")) {
                int index = source.asInt(-1) - 1;
                if (index >= 0 && index < sources.size()) selectedSources.add(sources.get(index).reference());
                else candidateWarnings.add("AI 引用了不存在的文件，已忽略，请核对");
            }
            var mappings = new ArrayList<CaseMapping>();
            if (problem.path("testCases").isArray()) for (var mapping : problem.path("testCases")) {
                int inputIndex = mapping.path("input").asInt(-1) - 1;
                int outputIndex = mapping.path("output").asInt(-1) - 1;
                if (inputIndex < 0 || inputIndex >= sources.size() || !sources.get(inputIndex).entry().kind().equals("text")) throw new BizException(502, "AI 返回了无效的测试输入引用，请重试");
                var input = sources.get(inputIndex).reference();
                if (!usedInputs.add(input)) throw new BizException(502, "AI 将同一个测试输入分配了多次，请重试");
                Reference output = outputIndex >= 0 && outputIndex < sources.size() && sources.get(outputIndex).entry().kind().equals("text") ? sources.get(outputIndex).reference() : null;
                selectedSources.add(input);
                if (output != null) selectedSources.add(output);
                else candidateWarnings.add(input.path() + " 尚未找到唯一答案，请手动选择或补充原文件");
                mappings.add(new CaseMapping(mappings.size() + 1, input, output));
            }
            if (mappings.size() > 200) throw new BizException(400, "每题最多 200 个测试点，请分批整理");
            if (selectedSources.isEmpty() && response.path("problems").size() == 1) sources.forEach(source -> selectedSources.add(source.reference()));
            var group = sources.stream().filter(source -> selectedSources.contains(source.reference())).toList();
            String rawText = group.stream().filter(this::isStatement).map(source -> source.entry().text()).collect(java.util.stream.Collectors.joining("\n\n"));
            var basic = basic(problem.path("basic"), "待整理题目", rawText, candidateWarnings);
            if (basic.statement().isBlank()) candidateWarnings.add("缺少题面，请在导入前填写");
            if (mappings.isEmpty()) candidateWarnings.add("缺少测试输入，请补充数据文件后重新解析");
            var outputs = mappings.stream().map(CaseMapping::output).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());
            var inputs = mappings.stream().map(CaseMapping::input).collect(java.util.stream.Collectors.toSet());
            var options = group.stream().filter(source -> source.entry().kind().equals("text") && !isMetadata(source.entry().path()))
                .map(source -> new CaseOption(source.reference(), source.entry().size(), inputs.contains(source.reference()) ? "input" : outputs.contains(source.reference()) ? "output" : "file")).toList();
            candidates.add(new Candidate(UUID.randomUUID().toString(), basic, List.copyOf(mappings), options, List.copyOf(selectedSources), List.copyOf(candidateWarnings)));
        }
        for (var source : sources) if ("input".equals(caseKind(source.entry().path())) && !usedInputs.contains(source.reference())) warnings.add(source.entry().path() + " 未被 AI 分配到题目，请核对并单独整理");
        return List.copyOf(candidates);
    }

    private Plan savePlan(long owner, String sourceKey, List<AdminChatFileVO> metadata, List<Candidate> candidates, List<String> warnings) {
        var plan = new Plan(UUID.randomUUID().toString(), metadata, List.copyOf(candidates), List.copyOf(warnings), List.of());
        try {
            jdbc.update("INSERT INTO admin_ai_chat_imports (id, owner_admin_id, source_key, plan_json) VALUES (?, ?, ?, ?)", plan.id(), owner, sourceKey, write(plan));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            var row = jdbc.query("SELECT id, plan_json, result_json FROM admin_ai_chat_imports WHERE owner_admin_id = ? AND source_key = ?",
                (rs, index) -> new StoredPlan(rs.getString("id"), rs.getString("plan_json"), rs.getString("result_json")), owner, sourceKey);
            if (row.isEmpty()) throw e;
            return readPlan(row.get(0));
        }
        return plan;
    }

    @Transactional
    public ImportResult commit(String id, CommitRequest request) {
        long owner = files.ownerId();
        var rows = jdbc.query("SELECT id, plan_json, result_json FROM admin_ai_chat_imports WHERE id = ? AND owner_admin_id = ? FOR UPDATE",
            (rs, row) -> new StoredPlan(rs.getString("id"), rs.getString("plan_json"), rs.getString("result_json")), id, owner);
        if (rows.isEmpty()) throw new BizException(404, "导入预览不存在，请重新整理");
        var stored = rows.get(0);
        if (stored.result() != null) return read(stored.result(), ImportResult.class);
        Plan plan = readPlan(stored);
        var sourceEntries = new HashMap<Reference, AdminChatFileParser.Entry>();
        for (var file : plan.files()) for (var entry : files.bundle(owner, file.id()).entries()) sourceEntries.put(new Reference(file.id(), entry.path()), entry);
        var selections = new java.util.HashSet<String>();
        var results = new ArrayList<Imported>();
        for (Selection selection : request.selections()) {
            var candidate = plan.candidates().stream().filter(item -> item.key().equals(selection.key())).findFirst()
                .orElseThrow(() -> new BizException(400, "候选题目不属于本次预览"));
            if (!selections.add(selection.key())) throw new BizException(400, "候选题目重复");
            ProblemDraftBasicRequest submitted = selection.basic();
            var basic = new ProblemDraftBasicRequest(submitted.title(), submitted.timeLimit(), submitted.memoryLimit(), submitted.statement(),
                submitted.inputFormat(), submitted.outputFormat(), submitted.checkerSource(), submitted.tags(), submitted.difficulty(), request.folderId(),
                false, submitted.accessScope(), submitted.majorId(), "DRAFT", submitted.samples());
            var violations = validator.validate(basic);
            if (!violations.isEmpty()) throw new BizException(400, violations.iterator().next().getMessage());
            List<CaseMapping> mappings = selection.testCases() == null ? candidate.testCases() : selection.testCases();
            if (mappings.isEmpty() || mappings.size() > 200) throw new BizException(400, "每题需要 1～200 个测试点");
            var testCases = new ArrayList<ProblemTestCaseRequest>();
            var usedInputs = new java.util.HashSet<Reference>();
            var allowed = candidate.caseOptions().stream().map(CaseOption::reference).collect(java.util.stream.Collectors.toSet());
            long totalBytes = 0;
            for (var mapping : mappings) {
                if (mapping.input() == null || !allowed.contains(mapping.input()) || !usedInputs.add(mapping.input())) throw new BizException(400, "测试输入无效或重复");
                var input = sourceEntries.get(mapping.input());
                if (input == null || !input.kind().equals("text")) throw new BizException(400, "测试输入文件不属于本题");
                var output = mapping.output() == null ? null : sourceEntries.get(mapping.output());
                if (mapping.output() != null && (!allowed.contains(mapping.output()) || output == null || !output.kind().equals("text"))) throw new BizException(400, "测试答案文件不属于本题");
                totalBytes += input.size() + (output == null ? 0 : output.size());
                if (totalBytes > AdminChatFileParser.MAX_BYTES) throw new BizException(400, "每题测试数据不能超过 50 MB");
                if ((output == null || output.text().isBlank()) && (basic.checkerSource() == null || basic.checkerSource().isBlank())) throw new BizException(400, "测试点 " + (testCases.size() + 1) + " 缺少有效答案，请补充原始答案文件或特殊判题源码");
                testCases.add(new ProblemTestCaseRequest(testCases.size() + 1, input.text(), output == null ? "" : output.text()));
            }
            String draftId = drafts.createDraft().draftId();
            drafts.saveBasic(draftId, basic);
            drafts.saveTestCases(draftId, new ProblemDraftTestCasesRequest(testCases));
            var problem = drafts.commit(draftId);
            results.add(new Imported(problem.id(), problem.title(), testCases.size(), "DRAFT"));
        }
        var result = new ImportResult(id, List.copyOf(results));
        jdbc.update("UPDATE admin_ai_chat_imports SET result_json = ? WHERE id = ? AND owner_admin_id = ?", write(result), id, owner);
        return result;
    }

    private List<CaseMapping> pair(List<Source> sources, List<String> warnings) {
        var inputs = new ArrayList<Source>();
        var outputs = new HashMap<String, List<Source>>();
        for (var source : sources) {
            String kind = caseKind(source.entry().path());
            if (kind == null || !source.entry().kind().equals("text")) continue;
            if (kind.equals("input")) inputs.add(source);
            else outputs.computeIfAbsent(caseKey(source.entry().path()), key -> new ArrayList<>()).add(source);
        }
        inputs.sort(Comparator.comparing(source -> naturalKey(caseKey(source.entry().path()))));
        var usedKeys = new java.util.HashSet<String>();
        var result = new ArrayList<CaseMapping>();
        var usedOutputs = new java.util.HashSet<Reference>();
        for (var input : inputs) {
            String key = caseKey(input.entry().path());
            List<Source> matches = outputs.getOrDefault(key, List.of());
            if (!usedKeys.add(key)) warnings.add(input.entry().path() + " 与其他输入具有相同配对标识，已分别保留，请核对");
            Reference output = matches.size() == 1 ? matches.get(0).reference() : null;
            if (matches.isEmpty()) warnings.add(input.entry().path() + " 缺少配套答案");
            if (matches.size() > 1) warnings.add(input.entry().path() + " 匹配到多个答案，请手动选择");
            if (output != null) usedOutputs.add(output);
            result.add(new CaseMapping(result.size() + 1, input.reference(), output));
        }
        for (var group : outputs.values()) for (var output : group) if (!usedOutputs.contains(output.reference())) warnings.add(output.entry().path() + " 尚未匹配输入，请核对");
        return List.copyOf(result);
    }

    private String caseKind(String path) {
        String ext = AdminChatFileParser.extension(path);
        if (ext.equals("in")) return "input";
        if (Set.of("out", "ans").contains(ext)) return "output";
        String stem = leaf(path).replaceFirst("\\.[^.]+$", "").toLowerCase(Locale.ROOT);
        if (ext.equals("txt") && stem.matches("(?:input|in)[-_ ]*\\d+")) return "input";
        if (ext.equals("txt") && stem.matches("(?:output|out|answer|ans)[-_ ]*\\d+")) return "output";
        return null;
    }

    private String caseKey(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        String directory = parent(lower).replaceAll("(?:^|/)(?:inputs?|outputs?|answers?|in|out|ans)(?=/|$)", "").replaceAll("/+", "/").replaceAll("^/|/$", "");
        String stem = leaf(lower).replaceFirst("\\.[^.]+$", "").replaceFirst("^(?:input|output|answer|in|out|ans)[-_ ]*(?=\\d)", "");
        stem = Pattern.compile("\\d+").matcher(stem).replaceAll(match -> new java.math.BigInteger(match.group()).toString());
        return directory + "/" + stem;
    }

    private String naturalKey(String value) {
        return Pattern.compile("\\d+").matcher(value).replaceAll(match -> String.format("%020d", new java.math.BigInteger(match.group())));
    }

    private boolean isMetadata(String path) { return leaf(path).equalsIgnoreCase("problem.json") || leaf(path).equalsIgnoreCase("题目.json"); }
    private boolean isStatement(Source source) {
        String leaf = leaf(source.entry().path()).toLowerCase(Locale.ROOT);
        String ext = AdminChatFileParser.extension(leaf);
        return !Set.of("unreadable", "unsupported").contains(source.entry().kind()) && caseKind(source.entry().path()) == null
            && Set.of("md", "markdown", "txt", "html", "htm", "pdf", "docx", "xlsx", "xls", "tex").contains(ext)
            && !leaf.matches("(?:readme|solution|editorial|题解|说明|答案)(?:[._ -].*)?");
    }

    private ProblemDraftBasicRequest basic(JsonNode node, String fallbackTitle, String documentText, List<String> warnings) {
        if (node == null || !node.isObject()) node = json.createObjectNode();
        var samples = new ArrayList<ProblemSampleCaseRequest>();
        if (node.path("samples").isArray()) for (var sample : node.path("samples")) samples.add(new ProblemSampleCaseRequest(sample.path("input").asText(""), sample.path("output").asText(""), sample.path("explanation").asText(null)));
        var tags = new ArrayList<String>();
        if (node.path("tags").isArray()) for (var tag : node.path("tags")) if (tag.isTextual()) tags.add(tag.asText());
        if (!node.has("timeLimit") || !node.has("memoryLimit")) warnings.add("未提供完整时间/内存限制，暂按 1000 ms / 256 MB 填充，请核对");
        String statement = node.path("statement").asText("");
        if (statement.isBlank() && !documentText.isBlank()) statement = "<div style=\"white-space:pre-wrap\">" + documentText.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</div>";
        return new ProblemDraftBasicRequest(node.path("title").asText(fallbackTitle.replaceFirst("\\.[^.]+$", "")),
            node.path("timeLimit").asInt(1000), node.path("memoryLimit").asInt(256), statement,
            node.path("inputFormat").asText(""), node.path("outputFormat").asText(""), node.path("checkerSource").asText(null),
            tags, node.path("difficulty").asInt(1), null, false, null, null, "DRAFT", samples);
    }

    private String parent(String path) { int slash = path.lastIndexOf('/'); return slash < 0 ? "" : path.substring(0, slash); }
    private String leaf(String path) { return path.substring(path.lastIndexOf('/') + 1); }
    private String sourceKey(List<String> ids, String instructions) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((String.join(",", ids.stream().sorted().toList()) + "\n" + (instructions == null ? "" : instructions.trim())).getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private Plan readPlan(StoredPlan stored) {
        Plan plan = read(stored.plan(), Plan.class);
        return stored.result() == null ? plan : new Plan(plan.id(), plan.files(), plan.candidates(), plan.warnings(), read(stored.result(), ImportResult.class).problems());
    }
    private <T> T read(String value, Class<T> type) {
        try { return json.readValue(value, type); } catch (Exception e) { throw new BizException(500, "导入计划读取失败"); }
    }
    private String write(Object value) {
        try { return json.writeValueAsString(value); } catch (Exception e) { throw new BizException(500, "导入计划保存失败"); }
    }

    public record PreviewRequest(@NotEmpty @Size(max = 4) List<@NotBlank String> fileIds, Boolean useAi, @Size(max = 12000) String instructions) {}
    public record Reference(@NotBlank String fileId, @NotBlank String path) {}
    public record CaseMapping(Integer caseNo, @NotNull @Valid Reference input, @Valid Reference output) {}
    public record CaseOption(Reference reference, long size, String kind) {}
    public record Candidate(String key, ProblemDraftBasicRequest basic, List<CaseMapping> testCases, List<CaseOption> caseOptions, List<Reference> sources, List<String> warnings) {}
    public record Plan(String id, List<AdminChatFileVO> files, List<Candidate> candidates, List<String> warnings, List<Imported> imported) {}
    public record Selection(@NotBlank String key, @NotNull @Valid ProblemDraftBasicRequest basic, @Size(max = 200) List<@NotNull @Valid CaseMapping> testCases) {}
    public record CommitRequest(@NotEmpty @Size(max = 20) List<@NotNull @Valid Selection> selections, Long folderId) {}
    public record Imported(Long id, String title, int testCaseCount, String status) {}
    public record ImportResult(String id, List<Imported> problems) {}
    private record Source(Reference reference, AdminChatFileParser.Entry entry) {}
    private record StoredPlan(String id, String plan, String result) {}
}

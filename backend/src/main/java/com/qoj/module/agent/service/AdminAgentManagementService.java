package com.qoj.module.agent.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qoj.common.exception.BizException;
import com.qoj.module.announcement.dto.AnnouncementCreateRequest;
import com.qoj.module.announcement.dto.AnnouncementUpdateRequest;
import com.qoj.module.announcement.service.AnnouncementService;
import com.qoj.module.contest.dto.ContestCreateRequest;
import com.qoj.module.contest.dto.ContestProblemCaseScoreRequest;
import com.qoj.module.contest.dto.ContestProblemRequest;
import com.qoj.module.contest.dto.ContestUpdateRequest;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.practice.dto.PracticeCreateRequest;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.problem.dto.ProblemFolderRequest;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.ProblemUpdateRequest;
import com.qoj.module.problem.service.ProblemFolderService;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.problem.vo.AdminProblemVO;
import com.qoj.module.problem.vo.ProblemSampleCaseVO;
import com.qoj.security.CurrentUser;
import jakarta.validation.Validator;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Explicit, typed admin actions exposed to the chat agent. */
@Service
public class AdminAgentManagementService {
    private static final Set<String> PROBLEM_FIELDS = Set.of("title", "statement", "inputFormat", "outputFormat",
        "timeLimit", "memoryLimit", "difficulty", "tags", "folderId", "checkerSource", "samples",
        "accessScope", "majorId", "studentPublishStatus", "isPublic");
    private static final Set<String> CONTEST_FIELDS = Set.of("title", "description", "durationMinutes", "startTime",
        "endTime", "type", "audience", "audienceId", "audiences", "frozen", "freezeTime",
        "enableRollingScoreboard", "goldRatio", "silverRatio", "bronzeRatio", "allowAfterEndSubmit",
        "allowAfterEndViewProblem", "allowAfterEndViewCode", "enableCodeTemplates", "publicScoreboardEnabled",
        "showClassOnScoreboard", "allowStarRegistration", "allowViewAllSubmissions", "registrationType",
        "registrationPassword", "status");
    private final ContestService contests;
    private final ProblemService problems;
    private final ProblemFolderService folders;
    private final AnnouncementService announcements;
    private final PracticeService practices;
    private final ObjectMapper json;
    private final Validator validator;

    public AdminAgentManagementService(ContestService contests, ProblemService problems, ProblemFolderService folders,
                                       AnnouncementService announcements, PracticeService practices,
                                       ObjectMapper json, Validator validator) {
        this.contests = contests;
        this.problems = problems;
        this.folders = folders;
        this.announcements = announcements;
        this.practices = practices;
        this.json = json;
        this.validator = validator;
    }

    public Object contest(JsonNode args) {
        requireAdmin();
        String operation = args.path("operation").asText();
        long id = args.path("contestId").asLong(-1);
        return switch (operation) {
            case "create" -> {
                JsonNode data = object(args, "data");
                var request = checked(data, ContestCreateRequest.class);
                yield contests.create(request);
            }
            case "update" -> {
                positive(id, "contestId");
                JsonNode data = object(args, "data");
                onlyFields(data, CONTEST_FIELDS);
                yield contests.update(id, checked(data, ContestUpdateRequest.class));
            }
            case "add_problem", "update_problem", "remove_problem" -> changeContestProblem(id, operation, args);
            case "add_registration" -> {
                positive(id, "contestId");
                long userId = args.path("userId").asLong(-1);
                positive(userId, "userId");
                yield contests.addRegistration(id, userId, args.has("starred") ? args.path("starred").asBoolean() : null);
            }
            default -> throw new BizException(400, "不支持该比赛操作");
        };
    }

    private Object changeContestProblem(long contestId, String operation, JsonNode args) {
        positive(contestId, "contestId");
        long problemId = args.path("problemId").asLong(-1);
        positive(problemId, "problemId");
        var existing = contests.adminProblems(contestId);
        var requests = new ArrayList<ContestProblemRequest>();
        boolean found = false;
        for (var item : existing) {
            var old = new ContestProblemRequest(item.problemId(), item.label(), item.score(), item.displayOrder(),
                item.caseScores().stream().map(score -> new ContestProblemCaseScoreRequest(score.caseNo(), score.score())).toList());
            if (!item.problemId().equals(problemId)) {
                requests.add(old);
                continue;
            }
            found = true;
            if (operation.equals("add_problem")) throw new BizException(409, "题目已在比赛中");
            if (operation.equals("update_problem")) requests.add(problemConfig(args, old, requests.size() + 1));
        }
        if (!found && !operation.equals("add_problem")) throw new BizException(404, "比赛中没有该题目");
        if (operation.equals("add_problem")) requests.add(problemConfig(args, null, requests.size() + 1));
        ObjectNode update = json.createObjectNode();
        update.set("problems", json.valueToTree(requests));
        var result = contests.update(contestId, checked(update, ContestUpdateRequest.class));
        return Map.of("contestId", contestId, "problemCount", requests.size(), "problems", result.problems());
    }

    private ContestProblemRequest problemConfig(JsonNode args, ContestProblemRequest old, int order) {
        long id = args.path("problemId").asLong();
        String label = args.has("label") ? args.path("label").asText() : old == null ? label(order) : old.label();
        if (label.isBlank() || label.length() > 20) throw new BizException(400, "比赛题目标识无效");
        int score = args.has("score") ? args.path("score").asInt() : old == null ? 0 : old.score() == null ? 0 : old.score();
        int displayOrder = args.has("displayOrder") ? args.path("displayOrder").asInt()
            : old == null || old.displayOrder() == null ? order : old.displayOrder();
        if (score < 0 || displayOrder < 1) throw new BizException(400, "比赛题目分数或顺序无效");
        List<ContestProblemCaseScoreRequest> caseScores = args.has("caseScores")
            ? json.convertValue(args.path("caseScores"), new TypeReference<List<ContestProblemCaseScoreRequest>>() {})
            : old == null ? List.<ContestProblemCaseScoreRequest>of() : old.caseScores();
        return new ContestProblemRequest(id, label, score, displayOrder, caseScores);
    }

    private static String label(int order) {
        int n = order;
        StringBuilder result = new StringBuilder();
        while (n > 0) { n--; result.insert(0, (char) ('A' + n % 26)); n /= 26; }
        return result.toString();
    }

    public Object editProblem(JsonNode args) {
        requireAdmin();
        long id = args.path("problemId").asLong(-1);
        positive(id, "problemId");
        JsonNode changes = object(args, "changes");
        onlyFields(changes, PROBLEM_FIELDS);
        if (!(problems.detail(id) instanceof AdminProblemVO current)) throw new BizException(403, "无权编辑该题目");
        ObjectNode full = json.createObjectNode();
        full.put("title", current.title()); full.put("statement", current.statement());
        full.put("inputFormat", current.inputFormat()); full.put("outputFormat", current.outputFormat());
        full.set("timeLimit", json.valueToTree(current.timeLimit()));
        full.set("memoryLimit", json.valueToTree(current.memoryLimit()));
        full.set("difficulty", json.valueToTree(current.difficulty()));
        full.set("tags", json.valueToTree(current.tags()));
        full.set("folderId", json.valueToTree(current.folderId()));
        full.set("samples", json.valueToTree((current.samples() == null ? List.<ProblemSampleCaseVO>of() : current.samples()).stream().map(sample ->
            new ProblemSampleCaseRequest(sample.input(), sample.output(), sample.explanation())).toList()));
        full.set("isPublic", json.valueToTree(current.isPublic()));
        full.set("studentPublishStatus", json.valueToTree(current.studentPublishStatus()));
        full.set("accessScope", json.valueToTree(current.accessScope()));
        full.set("majorId", json.valueToTree(current.majorId()));
        changes.fields().forEachRemaining(entry -> full.set(entry.getKey(), entry.getValue()));
        var saved = problems.update(id, checked(full, ProblemUpdateRequest.class));
        return Map.of("id", saved.id(), "title", saved.title(), "studentPublishStatus", String.valueOf(saved.studentPublishStatus()),
            "sampleCount", saved.samples() == null ? 0 : saved.samples().size(),
            "testCaseCount", saved.testCaseCount() == null ? 0 : saved.testCaseCount());
    }

    public Object testCase(JsonNode args) {
        requireAdmin();
        long problemId = args.path("problemId").asLong(-1);
        positive(problemId, "problemId");
        return switch (args.path("operation").asText()) {
            case "add" -> problems.addTestCase(problemId, checked(object(args, "data"), ProblemTestCaseRequest.class));
            case "update" -> {
                long caseId = args.path("caseId").asLong(-1);
                positive(caseId, "caseId");
                yield problems.updateTestCase(problemId, caseId, checked(object(args, "data"), ProblemTestCaseRequest.class));
            }
            case "remove" -> {
                long caseId = args.path("caseId").asLong(-1);
                positive(caseId, "caseId");
                problems.deleteTestCase(problemId, caseId);
                yield Map.of("problemId", problemId, "removedCaseId", caseId);
            }
            default -> throw new BizException(400, "不支持该测试点操作");
        };
    }

    public Object folder(JsonNode args) {
        requireAdmin();
        String operation = args.path("operation").asText();
        long id = args.path("folderId").asLong(-1);
        return switch (operation) {
            case "create" -> folders.create(checked(object(args, "data"), ProblemFolderRequest.class));
            case "update" -> {
                positive(id, "folderId");
                var current = folders.detail(id);
                ObjectNode merged = json.createObjectNode();
                merged.put("name", current.name()); merged.put("description", current.description());
                merged.set("displayOrder", json.valueToTree(current.displayOrder()));
                merged.set("accessScope", json.valueToTree(current.accessScope()));
                merged.set("majorId", json.valueToTree(current.majorId()));
                JsonNode changes = object(args, "data");
                onlyFields(changes, Set.of("name", "description", "displayOrder", "accessScope", "majorId"));
                changes.fields().forEachRemaining(entry -> merged.set(entry.getKey(), entry.getValue()));
                yield folders.update(id, checked(merged, ProblemFolderRequest.class));
            }
            case "add_problem", "remove_problem" -> {
                positive(id, "folderId");
                long problemId = args.path("problemId").asLong(-1);
                positive(problemId, "problemId");
                var ids = new ArrayList<>(folders.detail(id).problems().stream().map(item -> item.id()).toList());
                boolean present = ids.contains(problemId);
                if (operation.equals("add_problem") && !present) ids.add(problemId);
                if (operation.equals("remove_problem") && present) ids.remove(problemId);
                folders.replaceProblems(id, ids);
                yield Map.of("folderId", id, "problemIds", ids);
            }
            default -> throw new BizException(400, "不支持该题目文件夹操作");
        };
    }

    public Object announcement(JsonNode args) {
        requireAdmin();
        return switch (args.path("operation").asText()) {
            case "create" -> {
                var data = object(args, "data");
                var request = checked(data, AnnouncementCreateRequest.class);
                if (!data.has("isVisible")) request.isVisible = false;
                long id = announcements.create(request, CurrentUser.required());
                yield announcements.getById(id);
            }
            case "update" -> {
                long id = args.path("announcementId").asLong(-1);
                positive(id, "announcementId");
                JsonNode data = object(args, "data");
                onlyFields(data, Set.of("title", "content", "isVisible", "isPinned"));
                announcements.update(id, checked(data, AnnouncementUpdateRequest.class));
                yield announcements.getById(id);
            }
            default -> throw new BizException(400, "不支持该公告操作");
        };
    }

    public Object practice(JsonNode args) {
        requireAdmin();
        return switch (args.path("operation").asText()) {
            case "create" -> practices.create(checked(object(args, "data"), PracticeCreateRequest.class));
            case "update" -> {
                long id = args.path("practiceId").asLong(-1);
                positive(id, "practiceId");
                yield practices.update(id, checked(object(args, "data"), PracticeCreateRequest.class));
            }
            default -> throw new BizException(400, "不支持该练习操作");
        };
    }

    public Object query(String kind, long id, int page, int size) {
        requireAdmin();
        return switch (kind) {
            case "contest_problems" -> contests.adminProblems(id);
            case "announcements" -> announcements.listForAdmin(page, size);
            case "announcement" -> announcements.getById(id);
            case "practices" -> practices.adminList(page, size);
            default -> throw new BizException(400, "不支持该查询类型");
        };
    }

    private <T> T checked(JsonNode node, Class<T> type) {
        T value = json.convertValue(node, type);
        var violations = validator.validate(value);
        if (!violations.isEmpty()) throw new BizException(400, violations.iterator().next().getMessage());
        return value;
    }

    private static JsonNode object(JsonNode args, String field) {
        JsonNode value = args.path(field);
        if (!value.isObject() || value.isEmpty()) throw new BizException(400, field + " 必须是非空对象");
        return value;
    }

    private static void onlyFields(JsonNode changes, Set<String> allowed) {
        Set<String> unknown = new HashSet<>();
        changes.fieldNames().forEachRemaining(name -> { if (!allowed.contains(name)) unknown.add(name); });
        if (!unknown.isEmpty()) throw new BizException(400, "不支持的字段：" + String.join(", ", unknown));
    }

    private static void positive(long id, String name) {
        if (id <= 0) throw new BizException(400, name + " 必须是正整数");
    }

    private static void requireAdmin() {
        if (!CurrentUser.required().isAdmin()) throw new BizException(403, "仅超级管理员可使用后台管理工具");
    }
}

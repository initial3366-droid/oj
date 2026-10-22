package com.qoj.module.agent.service;

import com.qoj.module.classroom.dto.*;
import com.qoj.module.contest.service.*;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestRegistrationMapper;
import com.qoj.module.course.dto.CourseRequest;
import com.qoj.module.course.service.CourseService;
import com.qoj.module.practice.dto.PracticePublicationRequest;
import com.qoj.module.practice.service.PracticePublicationService;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.submission.service.SubmissionQueueService;
import com.qoj.module.submission.service.SubmissionService;
import com.qoj.module.teacher.dto.MajorRequest;
import com.qoj.module.teacher.service.MajorService;
import com.qoj.module.team.service.TeamService;
import com.qoj.module.user.dto.UserCreateRequest;
import com.qoj.module.user.dto.UserUpdateRequest;
import com.qoj.module.user.service.UserAdminService;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import jakarta.validation.Validator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Bounded admin operations for the agent. HTTP controller permissions are repeated where services do not enforce them. */
@Service
public class AdminAgentOperationsService {
    private final ContestService contests;
    private final ContestMapper contestMapper;
    private final ContestRegistrationMapper registrations;
    private final ContestAccessPolicy contestPolicy;
    private final ContestAcmRankService acmRanks;
    private final ContestOiRankService oiRanks;
    private final ContestScoreboardSnapshotService snapshots;
    private final ContestRollingService rolling;
    private final SubmissionService submissions;
    private final SubmissionQueueService queue;
    private final PracticeService practices;
    private final PracticePublicationService publications;
    private final UserAdminService users;
    private final ClassRoomService classrooms;
    private final TeamService teams;
    private final MajorService majors;
    private final CourseService courses;
    private final SystemSettingService settings;
    private final ObjectMapper json;
    private final Validator validator;

    public AdminAgentOperationsService(ContestService contests, ContestMapper contestMapper,
            ContestRegistrationMapper registrations, ContestAccessPolicy contestPolicy,
            ContestAcmRankService acmRanks, ContestOiRankService oiRanks,
            ContestScoreboardSnapshotService snapshots, ContestRollingService rolling,
            SubmissionService submissions, SubmissionQueueService queue,
            PracticeService practices, PracticePublicationService publications,
            UserAdminService users, ClassRoomService classrooms, TeamService teams,
            MajorService majors, CourseService courses, SystemSettingService settings,
            ObjectMapper json, Validator validator) {
        this.contests = contests; this.contestMapper = contestMapper; this.registrations = registrations;
        this.contestPolicy = contestPolicy; this.acmRanks = acmRanks; this.oiRanks = oiRanks;
        this.snapshots = snapshots; this.rolling = rolling; this.submissions = submissions; this.queue = queue;
        this.practices = practices; this.publications = publications; this.users = users;
        this.classrooms = classrooms; this.teams = teams; this.majors = majors; this.courses = courses;
        this.settings = settings; this.json = json; this.validator = validator;
    }

    public Object contestInspection(JsonNode a) {
        admin();
        long contestId = id(a, "contestId");
        Contest contest = contestPermission(contestId, Permission.UPDATE);
        int page = page(a);
        int pageSize = a.path("pageSize").asInt(5);
        if (pageSize < 1 || pageSize > 10) throw bad("pageSize 必须在 1 到 10 之间");
        var stats = queue.stats(contestId, null, null, null, null, null, null);
        if (!(stats.get("waiting") instanceof Number)) throw new BizException(403, "无权查看巡查统计");
        var systemErrors = submissions.adminList(page, pageSize, null, null, null, null, contestId,
            null, null, null, "SE", null, null, null, null, "updatedAt", "desc");
        var failed = submissions.adminList(page, pageSize, null, null, null, null, contestId,
            null, null, null, "FAILED", null, null, null, null, "updatedAt", "desc");
        long failures = systemErrors.total() + failed.total();
        long accepted = contests.adminProblems(contestId).stream().mapToLong(problem -> problem.acceptedCount()).sum();
        var alerts = new ArrayList<Map<String, Object>>();
        if (failures > 0) alerts.add(Map.of("level", "error", "message", "发现 SE / FAILED 系统失败提交，请检查错误日志与判题服务。", "count", failures));
        long waiting = ((Number) stats.get("waiting")).longValue();
        if (waiting > 0) alerts.add(Map.of("level", "info", "message", "当前有提交等待判题；若持续积压，请检查本场判题队列。", "count", waiting));
        return Map.of("contestId", contestId, "title", contest.title,
            "updatedAt", LocalDateTime.now(), "queueStats", stats,
            "acceptedCount", accepted, "acceptedCountMeaning", "按选手与比赛题目去重，同一选手同一题重复 AC 只计一次",
            "systemFailureCount", failures, "alerts", alerts,
            "systemErrors", systemErrors, "failedSubmissions", failed);
    }

    public Object contestRead(JsonNode a) {
        admin();
        long id = id(a, "contestId");
        return switch (a.path("kind").asText()) {
            case "registration_candidates" -> contests.registrationCandidates(id, string(a, "keyword"));
            case "registrations" -> {
                contestPermission(id, Permission.MANAGE_REGISTRATION);
                yield registrations.selectList(new QueryWrapper<ContestRegistration>()
                    .eq("contest_id", id).eq("status", "APPROVED").orderByDesc("registered_at").last("LIMIT 50"))
                    .stream().map(r -> Map.of("id", r.id, "userId", r.userId,
                        "username", r.username == null ? "" : r.username,
                        "displayName", r.displayName == null ? "" : r.displayName,
                        "starred", Boolean.TRUE.equals(r.starred), "status", r.status)).toList();
            }
            case "rank" -> {
                Contest contest = contestPermission(id, Permission.UPDATE);
                String mode = contest.scoringMode != null ? contest.scoringMode : contest.type;
                yield "OI".equalsIgnoreCase(mode) ? oiRanks.getRankList(id).stream().limit(50).toList()
                    : acmRanks.getRankList(id).stream().limit(50).toList();
            }
            case "scoreboard" -> { contestPermission(id, Permission.UPDATE); yield contests.scoreboardForAdminExport(id); }
            case "snapshot" -> { contestPermission(id, Permission.UPDATE); yield snapshots.getSnapshot(id, enumValue(a, "snapshotType", Set.of("FROZEN", "FINAL", "CUSTOM"))); }
            case "rolling" -> rolling.getState(id);
            default -> throw bad("不支持的比赛查询");
        };
    }

    public Object contestManage(JsonNode a) {
        admin();
        long id = id(a, "contestId");
        return switch (a.path("operation").asText()) {
            case "remove_registration" -> { contests.removeRegistration(id, id(a, "registrationId")); yield Map.of("contestId", id, "removed", true); }
            case "rebuild_rank" -> {
                contestPermission(id, Permission.UPDATE);
                String mode = enumValue(a, "mode", Set.of("ACM", "OI"));
                if ("OI".equals(mode)) oiRanks.rebuildRank(id); else acmRanks.rebuildRank(id);
                yield Map.of("contestId", id, "mode", mode, "rebuilt", true);
            }
            case "replay" -> contests.replay(id);
            case "create_snapshot" -> { contestPermission(id, Permission.UPDATE); yield snapshots.createSnapshot(id, enumValue(a, "snapshotType", Set.of("FROZEN", "FINAL", "CUSTOM"))); }
            case "rolling_start" -> rolling.start(id);
            case "rolling_next" -> rolling.step(id, "next");
            case "rolling_previous" -> rolling.step(id, "previous");
            case "rolling_finish" -> rolling.finish(id);
            default -> throw bad("不支持的比赛操作");
        };
    }

    public Object publishFinalScoreboard(JsonNode a) { admin(); return rolling.publishFinal(id(a, "contestId")); }

    public Object submissionRead(JsonNode a) {
        admin();
        return switch (a.path("kind").asText()) {
            case "detail" -> submissions.adminDetail(id(a, "submissionId"));
            case "code" -> Map.of("submissionId", id(a, "submissionId"), "code", submissions.adminCode(id(a, "submissionId")));
            case "queue_detail" -> queue.detail(id(a, "queueId"), false);
            case "queue_logs" -> queue.logs(id(a, "queueId"));
            case "queue_stats" -> queue.stats(optionalId(a, "contestId"), optionalId(a, "problemId"), optionalId(a, "userId"),
                string(a, "language"), string(a, "judgeServer"), null, null);
            case "queue_list" -> queue.list(page(a), size(a), optionalId(a, "contestId"), optionalId(a, "problemId"),
                optionalId(a, "userId"), string(a, "language"), string(a, "status"), string(a, "judgeServer"),
                null, null, null, null, false);
            default -> throw bad("不支持的提交查询");
        };
    }

    public Object submissionManage(JsonNode a) {
        admin();
        return switch (a.path("operation").asText()) {
            case "rejudge_submission" -> submissions.adminRejudge(id(a, "submissionId"));
            case "rejudge_queue" -> queue.rejudge(id(a, "queueId"));
            case "cancel_queue" -> queue.cancel(id(a, "queueId"));
            case "set_priority" -> {
                int priority = a.path("priority").asInt(-1);
                if (priority < 0 || priority > 1000) throw bad("priority 必须在 0 到 1000 之间");
                yield queue.updatePriority(id(a, "queueId"), priority);
            }
            default -> throw bad("不支持的提交操作");
        };
    }

    public Object practiceRead(JsonNode a) {
        admin();
        return switch (a.path("kind").asText()) {
            case "report" -> practices.report(id(a, "practiceId"));
            case "publications" -> {
                Long courseId = optionalId(a, "courseId"), practiceId = optionalId(a, "practiceId");
                var values = publications.allPublications().stream()
                    .filter(value -> courseId == null || Objects.equals(value.courseId(), courseId))
                    .filter(value -> practiceId == null || Objects.equals(value.sourcePracticeId(), practiceId))
                    .toList();
                yield new PageResult<>(values.size(),
                    values.stream().skip((long) (page(a) - 1) * size(a)).limit(size(a)).toList());
            }
            case "publication" -> publications.managementDetail(id(a, "publicationId"));
            case "publication_report" -> publications.publicationReport(id(a, "publicationId"));
            default -> throw bad("不支持的练习查询");
        };
    }

    public Object copyPractice(JsonNode a) { admin(); return practices.copy(id(a, "practiceId")); }
    public Object publishPractice(JsonNode a) {
        admin();
        var request = checked(a.path("data"), PracticePublicationRequest.class);
        if (request.courseId() == null) throw bad("请选择所属课程后发布题单");
        if (request.startTime() == null || request.endTime() == null) throw bad("请设置题单开始时间和截止时间");
        return publications.publish(id(a, "practiceId"), request);
    }
    public Object updatePublication(JsonNode a) { admin(); return publications.update(id(a, "publicationId"), checked(a.path("data"), PracticePublicationRequest.class)); }

    public Object courseRead(JsonNode a) {
        admin();
        return switch (a.path("kind").asText()) {
            case "list" -> courses.list(true, page(a), size(a), string(a, "keyword"));
            case "detail" -> courses.detail(id(a, "courseId"), true);
            case "practices" -> publications.coursePublications(id(a, "courseId"));
            case "report" -> courses.report(id(a, "courseId"));
            default -> throw bad("不支持的课程查询");
        };
    }

    public Object courseManage(JsonNode a) {
        admin();
        String operation = a.path("operation").asText();
        if ("archive".equals(operation)) {
            long courseId = id(a, "courseId");
            courses.archive(courseId);
            return courses.detail(courseId, true);
        }
        if (!Set.of("create", "update").contains(operation)) throw bad("不支持的课程操作");
        JsonNode data = a.path("data");
        fields(data, Set.of("title", "description", "term", "status", "classIds"));
        var merged = json.createObjectNode();
        long courseId = "update".equals(operation) ? id(a, "courseId") : 0;
        if ("update".equals(operation)) {
            var current = courses.detail(courseId, true);
            merged.put("title", current.title());
            merged.put("description", current.description());
            merged.put("term", current.term());
            merged.put("status", current.status());
            merged.set("classIds", json.valueToTree(current.classIds()));
        } else {
            merged.put("status", "DRAFT");
            merged.set("classIds", json.createArrayNode());
        }
        // classIds=[] explicitly clears associations; null must not silently fall back to legacy classId.
        if (data.has("classIds") && !data.path("classIds").isArray()) throw bad("classIds 必须是数组");
        data.fields().forEachRemaining(entry -> merged.set(entry.getKey(), entry.getValue()));
        var request = checked(merged, CourseRequest.class);
        return "create".equals(operation) ? courses.create(request) : courses.update(courseId, request);
    }

    public Object peopleRead(JsonNode a) {
        admin();
        return switch (a.path("kind").asText()) {
            case "users" -> users.list(page(a), size(a), string(a, "role"), string(a, "keyword"));
            case "user" -> users.detail(id(a, "userId"));
            case "classes" -> classrooms.adminList(string(a, "keyword"));
            case "class" -> classrooms.adminDetail(id(a, "classId"));
            case "teachers" -> classrooms.listTeachers(string(a, "keyword"));
            case "teams" -> teams.list();
            case "majors" -> majors.list(string(a, "keyword"), a.path("activeOnly").asBoolean(false));
            default -> throw bad("不支持的人员组织查询");
        };
    }

    public Object peopleManage(JsonNode a) {
        admin();
        JsonNode data = a.path("data");
        return switch (a.path("operation").asText()) {
            case "create_user" -> users.create(checked(data, UserCreateRequest.class));
            case "update_user" -> { fields(data, Set.of("username", "displayName", "studentNo", "email", "role")); yield users.update(id(a, "userId"), checked(data, UserUpdateRequest.class)); }
            case "create_class" -> classrooms.adminCreate(checked(data, ClassRoomCreateRequest.class));
            case "update_class" -> { fields(data, Set.of("name", "description", "teacherId", "joinEnabled", "approvalRequired")); yield classrooms.adminUpdate(id(a, "classId"), checked(data, ClassRoomUpdateRequest.class)); }
            case "create_teacher" -> classrooms.createTeacher(checked(data, TeacherCreateRequest.class));
            case "update_teacher" -> { fields(data, Set.of("username", "displayName", "teacherNo", "email", "majorId", "status")); yield classrooms.updateTeacher(id(a, "teacherId"), checked(data, TeacherUpdateRequest.class)); }
            case "create_team" -> teams.create(requiredString(data, "name"));
            case "rename_team" -> teams.rename(id(a, "teamId"), requiredString(data, "name"));
            case "add_team_member" -> teams.addMember(id(a, "teamId"), id(a, "userId"));
            case "remove_team_member" -> teams.removeMember(id(a, "teamId"), id(a, "userId"));
            case "create_major" -> majors.create(checked(data, MajorRequest.class));
            case "update_major" -> { fields(data, Set.of("code", "name", "status")); yield majors.update(id(a, "majorId"), checked(data, MajorRequest.class)); }
            default -> throw bad("不支持的人员组织操作");
        };
    }

    public Object maintenanceMode(JsonNode a) {
        admin();
        if (!a.has("enabled") || !a.path("enabled").isBoolean()) throw bad("enabled 必须是布尔值");
        settings.updateMaintenanceMode(a.path("enabled").asBoolean(), CurrentUser.required());
        return Map.of("maintenanceMode", settings.getFrontendSettings().maintenanceMode);
    }

    private Contest contestPermission(long id, Permission permission) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) throw new BizException(404, "比赛不存在");
        if (!contestPolicy.can(CurrentUser.required(), permission, contest)) throw new BizException(403, "无权操作该比赛");
        return contest;
    }
    private <T> T checked(JsonNode node, Class<T> type) {
        if (!node.isObject()) throw bad("data 必须是对象");
        T value = json.convertValue(node, type);
        var violations = validator.validate(value);
        if (!violations.isEmpty()) throw bad(violations.iterator().next().getMessage());
        return value;
    }
    private static void fields(JsonNode data, Set<String> allowed) {
        if (!data.isObject() || data.isEmpty()) throw bad("data 必须是非空对象");
        data.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw bad("不支持的字段：" + field); });
    }
    private static String requiredString(JsonNode node, String key) {
        String value = node.path(key).asText("").trim();
        if (value.isBlank()) throw bad(key + " 不能为空");
        return value;
    }
    private static String enumValue(JsonNode a, String key, Set<String> allowed) {
        String value = a.path(key).asText("").toUpperCase();
        if (!allowed.contains(value)) throw bad(key + " 无效");
        return value;
    }
    private static long id(JsonNode a, String key) {
        long value = a.path(key).asLong(-1);
        if (value <= 0) throw bad(key + " 必须是正整数");
        return value;
    }
    private static Long optionalId(JsonNode a, String key) { return a.hasNonNull(key) ? id(a, key) : null; }
    private static int page(JsonNode a) { return Math.max(1, a.path("page").asInt(1)); }
    private static int size(JsonNode a) { return Math.max(1, Math.min(50, a.path("pageSize").asInt(20))); }
    private static String string(JsonNode a, String key) { return a.hasNonNull(key) ? a.path(key).asText() : null; }
    private static BizException bad(String message) { return new BizException(400, message); }
    private static void admin() { if (!CurrentUser.required().isAdmin()) throw new BizException(403, "仅超级管理员可使用后台管理工具"); }
}

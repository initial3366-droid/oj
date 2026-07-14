package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestRegistrationMapper;
import com.qoj.module.contest.vo.ContestScoreboardCellVO;
import com.qoj.module.contest.vo.ContestScoreboardProblemVO;
import com.qoj.module.contest.vo.ContestScoreboardRowVO;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.audit.AuditLogger;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.stereotype.Service;

/**
 * 比赛Inspection导出业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ContestInspectionExportService {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ContestMapper contestMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestRegistrationMapper contestRegistrationMapper;
    private final SubmissionMapper submissionMapper;
    private final UserMapper userMapper;
    private final ContestService contestService;
    private final ContestAccessPolicy contestAccessPolicy;
    private final AuditLogger auditLogger;

    /**
     * 构造 比赛Inspection导出Service 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public ContestInspectionExportService(
        ContestMapper contestMapper,
        ContestProblemMapper contestProblemMapper,
        ContestRegistrationMapper contestRegistrationMapper,
        SubmissionMapper submissionMapper,
        UserMapper userMapper,
        ContestService contestService,
        ContestAccessPolicy contestAccessPolicy,
        AuditLogger auditLogger
    ) {
        this.contestMapper = contestMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestRegistrationMapper = contestRegistrationMapper;
        this.submissionMapper = submissionMapper;
        this.userMapper = userMapper;
        this.contestService = contestService;
        this.contestAccessPolicy = contestAccessPolicy;
        this.auditLogger = auditLogger;
    }

    public byte[] scoreboardCsv(long contestId) {
        Contest contest = requireManageContest(contestId);
        ContestScoreboardVO scoreboard = contestService.scoreboardForAdminExport(contestId);
        auditLogger.logPermissionAllowed(CurrentUser.required(), Permission.MANAGE_SCOREBOARD, "Contest", contest.id, "导出比赛排行榜");
        /**
         * 封装withBom相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withBom(scoreboardCsvText(scoreboard));
    }

    public byte[] submissionsZip(long contestId) {
        Contest contest = requireManageContest(contestId);
        ContestScoreboardVO scoreboard = contestService.scoreboardForAdminExport(contestId);
        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("contest_id", contest.id)
                .orderByAsc("user_id")
                .orderByAsc("submit_time")
                .orderByAsc("id")
        );
        Map<Long, ContestProblem> contestProblems = contestProblemMap(contest.id);
        auditLogger.logPermissionAllowed(CurrentUser.required(), Permission.VIEW_CODE, "Contest", contest.id, "导出比赛提交代码");

        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            putText(zip, "scoreboard.csv", scoreboardCsvText(scoreboard));
            putText(zip, "submissions.csv", submissionsCsvText(submissions, contestProblems));
            for (Submission submission : submissions) {
                putText(zip, codeEntryName(submission, contestProblems), submission.code == null ? "" : submission.code);
            }
            zip.finish();
            return output.toByteArray();
        } catch (IOException ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.INTERNAL_ERROR.getCode(), "导出提交代码失败");
        }
    }

    public byte[] registrationUsersCsv(long contestId) {
        Contest contest = requireManageRegistrationContest(contestId);
        List<ContestRegistration> registrations = contestRegistrationMapper.selectList(
            new QueryWrapper<ContestRegistration>()
                .eq("contest_id", contest.id)
                .eq("status", "APPROVED")
                .orderByDesc("registered_at")
                .orderByDesc("id")
        );
        Set<Long> userIds = registrations.stream()
            .map(registration -> registration.userId)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Map<Long, User> usersById = userIds.isEmpty()
            ? Map.of()
            : userMapper.selectBatchIds(userIds).stream()
                .collect(java.util.stream.Collectors.toMap(user -> user.id, user -> user));
        auditLogger.logPermissionAllowed(CurrentUser.required(), Permission.MANAGE_REGISTRATION, "Contest", contest.id, "导出比赛报名用户");
        /**
         * 封装withBom相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withBom(registrationUsersCsvText(registrations, usersById));
    }

    public String scoreboardFilename(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        String title = contest == null ? String.valueOf(contestId) : contest.title;
        return "contest-" + contestId + "-" + safeName(title) + "-scoreboard.csv";
    }

    public String submissionsZipFilename(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        String title = contest == null ? String.valueOf(contestId) : contest.title;
        return "contest-" + contestId + "-" + safeName(title) + "-submissions.zip";
    }

    public String registrationUsersFilename(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        String title = contest == null ? String.valueOf(contestId) : contest.title;
        return "contest-" + contestId + "-" + safeName(title) + "-registration-users.csv";
    }

    private Contest requireManageContest(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        AuthUser authUser = CurrentUser.required();
        if (!contestAccessPolicy.can(authUser, Permission.MANAGE_SCOREBOARD, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权导出该比赛数据");
        }
        return contest;
    }

    private Contest requireManageRegistrationContest(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        AuthUser authUser = CurrentUser.required();
        if (!contestAccessPolicy.can(authUser, Permission.MANAGE_REGISTRATION, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权导出该比赛报名数据");
        }
        return contest;
    }

    private String scoreboardCsvText(ContestScoreboardVO scoreboard) {
        StringBuilder builder = new StringBuilder();
        builder.append(csvLine(scoreboardHeader(scoreboard.problems())));
        for (ContestScoreboardRowVO row : scoreboard.rows()) {
            java.util.ArrayList<String> values = new java.util.ArrayList<>();
            values.add(String.valueOf(row.rank()));
            values.add(String.valueOf(row.userId()));
            values.add(row.displayName());
            values.add(String.valueOf(row.solved()));
            values.add(String.valueOf(row.penalty()));
            values.add(String.valueOf(row.score()));
            values.add(formatTime(row.lastAcceptedAt()));
            values.add(row.identityType());
            values.add(row.identityId() == null ? "" : String.valueOf(row.identityId()));
            Map<Long, ContestScoreboardCellVO> cells = new HashMap<>();
            row.cells().forEach(cell -> cells.put(cell.problemId(), cell));
            for (ContestScoreboardProblemVO problem : scoreboard.problems()) {
                ContestScoreboardCellVO cell = cells.get(problem.problemId());
                values.add(cell == null || !Boolean.TRUE.equals(cell.accepted()) ? "" : "AC");
                values.add(cell == null || cell.attempts() == null ? "0" : String.valueOf(cell.attempts()));
                values.add(cell == null || cell.score() == null ? "0" : String.valueOf(cell.score()));
                values.add(cell == null ? "" : formatTime(cell.acceptedAt()));
            }
            builder.append(csvLine(values));
        }
        return builder.toString();
    }

    private List<String> scoreboardHeader(List<ContestScoreboardProblemVO> problems) {
        java.util.ArrayList<String> headers = new java.util.ArrayList<>(
            List.of("排名", "用户ID", "用户", "AC/解决数", "罚时", "总分", "最后AC时间", "身份类型", "身份ID")
        );
        for (ContestScoreboardProblemVO problem : problems) {
            String label = problem.label() == null ? String.valueOf(problem.problemId()) : problem.label();
            headers.add(label + "状态");
            headers.add(label + "提交次数");
            headers.add(label + "分数");
            headers.add(label + "AC时间");
        }
        return headers;
    }

    private String submissionsCsvText(List<Submission> submissions, Map<Long, ContestProblem> contestProblems) {
        StringBuilder builder = new StringBuilder();
        builder.append(csvLine(List.of(
            "提交ID",
            "用户ID",
            "用户名",
            "显示名称",
            "题目标签",
            "题目ID",
            "比赛题目ID",
            "语言",
            "状态",
            "分数",
            "运行时间ms",
            "运行内存KB",
            "提交时间",
            "判题开始",
            "判题结束",
            "代码长度"
        )));
        for (Submission submission : submissions) {
            User user = submission.userId == null ? null : userMapper.selectById(submission.userId);
            ContestProblem contestProblem = contestProblemFor(submission, contestProblems);
            builder.append(csvLine(List.of(
                text(submission.id),
                text(submission.userId),
                user == null ? "" : text(user.username),
                user == null ? "" : text(user.displayName),
                contestProblem == null ? "" : text(contestProblem.label),
                text(submission.problemId),
                text(submission.contestProblemId),
                text(submission.language),
                text(submission.status),
                text(submission.score),
                text(submission.timeUsed),
                text(submission.memoryUsed),
                formatTime(submissionTime(submission)),
                formatTime(submission.judgeStartTime),
                formatTime(submission.judgeEndTime),
                text(submission.codeLength == null && submission.code != null ? submission.code.length() : submission.codeLength)
            )));
        }
        return builder.toString();
    }

    private String registrationUsersCsvText(List<ContestRegistration> registrations, Map<Long, User> usersById) {
        StringBuilder builder = new StringBuilder();
        builder.append(csvLine(List.of(
            "id",
            "username",
            "student_no",
            "email",
            "role",
            "class_id",
            "display_name",
            "created_at",
            "updated_at"
        )));
        Set<Long> exportedUserIds = new LinkedHashSet<>();
        for (ContestRegistration registration : registrations) {
            if (registration.userId == null || !exportedUserIds.add(registration.userId)) {
                continue;
            }
            User user = usersById.get(registration.userId);
            if (user == null) {
                continue;
            }
            builder.append(csvLine(List.of(
                text(user.id),
                text(user.username),
                text(user.studentNo),
                text(user.email),
                text(user.role),
                text(user.classId),
                text(user.displayName),
                formatTime(user.createdAt),
                formatTime(user.updatedAt)
            )));
        }
        return builder.toString();
    }

    private Map<Long, ContestProblem> contestProblemMap(long contestId) {
        Map<Long, ContestProblem> result = new HashMap<>();
        List<ContestProblem> contestProblems = contestProblemMapper.selectList(
            new QueryWrapper<ContestProblem>().eq("contest_id", contestId)
        );
        for (ContestProblem problem : contestProblems) {
            result.put(problem.id, problem);
            result.put(problem.problemId, problem);
        }
        return result;
    }

    private ContestProblem contestProblemFor(Submission submission, Map<Long, ContestProblem> contestProblems) {
        if (submission.contestProblemId != null && contestProblems.containsKey(submission.contestProblemId)) {
            return contestProblems.get(submission.contestProblemId);
        }
        return submission.problemId == null ? null : contestProblems.get(submission.problemId);
    }

    private String codeEntryName(Submission submission, Map<Long, ContestProblem> contestProblems) {
        User user = submission.userId == null ? null : userMapper.selectById(submission.userId);
        ContestProblem contestProblem = contestProblemFor(submission, contestProblems);
        String userPart = "user-" + text(submission.userId) + "-" + safeName(user == null ? "" : user.username);
        String label = contestProblem == null || contestProblem.label == null ? "problem-" + text(submission.problemId) : contestProblem.label;
        String filename = "submission-" + submission.id + "-" + safeName(label) + "-" + safeName(submission.status) + extension(submission.language);
        return "codes/" + userPart + "/" + filename;
    }

    private void putText(ZipOutputStream zip, String name, String content) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        zip.putNextEntry(entry);
        byte[] payload = name.endsWith(".csv")
            ? withBom(content)
            : content.getBytes(StandardCharsets.UTF_8);
        zip.write(payload);
        zip.closeEntry();
    }

    private byte[] withBom(String text) {
        byte[] payload = text.getBytes(StandardCharsets.UTF_8);
        byte[] output = new byte[payload.length + 3];
        output[0] = (byte) 0xEF;
        output[1] = (byte) 0xBB;
        output[2] = (byte) 0xBF;
        System.arraycopy(payload, 0, output, 3, payload.length);
        return output;
    }

    private String csvLine(List<String> values) {
        return values.stream().map(this::csv).collect(java.util.stream.Collectors.joining(",")) + "\n";
    }

    private String csv(String value) {
        String safe = value == null ? "" : value;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private String formatTime(LocalDateTime time) {
        return time == null ? "" : TIME_FORMAT.format(time);
    }

    private LocalDateTime submissionTime(Submission submission) {
        return submission.submitTime == null ? submission.createdAt : submission.submitTime;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safeName(String value) {
        String normalized = (value == null ? "" : value).trim().replaceAll("[^A-Za-z0-9._-]+", "_");
        if (normalized.isBlank()) {
            return "data";
        }
        return normalized.length() > 80 ? normalized.substring(0, 80) : normalized;
    }

    private String extension(String language) {
        String normalized = language == null ? "" : language.toLowerCase(Locale.ROOT);
        if (normalized.contains("python") || normalized.equals("py")) return ".py";
        if (normalized.contains("java")) return ".java";
        if (normalized.contains("c++") || normalized.contains("cpp")) return ".cpp";
        if (normalized.equals("c")) return ".c";
        if (normalized.contains("javascript") || normalized.equals("js")) return ".js";
        if (normalized.contains("typescript") || normalized.equals("ts")) return ".ts";
        return ".txt";
    }
}

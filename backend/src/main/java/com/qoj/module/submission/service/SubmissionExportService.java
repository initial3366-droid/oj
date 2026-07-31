package com.qoj.module.submission.service;

import com.qoj.module.submission.vo.AdminSubmissionVO;
import com.qoj.security.AuthUser;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 管理端提交记录 CSV 导出服务。
 *
 * <p>沿用项目现有导出风格（见 ContestInspectionExportService）：手写 CSV + UTF-8 BOM，
 * 确保中文表头在 Excel/WPS 中正确显示。导出字段为 AdminSubmissionVO 的主体列（不含 code 与 cases）。
 */
@Service
public class SubmissionExportService {
    /** 导出条数上限，避免一次性拉取过大结果集 */
    public static final int EXPORT_LIMIT = 50000;

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final SubmissionService submissionService;

    /**
     * 构造 提交导出Service 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public SubmissionExportService(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    /**
     * 按当前过滤条件导出提交记录 CSV 字节流。
     */
    public byte[] exportSubmissionsCsv(
        Long id,
        Long userId,
        Long classId,
        Long problemId,
        Long contestId,
        Long contestProblemId,
        Long practiceId,
        String language,
        String status,
        String judgeServer,
        String identityType,
        LocalDateTime from,
        LocalDateTime to,
        String sortBy,
        String sortOrder,
        AuthUser authUser
    ) {
        List<AdminSubmissionVO> rows = submissionService.adminExportList(
            EXPORT_LIMIT,
            id, userId, classId, problemId, contestId, contestProblemId, practiceId,
            language, status, judgeServer, identityType, from, to, sortBy, sortOrder
        );

        StringBuilder builder = new StringBuilder();
        builder.append(csvLine(List.of(
            "提交ID", "用户ID", "用户名", "显示名称",
            "题目ID", "题目", "比赛题目ID", "比赛题目标签",
            "比赛ID", "比赛名称", "题单ID", "题单名称",
            "参赛者ID", "团队ID",
            "语言", "状态", "分数", "运行时间ms", "运行内存KB",
            "通过测试点", "总测试点",
            "代码长度", "身份类型", "身份ID",
            "判题机", "优先级", "重试次数",
            "比赛提交", "封榜", "重判",
            "提交时间", "判题开始", "判题结束",
            "创建时间", "更新时间",
            "判题信息", "错误信息"
        )));
        for (AdminSubmissionVO r : rows) {
            builder.append(csvLine(List.of(
                text(r.id()),
                text(r.userId()),
                text(r.username()),
                text(r.displayName()),
                text(r.problemId()),
                text(r.problemTitle()),
                text(r.contestProblemId()),
                text(r.contestProblemLabel()),
                text(r.contestId()),
                text(r.contestTitle()),
                text(r.practiceId()),
                text(r.practiceTitle()),
                text(r.participantId()),
                text(r.teamId()),
                text(r.language()),
                text(r.status()),
                text(r.score()),
                text(r.timeUsed()),
                text(r.memoryUsed()),
                text(r.passedCaseCount()),
                text(r.totalCaseCount()),
                text(r.codeLength()),
                text(r.identityType()),
                text(r.identityId()),
                text(r.judgeServer()),
                text(r.priority()),
                text(r.retryCount()),
                boolText(r.isContestSubmission()),
                boolText(r.isFrozen()),
                boolText(r.isRejudged()),
                formatTime(r.submitTime()),
                formatTime(r.judgeStartTime()),
                formatTime(r.judgeEndTime()),
                formatTime(r.createdAt()),
                formatTime(r.updatedAt()),
                text(r.judgeMessage()),
                text(r.errorMessage())
            )));
        }
        /**
         * 封装withBom相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withBom(builder.toString());
    }

    /**
     * 生成导出文件名。仅用可控字符，避免注入与非法文件名。
     */
    public String buildFilename(AuthUser authUser, LocalDateTime from, LocalDateTime to) {
        String stamp = TIME_FORMAT.format(LocalDateTime.now()).replace(":", "").replace(" ", "-");
        return "submissions-" + stamp + ".csv";
    }

    /**
     * 封装withBom相关逻辑。直接返回当前实例保存的output，不产生额外的数据写入。
     */
    private byte[] withBom(String text) {
        byte[] payload = text.getBytes(StandardCharsets.UTF_8);
        byte[] output = new byte[payload.length + 3];
        output[0] = (byte) 0xEF;
        output[1] = (byte) 0xBB;
        output[2] = (byte) 0xBF;
        System.arraycopy(payload, 0, output, 3, payload.length);
        return output;
    }

    /**
     * 封装csvLine相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String csvLine(List<String> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(csv(values.get(i)));
        }
        sb.append("\n");
        return sb.toString();
    }

    /**
     * 封装csv相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String csv(String value) {
        String safe = value == null ? "" : value;
        return "\"" + safe.replace("\"", "\"\"").replace("\r", " ").replace("\n", " ") + "\"";
    }

    /**
     * 格式化Time。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String formatTime(LocalDateTime time) {
        return time == null ? "" : TIME_FORMAT.format(time);
    }

    /**
     * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * 封装boolText相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String boolText(Boolean value) {
        if (value == null) return "";
        return value ? "是" : "否";
    }
}

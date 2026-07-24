package com.qoj.module.agent.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.agent.dto.AgentChatRequest;
import com.qoj.module.agent.vo.AgentChatResponse;
import com.qoj.module.agent.vo.AgentQuotaVO;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

/**
 * AgentChat业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class AgentChatService {
    private static final int DAILY_QUOTA = 5;
    private static final String QUOTA_KEY_PREFIX = "oj:agent:quota:";
    private static final String QUOTA_RESET_KEY_PREFIX = "oj:agent:reset:";

    private final ProblemService problemService;
    private final ContestService contestService;
    private final SubmissionMapper submissionMapper;
    private final AgentClient agentClient;
    private final SystemSettingService settingService;
    private final StringRedisTemplate redisTemplate;
    private final ClassMemberMapper classMemberMapper;

    /**
     * 构造 AgentChatService 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public AgentChatService(
        ProblemService problemService,
        ContestService contestService,
        SubmissionMapper submissionMapper,
        AgentClient agentClient,
        SystemSettingService settingService,
        StringRedisTemplate redisTemplate,
        ClassMemberMapper classMemberMapper
    ) {
        this.problemService = problemService;
        this.contestService = contestService;
        this.submissionMapper = submissionMapper;
        this.agentClient = agentClient;
        this.settingService = settingService;
        this.redisTemplate = redisTemplate;
        this.classMemberMapper = classMemberMapper;
    }

    public AgentChatResponse chat(AgentChatRequest request) {
        AuthUser user = CurrentUser.required();
        if (user.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号不能使用前台编程助手");
        }
        if (request.contestId() != null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "比赛期间禁止使用 AI 助手");
        }

        AgentSettingsVO agent = settingService.getAgentRuntimeSettings();
        ensureAgentAvailable(agent);

        // 检查配额
        int used = getUsedCount(user.id());
        if (used >= DAILY_QUOTA) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "今日 AI 对话额度已用完（每日 " + DAILY_QUOTA + " 次）");
        }

        ProblemVO problem = loadProblem(request);
        Submission submission = loadOwnSubmission(request.submissionId(), user.id());
        String requestId = UUID.randomUUID().toString();
        String reply = agentClient.chat(
            agent,
            systemPrompt(),
            userPrompt(agent, request, problem, submission)
        );

        // 成功后增加计数
        incrementUsedCount(user.id());

        /**
         * 封装AgentChat响应相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AgentChatResponse(reply, agent.model, requestId);
    }

    public AgentQuotaVO getQuota(long userId) {
        int used = getUsedCount(userId);
        int remaining = Math.max(0, DAILY_QUOTA - used);
        /**
         * 封装AgentQuotaVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AgentQuotaVO(DAILY_QUOTA, used, remaining);
    }

    public void resetQuota(long userId) {
        String key = quotaKey(userId);
        redisTemplate.delete(key);
    }

    public void resetQuotaForClass(long classId) {
        List<ClassMember> members = classMemberMapper.selectList(
            new QueryWrapper<ClassMember>().eq("class_id", classId)
        );
        for (ClassMember member : members) {
            resetQuota(member.userId);
        }
    }

    public void resetQuotaForAll() {
        String pattern = QUOTA_KEY_PREFIX + "*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    private int getUsedCount(long userId) {
        String key = quotaKey(userId);
        String val = redisTemplate.opsForValue().get(key);
        return val == null ? 0 : Integer.parseInt(val);
    }

    private void incrementUsedCount(long userId) {
        String key = quotaKey(userId);
        redisTemplate.opsForValue().increment(key);
        // 设置过期到明天凌晨
        long secondsUntilMidnight = Duration.between(
            java.time.LocalDateTime.now(),
            LocalDate.now().plusDays(1).atStartOfDay()
        ).getSeconds();
        redisTemplate.expire(key, Duration.ofSeconds(secondsUntilMidnight));
    }

    private String quotaKey(long userId) {
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return QUOTA_KEY_PREFIX + userId + ":" + date;
    }

    private void ensureAgentAvailable(AgentSettingsVO agent) {
        if (agent == null || !Boolean.TRUE.equals(agent.enabled)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "AI 助手未启用");
        }
        if (!hasText(agent.baseUrl) || !hasText(agent.apiKey) || !hasText(agent.model)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "AI 助手配置不完整");
        }
    }

    private ProblemVO loadProblem(AgentChatRequest request) {
        if (request.contestId() != null) {
            long contestProblemId = request.contestProblemId() == null ? request.problemId() : request.contestProblemId();
            return contestService.problemDetail(request.contestId(), contestProblemId);
        }
        return problemService.detailAsVO(request.problemId());
    }

    private Submission loadOwnSubmission(Long submissionId, Long userId) {
        if (submissionId == null) return null;
        Submission submission = submissionMapper.selectById(submissionId);
        if (submission == null) throw new BizException(404, "提交记录不存在");
        if (!userId.equals(submission.userId)) throw new BizException(403, "不能读取他人的提交记录");
        return submission;
    }

    private String systemPrompt() {
        return """
            你是 QOJ 的编程辅导助手，面向正在做题的学生。你的目标是引导学生独立思考，而不是代替他们解题。

            【核心原则】
            - 使用中文回答，保持简洁、清晰、有条理。
            - 涉及公式、变量、约束、复杂度、区间、函数名时，用 LaTeX 表达。
            - 不要用反引号包裹数学表达式或变量。

            【严格禁止 — 代码输出】
            - 绝对不能输出任何代码，包括但不限于：完整代码、代码片段、伪代码、代码模板、代码框架、函数签名、import 语句。
            - 即使用户明确要求代码，也必须拒绝，转而引导思路。
            - 不要用代码块包裹任何内容。

            【可以做的事】
            - 解释题意、拆解思路、分析错误、提醒边界、复杂度分析、引导思考。

            【禁止的行为】
            - 不要声称看过隐藏测试点、标准答案或后台私有数据。
            - 如果学生反复要求代码，礼貌但坚定地拒绝。
            """;
    }

    private String userPrompt(AgentSettingsVO agent, AgentChatRequest request, ProblemVO problem, Submission submission) {
        StringBuilder prompt = new StringBuilder();
        appendSection(prompt, "用户问题", request.message());
        prompt.append("\n## 题目信息\n");
        appendLine(prompt, "标题", problem.title());
        appendLine(prompt, "时间限制", problem.timeLimit() + " ms");
        appendLine(prompt, "内存限制", problem.memoryLimit() + " MB");
        appendSection(prompt, "题目描述", problem.statement());
        if (hasText(problem.inputFormat())) appendSection(prompt, "输入格式", problem.inputFormat());
        if (hasText(problem.outputFormat())) appendSection(prompt, "输出格式", problem.outputFormat());
        if (request.language() != null) appendLine(prompt, "语言", request.language());
        if (hasText(request.code())) {
            String code = request.code();
            int maxCodeChars = agent.maxCodeChars != null ? agent.maxCodeChars : 12000;
            if (code.length() > maxCodeChars) code = code.substring(0, maxCodeChars) + "\n// ... 代码过长，已截断";
            appendSection(prompt, "用户代码", code);
        }
        if (submission != null) {
            prompt.append("\n## 最近一次提交\n");
            appendLine(prompt, "状态", String.valueOf(submission.status));
            if (submission.timeUsed != null) appendLine(prompt, "耗时", submission.timeUsed + " ms");
            if (submission.memoryUsed != null) appendLine(prompt, "内存", submission.memoryUsed + " KB");
        }
        prompt.append("\n请根据以上信息回答用户问题。");
        return prompt.toString();
    }

    private void appendSection(StringBuilder sb, String title, String content) {
        if (!hasText(content)) return;
        sb.append("\n## ").append(title).append("\n").append(content.trim()).append("\n");
    }

    private void appendLine(StringBuilder sb, String label, String value) {
        if (!hasText(value)) return;
        sb.append("- ").append(label).append("：").append(value.trim()).append("\n");
    }
}

package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.submission.dto.JudgeResultCallbackRequest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.JudgeCallbackService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CcpcojJudgeGatewayService {
    public static final String SESSION_COOKIE = "QOJ_CCPCOJ_JUDGE";
    private static final Pattern TEST_DATA_PATH = Pattern.compile("^(\\d+)/(\\d+)\\.(in|out)$");
    private static final int MAX_JUDGE_MESSAGE_LENGTH = 32000;

    private final SubmissionMapper submissionMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final SystemSettingService settingService;
    private final StringRedisTemplate redisTemplate;
    private final JudgeCallbackService callbackService;
    private final JudgeMessagePublisher messagePublisher;

    public CcpcojJudgeGatewayService(
        SubmissionMapper submissionMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        ContestProblemMapper contestProblemMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        SystemSettingService settingService,
        StringRedisTemplate redisTemplate,
        JudgeCallbackService callbackService,
        JudgeMessagePublisher messagePublisher
    ) {
        this.submissionMapper = submissionMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestProblemTestCaseMapper = contestProblemTestCaseMapper;
        this.settingService = settingService;
        this.redisTemplate = redisTemplate;
        this.callbackService = callbackService;
        this.messagePublisher = messagePublisher;
    }

    public String login(String username, String password) {
        if (!settingService.verifyCcpcojJudgeCredentials(username, password)) {
            return null;
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
            RedisKeys.ccpcojJudgeSession(sessionId),
            username,
            Duration.ofMinutes(settings.ccpcojSessionTtlMinutes)
        );
        return sessionId;
    }

    public Duration sessionTtl() {
        return Duration.ofMinutes(settingService.getJudgeRuntimeSettings().ccpcojSessionTtlMinutes);
    }

    public boolean authenticated(String sessionId) {
        return sessionId != null
            && Boolean.TRUE.equals(redisTemplate.hasKey(RedisKeys.ccpcojJudgeSession(sessionId)));
    }

    public String workerId(String sessionId) {
        String username = redisTemplate.opsForValue().get(RedisKeys.ccpcojJudgeSession(sessionId));
        String suffix = sessionId == null ? "unknown" : sessionId.substring(0, Math.min(8, sessionId.length()));
        return (username == null || username.isBlank() ? "ccpcoj" : username) + "-" + suffix;
    }

    public String pending(int requestedLimit, String languageSet, String sessionId) {
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        if (!settings.enabled) {
            return "";
        }
        boolean includePractice = "ccpcoj".equalsIgnoreCase(settings.mode);
        boolean includeContest = "ccpcoj".equalsIgnoreCase(settings.contestMode);
        if (!includePractice && !includeContest) {
            return "";
        }

        int limit = Math.max(1, Math.min(Math.min(requestedLimit, settings.maxConcurrent), 100));
        Set<Integer> acceptedLanguages = parseLanguageSet(languageSet);
        if (acceptedLanguages.isEmpty()) {
            return "";
        }
        LocalDateTime staleBefore = LocalDateTime.now().minusMinutes(settings.ccpcojStaleTaskMinutes);
        List<Submission> candidates = submissionMapper.selectWaitingForCcpcoj(
            limit,
            includePractice,
            includeContest,
            isOiWorker(sessionId),
            acceptedLanguages.contains(0),
            acceptedLanguages.contains(1),
            acceptedLanguages.contains(3),
            acceptedLanguages.contains(6),
            staleBefore
        );
        return candidates.stream()
            .map(item -> String.valueOf(item.id))
            .reduce("", (left, right) -> left + right + "\n");
    }

    @Transactional
    public boolean checkout(long submissionId, String workerId) {
        if (!protocolInt(submissionId)) {
            return false;
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        LocalDateTime now = LocalDateTime.now();
        int updated = submissionMapper.claimForCcpcoj(
            submissionId,
            workerId,
            now,
            now.minusMinutes(settings.ccpcojStaleTaskMinutes)
        );
        if (updated > 0) {
            messagePublisher.submissionChanged(submissionId, "COMPILING", null, null);
            messagePublisher.submissionQueueUpdated();
        }
        return updated > 0;
    }

    public String solutionInfo(long submissionId) {
        Submission submission = submissionMapper.selectById(submissionId);
        if (!supportsProtocol(submission)) {
            return "";
        }
        long judgeProblemId = encodeProblemId(submission.problemId, submission.contestProblemId);
        return judgeProblemId + "\n"
            + submission.userId + "\n"
            + languageId(submission.language) + "\n"
            + (submission.contestId == null ? 0 : submission.contestId) + "\n";
    }

    public String sourceCode(long submissionId) {
        Submission submission = submissionMapper.selectById(submissionId);
        return submission == null || submission.code == null ? "" : submission.code + "\n";
    }

    public String problemInfo(long judgeProblemId) {
        JudgeProblem problem = loadJudgeProblem(judgeProblemId);
        if (problem == null) {
            return "";
        }
        int timeLimitMs = problem.timeLimitMs == null ? 1000 : problem.timeLimitMs;
        int memoryLimitMb = problem.memoryLimitMb == null ? 256 : problem.memoryLimitMb;
        double seconds = Math.max(1, timeLimitMs) / 1000.0;
        return seconds + "\n" + Math.max(1, memoryLimitMb) + "\n0\n";
    }

    public String testDataList(long judgeProblemId) {
        List<JudgeTestCase> testCases = loadTestCases(judgeProblemId);
        StringBuilder result = new StringBuilder();
        for (JudgeTestCase testCase : testCases) {
            long timestamp = testCase.updatedAt == null
                ? 1L
                : testCase.updatedAt.atZone(ZoneId.systemDefault()).toEpochSecond();
            result.append(timestamp).append('\n').append(testCase.caseNo).append(".in\n");
            result.append(timestamp).append('\n').append(testCase.caseNo).append(".out\n");
        }
        return result.toString();
    }

    public byte[] testData(String path) {
        Matcher matcher = TEST_DATA_PATH.matcher(path == null ? "" : path);
        if (!matcher.matches()) {
            return null;
        }
        long judgeProblemId = Long.parseLong(matcher.group(1));
        int caseNo = Integer.parseInt(matcher.group(2));
        boolean input = "in".equals(matcher.group(3));
        return loadTestCases(judgeProblemId).stream()
            .filter(item -> item.caseNo == caseNo)
            .findFirst()
            .map(item -> (input ? item.input : item.output).getBytes(StandardCharsets.UTF_8))
            .orElse(null);
    }

    @Transactional
    public void updateSolution(
        long submissionId,
        int result,
        int time,
        int memory,
        double passRate,
        String workerId
    ) {
        Submission submission = submissionMapper.selectByIdForUpdate(submissionId);
        if (!ownedBy(submission, workerId)) {
            return;
        }
        String status = status(result);
        if (result == 2 || result == 3 || result == 12) {
            submission.status = status;
            submission.timeUsed = positiveOrNull(time);
            submission.memoryUsed = positiveOrNull(memory);
            submission.judgeServer = "CCPCOJ";
            submission.updatedAt = LocalDateTime.now();
            submissionMapper.updateById(submission);
            messagePublisher.submissionChanged(submission.id, status, submission.timeUsed, submission.memoryUsed);
            return;
        }

        JudgeResultCallbackRequest request = new JudgeResultCallbackRequest();
        request.submissionId = submissionId;
        request.status = status;
        request.timeUsed = positiveOrNull(time);
        request.memoryUsed = positiveOrNull(memory);
        request.score = score(submission, passRate);
        callbackService.handleJudgeResult(request);

        Submission completed = submissionMapper.selectById(submissionId);
        if (completed == null) {
            return;
        }
        completed.judgeServer = "CCPCOJ";
        completed.judgeWorkerId = null;
        completed.updatedAt = LocalDateTime.now();
        submissionMapper.updateById(completed);
        redisTemplate.delete(RedisKeys.judgePending(
            completed.userId,
            completed.contestProblemId == null ? completed.problemId : completed.contestProblemId,
            completed.contestId
        ));
        if (completed.contestId == null) {
            updateProblemAcRate(completed.problemId);
        }
        messagePublisher.submissionChanged(completed.id, completed.status, completed.timeUsed, completed.memoryUsed);
        messagePublisher.submissionQueueUpdated();
    }

    @Transactional
    public void addJudgeMessage(long submissionId, String message, String workerId) {
        Submission submission = submissionMapper.selectByIdForUpdate(submissionId);
        if (!ownedBy(submission, workerId) || message == null || message.isBlank()) {
            return;
        }
        String combined = submission.judgeMessage == null || submission.judgeMessage.isBlank()
            ? message
            : submission.judgeMessage + "\n" + message;
        submission.judgeMessage = combined.length() <= MAX_JUDGE_MESSAGE_LENGTH
            ? combined
            : combined.substring(0, MAX_JUDGE_MESSAGE_LENGTH);
        submission.updatedAt = LocalDateTime.now();
        submissionMapper.updateById(submission);
    }

    private List<JudgeTestCase> loadTestCases(long judgeProblemId) {
        DecodedProblemId decoded = decodeProblemId(judgeProblemId);
        List<JudgeTestCase> result = new ArrayList<>();
        if (decoded.contestProblem) {
            List<ContestProblemTestCase> testCases = contestProblemTestCaseMapper.selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", decoded.id)
                    .orderByAsc("case_no")
            );
            for (ContestProblemTestCase item : testCases) {
                result.add(new JudgeTestCase(
                    item.caseNo,
                    nullToEmpty(item.inputData),
                    nullToEmpty(item.outputData),
                    item.updatedAt == null ? item.createdAt : item.updatedAt
                ));
            }
        } else {
            for (ProblemTestCase item : problemTestCaseMapper.selectByProblemId(decoded.id)) {
                result.add(new JudgeTestCase(
                    item.caseNo,
                    nullToEmpty(item.inputData),
                    nullToEmpty(item.outputData),
                    item.updatedAt == null ? item.createdAt : item.updatedAt
                ));
            }
        }
        return result;
    }

    private JudgeProblem loadJudgeProblem(long judgeProblemId) {
        DecodedProblemId decoded = decodeProblemId(judgeProblemId);
        if (decoded.contestProblem) {
            ContestProblem problem = contestProblemMapper.selectById(decoded.id);
            return problem == null ? null : new JudgeProblem(problem.timeLimit, problem.memoryLimit);
        }
        Problem problem = problemMapper.selectById(decoded.id);
        return problem == null ? null : new JudgeProblem(problem.timeLimit, problem.memoryLimit);
    }

    private long encodeProblemId(Long problemId, Long contestProblemId) {
        long sourceId = contestProblemId == null ? problemId : contestProblemId;
        long encoded = Math.multiplyExact(sourceId, 2L) + (contestProblemId == null ? 0L : 1L);
        if (encoded > Integer.MAX_VALUE) {
            throw new IllegalStateException("CCPCOJ 题目标识超出 32 位整数范围");
        }
        return encoded;
    }

    private DecodedProblemId decodeProblemId(long encoded) {
        return new DecodedProblemId(encoded / 2L, encoded % 2L == 1L);
    }

    private int languageId(String language) {
        String normalized = language == null ? "" : language.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "c" -> 0;
            case "cpp", "c++", "cxx", "g++" -> 1;
            case "java" -> 3;
            case "python", "python3", "py" -> 6;
            default -> -1;
        };
    }

    private boolean isOiWorker(String sessionId) {
        String username = redisTemplate.opsForValue().get(RedisKeys.ccpcojJudgeSession(sessionId));
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        return username != null && username.equals(settings.ccpcojJudgeUsername + "-oi");
    }

    private boolean supportsProtocol(Submission submission) {
        if (submission == null
            || !protocolInt(submission.id, false)
            || !protocolInt(submission.userId, true)
            || !protocolInt(submission.contestId, true)
            || languageId(submission.language) < 0) {
            return false;
        }
        Long sourceId = submission.contestProblemId == null
            ? submission.problemId
            : submission.contestProblemId;
        return sourceId != null && sourceId > 0 && sourceId <= 1073741823L;
    }

    private boolean protocolInt(long value) {
        return value >= 0 && value <= Integer.MAX_VALUE;
    }

    private boolean protocolInt(Long value, boolean nullable) {
        return value == null ? nullable : protocolInt(value.longValue());
    }

    private boolean ownedBy(Submission submission, String workerId) {
        return submission != null
            && workerId != null
            && workerId.equals(submission.judgeWorkerId)
            && Set.of("JUDGING", "COMPILING", "RUNNING").contains(submission.status);
    }

    private Set<Integer> parseLanguageSet(String value) {
        Set<Integer> result = new HashSet<>();
        if (value == null || value.isBlank()) {
            return result;
        }
        Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(item -> !item.isEmpty())
            .forEach(item -> {
                try {
                    result.add(Integer.parseInt(item));
                } catch (NumberFormatException ignored) {
                    // Ignore malformed worker configuration entries.
                }
            });
        return result;
    }

    private String status(int result) {
        return switch (result) {
            case 0 -> "WAITING";
            case 1 -> "REJUDGE_PENDING";
            case 2 -> "COMPILING";
            case 3, 12 -> "RUNNING";
            case 4 -> "AC";
            case 5, 6 -> "WA";
            case 7 -> "TLE";
            case 8 -> "MLE";
            case 9 -> "NOO";
            case 10 -> "RE";
            case 11 -> "CE";
            default -> "SE";
        };
    }

    private Integer score(Submission submission, double passRate) {
        int fullScore = 100;
        if (submission.contestProblemId != null) {
            ContestProblem contestProblem = contestProblemMapper.selectById(submission.contestProblemId);
            if (contestProblem != null) {
                if (contestProblem.score != null && contestProblem.score > 0) {
                    fullScore = contestProblem.score;
                } else if (contestProblem.fullScore != null && contestProblem.fullScore > 0) {
                    fullScore = contestProblem.fullScore;
                }
            }
        }
        double normalized = Math.max(0.0, Math.min(1.0, passRate));
        return (int) Math.round(fullScore * normalized);
    }

    private void updateProblemAcRate(Long problemId) {
        Long total = submissionMapper.countByProblemId(problemId);
        Long accepted = submissionMapper.countAcceptedByProblemId(problemId);
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            return;
        }
        int rate = total == null || total == 0
            ? 0
            : (int) Math.round((accepted == null ? 0 : accepted) * 100.0 / total);
        problem.acRate = BigDecimal.valueOf(rate);
        problemMapper.updateById(problem);
    }

    private Integer positiveOrNull(int value) {
        return value > 0 ? value : null;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private record JudgeProblem(Integer timeLimitMs, Integer memoryLimitMb) {
    }

    private record JudgeTestCase(int caseNo, String input, String output, LocalDateTime updatedAt) {
    }

    private record DecodedProblemId(long id, boolean contestProblem) {
    }
}

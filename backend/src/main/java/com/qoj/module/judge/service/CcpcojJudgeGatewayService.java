package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.redis.RedisKeys;
import com.qoj.common.util.Utf8TextLimiter;
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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Compatibility gateway for the pull-based CCPCOJ judge worker protocol.
 *
 * <p>The gateway is intentionally limited to queue transport. QOJ remains the
 * source of truth for submissions, contest snapshots, verdicts, and rankings.
 * Every sensitive read is tied to an active worker claim in the database.
 */
@Service
public class CcpcojJudgeGatewayService {
    public static final String SESSION_COOKIE = "QOJ_CCPCOJ_JUDGE";
    public static final int MAX_JUDGE_MESSAGE_LENGTH = 32000;
    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final int MAX_LOGIN_ATTEMPTS_PER_IP = 10;
    private static final int MAX_USERNAME_LENGTH = 63;
    private static final int MAX_PASSWORD_LENGTH = 128;
    private static final String SESSION_VALUE_SEPARATOR = "\n";
    private static final Duration LOGIN_RATE_WINDOW = Duration.ofMinutes(1);
    private static final Pattern SESSION_ID = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    private static final Pattern TEST_DATA_PATH = Pattern.compile("^(\\d+)/(\\d+)\\.(in|out)$");
    // A valid BCrypt hash keeps password verification cost stable before configuration.
    private static final String DUMMY_PASSWORD_HASH =
        "$2b$12$M0fzNdVCa8NdVNZf//sGsOc06DqpWE9d/OI//Z0llWYtaDgDu2jEa";

    private final SubmissionMapper submissionMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final SystemSettingService settingService;
    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JudgeCallbackService callbackService;
    private final JudgeMessagePublisher messagePublisher;

    /**
     * 构造 Ccpcoj判题GatewayService 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态；在状态变化后发布异步消息；可能调用外部判题或网关服务。
     */
    public CcpcojJudgeGatewayService(
        SubmissionMapper submissionMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        ContestProblemMapper contestProblemMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        SystemSettingService settingService,
        StringRedisTemplate redisTemplate,
        PasswordEncoder passwordEncoder,
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
        this.passwordEncoder = passwordEncoder;
        this.callbackService = callbackService;
        this.messagePublisher = messagePublisher;
    }

    /** Authenticates a worker under both per-IP and IP-and-username rate windows. */
    public LoginResult login(String username, String password, String remoteAddress) {
        requireCredentialShape(username, password);
        String ipRateKey = RedisKeys.ccpcojJudgeLoginIpRate(loginIpFingerprint(remoteAddress));
        if (rateLimited(ipRateKey, MAX_LOGIN_ATTEMPTS_PER_IP)) {
            return LoginResult.rateLimited();
        }
        String rateKey = RedisKeys.ccpcojJudgeLoginRate(loginFingerprint(remoteAddress, username));
        if (rateLimited(rateKey, MAX_LOGIN_ATTEMPTS)) {
            return LoginResult.rateLimited();
        }

        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        if (!credentialsMatch(settings, username, password)) {
            return LoginResult.invalidCredentials();
        }

        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
            RedisKeys.ccpcojJudgeSession(sessionId),
            sessionValue(username, settings),
            sessionTtl(settings)
        );
        redisTemplate.delete(rateKey);
        return LoginResult.success(sessionId);
    }

    public Duration sessionTtl() {
        /**
         * 封装会话Ttl相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return sessionTtl(settingService.getJudgeRuntimeSettings());
    }

    public boolean authenticated(String sessionId) {
        if (!validSessionId(sessionId)) {
            return false;
        }
        String stored = redisTemplate.opsForValue().get(RedisKeys.ccpcojJudgeSession(sessionId));
        if (stored == null) {
            return false;
        }
        /**
         * 封装会话MatchesCurrentCredentials相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return sessionMatchesCurrentCredentials(stored, settingService.getJudgeRuntimeSettings());
    }

    public String workerId(String sessionId) {
        String stored = !validSessionId(sessionId)
            ? null
            : redisTemplate.opsForValue().get(RedisKeys.ccpcojJudgeSession(sessionId));
        String username = sessionUsername(stored);
        String suffix = !validSessionId(sessionId) ? "invalid" : sessionId.substring(0, 8);
        return (username == null || username.isBlank() ? "ccpcoj" : username) + "-" + suffix;
    }

    public String pending(int requestedLimit, String languageSet, String sessionId) {
        if (!authenticated(sessionId)) {
            return "";
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        if (!settings.enabled) {
            return "";
        }
        int limit = Math.max(1, Math.min(Math.min(requestedLimit, settings.maxConcurrent), 100));
        Set<Integer> acceptedLanguages = parseLanguageSet(languageSet);
        if (acceptedLanguages.isEmpty()) {
            return "";
        }
        LocalDateTime staleBefore = LocalDateTime.now()
            .minusMinutes(Math.max(2, settings.ccpcojStaleTaskMinutes));
        List<Submission> candidates = submissionMapper.selectWaitingForCcpcoj(
            limit,
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

    /**
     * Claims a task atomically. Reclaimed stale tasks change worker ownership, so
     * the previous worker immediately loses source and test-data access.
     */
    @Transactional
    public boolean checkout(long submissionId, String sessionId) {
        if (!authenticated(sessionId) || !protocolInt(submissionId)) {
            return false;
        }
        String workerId = workerId(sessionId);
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        if (!settings.enabled) {
            return false;
        }
        boolean oiWorker = isOiWorker(sessionId);
        LocalDateTime now = LocalDateTime.now();
        int updated = submissionMapper.claimForCcpcoj(
            submissionId,
            workerId,
            now,
            now.minusMinutes(Math.max(2, settings.ccpcojStaleTaskMinutes)),
            oiWorker
        );
        if (updated > 0) {
            messagePublisher.submissionChanged(submissionId, "COMPILING", null, null);
            messagePublisher.submissionQueueUpdated();
        }
        return updated > 0;
    }

    public String solutionInfo(long submissionId, String sessionId) {
        Submission submission = ownedSubmission(submissionId, sessionId);
        if (!supportsProtocol(submission)) {
            return "";
        }
        long judgeProblemId = encodeProblemId(submission.problemId, submission.contestProblemId);
        return judgeProblemId + "\n"
            + submission.userId + "\n"
            + languageId(submission.language) + "\n"
            + (submission.contestId == null ? 0 : submission.contestId) + "\n";
    }

    public String sourceCode(long submissionId, String sessionId) {
        Submission submission = ownedSubmission(submissionId, sessionId);
        return submission == null || submission.code == null ? "" : submission.code + "\n";
    }

    public String problemInfo(long judgeProblemId, String sessionId) {
        if (!canAccessProblem(judgeProblemId, sessionId)) {
            return "";
        }
        JudgeProblem problem = loadJudgeProblem(judgeProblemId);
        if (problem == null) {
            return "";
        }
        int timeLimitMs = problem.timeLimitMs == null ? 1000 : problem.timeLimitMs;
        int memoryLimitMb = problem.memoryLimitMb == null ? 256 : problem.memoryLimitMb;
        double seconds = Math.max(1, timeLimitMs) / 1000.0;
        return seconds + "\n" + Math.max(1, memoryLimitMb) + "\n0\n";
    }

    public String testDataList(long judgeProblemId, String sessionId) {
        if (!canAccessProblem(judgeProblemId, sessionId)) {
            return "";
        }
        List<JudgeTestCase> testCases = loadHiddenTestCases(judgeProblemId);
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

    public byte[] testData(String path, String sessionId) {
        Matcher matcher = TEST_DATA_PATH.matcher(path == null ? "" : path);
        if (!matcher.matches()) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException("filename 参数格式错误");
        }
        long judgeProblemId = parseProtocolLong(matcher.group(1), "filename");
        int caseNo = parseProtocolInt(matcher.group(2), "filename");
        if (!canAccessProblem(judgeProblemId, sessionId)) {
            return null;
        }
        boolean input = "in".equals(matcher.group(3));
        /**
         * 读取HiddenTestCases并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return loadHiddenTestCases(judgeProblemId).stream()
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
        submission.judgeMessage = Utf8TextLimiter.fitMysqlText(combined);
        submission.updatedAt = LocalDateTime.now();
        submissionMapper.updateById(submission);
    }

    private Submission ownedSubmission(long submissionId, String sessionId) {
        if (!authenticated(sessionId)) {
            return null;
        }
        Submission submission = submissionMapper.selectById(submissionId);
        /**
         * 封装ownedBy相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return ownedBy(submission, workerId(sessionId)) ? submission : null;
    }

    private boolean canAccessProblem(long judgeProblemId, String sessionId) {
        if (!authenticated(sessionId) || judgeProblemId <= 0 || !protocolInt(judgeProblemId)) {
            return false;
        }
        DecodedProblemId decoded = decodeProblemId(judgeProblemId);
        if (decoded.id <= 0) {
            return false;
        }
        return submissionMapper.countActiveCcpcojClaims(
            workerId(sessionId), decoded.id, decoded.contestProblem) > 0;
    }

    /**
     * Samples are public examples and must never affect verdicts or OI pass rates.
     */
    private List<JudgeTestCase> loadHiddenTestCases(long judgeProblemId) {
        DecodedProblemId decoded = decodeProblemId(judgeProblemId);
        List<JudgeTestCase> result = new ArrayList<>();
        if (decoded.contestProblem) {
            List<ContestProblemTestCase> testCases = contestProblemTestCaseMapper.selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", decoded.id)
                    .eq("sample", false)
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
            List<ProblemTestCase> testCases = problemTestCaseMapper.selectList(
                new QueryWrapper<ProblemTestCase>()
                    .eq("problem_id", decoded.id)
                    .eq("sample", false)
                    .orderByAsc("case_no")
            );
            for (ProblemTestCase item : testCases) {
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
        Long selectedId = contestProblemId == null ? problemId : contestProblemId;
        if (selectedId == null || selectedId <= 0) {
            /**
             * 封装IllegalStateException相关逻辑。可能调用外部判题或网关服务。
             */
            throw new IllegalStateException("CCPCOJ 题目标识无效");
        }
        long encoded = Math.multiplyExact(selectedId, 2L) + (contestProblemId == null ? 0L : 1L);
        if (encoded > Integer.MAX_VALUE) {
            /**
             * 封装IllegalStateException相关逻辑。可能调用外部判题或网关服务。
             */
            throw new IllegalStateException("CCPCOJ 题目标识超出 32 位整数范围");
        }
        return encoded;
    }

    private DecodedProblemId decodeProblemId(long encoded) {
        /**
         * 构造 Decoded题目标识 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
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
        String username = sessionUsername(
            redisTemplate.opsForValue().get(RedisKeys.ccpcojJudgeSession(sessionId)));
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        return username != null && username.equals(settings.ccpcojJudgeUsername + "-oi");
    }

    private boolean supportsProtocol(Submission submission) {
        if (submission == null
            || !protocolInt(submission.id, false)
            || !protocolInt(submission.userId, false)
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
            && "CCPCOJ".equals(submission.judgeBackend)
            && "CCPCOJ".equals(submission.judgeServer)
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
                    // Malformed worker entries are ignored without reaching SQL.
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
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    private boolean credentialsMatch(JudgeSettingsVO settings, String username, String password) {
        String configuredUsername = nullToEmpty(settings.ccpcojJudgeUsername);
        byte[] candidateDigest = sha256(username);
        boolean regularWorker = MessageDigest.isEqual(candidateDigest, sha256(configuredUsername));
        boolean oiWorker = MessageDigest.isEqual(candidateDigest, sha256(configuredUsername + "-oi"));
        boolean usernameMatches = regularWorker | oiWorker;

        String configuredHash = settings.ccpcojJudgePassword;
        String hashToCheck = configuredHash == null || configuredHash.isBlank()
            ? DUMMY_PASSWORD_HASH
            : configuredHash;
        boolean passwordMatches;
        try {
            passwordMatches = passwordEncoder.matches(password, hashToCheck);
        } catch (RuntimeException ex) {
            passwordMatches = false;
        }
        boolean passwordConfigured = configuredHash != null && !configuredHash.isBlank();
        // Non-short-circuit operation keeps the password check on unknown usernames.
        return usernameMatches & passwordMatches & passwordConfigured;
    }

    /**
     * Bind every session to the active worker identity and password hash. Updating
     * either setting invalidates existing cookies immediately without a Redis scan.
     */
    private String sessionValue(String username, JudgeSettingsVO settings) {
        String credentialState = nullToEmpty(settings.ccpcojJudgeUsername)
            + SESSION_VALUE_SEPARATOR
            + nullToEmpty(settings.ccpcojJudgePassword);
        return username + SESSION_VALUE_SEPARATOR
            + HexFormat.of().formatHex(sha256(credentialState));
    }

    private boolean sessionMatchesCurrentCredentials(String stored, JudgeSettingsVO settings) {
        String username = sessionUsername(stored);
        if (username == null) {
            return false;
        }
        String configuredUsername = nullToEmpty(settings.ccpcojJudgeUsername);
        boolean recognizedUsername = MessageDigest.isEqual(sha256(username), sha256(configuredUsername))
            | MessageDigest.isEqual(sha256(username), sha256(configuredUsername + "-oi"));
        return recognizedUsername
            && MessageDigest.isEqual(sha256(stored), sha256(sessionValue(username, settings)));
    }

    private String sessionUsername(String stored) {
        if (stored == null) {
            return null;
        }
        int separator = stored.indexOf(SESSION_VALUE_SEPARATOR);
        return separator <= 0 ? null : stored.substring(0, separator);
    }

    private void requireCredentialShape(String username, String password) {
        if (username == null || username.isBlank() || username.length() > MAX_USERNAME_LENGTH) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException("user_id 参数格式错误");
        }
        if (password == null || password.isBlank() || password.length() > MAX_PASSWORD_LENGTH) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException("password 参数格式错误");
        }
    }

    private String loginFingerprint(String remoteAddress, String username) {
        return HexFormat.of().formatHex(sha256(
            normalizedRemoteAddress(remoteAddress) + "\n" + username.toLowerCase(Locale.ROOT)));
    }

    private String loginIpFingerprint(String remoteAddress) {
        return HexFormat.of().formatHex(sha256(normalizedRemoteAddress(remoteAddress)));
    }

    private String normalizedRemoteAddress(String remoteAddress) {
        return remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress.trim();
    }

    private boolean rateLimited(String key, int maximumAttempts) {
        Long attempts = redisTemplate.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(key, LOGIN_RATE_WINDOW);
        }
        return attempts == null || attempts > maximumAttempts;
    }

    private boolean validSessionId(String sessionId) {
        return sessionId != null && SESSION_ID.matcher(sessionId).matches();
    }

    private byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                .digest(nullToEmpty(value).getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException ex) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private Duration sessionTtl(JudgeSettingsVO settings) {
        return Duration.ofMinutes(Math.max(10, settings.ccpcojSessionTtlMinutes));
    }

    private long parseProtocolLong(String value, String field) {
        try {
            long parsed = Long.parseLong(value);
            if (parsed <= 0 || !protocolInt(parsed)) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException(field + " 参数超出范围");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(field + " 参数格式错误", ex);
        }
    }

    private int parseProtocolInt(String value, String field) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed <= 0) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException(field + " 参数超出范围");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(field + " 参数格式错误", ex);
        }
    }

    private Integer positiveOrNull(int value) {
        return value > 0 ? value : null;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * 登录状态枚举。限定该领域允许出现的离散状态，避免在业务代码中传播无约束字符串。
     */
    public enum LoginStatus {
        SUCCESS,
        INVALID_CREDENTIALS,
        RATE_LIMITED
    }

    /**
     * 登录结果不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    public record LoginResult(LoginStatus status, String sessionId) {
        /**
         * 封装success相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static LoginResult success(String sessionId) {
            /**
             * 构造 登录结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new LoginResult(LoginStatus.SUCCESS, sessionId);
        }

        /**
         * 封装invalidCredentials相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static LoginResult invalidCredentials() {
            /**
             * 构造 登录结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new LoginResult(LoginStatus.INVALID_CREDENTIALS, null);
        }

        /**
         * 封装rateLimited相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static LoginResult rateLimited() {
            /**
             * 构造 登录结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new LoginResult(LoginStatus.RATE_LIMITED, null);
        }
    }

    /**
     * 判题题目不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record JudgeProblem(Integer timeLimitMs, Integer memoryLimitMb) {
    }

    /**
     * 判题Test测试点不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record JudgeTestCase(int caseNo, String input, String output, LocalDateTime updatedAt) {
    }

    /**
     * Decoded题目标识不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record DecodedProblemId(long id, boolean contestProblem) {
    }
}

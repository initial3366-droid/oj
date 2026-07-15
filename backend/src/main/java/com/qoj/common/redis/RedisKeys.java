package com.qoj.common.redis;

/**
 * RedisKeys领域类型。封装 common.redis 模块内的相关职责。
 */
public final class RedisKeys {

    /**
     * 构造 RedisKeys 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private RedisKeys() {
    }

    /**
     * 构造或转换kenBlacklist。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String tokenBlacklist(String jti) {
        return "oj:token:blacklist:" + jti;
    }

    /**
     * 封装refresh令牌Blacklist相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String refreshTokenBlacklist(String jti) {
        return "oj:refresh:blacklist:" + jti;
    }

    /**
     * 封装refresh令牌Family相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String refreshTokenFamily(String familyId) {
        return "oj:refresh:family:" + familyId;
    }

    /**
     * 封装r会话相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String userSession(long userId, String sessionId) {
        return "oj:session:" + userId + ":" + sessionId;
    }

    /**
     * 封装r相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String user(long userId) {
        return "oj:user:" + userId;
    }

    /**
     * 处理online用户。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String onlineUser(long userId) {
        return "oj:online:" + userId;
    }

    public static String onlineAccount(String accountType, long accountId) {
        return "oj:online:" + accountType.toLowerCase() + ":" + accountId;
    }

    /**
     * 处理online用户Pattern。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String onlineUserPattern() {
        return "oj:online:*";
    }

    /**
     * 封装题目相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String problem(long problemId) {
        return "oj:problem:" + problemId;
    }

    public static String practicePublicationUnlock(long publicationId, long userId) {
        return "oj:practice-publication:" + publicationId + ":unlock:" + userId;
    }

    public static String practicePublicationPasswordAttempts(long publicationId, long userId) {
        return "oj:practice-publication:" + publicationId + ":password-attempts:" + userId;
    }

    /**
     * 封装比赛Board相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String contestBoard(long contestId) {
        return "oj:contest:" + contestId + ":board";
    }

    /**
     * 封装排行榜Global相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String leaderboardGlobal() {
        return "oj:leaderboard:global:student:ac";
    }

    /**
     * 封装排行榜班级相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String leaderboardClass() {
        return "oj:leaderboard:class:student:ac";
    }

    /**
     * 封装判题Pending相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String judgePending(long userId, long problemId) {
        return "oj:judge:pending:" + userId + ":" + problemId;
    }

    /**
     * 封装判题Pending相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String judgePending(long userId, long problemId, Long contestId) {
        String scope = contestId == null ? "practice" : "contest:" + contestId;
        return "oj:judge:pending:" + userId + ":" + scope + ":" + problemId;
    }

    /**
     * 封装题目Draft相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String problemDraft(long userId, String draftId) {
        return "oj:problem:draft:" + userId + ":" + draftId;
    }

    public static String problemDraft(String accountType, long accountId, String draftId) {
        return "oj:problem:draft:" + accountType.toLowerCase() + ":" + accountId + ":" + draftId;
    }

    /**
     * 封装比赛Draft相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String contestDraft(long userId) {
        return "oj:contest:draft:" + userId;
    }

    /**
     * 封装比赛Draft相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String contestDraft(String accountType, long userId) {
        return "oj:contest:draft:" + accountType + ":" + userId;
    }

    /**
     * 创建或提交Rate。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String submitRate(String ip) {
        return "oj:rate:" + ip + ":submit";
    }

    /** Per-user fixed-window counter for resource-intensive sandbox runs. */
    public static String sandboxRunRate(long userId) {
        return "oj:rate:user:" + userId + ":sandbox";
    }

    /** Per-user lease that prevents overlapping sandbox processes. */
    public static String sandboxRunLock(long userId) {
        return "oj:lock:user:" + userId + ":sandbox";
    }

    /** Global fixed-window limit for sandbox requests across all accounts. */
    public static String sandboxRunGlobalRate() {
        return "oj:rate:global:sandbox";
    }

    /** Expiring global sandbox leases stored as a Redis sorted set. */
    public static String sandboxRunGlobalSlots() {
        return "oj:lease:global:sandbox";
    }

    /**
     * 封装比赛状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String contestStatus(long contestId) {
        return "oj:contest:" + contestId + ":status";
    }

    /**
     * 封装captcha相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String captcha(String captchaId) {
        return "oj:captcha:" + captchaId;
    }

    /**
     * 封装emailVerification编码相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static String emailVerificationCode(String email) {
        return "oj:email:verify:" + email;
    }

    /** CCPCOJ worker session containing its identity and credential-state fingerprint. */
    public static String ccpcojJudgeSession(String sessionId) {
        return "oj:ccpcoj:judge:session:" + sessionId;
    }

    /**
     * Fixed-window login counter keyed by a SHA-256 fingerprint of IP and username.
     */
    public static String ccpcojJudgeLoginRate(String fingerprint) {
        return "oj:ccpcoj:judge:login-rate:" + fingerprint;
    }

    /**
     * CCPCOJ login counter keyed only by the remote address fingerprint.
     * This prevents attackers from bypassing BCrypt rate limits by rotating usernames.
     */
    public static String ccpcojJudgeLoginIpRate(String fingerprint) {
        return "oj:ccpcoj:judge:login-ip-rate:" + fingerprint;
    }
}

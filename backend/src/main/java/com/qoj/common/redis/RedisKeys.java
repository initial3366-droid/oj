package com.qoj.common.redis;

public final class RedisKeys {

    private RedisKeys() {
    }

    public static String tokenBlacklist(String jti) {
        return "oj:token:blacklist:" + jti;
    }

    public static String refreshTokenBlacklist(String jti) {
        return "oj:refresh:blacklist:" + jti;
    }

    public static String refreshTokenFamily(String familyId) {
        return "oj:refresh:family:" + familyId;
    }

    public static String userSession(long userId, String sessionId) {
        return "oj:session:" + userId + ":" + sessionId;
    }

    public static String user(long userId) {
        return "oj:user:" + userId;
    }

    public static String onlineUser(long userId) {
        return "oj:online:" + userId;
    }

    public static String onlineUserPattern() {
        return "oj:online:*";
    }

    public static String problem(long problemId) {
        return "oj:problem:" + problemId;
    }

    public static String contestBoard(long contestId) {
        return "oj:contest:" + contestId + ":board";
    }

    public static String leaderboardGlobal() {
        return "oj:leaderboard:global:student:ac";
    }

    public static String leaderboardClass() {
        return "oj:leaderboard:class:student:ac";
    }

    public static String judgePending(long userId, long problemId) {
        return "oj:judge:pending:" + userId + ":" + problemId;
    }

    public static String judgePending(long userId, long problemId, Long contestId) {
        String scope = contestId == null ? "practice" : "contest:" + contestId;
        return "oj:judge:pending:" + userId + ":" + scope + ":" + problemId;
    }

    public static String problemDraft(long userId, String draftId) {
        return "oj:problem:draft:" + userId + ":" + draftId;
    }

    public static String contestDraft(long userId) {
        return "oj:contest:draft:" + userId;
    }

    public static String contestDraft(String accountType, long userId) {
        return "oj:contest:draft:" + accountType + ":" + userId;
    }

    public static String submitRate(String ip) {
        return "oj:rate:" + ip + ":submit";
    }

    public static String contestStatus(long contestId) {
        return "oj:contest:" + contestId + ":status";
    }

    public static String captcha(String captchaId) {
        return "oj:captcha:" + captchaId;
    }

    public static String emailVerificationCode(String email) {
        return "oj:email:verify:" + email;
    }
}

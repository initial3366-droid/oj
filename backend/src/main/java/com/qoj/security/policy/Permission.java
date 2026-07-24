package com.qoj.security.policy;

/**
 * 权限访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
public enum Permission {
    VIEW("view"),
    CREATE("create"),
    UPDATE("update"),
    DELETE("delete"),
    SUBMIT("submit"),
    VIEW_CODE("view_code"),
    VIEW_HIDDEN_CASE("view_hidden_case"),
    REJUDGE("rejudge"),
    MANAGE_REGISTRATION("manage_registration"),
    MANAGE_SCOREBOARD("manage_scoreboard"),
    SUBMISSION_VIEW_SELF("submission:view_self"),
    SUBMISSION_VIEW_ADMIN("submission:view_admin"),
    SUBMISSION_VIEW_CODE_ADMIN("submission:view_code_admin"),
    QUEUE_VIEW_SELF("queue:view_self"),
    QUEUE_VIEW_CONTEST_ADMIN("queue:view_contest_admin"),
    QUEUE_VIEW_ALL("queue:view_all"),
    QUEUE_REJUDGE("queue:rejudge"),
    QUEUE_CANCEL("queue:cancel"),
    QUEUE_UPDATE_PRIORITY("queue:update_priority"),
    QUEUE_VIEW_LOGS("queue:view_logs");

    private final String key;

    /**
     * 构造 权限 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    Permission(String key) {
        this.key = key;
    }

    /**
     * 封装key相关逻辑。直接返回当前实例保存的key，不产生额外的数据写入。
     */
    public String key() {
        return key;
    }

    /**
     * 构造或转换String。直接返回当前实例保存的key，不产生额外的数据写入。
     */
    @Override
    public String toString() {
        return key;
    }
}

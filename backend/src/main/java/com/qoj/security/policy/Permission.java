package com.qoj.security.policy;

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

    Permission(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    @Override
    public String toString() {
        return key;
    }
}

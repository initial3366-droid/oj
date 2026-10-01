package com.qojagent.service;

public class AgentException extends RuntimeException {
    private final int status;

    public AgentException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}

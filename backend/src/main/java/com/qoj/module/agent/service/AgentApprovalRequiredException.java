package com.qoj.module.agent.service;

/** Pauses a checkpointed tool call until its owning admin answers in the UI. */
public class AgentApprovalRequiredException extends RuntimeException {
    private final AgentRunState.Approval approval;

    public AgentApprovalRequiredException(AgentRunState.Approval approval) {
        super("等待用户确认操作");
        this.approval = approval;
    }

    public AgentRunState.Approval approval() { return approval; }
}

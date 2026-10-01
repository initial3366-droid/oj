package com.qoj.module.agent.service;

/** Normal user cancellation; checkpoints remain available for resume. */
public class AgentRunStoppedException extends RuntimeException {
    public AgentRunStoppedException() { super("生成已停止，进度已保留"); }
}

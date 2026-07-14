package com.qoj.module.agent.service;

import com.qoj.module.setting.vo.AgentSettingsVO;

/**
 * AgentClient接口。定义模块之间可依赖的稳定能力边界。
 */
public interface AgentClient {
    /**
     * 封装chat相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt);
}

package com.qoj.module.agent.service;

import com.qoj.module.setting.vo.AgentSettingsVO;

public interface AgentClient {
    String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt);
}

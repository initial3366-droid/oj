package com.qoj.module.agent.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;

/** Serializable tool transcript; user/media context is rebuilt from the owned chat request. */
public class AgentRunState {
    public List<Turn> transcript = new ArrayList<>();
    public List<AssistantMessage.ToolCall> pending = new ArrayList<>();
    public List<ToolResponseMessage.ToolResponse> observations = new ArrayList<>();
    public Map<String, Outcome> cache = new LinkedHashMap<>();
    public int repeatedCalls;
    public String lastActionKey;
    public boolean complete;
    public record Turn(String text, List<AssistantMessage.ToolCall> calls, List<ToolResponseMessage.ToolResponse> responses) {}
    public record Outcome(String data, boolean success) {}
}

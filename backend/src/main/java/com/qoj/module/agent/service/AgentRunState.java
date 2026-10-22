package com.qoj.module.agent.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;

/** Serializable tool transcript; user/media context is rebuilt from the owned chat request. */
public class AgentRunState {
    public List<Turn> transcript = new ArrayList<>();
    public String contextSummary;
    public List<AssistantMessage.ToolCall> pending = new ArrayList<>();
    public List<ToolResponseMessage.ToolResponse> observations = new ArrayList<>();
    public Map<String, Outcome> cache = new LinkedHashMap<>();
    public String executionId = UUID.randomUUID().toString();
    public Map<String, Execution> executions = new LinkedHashMap<>();
    public Set<String> approvedOperationGroups = new LinkedHashSet<>();
    public int repeatedCalls;
    public String lastActionKey;
    public boolean complete;
    public Approval pendingApproval;
    public ApprovalDecision approvalDecision;
    public record Turn(String text, List<AssistantMessage.ToolCall> calls, List<ToolResponseMessage.ToolResponse> responses) {}
    public record Outcome(String data, boolean success) {}
    /** A null outcome means execution started but completion was not durably confirmed. */
    public record Execution(String fingerprint, Outcome outcome) {}
    public record Approval(String callId, String name, String description, List<String> callIds, String groupKey) {
        public Approval(String callId, String name, String description) {
            this(callId, name, description, List.of(callId), null);
        }
        public List<String> approvedCallIds() {
            return callIds == null || callIds.isEmpty() ? List.of(callId) : callIds;
        }
        public boolean includes(String id) { return approvedCallIds().contains(id); }
    }
    public record ApprovalDecision(String callId, String choice, String customText, List<String> callIds, String groupKey) {
        public ApprovalDecision(String callId, String choice, String customText) {
            this(callId, choice, customText, List.of(callId), null);
        }
        public List<String> approvedCallIds() {
            return callIds == null || callIds.isEmpty() ? List.of(callId) : callIds;
        }
        public boolean includes(String id) { return approvedCallIds().contains(id); }
    }
}

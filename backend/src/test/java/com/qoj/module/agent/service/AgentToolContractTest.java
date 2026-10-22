package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.module.setting.vo.AgentSettingsVO;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import reactor.core.publisher.Flux;
import static org.junit.jupiter.api.Assertions.*;

/** Exercises real tool orchestration with deterministic provider responses and counted side effects. */
class AgentToolContractTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void rejectsMalformedTypesBoundsUnknownFieldsAndConditionalArguments() {
        String read = "{\"type\":\"object\",\"properties\":{\"limit\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":12000}},\"required\":[\"limit\"],\"additionalProperties\":false}";
        for (String args : List.of("{}", "null", "[]", "{", "{\"limit\":\"2\"}", "{\"limit\":0}", "{\"limit\":12001}",
                "{\"limit\":2,\"extra\":true}", "{\"limit\":2} {}", "{\"limit\":2,\"limit\":3}")) {
            assertThrows(AgentToolSupport.InvalidArguments.class, () -> AgentToolSupport.validate(read, args), args);
        }
        assertDoesNotThrow(() -> AgentToolSupport.validate(read, "{\"limit\":12000}"));
        invalid("query_qoj", "{\"kind\":\"problem\"}");
        valid("query_qoj", "{\"kind\":\"problem\",\"id\":1}");
        valid("query_qoj", "{\"kind\":\"problems\"}");
        invalid("run_code", "{\"language\":\"csharp\",\"code\":\"x\"}");
        invalid("generate_test_cases", "{\"language\":\"python\",\"code\":\"x\"}");
        invalid("generate_test_cases", "{\"language\":\"python\",\"code\":\"x\",\"inputs\":[\"\"],\"generatorCode\":\"x\"}");
        invalid("generate_test_cases", "{\"language\":\"python\",\"code\":\"x\",\"inputs\":[\"\"],\"generatorLanguage\":\"python\"}");
        valid("generate_test_cases", "{\"language\":\"python\",\"code\":\"x\",\"inputs\":[\"\"]}");
        valid("generate_test_cases", "{\"language\":\"cpp17\",\"code\":\"x\",\"generatorCode\":\"x\"}");
        for (String name : List.of("get_draft", "update_draft", "commit_draft")) invalid(name, "{}");
        invalid("create_draft", "{\"basic\":{\"title\":\"x\"}}");
        invalid("create_draft", "{\"basic\":{\"title\":\"x\",\"statement\":\"s\",\"timeLimit\":1,\"memoryLimit\":256}}");
        valid("create_draft", "{\"basic\":{\"title\":\"x\",\"statement\":\"s\",\"timeLimit\":1000,\"memoryLimit\":256,\"samples\":[{\"input\":\"\",\"output\":\"\"}]}}");
    }

    @Test
    void queriesAreFreshAndDistinctWriteIdsExecuteIndependently() throws Exception {
        var reads = new AtomicInteger(); var writes = new AtomicInteger();
        var state = new AgentRunState();
        state.approvedOperationGroups.add("create_draft:");
        state.pending.addAll(List.of(call("q1", "query_qoj"), call("w1", "create_draft"), call("q2", "query_qoj"), call("w2", "create_draft")));
        run(state, List.of(tool("query_qoj", reads), tool("create_draft", writes)));
        assertEquals(2, reads.get()); assertEquals(2, writes.get());
        var observations = state.transcript.get(0).responses();
        assertEquals(1, JSON.readTree(observations.get(0).responseData()).path("data").path("count").asInt());
        assertEquals(2, JSON.readTree(observations.get(2).responseData()).path("data").path("count").asInt());
        for (var observation : observations) {
            var result = JSON.readTree(observation.responseData());
            assertTrue(result.path("ok").asBoolean()); assertTrue(result.path("warnings").isArray());
            assertFalse(result.path("requestId").asText().isBlank());
        }
    }

    @Test
    void sameWriteIdReplaysAfterCheckpointAndChangedArgumentsAreRejected() throws Exception {
        var writes = new AtomicInteger(); var state = new AgentRunState();
        state.approvedOperationGroups.add("create_draft:"); state.pending.add(call("w1", "create_draft"));
        run(state, List.of(tool("create_draft", writes)));
        state = JSON.readValue(JSON.writeValueAsString(state), AgentRunState.class);
        state.complete = false; state.pending.add(call("w1", "create_draft"));
        run(state, List.of(tool("create_draft", writes))); assertEquals(1, writes.get());
        state.complete = false;
        state.pending.add(new AssistantMessage.ToolCall("w1", "function", "create_draft", "{\"new\":true}"));
        run(state, List.of(tool("create_draft", writes)));
        assertEquals(1, writes.get());
        assertFalse(JSON.readTree(state.transcript.get(2).responses().get(0).responseData()).path("ok").asBoolean());
    }

    @Test
    void invalidWriteNeverAsksForApprovalOrExecutes() throws Exception {
        var writes = new AtomicInteger(); var state = new AgentRunState();
        state.pending.add(new AssistantMessage.ToolCall("bad", "function", "create_draft", "[]"));
        run(state, List.of(tool("create_draft", writes)));
        assertEquals(0, writes.get()); assertNull(state.pendingApproval);
        var error = JSON.readTree(state.transcript.get(0).responses().get(0).responseData());
        assertEquals("INVALID_ARGUMENT", error.path("error").path("code").asText());
        assertFalse(error.path("error").path("field").asText().isBlank());
    }

    @Test
    void interruptedWriteIsNotAutomaticallyReexecuted() throws Exception {
        var state = new AgentRunState(); var writes = new AtomicInteger();
        state.approvedOperationGroups.add("create_draft:"); state.pending.add(call("w1", "create_draft"));
        var persisted = new AtomicReference<String>();
        ToolCallback crashing = new ToolCallback() {
            public ToolDefinition getToolDefinition() { return tool("create_draft", writes).getToolDefinition(); }
            public String call(String args) { writes.incrementAndGet(); throw new AssertionError("process interrupted after side effect"); }
        };
        assertThrows(AssertionError.class, () -> client().runAgentSegment(new AgentSettingsVO(), List.of(), List.of(crashing), state, () -> {
            try { persisted.set(JSON.writeValueAsString(state)); } catch (Exception e) { throw new RuntimeException(e); }
        }, () -> false, text -> {}, event -> {}));
        var resumed = JSON.readValue(persisted.get(), AgentRunState.class);
        run(resumed, List.of(tool("create_draft", writes)));
        assertEquals(1, writes.get());
        assertEquals("OUTCOME_UNKNOWN", JSON.readTree(resumed.transcript.get(0).responses().get(0).responseData()).path("error").path("code").asText());
    }

    private static void invalid(String tool, String args) { assertThrows(AgentToolSupport.InvalidArguments.class, () -> AgentToolSupport.validate(AgentToolSupport.schema(tool, "{}"), args)); }
    private static void valid(String tool, String args) { assertDoesNotThrow(() -> AgentToolSupport.validate(AgentToolSupport.schema(tool, "{}"), args)); }
    private static AssistantMessage.ToolCall call(String id, String name) { return new AssistantMessage.ToolCall(id, "function", name, "{}"); }
    private static ToolCallback tool(String name, AtomicInteger counter) {
        return new ToolCallback() {
            public ToolDefinition getToolDefinition() { return ToolDefinition.builder().name(name).description(name).inputSchema("{\"type\":\"object\"}").build(); }
            public String call(String args) { return "{\"count\":" + counter.incrementAndGet() + "}"; }
        };
    }
    private static OpenAiCompatibleAgentClient client() {
        return new OpenAiCompatibleAgentClient(new AgentModelFactory() {
            @Override public Flux<ChatResponse> stream(AgentSettingsVO settings, Prompt prompt) {
                return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage("done")))));
            }
        });
    }
    private static void run(AgentRunState state, List<ToolCallback> tools) {
        assertTrue(client().runAgentSegment(new AgentSettingsVO(), List.of(), tools, state, () -> {}, () -> false, text -> {}, event -> {}));
    }
}

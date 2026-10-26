import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.service.AgentClient;
import com.qoj.module.agent.service.AgentContextBudget;
import com.qoj.module.agent.service.AgentModelFactory;
import com.qoj.module.agent.service.AgentRunState;
import com.qoj.module.agent.service.OpenAiCompatibleAgentClient;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;

/** Runs the real SDK and tool loop against an isolated HTTP provider fixture, without credentials. */
public class AgentCompactionE2e {
    private static final ObjectMapper JSON = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        var requests = new ArrayList<JsonNode>();
        var omitUsage = new java.util.concurrent.atomic.AtomicBoolean();
        var result = new AtomicReference<>(JSON.writeValueAsString(Map.of(
            "goal", "核对题目 KEEP-ME", "constraints", "保留原数据", "decisions", "仅查询",
            "objects", "problem:1", "completed", "已查询", "pending", "核对结果",
            "failures", "", "references", "problem:1", "background", "")));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            var request = JSON.readTree(exchange.getRequestBody());
            requests.add(request);
            String body;
            if (request.path("stream").asBoolean()) {
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
                body = "data: " + JSON.writeValueAsString(Map.of("id", "fixture", "object", "chat.completion.chunk",
                    "model", "fixture", "choices", List.of(Map.of("index", 0, "delta",
                        Map.of("role", "assistant", "content", "核对完成"), "finish_reason", "stop")))) + "\n\n"
                    + "data: " + JSON.writeValueAsString(Map.of("id", "fixture", "object", "chat.completion.chunk",
                        "model", "fixture", "choices", List.of(), "usage",
                        Map.of("prompt_tokens", 1400, "completion_tokens", 120, "total_tokens", 1520)))
                    + "\n\ndata: [DONE]\n\n";
            } else {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                body = JSON.writeValueAsString(Map.of("id", "fixture", "object", "chat.completion", "model", "fixture",
                    "choices", List.of(Map.of("index", 0, "message", Map.of("role", "assistant", "content", result.get()),
                        "finish_reason", "stop")), "usage",
                    Map.of("prompt_tokens", 3000, "completion_tokens", 100, "total_tokens", 3100)));
            }
            if (request.path("stream").asBoolean() && omitUsage.get()) {
                body = body.lines().filter(line -> !line.contains("prompt_tokens"))
                    .collect(java.util.stream.Collectors.joining("\n")) + "\n\n";
            }
            var bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            var model = OpenAiChatModel.builder().options(OpenAiChatOptions.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1")
                .apiKey("fixture-no-secret").model("fixture").maxRetries(0).build()).build();
            // Only the provider transport is substituted. Production client, compaction and state are real.
            var factory = new AgentModelFactory() {
                @Override public OpenAiChatModel get(AgentSettingsVO settings) { return model; }
                @Override public OpenAiChatModel getStreaming(AgentSettingsVO settings) { return model; }
            };
            var client = new OpenAiCompatibleAgentClient(factory);
            var settings = new AgentSettingsVO();
            settings.model = "fixture";
            settings.contextWindowTokens = 8192;
            settings.timeoutMs = 30000L;
            var events = new ArrayList<AgentClient.ToolEvent>();
            var state = state();
            state.approvedOperationGroups.add("existing-approval");
            state.executions.put("write-1", new AgentRunState.Execution("original", new AgentRunState.Outcome("done", true)));
            require(client.runAgentSegment(settings, messages(), List.of(), state, () -> {}, () -> false,
                delta -> {}, events::add), "Agent must finish");
            require(state.contextSummary != null, "must compact");
            require(JSON.readTree(state.contextSummary).path("objects").asText().equals("problem:1"), "object ID preserved");
            require(state.transcript.size() == 2, "newest complete call/result pair preserved");
            require(state.approvedOperationGroups.size() == 1 && state.executions.containsKey("write-1"),
                "approvals and execution records must stay separate");
            var sent = requests.get(requests.size() - 1).path("messages");
            require(sent.toString().contains("KEEP-ME") && sent.toString().contains("latest-call"), "state and newest tool round sent");
            var usage = JSON.readTree(events.stream().filter(e -> e.phase().equals("context"))
                .reduce((a, b) -> b).orElseThrow().data());
            require(usage.path("inputTokens").asInt() == 1400 && usage.path("outputTokens").asInt() == 120,
                "real SDK provider input/output usage returned");
            require(usage.path("compacted").asBoolean() && usage.path("window").asInt() == 8192,
                "compacted window metadata returned");
            omitUsage.set(true);
            var estimatedEvents = new ArrayList<AgentClient.ToolEvent>();
            client.runAgentSegment(settings, messages(), List.of(), new AgentRunState(), () -> {}, () -> false,
                delta -> {}, estimatedEvents::add);
            var fallback = JSON.readTree(estimatedEvents.stream().filter(e -> e.phase().equals("context"))
                .reduce((a, b) -> b).orElseThrow().data());
            require(fallback.path("estimated").asBoolean() && fallback.path("outputTokens").asInt() > 0,
                "missing provider usage must estimate the completed reply");
            int rejected = 0;
            for (String invalid : List.of("not JSON", "{}", result.get() + " trailing", result.get().replace("核对题目 KEEP-ME", "x".repeat(12001)))) {
                result.set(invalid);
                var unchanged = state();
                try {
                    client.runAgentSegment(settings, messages(), List.of(), unchanged, () -> {}, () -> false,
                        delta -> {}, event -> {});
                    throw new AssertionError("invalid summary accepted");
                } catch (BizException expected) {
                    require(unchanged.contextSummary == null && unchanged.transcript.size() == 4,
                        "invalid summary must preserve transcript");
                    rejected++;
                }
            }
            var report = Map.of("passed", true, "provider", "isolated HTTP fixture; real Spring AI SDK and Agent client",
                "checks", List.of("structured compaction", "newest tool pair intact", "approval/execution records intact",
                    "provider input and output usage", "missing usage includes estimated output", "invalid summaries preserve history"),
                "invalidSummariesRejected", rejected, "usage", usage, "httpRequests", requests.size());
            Files.writeString(Path.of(args[0]), JSON.writerWithDefaultPrettyPrinter().writeValueAsString(report));
            System.out.println("Agent compaction HTTP integration passed");
        } finally {
            server.stop(0);
        }
        // The SDK owns background transport threads; this standalone fixture is complete.
        System.exit(0);
    }

    private static List<AgentClient.Message> messages() {
        return List.of(new AgentClient.Message("system", "核对题目"), new AgentClient.Message("user", "只查询题目1"));
    }

    private static AgentRunState state() {
        var state = new AgentRunState();
        state.transcript.add(new AgentRunState.Turn("", List.of(new AssistantMessage.ToolCall("old-call", "function", "query", "{}")), null));
        state.transcript.add(new AgentRunState.Turn(null, null, List.of(new ToolResponseMessage.ToolResponse("old-call", "query", "a".repeat(10000)))));
        state.transcript.add(new AgentRunState.Turn("", List.of(new AssistantMessage.ToolCall("latest-call", "function", "query", "{}")), null));
        state.transcript.add(new AgentRunState.Turn(null, null, List.of(new ToolResponseMessage.ToolResponse("latest-call", "query", "latest result"))));
        return state;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}

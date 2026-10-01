package com.qoj.module.agent.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.setting.vo.AgentSettingsVO;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.List;
import java.util.function.Consumer;
import java.util.concurrent.TimeoutException;

/** OpenAI-compatible chat client backed by Spring AI. */
@Component
public class OpenAiCompatibleAgentClient implements AgentClient {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(OpenAiCompatibleAgentClient.class);
    private final AgentModelFactory modelFactory;

    public OpenAiCompatibleAgentClient(AgentModelFactory modelFactory) {
        this.modelFactory = modelFactory;
    }

    @Override
    public String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt) {
        return chat(agent, systemPrompt, userPrompt, List.of());
    }

    @Override
    public String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt, List<org.springframework.ai.content.Media> media) {
        try {
            ChatResponse response = modelFactory.get(agent).call(new Prompt(
                new SystemMessage(systemPrompt),
                UserMessage.builder().text(userPrompt).media(media).build()
            ));
            String content = responseText(response);
            if (content == null || content.isBlank()) {
                throw new BizException(502, "AI 服务返回空内容");
            }
            return content.trim();
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(502, "AI 服务请求失败，请检查服务配置后重试");
        }
    }

    @Override
    public void streamChat(AgentSettingsVO agent, List<AgentClient.Message> messages, Consumer<String> onDelta) {
        try {
            List<org.springframework.ai.chat.messages.Message> promptMessages = new ArrayList<>(messages.size());
            for (AgentClient.Message message : messages) {
                promptMessages.add(switch (message.role()) {
                    case "system" -> new SystemMessage(message.content());
                    case "assistant" -> new AssistantMessage(message.content());
                    case "user" -> UserMessage.builder().text(message.content()).media(message.media()).build();
                    default -> throw new BizException(400, "聊天消息格式不正确");
                });
            }
            Flux<ChatResponse> responses = modelFactory.getStreaming(agent).stream(new Prompt(promptMessages));
            long idleTimeoutMs = agent.timeoutMs == null || agent.timeoutMs <= 0 ? 30000L : agent.timeoutMs;
            responses.timeout(Duration.ofMillis(idleTimeoutMs))
                .takeUntil(response -> response.getResults().stream().anyMatch(result -> {
                    String reason = result.getMetadata().getFinishReason();
                    return reason != null && !reason.isBlank();
                }))
                .doOnNext(response -> {
                    String content = responseText(response);
                    if (content != null && !content.isEmpty()) onDelta.accept(content);
                })
                .takeUntilOther(reactor.core.publisher.Mono.delay(Duration.ofMillis(AgentModelFactory.STREAM_TIMEOUT_MS))
                    .flatMap(ignored -> reactor.core.publisher.Mono.error(new TimeoutException())))
                .blockLast();
        } catch (UncheckedIOException e) {
            // Preserve browser disconnects so the SSE controller saves the partial reply as stopped.
            throw e;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            if (reactor.core.Exceptions.unwrap(e) instanceof TimeoutException) {
                throw new BizException(504, "AI 回复超时，请稍后重试");
            }
            throw new BizException(502, "AI 服务请求失败，请检查服务配置后重试");
        }
    }

    private static String responseText(ChatResponse response) {
        return response == null || response.getResult() == null
            ? null
            : response.getResult().getOutput().getText();
    }

    @Override
    public void runAgent(AgentSettingsVO agent, List<AgentClient.Message> messages,
                         List<org.springframework.ai.tool.ToolCallback> tools, Consumer<String> onDelta,
                         Consumer<ToolEvent> onTool) {
        var state = new AgentRunState();
        while (!runAgentSegment(agent, messages, tools, state, () -> {}, () -> false, onDelta, onTool)) { }
    }

    @Override
    public boolean runAgentSegment(AgentSettingsVO agent, List<AgentClient.Message> messages,
                                    List<org.springframework.ai.tool.ToolCallback> tools, AgentRunState state,
                                    Runnable checkpoint, java.util.function.BooleanSupplier cancelled, Consumer<String> onDelta, Consumer<ToolEvent> onTool) {
        var history = new ArrayList<org.springframework.ai.chat.messages.Message>();
        for (var message : messages) history.add(switch (message.role()) {
            case "system" -> new SystemMessage(message.content());
            case "assistant" -> new AssistantMessage(message.content());
            case "user" -> UserMessage.builder().text(message.content()).media(message.media()).build();
            default -> throw new BizException(400, "聊天消息格式不正确");
        });
        for (var turn : state.transcript) {
            if (turn.calls() != null) history.add(AssistantMessage.builder().content(turn.text()).toolCalls(turn.calls()).build());
            else history.add(org.springframework.ai.chat.messages.ToolResponseMessage.builder().responses(turn.responses()).build());
        }
        long deadline = System.nanoTime() + Duration.ofSeconds(100).toNanos();
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper()
            .configure(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
        int calls = 0;
        try {
            for (int round = 0; ; round++) {
                if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
                if (state.complete) return true;
                // A pending tool batch is checkpointed before execution and after each observation.
                if (!state.pending.isEmpty()) {
                    for (int i = state.observations.size(); i < state.pending.size(); i++) {
                        if (calls >= 32 || System.nanoTime() >= deadline) { checkpoint.run(); return false; }
                        if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
                        var action = state.pending.get(i);
                        onTool.accept(new ToolEvent("action", action.name(), action.id(), true, action.arguments()));
                        String key = null;
                        AgentRunState.Outcome outcome;
                        boolean cached = false;
                        try {
                            if (action.arguments() == null || action.arguments().length() > 100000) throw new BizException(400, "工具参数过长或无效");
                            key = action.name() + ":" + mapper.writeValueAsString(mapper.readValue(action.arguments(), Object.class));
                            outcome = state.cache.get(key);
                            cached = outcome != null;
                            if (!cached) {
                                var tool = tools.stream().filter(item -> item.getToolDefinition().name().equals(action.name())).findFirst()
                                    .orElseThrow(() -> new BizException(400, "没有该工具"));
                                outcome = new AgentRunState.Outcome(tool.call(action.arguments()), true);
                            }
                        } catch (UncheckedIOException e) { throw e; }
                        catch (Exception e) {
                            outcome = new AgentRunState.Outcome("{\"error\":" + mapper.writeValueAsString(
                                e instanceof BizException ? e.getMessage() : "工具执行失败，请检查参数后重试") + "}", false);
                        }
                        if (key != null && outcome.success()) state.cache.put(key, outcome);
                        boolean repeated = cached || (key != null && key.equals(state.lastActionKey) && !outcome.success());
                        state.repeatedCalls = repeated ? state.repeatedCalls + 1 : 0;
                        state.lastActionKey = key;
                        if (!cached) calls++;
                        state.observations.add(new org.springframework.ai.chat.messages.ToolResponseMessage.ToolResponse(action.id(), action.name(), outcome.data()));
                        checkpoint.run();
                        onTool.accept(new ToolEvent("observation", action.name(), action.id(), outcome.success(), outcome.data(), cached));
                    }
                    var responses = List.copyOf(state.observations);
                    history.add(org.springframework.ai.chat.messages.ToolResponseMessage.builder().responses(responses).build());
                    state.transcript.add(new AgentRunState.Turn(null, null, responses));
                    state.pending.clear(); state.observations.clear(); checkpoint.run();
                }
                if (calls >= 32 || round >= 40 || deadline - System.nanoTime() < Duration.ofSeconds(15).toNanos()) return false;
                onTool.accept(new ToolEvent("model", "", "", true, ""));
                boolean stalled = state.repeatedCalls >= 8;
                if (stalled) history.add(new SystemMessage("连续重复操作没有新进展。停止工具调用，根据真实结果说明已完成事项与需要用户补充的信息。"));
                long remaining = Math.max(Duration.ofSeconds(1).toNanos(), deadline - System.nanoTime());
                var options = org.springframework.ai.openai.OpenAiChatOptions.builder()
                    .model(agent.model).toolCallbacks(stalled ? List.of() : tools).parallelToolCalls(false)
                    .timeout(Duration.ofNanos(Math.min(remaining, Duration.ofSeconds(90).toNanos()))).build();
                var finalResponse = new java.util.concurrent.atomic.AtomicReference<ChatResponse>();
                var responses = modelFactory.getStreaming(agent).stream(new Prompt(history, options))
                    .timeout(Duration.ofMillis(agent.timeoutMs == null || agent.timeoutMs <= 0 ? 30000 : agent.timeoutMs))
                    .takeUntilOther(Flux.interval(Duration.ofMillis(250)).filter(ignored -> cancelled.getAsBoolean()).next())
                    .doOnNext(response -> {
                        String content = responseText(response);
                        if (content != null && !content.isEmpty()) onDelta.accept(content);
                    });
                new org.springframework.ai.chat.model.MessageAggregator().aggregate(responses, finalResponse::set)
                    .blockLast(Duration.ofNanos(remaining));
                if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
                var response = finalResponse.get();
                if (response == null || response.getResult() == null) throw new BizException(502, "Agent 返回空内容");
                var assistant = response.getResult().getOutput();
                if (assistant.getToolCalls().isEmpty()) { state.complete = true; checkpoint.run(); return true; }
                if (stalled) {
                    onDelta.accept("\n\n重复操作未带来新进展，已停止。请补充需要调整的目标或参数。");
                    state.complete = true; checkpoint.run(); return true;
                }
                history.add(assistant);
                state.transcript.add(new AgentRunState.Turn(assistant.getText(), assistant.getToolCalls(), null));
                state.pending.addAll(assistant.getToolCalls()); checkpoint.run();
            }
        } catch (UncheckedIOException | BizException | AgentRunStoppedException e) { throw e; }
        catch (Exception e) {
            Throwable cause = reactor.core.Exceptions.unwrap(e);
            if (cause instanceof UncheckedIOException disconnected) throw disconnected;
            if (cause instanceof AgentRunStoppedException stopped) throw stopped;
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            String diagnostic = String.valueOf(cause.getMessage());
            if (agent.apiKey != null && !agent.apiKey.isBlank()) diagnostic = diagnostic.replace(agent.apiKey, "[redacted]");
            log.warn("Agent model failed [{}]: {}", cause.getClass().getSimpleName(), diagnostic);
            if (System.nanoTime() >= deadline) { checkpoint.run(); return false; }
            if (reactor.core.Exceptions.unwrap(e) instanceof TimeoutException || e instanceof IllegalStateException && e.getMessage() != null && e.getMessage().contains("Timeout")) {
                throw new BizException(504, "Agent 执行超时，进度已保留，可继续处理");
            }
            throw new BizException(502, "Agent 模型请求失败，请检查工具调用支持与服务配置");
        }
    }
}

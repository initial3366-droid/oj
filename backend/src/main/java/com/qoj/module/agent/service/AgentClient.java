package com.qoj.module.agent.service;

import com.qoj.module.setting.vo.AgentSettingsVO;

import java.util.List;
import java.util.function.Consumer;
import org.springframework.ai.content.Media;

/**
 * AgentClient接口。定义模块之间可依赖的稳定能力边界。
 */
public interface AgentClient {
    /**
     * 封装chat相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt);

    default String chat(AgentSettingsVO agent, String systemPrompt, String userPrompt, List<Media> media) {
        if (!media.isEmpty()) throw new com.qoj.common.exception.BizException(400, "当前 AI 客户端不支持图片");
        return chat(agent, systemPrompt, userPrompt);
    }

    /** 将对话增量传给调用方，供服务端 SSE 接口实时转发。 */
    void streamChat(AgentSettingsVO agent, List<Message> messages, Consumer<String> onDelta);

    default void streamChat(AgentSettingsVO agent, List<Message> messages, Consumer<String> onDelta,
                            java.util.function.BooleanSupplier cancelled) {
        streamChat(agent, messages, content -> {
            if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
            onDelta.accept(content);
        });
    }

    /** Native tool-call loop. Implementations must return each observation to the model. */
    default void runAgent(AgentSettingsVO agent, List<Message> messages,
                         List<org.springframework.ai.tool.ToolCallback> tools, Consumer<String> onDelta,
                         Consumer<ToolEvent> onTool) {
        throw new com.qoj.common.exception.BizException(503, "当前 AI 客户端不支持工具调用");
    }

    default boolean runAgentSegment(AgentSettingsVO agent, List<Message> messages,
                                    List<org.springframework.ai.tool.ToolCallback> tools, AgentRunState state,
                                    Runnable checkpoint, java.util.function.BooleanSupplier cancelled, Consumer<String> onDelta, Consumer<ToolEvent> onTool) {
        runAgent(agent, messages, tools, onDelta, onTool);
        state.complete = true;
        checkpoint.run();
        return true;
    }

    record ToolEvent(String phase, String name, String callId, boolean success, String data, boolean cached) {
        public ToolEvent(String phase, String name, String callId, boolean success, String data) {
            this(phase, name, callId, success, data, false);
        }
    }

    record Message(String role, String content, List<Media> media) {
        public Message(String role, String content) { this(role, content, List.of()); }
    }
}

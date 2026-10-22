package com.qoj.module.agent.service;

import com.qoj.module.setting.vo.AgentSettingsVO;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import reactor.core.publisher.Flux;
import static org.junit.jupiter.api.Assertions.*;

class AgentReplyBudgetTest {
    @Test
    void requestsLongReplyBudgetAndDisclosesProviderTruncation() {
        var captured = new AtomicReference<Prompt>();
        var factory = new AgentModelFactory() {
            @Override public Flux<ChatResponse> stream(AgentSettingsVO settings, Prompt prompt) {
                captured.set(prompt);
                return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage("部分回复"),
                    ChatGenerationMetadata.builder().finishReason("length").build()))));
            }
        };
        var output = new StringBuilder();
        var state = new AgentRunState();
        assertTrue(new OpenAiCompatibleAgentClient(factory).runAgentSegment(new AgentSettingsVO(), List.of(), List.of(),
            state, () -> {}, () -> false, output::append, event -> {}));
        assertEquals(65536, ((OpenAiChatOptions) captured.get().getOptions()).getMaxTokens());
        assertTrue(output.toString().contains("输出上限"));
    }
}

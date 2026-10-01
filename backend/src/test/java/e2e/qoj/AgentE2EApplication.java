package e2e.qoj;

import com.qoj.QojApplication;
import com.qoj.module.agent.service.AgentModelFactory;
import com.qoj.module.setting.vo.AgentSettingsVO;
import java.time.Duration;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;

/** HTTP E2E fixture only: the real SDK talks to a local scripted provider. No JUnit or production hook. */
public class AgentE2EApplication {
    public static void main(String[] args) {
        new SpringApplication(QojApplication.class, ProviderFixture.class).run(args);
    }

    @Configuration(proxyBeanMethods = false)
    public static class ProviderFixture {
        @Bean
        @Primary
        AgentModelFactory scriptedModels(org.springframework.core.env.Environment environment) {
            String url = environment.getRequiredProperty("e2e.provider-url");
            var model = OpenAiChatModel.builder().options(OpenAiChatOptions.builder()
                .baseUrl(url).apiKey("e2e-placeholder").model("e2e-model")
                .timeout(Duration.ofSeconds(120)).maxRetries(0).build()).build();
            return new AgentModelFactory() {
                @Override public OpenAiChatModel get(AgentSettingsVO settings) { return model; }
                @Override public OpenAiChatModel getStreaming(AgentSettingsVO settings) { return model; }
            };
        }

        @Bean
        static BeanFactoryPostProcessor disableBackgroundSchedules() {
            return factory -> {
                if (factory instanceof org.springframework.beans.factory.support.BeanDefinitionRegistry registry) {
                    String name = "org.springframework.context.annotation.internalScheduledAnnotationProcessor";
                    if (registry.containsBeanDefinition(name)) registry.removeBeanDefinition(name);
                }
            };
        }
    }
}

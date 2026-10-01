package com.qojagent.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qojagent.service.AgentDraftClient;
import com.qojagent.service.AgentAuthClient;
import com.qojagent.service.AgentException;
import com.qojagent.service.ProblemGenerationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping
public class AgentController {
    private final ProblemGenerationService generationService;
    private final AgentAuthClient authClient;
    private final AgentDraftClient draftClient;
    private final ObjectMapper objectMapper;

    public AgentController(
        ProblemGenerationService generationService,
        AgentAuthClient authClient,
        AgentDraftClient draftClient,
        ObjectMapper objectMapper
    ) {
        this.generationService = generationService;
        this.authClient = authClient;
        this.draftClient = draftClient;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping(value = "/v1/problem/generate", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> generate(
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
        @Valid @org.springframework.web.bind.annotation.RequestBody ProblemGenerateRequest request
    ) {
        authClient.requireAdmin(authorization);
        StreamingResponseBody body = outputStream -> {
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
                try {
                    ProblemGenerationService.Workspace workspace = generationService.generate(request, event -> {
                        try {
                            writeEvent(writer, "progress", event);
                        } catch (IOException e) {
                            throw new UncheckedIOException(e);
                        }
                    });
                    writeEvent(writer, "complete", workspace);
                } catch (UncheckedIOException e) {
                    throw e.getCause();
                } catch (AgentException e) {
                    writeEvent(writer, "error", Map.of("message", e.getMessage()));
                } catch (Exception e) {
                    writeEvent(writer, "error", Map.of("message", "Agent 生成失败，请检查服务配置和验题环境"));
                }
            }
        };
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .header("Cache-Control", "no-cache, no-transform")
            .header("X-Accel-Buffering", "no")
            .body(body);
    }

    @PostMapping(value = "/v1/problem/draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> saveDraft(
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
        @RequestHeader(value = "X-QOJ-Authorization", required = false) String qojAuthorization,
        @RequestParam("basic") String basic,
        @RequestPart("file") MultipartFile file
    ) {
        String userAuthorization = qojAuthorization == null || qojAuthorization.isBlank() ? authorization : qojAuthorization;
        authClient.requireAdmin(userAuthorization);
        return ResponseEntity.ok(draftClient.saveDraft(userAuthorization, basic, file));
    }

    @ExceptionHandler(AgentException.class)
    public ResponseEntity<String> handleAgentException(AgentException exception) {
        return ResponseEntity.status(exception.status()).contentType(MediaType.TEXT_PLAIN).body(exception.getMessage());
    }

    private void writeEvent(BufferedWriter writer, String name, Object data) throws IOException {
        writer.write("event: ");
        writer.write(name);
        writer.write("\ndata: ");
        writer.write(objectMapper.writeValueAsString(data));
        writer.write("\n\n");
        writer.flush();
    }
}

package com.qojagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qojagent.api.ProblemGenerateRequest;
import com.qojagent.config.AgentSettings;
import com.qojagent.config.AgentSettingsClient;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatModel.ResponseFormat;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/** Owns the Go agent's problem creation flow while keeping execution isolated from the QOJ API process. */
@Service
public class ProblemGenerationService {
    private static final int MAX_WORKSPACE_FILES = 300;
    private static final long MAX_WORKSPACE_BYTES = 16L * 1024 * 1024;
    private static final int MAX_SCRIPT_OUTPUT_CHARS = 6000;
    private static final List<String> REQUIRED_FILES = List.of(
        "config.json", "docs/statement.md", "src/solution.cpp", "src/solution2.cpp",
        "src/generator/generator.cpp", "src/validator/validator.cpp", "src/checker/checker.cpp"
    );
    private static final String OUTPUT_SCHEMA = """
        {"type":"object","additionalProperties":false,"required":["slug","title","problem","files"],
         "properties":{"slug":{"type":"string","pattern":"^[a-z0-9-]{3,64}$"},"title":{"type":"string"},
         "problem":{"type":"object","additionalProperties":false,"required":["title","rating","knowledgePoints","statementHtml","statementLatex","inputFormatHtml","inputFormatLatex","outputFormatHtml","outputFormatLatex","samples"],
         "properties":{"title":{"type":"string"},"rating":{"type":"string"},"knowledgePoints":{"type":"array","items":{"type":"string"}},
         "statementHtml":{"type":"string"},"statementLatex":{"type":"string"},"inputFormatHtml":{"type":"string"},"inputFormatLatex":{"type":"string"},
         "outputFormatHtml":{"type":"string"},"outputFormatLatex":{"type":"string"},"samples":{"type":"array","items":{"type":"object","additionalProperties":false,
         "required":["input","output","explanation"],"properties":{"input":{"type":"string"},"output":{"type":"string"},"explanation":{"type":"string"}}}}}},
         "files":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["path","content"],"properties":{"path":{"type":"string"},"content":{"type":"string"}}}}}}
        """;
    private static final String ORIGINALITY_SCHEMA = """
        {"type":"object","additionalProperties":false,"required":["found","summary","sources"],"properties":{"found":{"type":"boolean"},"summary":{"type":"string"},"sources":{"type":"array","items":{"type":"string"}}}}
        """;

    private final ObjectMapper objectMapper;
    private final AgentModelFactory modelFactory;
    private final AgentSettingsClient settingsClient;
    private final HttpClient httpClient;

    @Value("${icpc.skill-path:/opt/icpc-problem-creator/SKILL.md}")
    private String skillPath;
    @Value("${icpc.skill-root:/opt/icpc-problem-creator}")
    private String skillRoot;
    @Value("${agent.workspace-root:/var/lib/qoj-agent/workspaces}")
    private String workspaceRoot;
    @Value("${agent.powershell-command:pwsh}")
    private String powershellCommand;
    @Value("${agent.validation-timeout-ms:600000}")
    private long validationTimeoutMs;

    public ProblemGenerationService(ObjectMapper objectMapper, AgentModelFactory modelFactory, AgentSettingsClient settingsClient) {
        this.objectMapper = objectMapper;
        this.modelFactory = modelFactory;
        this.settingsClient = settingsClient;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public Workspace generate(ProblemGenerateRequest request, Consumer<ProgressEvent> emit) {
        AgentSettings settings = settingsClient.load();
        if (!Boolean.TRUE.equals(settings.enabled())) throw new AgentException(503, "AI 助手未启用");
        if (settings.apiKey() == null || settings.apiKey().isBlank() || settings.model() == null || settings.model().isBlank()) {
            throw new AgentException(503, "AI 服务配置不完整");
        }

        String skill = readSkill();
        String requestJson = writeJson(request);
        String instructions = skill + "\n\n你必须输出完整题目工作区文件。严格遵循 skill 的 config.json、validator、generator、checker、solution、solution2、wrong solutions 和 docs 要求。所有 files 的 key 必须是相对路径，禁止绝对路径、..、脚本和二进制。";
        emit.accept(new ProgressEvent("plan", "已加载 ICPC Problem Creator skill，开始原创性检索", 5));

        Workspace workspace = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            emit.accept(new ProgressEvent("think", "原创性检查第 " + attempt + " 轮：搜索公开题库和题面", 8 + attempt * 8));
            OriginalityDecision decision = searchOriginalProblems(settings, requestJson);
            emit.accept(new ProgressEvent("observe", decision.summary(), 18 + attempt * 8));
            if (decision.found()) {
                requestJson += "\n上一轮观察到高度相似原题，必须改变核心机制、数据约束和叙事后重新命题。搜索摘要：" + decision.summary();
                continue;
            }

            workspace = generateStructured(settings, instructions + "\n\n这是网页检索后的观察结果：" + decision.summary(), requestJson);
            String validationError = validateWorkspace(workspace);
            for (int repair = 1; validationError != null && repair <= 2; repair++) {
                emit.accept(new ProgressEvent("reflect", "生成结果缺少必需文件，正在修复（第 " + repair + " 轮）", 30 + repair * 5));
                String repairPrompt = instructions + "\n\n上一轮生成结果未通过工作区完整性检查。请补齐所有缺失文件并重新输出完整 files 数组。校验错误：" + validationError;
                workspace = generateStructured(settings, repairPrompt, requestJson);
                validationError = validateWorkspace(workspace);
            }
            if (validationError != null) throw new AgentException(502, "AI 生成工作区未通过完整性检查：" + validationError);
            break;
        }
        if (workspace == null) throw new AgentException(502, "连续检测到公开原题，未能生成原创题目");

        Path directory = createWorkspaceDirectory(workspace.slug());
        writeFiles(directory, workspace.files());
        emit.accept(new ProgressEvent("generate", "基于用户描述生成原创题目工作区", 45));
        for (int attempt = 1; attempt <= 3; attempt++) {
            String validationOutput = runValidation(directory, emit);
            if (validationOutput.isBlank()) {
                emit.accept(new ProgressEvent("verify", "出题、验题、跑测试全部通过", 90));
                return workspace;
            }
            if (attempt == 3) throw new AgentException(422, "skill 全量验题脚本连续 3 轮未通过：" + validationOutput);

            emit.accept(new ProgressEvent("reflect", "第 " + attempt + " 轮验题失败，带着失败日志重新生成", 65 + attempt * 8));
            String repairPrompt = instructions + "\n\n上一轮本地全量验题失败。请根据失败反馈修复题面、标程、generator、validator、checker 或测试设计，并重新输出完整工作区。失败反馈：" + validationOutput;
            workspace = generateStructured(settings, repairPrompt, requestJson);
            String workspaceError = validateWorkspace(workspace);
            if (workspaceError != null) throw new AgentException(502, "AI 修复工作区未通过完整性检查：" + workspaceError);
            writeFiles(directory, workspace.files());
        }
        throw new AgentException(422, "题目验证失败");
    }

    private OriginalityDecision searchOriginalProblems(AgentSettings settings, String input) {
        try {
            URI endpoint = apiBaseUri(settings).resolve("responses");
            String body = objectMapper.writeValueAsString(Map.of(
                "model", settings.model(),
                "instructions", "搜索网络中的竞赛题库、博客和公开题面，判断用户给出的题意是否存在高度相同的原题。必须引用搜索观察结果，不能因为只有知识点相同就判定重复。",
                "input", input,
                "text", Map.of("format", Map.of("type", "json_schema", "name", "original_problem_check",
                    "schema", objectMapper.readTree(ORIGINALITY_SCHEMA), "strict", true)),
                "tools", List.of(Map.of("type", "web_search_preview"))
            ));
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + settings.apiKey())
                .timeout(Duration.ofMillis(timeout(settings)))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AgentException(502, "原创性检索服务返回 HTTP " + response.statusCode());
            }
            JsonNode result = objectMapper.readTree(response.body());
            String outputText = result.path("output_text").asText("");
            if (!outputText.isBlank()) return objectMapper.readValue(outputText, OriginalityDecision.class);
            for (JsonNode item : result.path("output")) {
                for (JsonNode content : item.path("content")) {
                    if (content.hasNonNull("parsed")) return objectMapper.treeToValue(content.get("parsed"), OriginalityDecision.class);
                    String text = content.path("text").asText("");
                    if (!text.isBlank()) return objectMapper.readValue(text, OriginalityDecision.class);
                }
            }
            throw new AgentException(502, "原创性检索服务未返回结构化结果");
        } catch (AgentException e) {
            throw e;
        } catch (Exception e) {
            throw new AgentException(502, "原创性检索失败，请检查 AI 服务的 Responses API 与联网搜索配置");
        }
    }

    private Workspace generateStructured(AgentSettings settings, String instructions, String input) {
        try {
            OpenAiChatModel model = modelFactory.get(settings);
            OpenAiChatOptions outputOptions = OpenAiChatOptions.builder()
                .responseFormat(ResponseFormat.builder().type(ResponseFormat.Type.JSON_SCHEMA).jsonSchema(OUTPUT_SCHEMA).strict(true).build())
                .build();
            ChatResponse response = model.call(new Prompt(
                List.of(new SystemMessage(instructions), new UserMessage(input)), outputOptions
            ));
            if (response == null || response.getResult() == null || response.getResult().getOutput().getText() == null) {
                throw new AgentException(502, "AI 服务未返回结构化题目");
            }
            return objectMapper.readValue(response.getResult().getOutput().getText(), Workspace.class);
        } catch (AgentException e) {
            throw e;
        } catch (Exception e) {
            throw new AgentException(502, "AI 题目生成失败，请检查模型是否支持 JSON Schema 输出");
        }
    }

    private String readSkill() {
        Path path = Paths.get(skillPath).toAbsolutePath().normalize();
        if (!Files.isRegularFile(path)) throw new AgentException(503, "ICPC Problem Creator skill 未挂载：" + path);
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new AgentException(500, "无法读取 ICPC Problem Creator skill");
        }
    }

    private Path createWorkspaceDirectory(String slug) {
        Path root = Paths.get(workspaceRoot).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
            return Files.createTempDirectory(root, slug + "-");
        } catch (IOException e) {
            throw new AgentException(500, "无法创建题目工作区目录");
        }
    }

    private void writeFiles(Path directory, List<GeneratedFile> files) {
        for (GeneratedFile file : files) {
            Path relative = Paths.get(file.path().replace('/', java.io.File.separatorChar));
            Path target = directory.resolve(relative).normalize();
            if (relative.isAbsolute() || file.path().contains("\\") || !target.startsWith(directory) || target.equals(directory)) {
                throw new AgentException(400, "生成文件包含不安全路径：" + file.path());
            }
            try {
                Files.createDirectories(target.getParent());
                Files.writeString(target, file.content(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new AgentException(500, "写入生成工作区失败：" + file.path());
            }
        }
    }

    private String validateWorkspace(Workspace workspace) {
        if (workspace == null || workspace.slug() == null || !workspace.slug().matches("[a-z0-9-]{3,64}") ||
            workspace.title() == null || workspace.problem() == null || workspace.problem().samples() == null ||
            workspace.files() == null || workspace.files().isEmpty()) return "工作区结构不完整";
        if (workspace.files().size() > MAX_WORKSPACE_FILES) return "文件数量超过 " + MAX_WORKSPACE_FILES;
        long totalBytes = 0;
        for (GeneratedFile file : workspace.files()) {
            if (file == null || file.path() == null || file.content() == null || file.path().length() > 240) return "文件路径或内容无效";
            totalBytes += file.content().getBytes(StandardCharsets.UTF_8).length;
            if (totalBytes > MAX_WORKSPACE_BYTES) return "工作区文件总大小超过 16 MiB";
            try {
                Path relative = Paths.get(file.path());
                if (relative.isAbsolute() || file.path().contains("\\") || relative.normalize().startsWith("..")) return "文件路径不安全：" + file.path();
            } catch (RuntimeException e) {
                return "文件路径无效：" + file.path();
            }
        }
        for (String required : REQUIRED_FILES) {
            if (workspace.files().stream().noneMatch(file -> file != null && required.equals(file.path()))) return "缺少必需文件 " + required;
        }
        return null;
    }

    private String runValidation(Path workspace, Consumer<ProgressEvent> emit) {
        Path root = Paths.get(skillRoot).toAbsolutePath().normalize();
        Path script = root.resolve("scripts/run-all-tests.ps1").normalize();
        if (!script.startsWith(root) || !Files.isRegularFile(script)) throw new AgentException(503, "ICPC Problem Creator 全量验题脚本未挂载");

        Process process;
        try {
            process = new ProcessBuilder(powershellCommand, "-NoLogo", "-NoProfile", "-NonInteractive", "-File", script.toString(), "-Workspace", workspace.toString())
                .directory(root.toFile()).redirectErrorStream(true).start();
        } catch (IOException e) {
            throw new AgentException(503, "Agent 容器未安装 PowerShell（pwsh）");
        }
        CompletableFuture<String> output = CompletableFuture.supplyAsync(() -> readTail(process));
        try {
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(validationTimeoutMs);
            while (process.isAlive()) {
                long remainingNanos = deadline - System.nanoTime();
                if (remainingNanos <= 0) {
                    process.destroyForcibly();
                    output.cancel(true);
                    throw new AgentException(504, "全量验题脚本运行超时");
                }
                long waitMs = Math.max(1L, Math.min(TimeUnit.NANOSECONDS.toMillis(remainingNanos), 5000L));
                if (!process.waitFor(waitMs, TimeUnit.MILLISECONDS)) {
                    emit.accept(new ProgressEvent("test", "验题脚本运行中，正在编译并执行测试点", 60));
                }
            }
            String tail = output.get(30, TimeUnit.SECONDS);
            return process.exitValue() == 0 ? "" : (tail.isBlank() ? "验题脚本退出码 " + process.exitValue() : tail);
        } catch (InterruptedException e) {
            process.destroyForcibly();
            output.cancel(true);
            Thread.currentThread().interrupt();
            throw new AgentException(503, "题目验证已中断");
        } catch (AgentException e) {
            throw e;
        } catch (RuntimeException e) {
            process.destroyForcibly();
            output.cancel(true);
            throw e;
        } catch (Exception e) {
            process.destroyForcibly();
            output.cancel(true);
            throw new AgentException(500, "读取验题脚本输出失败");
        }
    }

    private String readTail(Process process) {
        StringBuilder tail = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            char[] buffer = new char[1024];
            int read;
            while ((read = reader.read(buffer)) >= 0) {
                tail.append(buffer, 0, read);
                if (tail.length() > MAX_SCRIPT_OUTPUT_CHARS) tail.delete(0, tail.length() - MAX_SCRIPT_OUTPUT_CHARS);
            }
        } catch (IOException e) {
            return "无法读取验题脚本输出";
        }
        return tail.toString();
    }

    private URI apiBaseUri(AgentSettings settings) {
        URI base = modelFactory.validatePublicUrl(settings.baseUrl());
        String path = base.getPath() == null ? "" : base.getPath().replaceAll("/+$", "");
        try {
            return new URI(base.getScheme(), null, base.getHost(), base.getPort(), path + "/", null, null);
        } catch (Exception e) {
            throw new AgentException(400, "AI 服务地址无效");
        }
    }

    private long timeout(AgentSettings settings) {
        return settings.timeoutMs() == null || settings.timeoutMs() <= 0 ? 30000L : settings.timeoutMs();
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (IOException e) {
            throw new AgentException(500, "无法序列化出题请求");
        }
    }

    public record ProgressEvent(String stage, String message, int percent) {}
    public record Workspace(String slug, String title, Problem problem, List<GeneratedFile> files) {}
    public record GeneratedFile(String path, String content) {}
    public record Problem(String title, String rating, List<String> knowledgePoints, String statementHtml, String statementLatex,
        String inputFormatHtml, String inputFormatLatex, String outputFormatHtml, String outputFormatLatex, List<Sample> samples) {}
    public record Sample(String input, String output, String explanation) {}
    public record OriginalityDecision(boolean found, String summary, List<String> sources) {}
}

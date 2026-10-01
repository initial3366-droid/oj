package com.qoj.module.agent.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.judge.JudgeService.SandboxResult;
import com.qoj.module.judge.gojudge.GoJudgeService;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.submission.service.SandboxExecutionGuard;
import com.qoj.security.CurrentUser;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Generated answers come from the isolated judge, and are reused by reference rather than rewritten by the model. */
@Service
public class AdminAgentGenerationService {
    private static final int MAX_CASES = 200;
    private static final int MAX_TOTAL_BYTES = 8 * 1024 * 1024;
    private final GoJudgeService judge;
    private final SandboxExecutionGuard guard;
    private final StringRedisTemplate redis;
    private final ObjectMapper json;

    public AdminAgentGenerationService(GoJudgeService judge, SandboxExecutionGuard guard, StringRedisTemplate redis, ObjectMapper json) {
        this.judge = judge; this.guard = guard; this.redis = redis; this.json = json;
    }

    public SandboxResult runCode(JsonNode args, BooleanSupplier cancelled) {
        requireAdmin();
        try (var permit = guard.acquire(-CurrentUser.required().id())) {
            var result = judge.runCustomBatch(language(args, "language", "python"), code(args, "code"),
                List.of(args.path("input").asText("")), cancelled).get(0);
            if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
            return result;
        }
    }

    public Map<String, Object> generate(JsonNode args, BooleanSupplier cancelled) {
        requireAdmin();
        String language = language(args, "language", "python"), solution = code(args, "code");
        var inputs = new ArrayList<String>();
        try (var permit = guard.acquire(-CurrentUser.required().id())) {
            if (args.has("generatorCode") && args.has("inputs")) throw new BizException(400, "inputs 与 generatorCode 请选择一种");
            if (args.has("generatorCode")) {
                var generated = judge.runCustomBatch(language(args, "generatorLanguage", "python"), code(args, "generatorCode"), List.of(""), cancelled).get(0);
                requireSuccess(generated, "输入生成器");
                try {
                    JsonNode array = json.readTree(generated.output());
                    readInputs(array, inputs);
                } catch (BizException e) { throw e; }
                catch (Exception e) { throw new BizException(400, "输入生成器必须输出 JSON 字符串数组，每项是一份完整测试输入"); }
            } else readInputs(args.path("inputs"), inputs);
            var sampleInputs = new ArrayList<String>();
            var sampleOutputs = new ArrayList<String>();
            if (args.has("samples")) {
                if (!args.path("samples").isArray() || args.path("samples").size() > 20) throw new BizException(400, "校验样例不能超过 20 组");
                for (var sample : args.path("samples")) {
                    if (!sample.path("input").isTextual() || !sample.path("output").isTextual()) throw new BizException(400, "校验样例需要输入和原始答案");
                    sampleInputs.add(sample.path("input").asText()); sampleOutputs.add(sample.path("output").asText());
                }
            }
            var allInputs = new ArrayList<>(sampleInputs); allInputs.addAll(inputs);
            long totalBytes = allInputs.stream().mapToLong(AdminAgentGenerationService::bytes).sum();
            if (totalBytes > MAX_TOTAL_BYTES) throw new BizException(400, "本批输入超过 8 MB，请分批生成");
            var results = judge.runCustomBatch(language, solution, allInputs, cancelled);
            for (int i = 0; i < results.size(); i++) requireSuccess(results.get(i), i < sampleInputs.size() ? "样例 " + (i + 1) : "测试点 " + (i - sampleInputs.size() + 1));
            if (results.size() != allInputs.size()) throw new BizException(400, "标程未完成全部输入，未保存生成数据");
            for (int i = 0; i < sampleOutputs.size(); i++) {
                if (!tokens(results.get(i).output()).equals(tokens(sampleOutputs.get(i)))) throw new BizException(400, "标程与样例 " + (i + 1) + " 的答案不符，请修正算法后重新生成");
            }
            var cases = new ArrayList<ProblemTestCaseRequest>();
            for (int i = 0; i < inputs.size(); i++) {
                String output = results.get(i + sampleInputs.size()).output();
                if (output == null || output.isBlank()) throw new BizException(400, "标程产生空答案，未保存生成数据");
                totalBytes += bytes(output);
                if (totalBytes > MAX_TOTAL_BYTES) throw new BizException(400, "本批生成数据超过 8 MB，请减少规模");
                cases.add(new ProblemTestCaseRequest(i + 1, inputs.get(i), output));
            }
            if (cancelled.getAsBoolean()) throw new AgentRunStoppedException();
            String id = UUID.randomUUID().toString();
            try { redis.opsForValue().set(key(id), json.writeValueAsString(cases), Duration.ofHours(6)); }
            catch (Exception e) { throw new BizException(503, "生成数据保存失败，请重试"); }
            return Map.of("generationId", id, "testCaseCount", cases.size(), "sampleChecks", sampleInputs.size(),
                "answerSource", "sandbox_reference_solution", "preview", cases.stream().limit(3).map(item -> Map.of(
                    "caseNo", item.caseNo(), "input", preview(item.input()), "output", preview(item.output()))).toList());
        }
    }

    public List<ProblemTestCaseRequest> cases(String id) {
        requireAdmin();
        if (id == null || !id.matches("[A-Za-z0-9-]{1,80}")) throw new BizException(400, "生成数据标识无效");
        String stored = redis.opsForValue().get(key(id));
        if (stored == null) throw new BizException(404, "生成数据不存在或已过期，请重新生成");
        try { return json.readValue(stored, new TypeReference<List<ProblemTestCaseRequest>>() {}); }
        catch (Exception e) { throw new BizException(500, "生成数据读取失败"); }
    }

    private void readInputs(JsonNode array, List<String> inputs) {
        if (array == null || !array.isArray() || array.isEmpty() || array.size() > MAX_CASES) throw new BizException(400, "每批需要 1～200 个完整测试输入");
        for (var value : array) {
            if (!value.isTextual()) throw new BizException(400, "测试输入必须是字符串");
            inputs.add(value.asText());
        }
    }
    private static void requireSuccess(SandboxResult result, String phase) {
        if (!"AC".equals(result.status())) throw new BizException(400, phase + "运行失败（" + result.status() + "）：" + preview(result.error() == null ? "" : result.error()));
    }
    private static String language(JsonNode args, String field, String fallback) { return args.path(field).asText(fallback); }
    private static String code(JsonNode args, String field) {
        if (!args.path(field).isTextual() || args.path(field).asText().isBlank() || bytes(args.path(field).asText()) > 65536) throw new BizException(400, "代码不能为空且不能超过 64 KB");
        return args.path(field).asText();
    }
    private static int bytes(String value) { return value.getBytes(StandardCharsets.UTF_8).length; }
    private static String tokens(String value) { return value == null ? "" : value.strip().replaceAll("\\s+", " "); }
    private static String preview(String value) { return value.length() <= 500 ? value : value.substring(0, 500) + "[节选]"; }
    private static String key(String id) { return "qoj:admin-agent:generated:" + CurrentUser.required().id() + ":" + id; }
    private static void requireAdmin() { if (!CurrentUser.required().isAdmin()) throw new BizException(403, "仅管理员可使用 Agent 计算工具"); }
}

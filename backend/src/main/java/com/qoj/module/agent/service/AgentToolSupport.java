package com.qoj.module.agent.service;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.qoj.common.exception.BizException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Shared argument contract for both direct callbacks and the approval-aware tool loop. */
final class AgentToolSupport {
    private static final ObjectMapper JSON = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    private static final JsonSchemaFactory FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
    private static final Cache<String, JsonSchema> SCHEMAS = Caffeine.newBuilder().maximumSize(256).build();
    private static final JsonNode CATALOG = loadCatalog();

    private AgentToolSupport() {}

    static String schema(String name, String fallback) {
        JsonNode selected = CATALOG.path("tools").path(name);
        if (selected.isMissingNode()) {
            return fallback;
        }
        ObjectNode schema = selected.deepCopy();
        schema.set("$defs", CATALOG.path("$defs"));
        return schema.toString();
    }

    static JsonNode validate(String schema, String arguments) {
        JsonNode value;
        try {
            if (arguments == null || arguments.length() > 100000) {
                throw new IllegalArgumentException();
            }
            value = JSON.readTree(arguments);
        } catch (Exception e) {
            throw new InvalidArguments(List.of(new Violation("$", "参数必须是有效的单个 JSON 对象，不允许重复字段，且不能超过 100000 字符")));
        }
        if (value == null || !value.isObject()) {
            throw new InvalidArguments(List.of(new Violation("$", "参数必须是 JSON 对象")));
        }
        var compiled = SCHEMAS.get(schema, text -> FACTORY.getSchema(text));
        var errors = compiled.validate(value).stream()
            .sorted(Comparator.comparing((ValidationMessage error) -> error.getInstanceLocation().toString())
                .thenComparing(ValidationMessage::getType))
            .limit(20).map(AgentToolSupport::violation).toList();
        if (!errors.isEmpty()) {
            throw new InvalidArguments(errors);
        }
        return value;
    }

    private static Violation violation(ValidationMessage error) {
        String field = error.getInstanceLocation().toString();
        String property = error.getProperty();
        if (property != null && !property.isBlank() && !field.endsWith("." + property)) {
            field += "." + property;
        }
        if (field.startsWith("$.")) {
            field = field.substring(2);
        }
        String message = error.getMessage();
        Object[] arguments = error.getArguments();
        String expected = arguments != null && arguments.length > 0 ? String.valueOf(arguments[0]) : "Schema 约束";
        message = switch (error.getType()) {
            case "minimum" -> field + " 必须大于等于 " + expected;
            case "maximum" -> field + " 必须小于等于 " + expected;
            case "required" -> field + " 缺少必填字段：" + expected;
            case "type" -> field + " 类型不正确：" + message;
            case "oneOf" -> field + " 必须且只能满足一种参数组合：" + message;
            case "not" -> field + " 包含不允许同时提供的字段：" + message;
            default -> message;
        };
        return new Violation(field, message);
    }

    static AgentRunState.Outcome success(String raw, String requestId) {
        try {
            JsonNode data = JSON.readTree(raw);
            var result = JSON.createObjectNode();
            result.put("ok", true);
            result.set("data", data == null ? JSON.nullNode() : data);
            result.set("warnings",
                data != null && data.path("warnings").isArray() ? data.path("warnings") : JSON.createArrayNode());
            result.put("requestId", requestId);
            return new AgentRunState.Outcome(result.toString(), true);
        } catch (Exception e) {
            return failure("INVALID_RESULT", "$", "工具未返回有效 JSON，请核实操作结果后再试", requestId);
        }
    }

    static AgentRunState.Outcome failure(Exception exception, String requestId) {
        if (exception instanceof InvalidArguments invalid) {
            var first = invalid.violations.get(0);
            var result = JSON.createObjectNode();
            result.put("ok", false);
            result.set("error", JSON.valueToTree(Map.of("code", "INVALID_ARGUMENT", "field", first.field(), "message",
                first.message(), "violations", invalid.violations)));
            result.set("warnings", JSON.createArrayNode());
            result.put("requestId", requestId);
            return new AgentRunState.Outcome(result.toString(), false);
        }
        String code = exception instanceof BizException biz ? switch (biz.getCode()) {
            case 400 -> "INVALID_ARGUMENT";
            case 401, 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            default -> "BUSINESS_ERROR";
        } : "TOOL_EXECUTION_FAILED";
        return failure(code, "$", exception instanceof BizException ? exception.getMessage() : "工具执行失败，请核实操作结果后重试",
            requestId);
    }

    static AgentRunState.Outcome failure(String code, String field, String message, String requestId) {
        return new AgentRunState.Outcome(
            JSON.valueToTree(Map.of("ok", false, "error", Map.of("code", code, "field", field, "message", message),
                "warnings", List.of(), "requestId", requestId)).toString(),
            false);
    }

    static AgentRunState.Outcome withRequestId(AgentRunState.Outcome outcome, String requestId) {
        try {
            ObjectNode result = (ObjectNode)JSON.readTree(outcome.data());
            result.put("requestId", requestId);
            return new AgentRunState.Outcome(result.toString(), outcome.success());
        } catch (Exception e) {
            return failure("INVALID_RESULT", "$", "缓存结果格式无效", requestId);
        }
    }

    private static JsonNode loadCatalog() {
        try (var input = AgentToolSupport.class.getResourceAsStream("/agent/tool-schemas.json")) {
            if (input == null) {
                throw new IllegalStateException("Missing Agent tool schemas");
            }
            return JSON.readTree(input);
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    record Violation(String field, String message) {
    }

    static final class InvalidArguments extends BizException {
        final List<Violation> violations;

        InvalidArguments(List<Violation> violations) {
            super(400, violations.get(0).message());
            this.violations = violations;
        }
    }
}

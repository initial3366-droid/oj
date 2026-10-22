package com.qoj.module.agent.service;

import java.util.*;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.security.CurrentUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.regex.Pattern;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.http.ContentDisposition;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.validation.BindException;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** Enumerates actual MVC routes and invokes their original binding, validation and secured controllers. */
@Service
public class AdminAgentApiService {
    private final ObjectProvider<RequestMappingHandlerMapping> mappings;
    private final ObjectProvider<RequestMappingHandlerAdapter> adapters;
    private final WebApplicationContext context;
    private final ObjectMapper json;
    private final AdminChatFileService files;
    private final SystemSettingService settings;
    private final String prefix;
    private volatile Map<String, Endpoint> catalog;
    private static final int INLINE_LIMIT = 24000;
    private static final Map<String, String> MODULE_LABELS = Map.ofEntries(
        Map.entry("courses", "课程"), Map.entry("practices", "练习题单发布"), Map.entry("problems", "题目题解"),
        Map.entry("users", "用户学生批量管理"), Map.entry("students", "学生导入"), Map.entry("classes", "班级"),
        Map.entry("teachers", "教师"), Map.entry("teams", "团队"), Map.entry("majors", "专业"),
        Map.entry("contests", "比赛网段报名榜单"), Map.entry("submissions", "提交"),
        Map.entry("submission-queue", "判题队列"), Map.entry("home", "首页轮播"), Map.entry("settings", "站点设置"),
        Map.entry("agent", "AI配额"), Map.entry("announcements", "公告"), Map.entry("dashboard", "概况"),
        Map.entry("problem-drafts", "题目草稿"), Map.entry("problem-folders", "题库文件夹"));

    public AdminAgentApiService(ObjectProvider<RequestMappingHandlerMapping> mappings,
                               ObjectProvider<RequestMappingHandlerAdapter> adapters, WebApplicationContext context,
                               ObjectMapper json, AdminChatFileService files,
                               SystemSettingService settings,
                               @Value("${admin.api-prefix:/api/admin/v1}") String prefix) {
        this.mappings = mappings; this.adapters = adapters; this.context = context;
        this.json = json; this.files = files; this.settings = settings; this.prefix = prefix.replaceAll("/+$", "");
    }

    private void requireAdmin() {
        if (!CurrentUser.required().isAdmin()) throw new BizException(403, "仅超级管理员可调用管理接口");
    }

    private Map<String, Endpoint> endpoints() {
        if (catalog != null) return catalog;
        synchronized (this) {
            if (catalog != null) return catalog;
            var found = new TreeMap<String, Endpoint>();
            mappings.getObject().getHandlerMethods().forEach((mapping, handler) -> {
                for (String path : mapping.getPatternValues()) {
                    if (!path.startsWith(prefix + "/")) continue;
                    String relative = path.substring(prefix.length());
                    if (excluded(relative, handler)) continue;
                    for (var method : mapping.getMethodsCondition().getMethods()) {
                        if (!Set.of("GET", "POST", "PUT", "PATCH", "DELETE").contains(method.name())) continue;
                        String id = method.name() + " " + path;
                        found.put(id, new Endpoint(id, method.name(), path, relative.split("/")[1], handler));
                    }
                }
            });
            catalog = Collections.unmodifiableMap(found);
            return catalog;
        }
    }

    private boolean excluded(String relative, HandlerMethod handler) {
        // Authentication and the Agent's own transport/approval/history are never capabilities.
        return handler.getBeanType().getSimpleName().contains("AuthController")
            || relative.equals("/me") || relative.startsWith("/auth/")
            || relative.startsWith("/agent/chat") || relative.contains("/password")
            || relative.contains("/xcpcio")
            || relative.contains("/login") || relative.contains("/logout") || relative.contains("/refresh");
    }

    public Object list(JsonNode args) {
        requireAdmin();
        String module = args.path("module").asText("");
        String keyword = args.path("keyword").asText("").toLowerCase(Locale.ROOT);
        int offset = Math.max(0, args.path("offset").asInt(0));
        int limit = Math.max(1, Math.min(40, args.path("limit").asInt(20)));
        var selected = endpoints().values().stream()
            .filter(e -> module.isEmpty() || e.module().equals(module))
            .filter(e -> keyword.isEmpty() || e.id().toLowerCase(Locale.ROOT).contains(keyword)
                || MODULE_LABELS.getOrDefault(e.module(), "").toLowerCase(Locale.ROOT).contains(keyword)
                || e.handler().getMethod().getName().toLowerCase(Locale.ROOT).contains(keyword)).toList();
        return Map.of("modules", endpoints().values().stream().map(Endpoint::module).distinct().sorted().toList(),
            "totalAvailable", endpoints().size(), "total", selected.size(), "offset", offset,
            "nextOffset", Math.min(selected.size(), (long) offset + limit), "hasMore", (long) offset + limit < selected.size(),
            "endpoints", selected.stream().skip(offset).limit(limit).map(this::summary).toList(),
            "excluded", List.of("后台登录、当前管理员资料、密码、令牌接口", "Agent 聊天、审批、历史及文件传输接口", "旧 XCPCIO 配置及同步接口"),
            "rule", "查询用 read_admin_api；所有非 GET 接口用 write_admin_api，必须逐项由用户确认。附件只接受当前聊天的 fileId。");
    }

    private Map<String, Object> summary(Endpoint e) {
        return Map.of("endpoint", e.id(), "module", e.module(), "moduleLabel", MODULE_LABELS.getOrDefault(e.module(), e.module()), "action", e.handler().getMethod().getName(),
            "tool", e.readOnly() ? "read_admin_api" : "write_admin_api", "requiresApproval", !e.readOnly());
    }

    public Object describe(JsonNode args) {
        requireAdmin();
        Endpoint e = endpoint(args);
        var result = new LinkedHashMap<>(summary(e));
        var parameters = new ArrayList<Map<String, Object>>();
        for (var parameter : e.handler().getMethodParameters()) {
            parameter.initParameterNameDiscovery(new DefaultParameterNameDiscoverer());
            var path = parameter.getParameterAnnotation(PathVariable.class);
            var query = parameter.getParameterAnnotation(RequestParam.class);
            var part = parameter.getParameterAnnotation(RequestPart.class);
            var body = parameter.getParameterAnnotation(RequestBody.class);
            if (path == null && query == null && part == null && body == null) continue;
            String location = body != null ? "body" : path != null ? "path" :
                MultipartFile.class.isAssignableFrom(parameter.getParameterType()) ? "files" : "query";
            String name = body != null ? "body" : path != null ? first(path.name(), path.value(), parameter.getParameterName())
                : query != null ? first(query.name(), query.value(), parameter.getParameterName())
                : first(part.name(), part.value(), parameter.getParameterName());
            var info = new LinkedHashMap<String, Object>();
            info.put("in", location); info.put("name", name);
            info.put("required", body != null ? body.required() : path != null ? path.required() :
                query != null ? query.required() && ValueConstants.DEFAULT_NONE.equals(query.defaultValue()) : part.required());
            if (query != null && !ValueConstants.DEFAULT_NONE.equals(query.defaultValue())) info.put("default", query.defaultValue());
            info.put("schema", location.equals("files") ? Map.of("type", "string", "description", "当前聊天附件 fileId") :
                schema(json.constructType(parameter.getGenericParameterType()), e, 0, new HashSet<>()));
            parameters.add(info);
        }
        result.put("parameters", parameters);
        result.put("note", "与原后台接口相同的参数、权限和校验。编辑前查询原记录，提交完整 DTO；凭据不可读写。下载会返回私有文件链接。");
        return result;
    }

    private static String first(String... names) {
        return Arrays.stream(names).filter(n -> n != null && !n.isEmpty()).findFirst().orElse("parameter");
    }

    private Object schema(JavaType type, Endpoint e, int depth, Set<Class<?>> ancestors) {
        Class<?> raw = type.getRawClass();
        if (type.isEnumType()) return Map.of("type", "string", "enum", Arrays.stream(raw.getEnumConstants()).map(Object::toString).toList());
        if (raw == boolean.class || raw == Boolean.class) return Map.of("type", "boolean");
        if (Number.class.isAssignableFrom(raw) || raw.isPrimitive() && raw != char.class)
            return Map.of("type", raw == double.class || raw == float.class || raw == Double.class || raw == Float.class ? "number" : "integer");
        if (type.isCollectionLikeType() || type.isArrayType()) return Map.of("type", "array", "items", schema(type.getContentType(), e, depth + 1, new HashSet<>(ancestors)));
        if (type.isMapLikeType() || raw == Object.class || JsonNode.class.isAssignableFrom(raw)) return Map.of("type", "object");
        if (raw.getName().startsWith("java.")) return Map.of("type", "string", "format", raw.getSimpleName());
        if (depth > 4 || !ancestors.add(raw)) return Map.of("type", "object", "description", raw.getSimpleName());
        var props = new LinkedHashMap<String, Object>();
        var required = new ArrayList<String>();
        for (var property : json.getDeserializationConfig().introspect(type).findProperties()) {
            if (blockedField(e, property.getName())) continue;
            props.put(property.getName(), schema(property.getPrimaryType(), e, depth + 1, new HashSet<>(ancestors)));
            var member = property.getPrimaryMember();
            if (member != null && (member.hasAnnotation(NotNull.class)
                || member.hasAnnotation(NotBlank.class)
                || member.hasAnnotation(NotEmpty.class))) required.add(property.getName());
        }
        return Map.of("type", "object", "properties", props, "required", required);
    }

    private Endpoint endpoint(JsonNode args) {
        Endpoint e = endpoints().get(args.path("endpoint").asText());
        if (e == null) throw new BizException(403, "接口不在 Agent 可用目录中（认证和内部聊天接口不可调用）");
        return e;
    }

    public Object invoke(JsonNode args, boolean writable, Set<String> chatFileIds) {
        requireAdmin();
        Endpoint e = endpoint(args);
        if (writable == e.readOnly()) throw new BizException(403, "查询和写入接口必须使用对应工具；写入需要用户确认");
        rejectCredentials(e, args.path("body"));
        rejectCredentials(e, args.path("query"));
        var pathVars = new LinkedHashMap<String, String>();
        JsonNode paths = args.path("path");
        String uri = e.path();
        var placeholders = Pattern.compile("\\{([^}:]+)(?::[^}]+)?}").matcher(e.path());
        while (placeholders.find()) {
            String name = placeholders.group(1), value = paths.path(name).asText("");
            if (!value.matches("[A-Za-z0-9_-]{1,100}")) throw new BizException(400, "路径参数缺失或无效：" + name);
            pathVars.put(name, value); uri = uri.replace(placeholders.group(), value);
        }
        var uploads = new LinkedHashMap<String, MultipartFile>();
        args.path("files").fields().forEachRemaining(entry -> {
            String id = entry.getValue().asText();
            if (!chatFileIds.contains(id)) throw new BizException(403, "仅可使用本次聊天中已上传的附件");
            var stored = files.read(files.ownerId(), id);
            uploads.put(entry.getKey(), new AdminAgentMvcExchange.Upload(entry.getKey(), stored.name(), stored.data()));
        });
        try {
            JsonNode requestBody = args.get("body");
            if (requestBody instanceof ObjectNode object) {
                requestBody = object.deepCopy();
                // These full-setting DTOs otherwise clear the hidden account identifier when it is omitted.
                if (e.path().equals(prefix + "/settings/system/oss"))
                    ((ObjectNode) requestBody).put("accessKeyId", settings.getOssRuntimeSettings().accessKeyId);
            }
            byte[] body = requestBody != null && !requestBody.isNull() ? json.writeValueAsBytes(requestBody) : new byte[0];
            var exchange = new AdminAgentMvcExchange(context, e.method(), uri, pathVars, args.path("query"), body, uploads);
            exchange.invoke(adapters.getObject(), e.handler());
            if (exchange.status() >= 400) throw new BizException(400, "后台接口返回 HTTP " + exchange.status());
            byte[] response = exchange.bytes();
            if (exchange.contentType().contains("json")) {
                JsonNode result = redact(json.readTree(response));
                if (result == null) return Map.of("success", true);
                if (result.has("code") && result.path("code").asInt() != 200)
                    throw new BizException(400, result.path("message").asText("后台接口执行失败"));
                String text = json.writeValueAsString(result);
                if (text.length() <= INLINE_LIMIT) return result;
                var file = files.saveExport("管理查询结果.json", json.writeValueAsBytes(result));
                return Map.of("file", file, "download", "/qoj-file/" + file.id(), "preview", text.substring(0, INLINE_LIMIT), "truncated", true);
            }
            String disposition = exchange.header("Content-Disposition");
            String filename = disposition == null ? "管理导出.csv" : ContentDisposition.parse(disposition).getFilename();
            var file = files.saveExport(filename == null ? "管理导出.bin" : filename, response);
            return Map.of("file", file, "download", "/qoj-file/" + file.id());
        } catch (BizException ex) { throw ex; }
        catch (BindException ex) { throw new BizException(400, "后台接口参数校验失败：" + ex.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + " " + f.getDefaultMessage()).limit(5).toList()); }
        catch (Exception ex) {
            for (Throwable cause = ex; cause != null; cause = cause.getCause()) if (cause instanceof BizException biz) throw biz;
            if (ex instanceof AccessDeniedException) throw new BizException(403, "没有后台接口权限");
            throw new BizException(400, "后台接口调用失败，请核对目录中要求的参数和附件");
        }
    }

    private boolean secret(String field) {
        String key = field.replaceAll("[_-]", "").toLowerCase(Locale.ROOT);
        return key.contains("password") || key.contains("passwd") || key.contains("secret") || key.contains("apikey")
            || key.contains("accesskey") || key.contains("token") || key.contains("authorization")
            || key.equals("cookie");
    }

    private boolean blockedField(Endpoint e, String field) {
        if (!secret(field)) return false;
        // Only enrollment/access passwords and initial student passwords are business data.
        return !(e.module().equals("contests") && field.equals("registrationPassword")
            || field.equals("password") && (e.module().equals("practices")
                || e.method().equals("POST") && Set.of("/users", "/teachers").contains(e.path().substring(prefix.length()))));
    }

    private void rejectCredentials(Endpoint e, JsonNode node) {
        if (node.isObject()) node.fields().forEachRemaining(entry -> {
            if (blockedField(e, entry.getKey())) throw new BizException(403, "登录凭据和密钥不提供给 Agent，请在后台设置页手动管理");
            rejectCredentials(e, entry.getValue());
        });
        else if (node.isArray()) node.forEach(item -> rejectCredentials(e, item));
    }

    private JsonNode redact(JsonNode node) {
        if (node instanceof ObjectNode object) {
            var names = new ArrayList<String>(); object.fieldNames().forEachRemaining(names::add);
            for (String key : names) { if (secret(key)) object.remove(key); else redact(object.get(key)); }
        } else if (node != null && node.isArray()) node.forEach(this::redact);
        return node;
    }

    private record Endpoint(String id, String method, String path, String module, HandlerMethod handler) {
        boolean readOnly() { return method.equals("GET"); }
    }
}

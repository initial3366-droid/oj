package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Central gate for destructive or state-changing Agent tools. Defaults to asking for unknown business tools. */
public final class AdminAgentApprovalPolicy {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> READ_ONLY = Set.of("load_tools",
        "list_files", "read_file", "read_files", "prepare_import", "query_qoj", "run_code", "generate_test_cases",
        "read_contest_operations", "read_submission_operations", "read_practice_operations",
        "read_people_operations", "read_course_operations", "get_draft",
        "list_admin_apis", "describe_admin_api", "read_admin_api");

    private AdminAgentApprovalPolicy() {}

    public static boolean isWriteTool(String name, JsonNode args) {
        return !READ_ONLY.contains(name) && !"read_contest_inspection".equals(name)
            && !("manage_draft".equals(name) && "detail".equals(args.path("operation").asText()));
    }

    /** Equivalent dedicated tools and plain CRUD endpoints share task-local consent. */
    public static String groupKey(String name, JsonNode args) {
        String operation = args.path("operation").asText("");
        String resource = switch (name) {
            case "manage_contest" -> "contests";
            case "manage_announcement" -> "announcements";
            case "manage_practice" -> "practices";
            case "manage_course" -> "courses";
            case "manage_folder" -> "problem-folders";
            case "edit_problem" -> "problems";
            default -> null;
        };
        if ("edit_problem".equals(name)) operation = "update";
        if (resource != null && Set.of("create", "update", "delete").contains(operation)) {
            return "crud:" + resource + ":" + operation;
        }
        if ("write_admin_api".equals(name)) {
            String endpoint = args.path("endpoint").asText("").trim();
            var match = Pattern.compile("^(POST|PUT|DELETE) (?:/[^/]+)*/(contests|announcements|practices|courses|problem-folders|problems)(/\\{[^/{}]+\\})?$").matcher(endpoint);
            if (match.matches()) {
                String method = match.group(1);
                boolean item = match.group(3) != null;
                if ("POST".equals(method) && !item) return "crud:" + match.group(2) + ":create";
                if (item && Set.of("PUT", "DELETE").contains(method)) {
                    return "crud:" + match.group(2) + ("PUT".equals(method) ? ":update" : ":delete");
                }
            }
            // A batch endpoint can implement both deletion and assignment. Never share those approvals.
            return name + ":" + endpoint + ":" + args.path("body").path("action").asText("");
        }
        return name + ":" + operation;
    }

    public static String description(String name, String arguments) {
        if (READ_ONLY.contains(name)) return null;
        JsonNode a;
        try { a = JSON.readTree(arguments == null ? "{}" : arguments); }
        catch (Exception e) { return "Agent 准备执行工具 " + name + "，参数需要核对。是否允许继续？"; }
        String operation = a.path("operation").asText("");
        String target = target(a);
        return switch (name) {
            case "write_admin_api" -> apiDescription(a);
            case "create_draft", "update_draft", "commit_draft" -> "Agent 准备"
                + ("create_draft".equals(name) ? "创建" : "commit_draft".equals(name) ? "保存为未发布题目" : "修改")
                + "题目草稿" + target + preview(a.path("basic")) + "。是否执行？";
            case "manage_draft" -> "detail".equals(operation) ? null
                : "Agent 准备" + ("create".equals(operation) ? "创建" : "commit".equals(operation) ? "保存为未发布题目" : "修改")
                    + "题目草稿" + target + preview(a.path("basic")) + "。是否执行？";
            case "commit_import" -> "Agent 准备提交导入计划" + target(a) + "，保存为未发布题目及测试数据。是否执行？";
            case "manage_contest" -> "Agent 准备" + verb(operation) + "比赛" + target + preview(a.path("data")) + "。是否执行？";
            case "manage_announcement" -> "Agent 准备" + verb(operation) + "公告" + target + preview(a.path("data")) + "。是否执行？";
            case "manage_practice" -> "Agent 准备" + verb(operation) + "练习模板" + target + preview(a.path("data")) + "。是否执行？";
            case "manage_course" -> "Agent 准备" + ("create".equals(operation) ? "创建" : "archive".equals(operation) ? "归档" : "修改")
                + "课程" + target + preview(a.path("data")) + "；关联班级变更会同步课程题单访问范围。是否执行？";
            case "manage_folder" -> "Agent 准备" + verb(operation) + "题目文件夹" + target + preview(a.path("data")) + "。是否执行？";
            case "manage_people_operations" -> "Agent 准备" + verb(operation) + "人员或组织记录" + target + preview(a.path("data")) + "。是否执行？";
            case "copy_practice" -> "Agent 准备复制练习" + target(a) + "为新题单。是否执行？";
            case "save_problem_tests", "manage_problem_tests" -> "Agent 准备修改题目" + target + "的隐藏测试点，可能影响后续判题。是否执行？";
            case "edit_problem" -> "Agent 准备修改题目" + target + fields(a.path("changes")) + preview(a.path("changes")) + "。是否执行？";
            case "manage_contest_operations" -> "Agent 准备" + verb(operation) + "比赛" + target + "，可能改变报名、榜单或滚榜状态。是否执行？";
            case "publish_final_scoreboard" -> "Agent 准备公开比赛" + target + "的最终榜单，参赛者将看到结果。是否发布？";
            case "manage_submission_operations" -> "Agent 准备" + verb(operation) + "提交或判题队列" + target + "。是否执行？";
            case "publish_practice" -> "Agent 准备发布课程题单" + target + preview(a.path("data")) + "，课程班级内学生将在开始时间后看到题目。是否发布？";
            case "update_practice_publication" -> "Agent 准备修改课程题单" + target + preview(a.path("data")) + "，可能改变访问时间及学生可见内容。是否执行？";
            case "set_maintenance_mode" -> "Agent 准备" + (a.path("enabled").asBoolean() ? "开启" : "关闭") + "维护模式，可能影响普通用户访问。是否执行？";
            default -> "Agent 准备执行工具 " + name + target + "。是否允许继续？";
        };
    }

    private static String apiDescription(JsonNode a) {
        String endpoint = a.path("endpoint").asText("未知管理接口");
        String verb = endpoint.startsWith("DELETE ") || endpoint.contains("delete") ? "删除"
            : endpoint.contains("unpublish") ? "下架" : endpoint.contains("publish") ? "发布"
            : endpoint.contains("rejudge") ? "重新判题" : endpoint.contains("/reset/") ? "重置配额"
            : endpoint.contains("/sync") ? "同步" : "写入或修改";
        var modules = Map.ofEntries(
            Map.entry("announcements", "公告"), Map.entry("problems", "题目"),
            Map.entry("problem-drafts", "题目草稿"), Map.entry("problem-folders", "题目文件夹"),
            Map.entry("contests", "比赛"), Map.entry("practices", "练习"), Map.entry("courses", "课程"),
            Map.entry("submissions", "提交记录"), Map.entry("submission-queue", "判题队列"),
            Map.entry("classes", "班级"), Map.entry("teachers", "教师"),
            Map.entry("users", "用户"), Map.entry("teams", "团队"),
            Map.entry("majors", "专业"), Map.entry("home", "首页内容"),
            Map.entry("settings", "站点配置"), Map.entry("agent", "AI 配额"),
            Map.entry("students", "学生记录"));
        String object = "后台记录";
        for (var entry : modules.entrySet()) if (endpoint.contains("/" + entry.getKey() + "/") || endpoint.endsWith("/" + entry.getKey())) { object = entry.getValue(); break; }
        var targets = new ArrayList<String>();
        a.path("path").elements().forEachRemaining(value -> targets.add(value.asText()));
        String details = targets.isEmpty() ? "" : "；目标编号：" + String.join("、", targets);
        JsonNode ids = a.path("body").path("ids");
        if (!ids.isArray()) ids = a.path("body").path("userIds");
        if (ids.isArray()) details += "；涉及 " + ids.size() + " 条记录，ID：" + ids;
        var fields = new ArrayList<String>();
        if (a.path("body").isObject()) a.path("body").fieldNames().forEachRemaining(fields::add);
        if (!fields.isEmpty()) details += "；提交 " + fields.size() + " 项内容";
        if (a.path("query").path("overwrite").asBoolean()) details += "；覆盖已有内容";
        JsonNode body = a.path("body");
        var labels = Map.ofEntries(
            Map.entry("title", "标题"), Map.entry("name", "名称"), Map.entry("status", "状态"),
            Map.entry("isVisible", "可见性"), Map.entry("isPinned", "置顶"), Map.entry("enabled", "启用"),
            Map.entry("priority", "优先级"), Map.entry("action", "批量操作"),
            Map.entry("courseId", "课程编号"), Map.entry("classId", "班级编号"),
            Map.entry("startTime", "开始时间"), Map.entry("endTime", "截止时间"));
        var changes = new ArrayList<String>();
        labels.forEach((key, label) -> {
            JsonNode value = body.path(key);
            if (!value.isMissingNode() && !value.isNull() && value.isValueNode()) {
                String text = value.isBoolean() ? value.asBoolean() ? "是" : "否" : value.asText().replaceAll("[\\r\\n]", " ");
                changes.add(label + "：" + (text.length() > 60 ? text.substring(0, 60) + "…" : text));
            }
        });
        return "Agent 准备" + verb + object + details + "；接口：" + endpoint
            + (changes.isEmpty() ? "" : "；拟设为「" + String.join("，", changes) + "」")
            + "。确认前不会执行，是否允许本次操作？";
    }

    private static String target(JsonNode a) {
        var targets = new ArrayList<String>();
        for (String key : new String[] {"contestId", "problemId", "caseId", "folderId", "announcementId",
            "courseId", "practiceId", "publicationId", "submissionId", "queueId", "userId", "classId", "teacherId", "teamId", "majorId", "slideId", "draftId", "planId"}) {
            if (a.hasNonNull(key)) targets.add(key + "=#" + a.path(key).asText());
        }
        return targets.isEmpty() ? "" : "（" + String.join("，", targets) + "）";
    }

    private static String fields(JsonNode changes) {
        if (!changes.isObject()) return "";
        var names = new ArrayList<String>();
        changes.fieldNames().forEachRemaining(names::add);
        return names.isEmpty() ? "" : "（字段：" + String.join("、", names) + "）";
    }

    private static String preview(JsonNode changes) {
        if (!changes.isObject()) return "";
        var values = new ArrayList<String>();
        for (String key : new String[] {"title", "name", "label", "username", "displayName", "studentNo", "teacherNo",
            "email", "role", "code", "status", "studentPublishStatus", "isVisible", "isPinned", "enabled",
            "timeLimit", "memoryLimit", "difficulty", "score", "courseId", "term", "displayOrder", "startTime", "endTime", "allowedIpRanges"}) {
            JsonNode value = changes.path(key);
            if (!value.isMissingNode() && value.isValueNode() && !value.isNull()) {
                String text = value.asText().replaceAll("[\\r\\n]", " ");
                values.add(key + "=" + (text.length() > 60 ? text.substring(0, 60) + "…" : text));
            }
        }
        for (String key : new String[] {"classIds", "problemIds", "problems", "audiences"}) {
            if (changes.path(key).isArray()) {
                String text = changes.path(key).toString();
                values.add(key + "=" + (text.length() > 1200 ? text.substring(0, 1200) + "…" : text));
            }
        }
        return values.isEmpty() ? "" : "；拟设为 " + String.join("，", values);
    }

    private static String verb(String operation) {
        if (operation.contains("remove") || operation.contains("delete") || operation.contains("cancel")) return "移除或取消";
        if (operation.contains("rejudge") || operation.contains("rebuild") || operation.equals("replay")) return "重新执行";
        if (operation.contains("publish")) return "发布";
        if (operation.equals("create") || operation.startsWith("create_")) return "创建";
        if (operation.startsWith("add_")) return "添加内容到";
        return "修改";
    }
}

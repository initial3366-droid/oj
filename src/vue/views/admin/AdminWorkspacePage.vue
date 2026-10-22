<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { AdminApiError, adminDelete, adminDownload, adminGet, adminGetBlob, adminPost, adminPostStream, adminPut } from "../../../admin/api/adminClient";
import { generateProblem, type AgentProblem, type AgentWorkspace } from "../../../api/aiAgent";
import { CHAT_FILE_API, type ChatAttachment, type ChatFileData, type ChatImageData, type ChatImportApproved, type ChatImportResult, type ChatImportSource, type FilePreviewSource } from "../../../api/adminChat";
import { adminPath } from "../../../utils/adminPath";
import { ADMIN_PREFIX } from "../../../config";
import AdminChatAttachments from "../../components/AdminChatAttachments.vue";
import AdminChatFilePreviewDialog from "../../components/AdminChatFilePreviewDialog.vue";
import AdminChatImportDialog from "../../components/AdminChatImportDialog.vue";
import AdminChatMarkdown from "../../components/AdminChatMarkdown.vue";

import { chatOwner, localChatAction, estimateChatTokens } from "../../utils/localAgentChat";

type Row = Record<string, unknown>;
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt?: number; completedAt?: number; durationMs?: number; continuationToken?: string; generationStatus?: string; timingEstimate?: boolean; images?: ChatImageData[]; files?: ChatFileData[] };
type ChatConversationMessage = Pick<ChatMessage, "role" | "content"> & Pick<ChatMessage, "images" | "files">;
type ChatSession = { id: string; title: string; createdAt: number; updatedAt: number; version?: number; titleSource?: string; titleRevision?: number; messages?: ChatMessage[]; summary?: string; summarizedCount?: number; migratedServerVersion?: string; providerInputTokens?: number; contextUsage?: { inputTokens: number; estimated: boolean; compacted?: boolean } };
type ChatApproval = { continuationToken: string; callId: string; name: string; description: string; sessionId: string; assistantMessageId: string };
type Workspace = {
  title: string;
  description: string;
  endpoint: string;
  resource?: string;
  kind?: "table" | "settings" | "report" | "chat" | "generator";
  createLabel?: string;
  fields?: Array<{ key: string; label: string; type?: "text" | "textarea" | "number" | "boolean" | "password"; required?: boolean }>;
  actions?: Array<{ label: string; endpoint: (row: Row) => string; method?: "post" | "delete" }>;
};

const route = useRoute();
const router = useRouter();
const rows = ref<Row[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const keyword = ref("");
const page = ref(1);
const pageSize = ref(20);
const detail = ref<Row | null>(null);
const detailDialog = ref(false);
const dialogOpen = ref(false);
const saving = ref(false);
const editingId = ref<number | string | null>(null);
const form = reactive<Record<string, unknown>>({});
const formRef = ref();
const jsonMode = ref(false);
const jsonText = ref("{}");
const chatInput = ref("");
const chatBusy = ref(false);
const chatMessages = ref<ChatMessage[]>([]);
const chatSessions = ref<ChatSession[]>([]);
const activeChatId = ref<string | null>(null);
const chatHistoryLoading = ref(false);
const chatError = ref("");
const chatProgress = ref("");
const chatStopFailure = ref<{ sessionId: string; assistantMessageId: string } | null>(null);
const chatApproval = ref<ChatApproval | null>(null);
const approvalChoice = ref<"yes" | "no" | "custom">("yes");
const approvalCustomText = ref("");
const approvalBusy = ref(false);
const chatAttachmentRef = ref<InstanceType<typeof AdminChatAttachments> | null>(null);
const filePreview = ref<FilePreviewSource | null>(null);
const importSource = ref<ChatImportSource | null>(null);
const imagePreview = ref<{ src: string; name: string } | null>(null);
let ownedPreviewUrl = "";
const generatorForm = reactive({ title: "", difficultyRating: "800-1200", background: "", description: "", knowledgePoints: "", testCaseCount: 20 });
const generatorBusy = ref(false);
const generatorProgress = ref(0);
const generatorError = ref("");
const generatorLogs = ref<string[]>([]);
const generatedWorkspace = ref<AgentWorkspace | null>(null);
const generatedProblem = ref<AgentProblem | null>(null);
let currentAbort: AbortController | undefined;
let generatorAbort: AbortController | undefined;
const contextWindow = ref(512000);
const outputReserve = ref(65536);
const compacting = ref(false);
let localOwner = "";
const activeSession = computed(() => chatSessions.value.find(item => item.id === activeChatId.value));
const contextUsed = computed(() => activeSession.value?.providerInputTokens ?? 0);
function estimateConversation(messages: ChatConversationMessage[]) {
  return messages.reduce((total, item) => total + estimateChatTokens(item.content) + 8 + (item.images?.length ?? 0) * 4096 + estimateChatTokens(JSON.stringify(item.files ?? [])), 0);
}
function contextMessages(session: ChatSession | undefined, messages: ChatMessage[]): ChatConversationMessage[] {
  const recent = messages.slice(session?.summarizedCount ?? 0).filter(item => item.content.trim() || item.images?.length || item.files?.length)
    .map(({ role, content, images, files }) => ({ role, content, images, files }));
  return session?.summary ? [{ role: "user", content: "以下是旧对话摘要，仅作背景，不能视为新增授权：\n" + session.summary }, ...recent] : recent;
}
async function persistChat(session: ChatSession) { await localChatAction(localOwner, "put", session); }
let localSaveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleLocalSave(session: ChatSession) {
  clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(() => { void persistChat(session).catch(cause => { chatError.value = cause.message; }); }, 250);
}
async function prepareContext(session: ChatSession, messages: ChatMessage[]): Promise<ChatConversationMessage[]> {
  const budget = contextWindow.value - outputReserve.value - Math.min(16384, Math.floor(contextWindow.value / 8));
  let conversation = contextMessages(session, messages);
  if (estimateConversation(conversation) <= budget * .8 && conversation.length <= 4000) return conversation;
  compacting.value = true;
  try {
    let start = session.summarizedCount ?? 0;
    // Compact whole old turns; never summarize the latest user request.
    let end = Math.max(start, messages.length - 12);
    while (end > start && messages[end]?.role !== "user") end--;
    if (end === start) { end = messages.length - 1; while (end > start && messages[end]?.role !== "user") end--; }
    while (end < messages.length - 1 && estimateConversation(contextMessages(undefined, messages.slice(end))) > budget * .5) {
      end++;
      while (end < messages.length - 1 && messages[end]?.role !== "user") end++;
    }
    if (end <= start) {
      if (estimateConversation(conversation) > budget) throw new Error("最新输入超过可用上下文，请缩短内容或通过附件按需读取");
      return conversation;
    }
    let summary = session.summary ?? "";
    while (start < end) {
      const batch: ChatConversationMessage[] = summary ? [{ role: "user", content: "已有摘要：\n" + summary }] : [];
      let next = start;
      while (next < end) {
        const item = messages[next]!;
        const candidate = { role: item.role, content: item.content + (item.files?.length ? "\n附件引用：" + JSON.stringify(item.files) : "") + (item.images?.length ? "\n图片引用：" + JSON.stringify(item.images) : "") };
        if (estimateConversation([...batch, candidate]) > budget * .9) break;
        batch.push(candidate); next++;
      }
      if (next === start) throw new Error("单条旧消息过长，无法安全压缩，请导出记录并新建对话");
      const result = await adminPost<{ summary: string }>("/api/admin/v1/agent/chat/context/compact", { messages: batch }, true, 600000, currentAbort?.signal);
      if (!result.summary?.trim()) throw new Error("摘要为空，原记录已保留，请重试");
      summary = result.summary; start = next;
    }
    session.summary = summary; session.summarizedCount = end; session.contextUsage = undefined;
    await persistChat(session);
    conversation = contextMessages(session, messages);
    if (estimateConversation(conversation) > budget) throw new Error("近期对话仍超过可用上下文，请缩短本次输入或新建对话");
    return conversation;
  } finally { compacting.value = false; }
}
const chatLegacyHistoryKey = "qoj.admin.ai-chat-history.v1";

function readLegacyChatHistory(): ChatSession[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(chatLegacyHistoryKey) || "[]");
    if (!Array.isArray(raw)) return [];
    const sessions = raw.filter((item): item is ChatSession => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.messages) && typeof item.updatedAt === "number")).slice(0, 100);
    return sessions.map((session) => {
      const messages = session.messages ?? [];
      const [userMessage, assistantMessage] = messages;
      const isLegacyReply = messages.length === 2 && userMessage?.role === "user" && assistantMessage?.role === "assistant" && assistantMessage.content.trim() && assistantMessage.completedAt == null && typeof session.createdAt === "number";
      if (!isLegacyReply) return session;
      return { ...session, messages: [
        { ...userMessage, createdAt: userMessage.createdAt ?? session.createdAt },
        { ...assistantMessage, createdAt: assistantMessage.createdAt ?? session.createdAt, completedAt: session.updatedAt, durationMs: Math.max(0, session.updatedAt - session.createdAt), generationStatus: "complete", timingEstimate: true },
      ] };
    });
  } catch { return []; }
}

function adminRelativePath() {
  const prefix = `/${ADMIN_PREFIX}`;
  return route.path.startsWith(prefix) ? route.path.slice(prefix.length) || "/" : route.path;
}

const path = computed(adminRelativePath);
const idFromPath = computed(() => path.value.match(/\/(\d+)(?:\/|$)/)?.[1] ?? "");
const workspace = computed<Workspace>(() => {
  const p = path.value;
  if (p === "/users/students") return { title: "学生管理", description: "检索学生账号并维护基础资料。", endpoint: `/api/admin/v1/users?role=STUDENT&page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/admin/v1/users", fields: [{ key: "username", label: "用户名", required: true }, { key: "password", label: "初始密码", type: "password" }, { key: "displayName", label: "姓名", required: true }, { key: "studentNo", label: "学号" }, { key: "email", label: "邮箱" }, { key: "role", label: "角色" }] };
  if (p.startsWith("/problem-folders")) return { title: p.includes("/problem-folders/") ? "题目文件夹详情" : "题目文件夹", description: "管理题库分类和文件夹中的题目。", endpoint: p.match(/\/problem-folders\/\d+/) ? `/api/admin/v1/problem-folders/${idFromPath.value}` : "/api/admin/v1/problem-folders", resource: "/api/admin/v1/problem-folders", fields: [{ key: "name", label: "文件夹名称", required: true }, { key: "description", label: "说明", type: "textarea" }, { key: "majorId", label: "专业 ID", type: "number" }] };
  if (p.startsWith("/problems/") && /\/(new|\d+\/edit|\d+\/test-cases)$/.test(p)) return { title: p.endsWith("test-cases") ? "题目测试数据" : "题目编辑器", description: "维护题面、样例、约束和测试数据。", endpoint: `/api/admin/v1/problems/${idFromPath.value}`, resource: "/api/admin/v1/problems", kind: "report" };
  if (p === "/problems") return { title: "题目管理", description: "搜索、查看并维护题库题目。", endpoint: `/api/admin/v1/problems?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/admin/v1/problems", fields: [{ key: "title", label: "题目标题", required: true }, { key: "difficulty", label: "难度", type: "number" }, { key: "isPublic", label: "公开", type: "boolean" }] };
  if (p.startsWith("/ai/chat")) return { title: "AI 对话", description: "与 QOJ Agent 对话，生成和整理题目素材。", endpoint: "/api/admin/v1/agent/chat/sessions", kind: "chat" };
  if (p.startsWith("/ai/problem-generator")) return { title: "AI 题目生成", description: "提交题目背景和要求，生成可编辑的题面草稿。", endpoint: "", kind: "generator" };
  if (p.startsWith("/ai/settings")) return { title: "AI 设置", description: "配置后台 Agent 的服务地址、模型和运行限制。", endpoint: "/api/admin/v1/settings/system/agent", kind: "settings" };
  if (p.startsWith("/courses")) return { title: p.match(/\/courses\/\d+/) ? "课程详情" : "课程管理", description: "维护课程、题单和教学范围。", endpoint: p.match(/\/courses\/\d+/) ? `/api/admin/v1/courses/${idFromPath.value}` : `/api/admin/v1/courses?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/admin/v1/courses", fields: [{ key: "title", label: "课程名称", required: true }, { key: "description", label: "课程说明", type: "textarea" }, { key: "classIds", label: "班级 ID 列表（JSON）", type: "textarea" }] };
  if (p.startsWith("/practices/publications/") && p.endsWith("/report")) return { title: "发布报告", description: "查看公开练习的提交和完成情况。", endpoint: `/api/admin/v1/practices/publications/${idFromPath.value}/report`, kind: "report" };
  if (p.startsWith("/practices/publications/")) return { title: "练习发布设置", description: "设置练习发布时间、范围和课程绑定。", endpoint: `/api/admin/v1/practices/publications/${idFromPath.value}`, resource: "/api/admin/v1/practices/publications", kind: "settings" };
  if (/^\/practices\/\d+\/(edit|publish)$/.test(p) || p === "/practices/new") return { title: p.endsWith("/publish") ? "发布练习" : "练习编辑", description: "配置练习题目和教学范围。", endpoint: `/api/admin/v1/practices/${idFromPath.value}`, resource: "/api/admin/v1/practices", fields: [{ key: "title", label: "练习名称", required: true }, { key: "description", label: "练习说明", type: "textarea" }, { key: "audience", label: "适用范围（ALL / CLASS）" }, { key: "audienceId", label: "班级 ID", type: "number" }, { key: "problemIds", label: "题目 ID 列表（JSON）", type: "textarea" }] };
  if (p.startsWith("/practices")) return { title: "练习管理", description: "维护练习、题目顺序及发布记录。", endpoint: `/api/admin/v1/practices?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/practices", fields: [{ key: "title", label: "练习名称", required: true }, { key: "description", label: "练习说明", type: "textarea" }, { key: "audience", label: "适用范围（ALL / CLASS）" }, { key: "audienceId", label: "班级 ID", type: "number" }, { key: "problemIds", label: "题目 ID 列表（JSON）", type: "textarea" }] };
  if (p.startsWith("/contests/") && p.endsWith("/submissions")) return { title: "比赛提交", description: "按比赛查看提交记录和判题结果。", endpoint: `/api/admin/v1/submissions?contestId=${idFromPath.value}&page=${page.value}&pageSize=${pageSize.value}`, kind: "table", actions: [{ label: "查看代码", endpoint: (row) => `/api/admin/v1/submissions/${row.id}/code` }] };
  if (p.startsWith("/contests/") && p.includes("/judge/queue")) return { title: "比赛判题队列", description: "监控比赛队列并执行重判或取消。", endpoint: `/api/admin/v1/submission-queue?contestId=${idFromPath.value}&page=${page.value}&pageSize=${pageSize.value}`, kind: "table", actions: [{ label: "重判", endpoint: (row) => `/api/admin/v1/submission-queue/${row.queueId}/rejudge` }, { label: "取消", endpoint: (row) => `/api/admin/v1/submission-queue/${row.queueId}/cancel`, method: "delete" }] };
  if (p === "/contests" || p === "/contests/new" || /\/contests\/\d+\/edit$/.test(p)) return { title: "比赛管理", description: "管理比赛、类型、时间、范围和报名。", endpoint: `/api/admin/v1/contests?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/contests", fields: [{ key: "title", label: "比赛名称", required: true }, { key: "type", label: "赛制（ACM / OI）" }, { key: "startTime", label: "开始时间" }, { key: "durationMinutes", label: "时长（分钟）", type: "number" }, { key: "description", label: "比赛说明", type: "textarea" }] };
  if (p.startsWith("/contests/")) return { title: "比赛详情", description: "查看比赛报名、题目、榜单和导出入口。", endpoint: `/api/admin/v1/contests/${idFromPath.value}`, kind: "report", actions: [{ label: "导出榜单", endpoint: () => `/api/admin/v1/contests/${idFromPath.value}/scoreboard/export` }] };
  if (p === "/submissions/statistics") return { title: "提交统计", description: "按时间、语言和结果筛选提交，并导出统计数据。", endpoint: `/api/admin/v1/submissions?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, kind: "table" };
  if (p === "/submissions") return { title: "提交管理", description: "查询提交详情、代码和判题过程。", endpoint: `/api/admin/v1/submissions?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, kind: "table", actions: [{ label: "查看代码", endpoint: (row) => `/api/admin/v1/submissions/${row.id}/code` }, { label: "删除", endpoint: (row) => `/api/admin/v1/submissions/${row.id}`, method: "delete" }] };
  if (p === "/judge/queue" || p === "/submission-queue") return { title: "判题队列", description: "查看排队任务、执行记录和队列状态。", endpoint: `/api/admin/v1/submission-queue?page=${page.value}&pageSize=${pageSize.value}`, kind: "table", actions: [{ label: "重判", endpoint: (row) => `/api/admin/v1/submission-queue/${row.queueId}/rejudge` }, { label: "取消", endpoint: (row) => `/api/admin/v1/submission-queue/${row.queueId}/cancel`, method: "delete" }] };
  if (p === "/leaderboard") return { title: "排行榜管理", description: "查看全局学生 AC 排名和班级排名。", endpoint: "/api/v1/leaderboard/global?limit=5000", kind: "table" };
  if (p.startsWith("/classes/")) return { title: "班级详情", description: "查看班级教师、学生和加入设置。", endpoint: `/api/admin/v1/classes/${idFromPath.value}`, kind: "report" };
  if (p === "/classes") return { title: "班级管理", description: "维护班级、教师归属、加入设置和成员。", endpoint: `/api/admin/v1/classes${keyword.value ? `?keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/admin/v1/classes", fields: [{ key: "name", label: "班级名称", required: true }, { key: "teacherId", label: "教师 ID", type: "number" }, { key: "description", label: "说明", type: "textarea" }, { key: "joinEnabled", label: "允许申请加入", type: "boolean" }, { key: "approvalRequired", label: "需要审批", type: "boolean" }] };
  if (p === "/teams") return { title: "队伍管理", description: "管理竞赛队伍和队伍成员。", endpoint: "/api/admin/v1/teams", resource: "/api/admin/v1/teams", fields: [{ key: "name", label: "队伍名称", required: true }] };
  if (p === "/settings/frontend") return { title: "前台设置", description: "配置站点名称、Logo、页脚和首页展示。", endpoint: "/api/admin/v1/settings/frontend", kind: "settings" };
  if (p === "/settings/register") return { title: "注册设置", description: "配置用户注册、邮箱验证和邮件发送参数。", endpoint: "/api/admin/v1/settings/register", kind: "settings" };
  if (p === "/settings/system") return { title: "系统设置", description: "查看和维护系统级服务配置。", endpoint: "/api/admin/v1/settings/system/oss", kind: "settings" };
  if (p === "/judge/config") return { title: "判题配置", description: "配置并发数、判题时限和运行资源限制。", endpoint: "/api/admin/v1/settings/judge", kind: "settings" };
  if (p === "/settings/code-templates") return { title: "代码模板", description: "维护各语言提交代码模板。", endpoint: "/api/admin/v1/settings/system/code-templates", kind: "settings" };
  if (p === "/settings/announcements") return { title: "公告管理", description: "维护首页公告和置顶公告。", endpoint: `/api/admin/v1/announcements?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/announcements", fields: [{ key: "title", label: "标题", required: true }, { key: "content", label: "公告内容", type: "textarea", required: true }, { key: "isVisible", label: "显示", type: "boolean" }, { key: "isPinned", label: "置顶", type: "boolean" }] };
  if (p === "/profile") return { title: "个人信息", description: "查看和更新管理员资料及密码。", endpoint: "/api/admin/v1/me", kind: "settings" };
  return { title: "管理页面", description: "当前地址没有匹配的管理功能。", endpoint: "", kind: "report" };
});

const isEditorRoute = computed(() => /\/(new|\d+\/edit)$/.test(path.value));
const displayRows = computed(() => rows.value);
const columns = computed(() => {
  const source = displayRows.value[0];
  if (!source) return [];
  const keys = Object.keys(source).filter((key) => !["description", "statement", "code", "cases", "members", "problems", "content"].includes(key));
  return keys.slice(0, 8);
});
const settingEntries = computed(() => detail.value ? Object.entries(detail.value) : []);

function applyForm(value?: Row) {
  editingId.value = (value?.id as number | string | undefined) ?? (isEditorRoute.value ? idFromPath.value || null : null);
  Object.keys(form).forEach((key) => delete form[key]);
  const fields = workspace.value.fields ?? [];
  if (value) Object.assign(form, structuredClone(value));
  else for (const field of fields) form[field.key] = field.type === "boolean" ? false : field.type === "number" ? undefined : "";
  if (isEditorRoute.value && editingId.value && !value) void loadEditRecord();
  jsonText.value = JSON.stringify(value ?? form, null, 2);
  jsonMode.value = false;
  dialogOpen.value = true;
}

async function loadEditRecord() {
  const endpoint = `${workspace.value.resource}/${editingId.value}`;
  try {
    const result = await adminGet<Row>(endpoint);
    Object.keys(form).forEach((key) => delete form[key]);
    Object.assign(form, result);
    jsonText.value = JSON.stringify(result, null, 2);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "记录加载失败"); }
}

function normalizeResult(result: unknown) {
  if (Array.isArray(result)) { rows.value = result as Row[]; total.value = rows.value.length; return; }
  if (result && typeof result === "object") {
    const item = result as Record<string, unknown>;
    if (Array.isArray(item.list)) { rows.value = item.list as Row[]; total.value = Number(item.total ?? rows.value.length); return; }
    if (Array.isArray(item.records)) { rows.value = item.records as Row[]; total.value = Number(item.total ?? rows.value.length); return; }
    detail.value = item;
    jsonText.value = JSON.stringify(item, null, 2);
    rows.value = [];
    total.value = 1;
    return;
  }
  rows.value = [];
  total.value = 0;
}

async function load() {
  if (!workspace.value.endpoint || workspace.value.kind === "chat") return;
  loading.value = true;
  error.value = "";
  detail.value = null;
  try { normalizeResult(await adminGet<unknown>(workspace.value.endpoint)); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "数据加载失败"; }
  finally { loading.value = false; }
}

async function save() {
  let payload: Row = { ...form };
  if (jsonMode.value) {
    try { payload = JSON.parse(jsonText.value) as Row; }
    catch { ElMessage.error("JSON 格式无效"); return; }
  }
  if (workspace.value.fields?.some((field) => field.required && !String(payload[field.key] ?? "").trim())) { ElMessage.warning("请填写必填字段"); return; }
  saving.value = true;
  try {
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        try { payload[key] = JSON.parse(value); } catch { /* Keep plain text as entered. */ }
      }
    }
    if (editingId.value && workspace.value.resource) await adminPut(`${workspace.value.resource}/${editingId.value}`, payload);
    else if (workspace.value.resource) await adminPost(workspace.value.resource, payload);
    else await adminPut(workspace.value.endpoint, payload);
    ElMessage.success("保存成功");
    dialogOpen.value = false;
    await load();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存失败"); }
  finally { saving.value = false; }
}

async function remove(row: Row) {
  const identity = row.id ?? row.queueId;
  if (identity === undefined) { ElMessage.warning("当前记录没有可删除的 ID"); return; }
  try {
    await ElMessageBox.confirm("确认删除这条记录？该操作不可撤销。", "删除确认", { type: "warning" });
    await adminDelete(`${workspace.value.resource ?? workspace.value.endpoint}/${identity}`);
    ElMessage.success("已删除");
    await load();
  } catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}

async function runAction(action: NonNullable<Workspace["actions"]>[number], row: Row) {
  try {
    const endpoint = action.endpoint(row);
    if (action.label.includes("代码")) {
      const code = await adminGet<string>(endpoint);
      detail.value = { code };
      detailDialog.value = true;
    } else if (endpoint.includes("/export")) {
      await adminDownload(endpoint, `qoj-${row.id ?? idFromPath.value}.csv`);
      ElMessage.success("导出完成");
    } else if (action.method === "delete") {
      await adminDelete(endpoint);
      ElMessage.success("操作完成");
      await load();
    } else {
      await adminPost(endpoint);
      ElMessage.success("操作完成");
      await load();
    }
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "操作失败"); }
}

function replaceChat(session: ChatSession) {
  chatSessions.value = [session, ...chatSessions.value.filter((item) => item.id !== session.id)];
  if (activeChatId.value === session.id && session.messages) chatMessages.value = session.messages;
  scheduleLocalSave(session);
}
async function loadChatHistory() {
  chatHistoryLoading.value = true; chatError.value = "";
  try {
    localOwner = chatOwner();
    chatSessions.value = (await localChatAction<ChatSession[]>(localOwner, "list")).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!chatSessions.value.length) {
      const legacy = readLegacyChatHistory();
      for (const session of legacy) await persistChat(session);
      if (legacy.length) { chatSessions.value = legacy; window.localStorage.removeItem(chatLegacyHistoryKey); }
    }
    activeChatId.value = null; chatMessages.value = [];
    const info = await adminGet<{ window: number; outputReserve: number }>("/api/admin/v1/agent/chat/context");
    contextWindow.value = info.window; outputReserve.value = info.outputReserve;
  } catch (cause) { chatError.value = cause instanceof Error ? cause.message : "本地聊天加载失败"; }
  finally { chatHistoryLoading.value = false; }
}
function exportChatHistory() {
  const blob = new Blob([JSON.stringify({ version: 2, sessions: chatSessions.value }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = "qoj-agent-history.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function migrateServerHistory() {
  if (chatBusy.value || chatHistoryLoading.value) return;
  chatHistoryLoading.value = true;
  try {
    const endpoint = "/api/admin/v1/agent/chat/sessions";
    const sessions = await adminGet<ChatSession[]>(endpoint);
    for (const metadata of sessions) {
      const marker = String(metadata.version ?? metadata.updatedAt);
      const existing = chatSessions.value.find(item => item.id === metadata.id);
      if (existing && existing.migratedServerVersion !== marker) throw new Error("本地存在同名ID的不同记录，请先导出备份后处理迁移冲突");
      if (!existing) {
        const session = await adminGet<ChatSession>(`${endpoint}/${encodeURIComponent(metadata.id)}`);
        session.migratedServerVersion = String(session.version ?? session.updatedAt);
        await persistChat(session); replaceChat(session);
      }
      await adminDelete(`${endpoint}/${encodeURIComponent(metadata.id)}?migratedToLocal=true`);
    }
    ElMessage.success("旧聊天已迁移至本地，并删除对应服务器记录");
  } catch (cause) { chatError.value = cause instanceof Error ? cause.message : "迁移失败，未迁移的记录仍保留在原处"; }
  finally { chatHistoryLoading.value = false; }
}
function newChat() { if (chatBusy.value) stopChat(); activeChatId.value = null; chatMessages.value = []; chatInput.value = ""; chatError.value = ""; chatApproval.value = null; }
async function restorePendingApproval(session: ChatSession) {
  const pending = [...(session.messages ?? [])].reverse().find((item) => item.role === "assistant" && item.continuationToken && !item.generationStatus);
  if (!pending?.continuationToken) return;
  try {
    const result = await adminGet<{ callId: string; name: string; description: string } | null>(
      `/api/admin/v1/agent/chat/tasks/${encodeURIComponent(pending.continuationToken)}/approval?sessionId=${encodeURIComponent(session.id)}&assistantMessageId=${encodeURIComponent(pending.id)}`,
    );
    if (result && activeChatId.value === session.id) chatApproval.value = { ...result, continuationToken: pending.continuationToken, sessionId: session.id, assistantMessageId: pending.id };
  } catch (cause) {
    if (cause instanceof AdminApiError && cause.code === 404 && activeChatId.value === session.id) {
      const expired = { ...session, messages: session.messages?.map((item) => item.id === pending.id ? { ...item, continuationToken: undefined, generationStatus: "error" } : item) };
      replaceChat(expired); chatError.value = "任务进度已过期，无法继续原任务，请重新发送处理要求。";
    }
  }
}
async function selectChat(session: ChatSession) {
  if (chatBusy.value) await stopChat();
  activeChatId.value = session.id; chatMessages.value = session.messages ?? []; chatError.value = "";
  await restorePendingApproval(session);
}
function newId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function formatChatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} 毫秒`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return remainingSeconds ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分钟`;
}
function formatChatTime(timestamp: number) { return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false }); }
function closeImagePreview() {
  imagePreview.value = null;
  if (ownedPreviewUrl) URL.revokeObjectURL(ownedPreviewUrl);
  ownedPreviewUrl = "";
}
function showImagePreview(blob: Blob, name: string) {
  closeImagePreview();
  ownedPreviewUrl = URL.createObjectURL(blob);
  imagePreview.value = { src: ownedPreviewUrl, name };
}
async function openStoredImage(image: ChatImageData) {
  try { showImagePreview(await adminGetBlob(`/api/admin/v1/agent/chat/images/${encodeURIComponent(image.id)}`), image.name); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "图片加载失败"); }
}
async function openDraftImage(source: { src: string; name: string }) {
  try {
    const response = await fetch(source.src);
    if (!response.ok) throw new Error("图片加载失败");
    showImagePreview(await response.blob(), source.name);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "图片加载失败"); }
}
function openFilePreview(file: ChatFileData, files: ChatFileData[], instructions: string) {
  filePreview.value = { file, files, instructions };
}
function openImport(planId: string) { importSource.value = { files: [], instructions: "", planId }; }
async function downloadChatFile(id: string) {
  try {
    const blob = await adminGetBlob(`${CHAT_FILE_API}/${encodeURIComponent(id)}/download`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "管理导出"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "文件下载失败"); }
}
function handleChatPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? []).filter((item) => item.kind === "file").flatMap((item) => {
    const file = item.getAsFile(); return file ? [file] : [];
  });
  if (!files.length) return;
  event.preventDefault();
  chatAttachmentRef.value?.addFiles(files);
  const pastedText = event.clipboardData?.getData("text/plain");
  if (pastedText) chatInput.value += pastedText;
}
function handleChatKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendChat();
  }
}
async function runChatStream(sessionId: string, assistantMessageId: string, conversation: ChatConversationMessage[], continuationToken?: string, approvedImport?: ChatImportApproved, resumeStopped = false): Promise<ChatImportResult | undefined> {
  currentAbort?.abort(); currentAbort = new AbortController(); chatBusy.value = true; chatProgress.value = "正在思考…"; chatApproval.value = null;
  if (resumeStopped) {
    const answer = chatMessages.value.find((item) => item.id === assistantMessageId);
    if (answer) { answer.generationStatus = undefined; answer.completedAt = undefined; answer.durationMs = undefined; }
  }
  let importResult: ChatImportResult | undefined;
  let awaitingApproval = false;
  let finished = false;
  const session = chatSessions.value.find(item => item.id === sessionId)!;
  const answer = session.messages?.find(item => item.id === assistantMessageId);
  if (answer) answer.generationStatus = undefined;
  try {
    for (let segment = 0; segment < 32; segment++) {
      let approvalRequired = false;
      const nextToken = await adminPostStream("/api/admin/v1/agent/chat/stream", { messages: conversation, sessionId, assistantMessageId, continuationToken, approvedImport, resumeStopped: resumeStopped && segment === 0 }, (delta) => {
        const answer = chatMessages.value.find((item) => item.id === assistantMessageId);
        if (answer) answer.content += delta;
        scheduleLocalSave(session);
        chatProgress.value = "正在生成回复…";
      }, currentAbort.signal, (event, payload) => {
        if (event === "context" && typeof payload.inputTokens === "number" && Number.isFinite(payload.inputTokens) && payload.inputTokens >= 0) {
          if (payload.estimated === false) session.providerInputTokens = (session.providerInputTokens ?? 0) + payload.inputTokens;
          session.contextUsage = { inputTokens: payload.inputTokens, estimated: payload.estimated !== false, compacted: payload.compacted === true };
          scheduleLocalSave(session);
        }
        if (event === "stopped" && answer) answer.generationStatus = "stopped";
        if (event === "progress" && typeof payload.message === "string") chatProgress.value = payload.message;
        if (event === "tool") {
          if (payload.phase === "action") chatProgress.value = "正在执行 QOJ 操作…";
          else if (payload.phase === "observation" || payload.phase === "model") chatProgress.value = "正在整理结果…";
          if (payload.phase === "observation" && payload.name === "commit_import" && payload.success === true) {
            const raw = payload.result as { data?: ChatImportResult } | undefined;
            if (raw && typeof raw === "object") importResult = raw.data ?? raw as ChatImportResult;
          }
          if (payload.phase === "run" && typeof payload.continuationToken === "string") {
            const answer = chatMessages.value.find((item) => item.id === assistantMessageId);
            if (answer) answer.continuationToken = payload.continuationToken;
          }
        }
        if (event === "approval_required" && typeof payload.continuationToken === "string" && typeof payload.callId === "string") {
          approvalRequired = true;
          awaitingApproval = true;
          approvalChoice.value = "yes"; approvalCustomText.value = "";
          const answer = chatMessages.value.find((item) => item.id === assistantMessageId);
          if (answer) answer.continuationToken = payload.continuationToken;
          chatApproval.value = { continuationToken: payload.continuationToken, callId: payload.callId, name: String(payload.name ?? ""), description: String(payload.description ?? "需要确认一项后台操作。"), sessionId, assistantMessageId };
        }
      });
      if (approvalRequired || !nextToken) { finished = !approvalRequired; break; }
      continuationToken = nextToken;
    }
    if (answer && !awaitingApproval && answer.generationStatus !== "stopped") {
      answer.generationStatus = finished ? "complete" : "stopped";
      if (finished) answer.continuationToken = undefined;
    }
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === "AbortError")) chatError.value = cause instanceof Error ? cause.message : "AI 回复失败";
    if (answer) answer.generationStatus = cause instanceof DOMException && cause.name === "AbortError" ? "stopped" : "error";
    if (approvedImport) throw cause;
  } finally {
    if (answer && !awaitingApproval) { answer.completedAt = Date.now(); answer.durationMs = Math.max(0, answer.completedAt - (answer.createdAt ?? answer.completedAt)); }
    session.updatedAt = Date.now(); replaceChat(session);
    try { await persistChat(session); } catch (cause) { chatError.value = cause instanceof Error ? cause.message : "本地保存失败"; }
    chatBusy.value = false; chatProgress.value = ""; currentAbort = undefined;
  }
  return importResult;
}
async function sendChat(approvedImport?: ChatImportApproved): Promise<ChatImportResult | undefined> {
  const content = approvedImport ? "确认导入我已在审核界面核对的题目和测试点，保存为未发布题目。" : chatInput.value.trim();
  const attachmentManager = chatAttachmentRef.value;
  const hasAttachments = attachmentManager?.hasAttachments() ?? false;
  if ((!content && !hasAttachments) || chatBusy.value || chatHistoryLoading.value || chatStopFailure.value || (hasAttachments && !attachmentManager?.allReady())) return;
  const originalDraft = chatInput.value;
  chatInput.value = ""; chatError.value = "";
  const originalSessions = [...chatSessions.value];
  const originalMessages = [...chatMessages.value];
  const originalActiveId = activeChatId.value;
  const now = Date.now();
  const previous = chatSessions.value.find((item) => item.id === activeChatId.value);
  const sessionId = previous?.id ?? newId();
  const sentAttachments: ChatAttachment[] = hasAttachments ? attachmentManager!.take() : [];
  const images = sentAttachments.flatMap((item) => item.image ? [item.image] : []);
  const files = sentAttachments.flatMap((item) => item.document ? [item.document] : []);
  const userMessage: ChatMessage = { id: newId(), role: "user", content, createdAt: now, images, files };
  const assistantMessage: ChatMessage = { id: newId(), role: "assistant", content: "", createdAt: now };
  const conversationMessages = [...(previous?.messages ?? chatMessages.value), userMessage];
  const session: ChatSession = previous
    ? { ...previous, updatedAt: now, messages: [...conversationMessages, assistantMessage] }
    : { id: sessionId, title: content.replace(/\s+/g, " ").slice(0, 20) || "附件对话", titleSource: "local", titleRevision: 0, createdAt: now, updatedAt: now, messages: [...conversationMessages, assistantMessage] };
  activeChatId.value = sessionId; chatMessages.value = session.messages ?? []; replaceChat(session);
  chatBusy.value = true;
  try {
    await persistChat(session);
  } catch (cause) {
    chatError.value = cause instanceof Error ? cause.message : "聊天记录保存失败";
    chatSessions.value = originalSessions; chatMessages.value = originalMessages; activeChatId.value = originalActiveId;
    chatAttachmentRef.value?.restore(sentAttachments); chatInput.value = originalDraft; chatBusy.value = false;
    return undefined;
  }
  chatAttachmentRef.value?.release(sentAttachments);
  currentAbort = new AbortController();
  try { const conversation = await prepareContext(session, conversationMessages); return await runChatStream(sessionId, assistantMessage.id, conversation, undefined, approvedImport); }
  catch (cause) {
    const cancelled = cause instanceof DOMException && cause.name === "AbortError";
    if (!cancelled) chatError.value = cause instanceof Error ? cause.message : "上下文准备失败";
    assistantMessage.generationStatus = cancelled ? "stopped" : "error";
    assistantMessage.completedAt = Date.now(); assistantMessage.durationMs = assistantMessage.completedAt - now;
    replaceChat(session); chatBusy.value = false; currentAbort = undefined; return undefined;
  }
}
async function approveChatImport(approval: ChatImportApproved): Promise<ChatImportResult> {
  const result = await sendChat(approval);
  if (!result) throw new Error(chatError.value || "AI 对话没有返回导入结果，请检查聊天状态后重试。");
  return result;
}
async function stopChat() {
  currentAbort?.abort();
  const assistant = [...chatMessages.value].reverse().find((item) => item.role === "assistant");
  if (!activeChatId.value || !assistant) return;
  const target = { sessionId: activeChatId.value, assistantMessageId: assistant.id };
  try {
    await adminPost("/api/admin/v1/agent/chat/stop", target);
    assistant.generationStatus = "stopped";
    chatStopFailure.value = null;
  } catch (cause) {
    chatStopFailure.value = target;
    chatError.value = `无法确认后台已停止：${cause instanceof Error ? cause.message : "停止请求失败"}`;
  }
}
async function retryChatStop() {
  const target = chatStopFailure.value;
  if (!target) return;
  try {
    await adminPost("/api/admin/v1/agent/chat/stop", target);
    chatStopFailure.value = null; chatError.value = "";
  } catch (cause) { chatError.value = `无法确认后台已停止：${cause instanceof Error ? cause.message : "停止请求失败"}`; }
}
async function answerApproval() {
  const pending = chatApproval.value;
  if (!pending || approvalBusy.value) return;
  if (approvalChoice.value === "custom" && !approvalCustomText.value.trim()) { chatError.value = "请填写自定义问题或处理意见。"; return; }
  approvalBusy.value = true; chatError.value = "";
  try {
    await adminPost(`/api/admin/v1/agent/chat/tasks/${encodeURIComponent(pending.continuationToken)}/approval`, { sessionId: pending.sessionId, assistantMessageId: pending.assistantMessageId, callId: pending.callId, choice: approvalChoice.value, customText: approvalChoice.value === "custom" ? approvalCustomText.value.trim() : undefined });
    const index = chatMessages.value.findIndex((item) => item.id === pending.assistantMessageId);
    const conversation = contextMessages(activeSession.value, chatMessages.value.slice(0, index));
    chatApproval.value = null; approvalCustomText.value = "";
    await runChatStream(pending.sessionId, pending.assistantMessageId, conversation, pending.continuationToken);
  } catch (cause) { chatError.value = cause instanceof Error ? cause.message : "确认操作失败"; }
  finally { approvalBusy.value = false; }
}
async function renameChat(session: ChatSession) {
  try { const result = await ElMessageBox.prompt("输入 5 到 20 个字的聊天名称", "重命名聊天", { inputValue: session.title, inputPattern: /^.{5,20}$/, inputErrorMessage: "名称长度需要为 5～20 个字" }); replaceChat({ ...session, title: result.value.trim(), titleSource: "user" }); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "重命名失败"); }
}
async function deleteChat(session: ChatSession) {
  try { await ElMessageBox.confirm(`删除“${session.title}”？`, "删除聊天", { type: "warning" }); clearTimeout(localSaveTimer); await localChatAction(localOwner, "delete", session); chatSessions.value=chatSessions.value.filter((item)=>item.id!==session.id);if(activeChatId.value===session.id)newChat(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
onBeforeUnmount(closeImagePreview);
function addGeneratorLog(message: string) { generatorLogs.value = [...generatorLogs.value.slice(-11), `${new Date().toLocaleTimeString("zh-CN",{hour12:false})} ${message}`]; }
async function startGeneration() {
  if (!generatorForm.description.trim()) { ElMessage.warning("请描述题目目标和约束方向"); return; }
  const knowledgePoints = generatorForm.knowledgePoints.split(/[、,，\n]/).map((item)=>item.trim()).filter(Boolean);
  if (!knowledgePoints.length) { ElMessage.warning("请至少填写一个知识点"); return; }
  generatorAbort?.abort(); generatorAbort = new AbortController(); generatorBusy.value=true; generatorProgress.value=0;generatorError.value="";generatedProblem.value=null;generatedWorkspace.value=null;generatorLogs.value=[];
  addGeneratorLog("已提交 Agent 生成任务");
  try {
    const result = await generateProblem({ title:generatorForm.title.trim()||undefined,rating:generatorForm.difficultyRating,background:generatorForm.background.trim()||undefined,description:generatorForm.description.trim(),knowledgePoints,testCaseCount:generatorForm.testCaseCount },(event)=>{generatorProgress.value=event.percent;addGeneratorLog(`${event.stage}：${event.message}`);},generatorAbort.signal);
    generatedWorkspace.value=result;generatedProblem.value={...result.problem,title:result.problem.title||result.title};generatorProgress.value=100;addGeneratorLog("候选题目已返回，可以修改后保存为未发布题目");
  } catch(cause) { if(!(cause instanceof DOMException&&cause.name==="AbortError")){generatorError.value=cause instanceof Error?cause.message:"AI 题目生成失败";addGeneratorLog(generatorError.value);} }
  finally { generatorBusy.value=false;generatorAbort=undefined; }
}
function cancelGeneration() { generatorAbort?.abort();generatorAbort=undefined;generatorBusy.value=false;addGeneratorLog("已取消当前任务"); }
async function saveGeneratedDraft() {
  const problem=generatedProblem.value;if(!problem)return;
  saving.value=true;
  try {
    const draft=await adminPost<{draftId:string}>('/api/admin/v1/problem-drafts',{});
    const rating=Number.parseInt(problem.rating.match(/\d+/)?.[0]??"800",10)||800;
    await adminPut(`/api/admin/v1/problem-drafts/${draft.draftId}/basic`,{title:problem.title.trim(),timeLimit:1000,memoryLimit:256,statement:problem.statementHtml,inputFormat:problem.inputFormatHtml,outputFormat:problem.outputFormatHtml,checkerSource:"",communication:{enabled:false},tags:problem.knowledgePoints,difficulty:Math.min(5,Math.max(1,Math.round(rating/800))),samples:problem.samples.map((item)=>({input:item.input,output:item.output,explanation:item.explanation??""})),isPublic:false,accessScope:"PRIVATE",studentPublishStatus:"DRAFT"});
    const testCases=problem.samples.map((item,index)=>({caseNo:index+1,input:item.input,output:item.output,publicInput:""}));
    if(testCases.length)await adminPut(`/api/admin/v1/problem-drafts/${draft.draftId}/test-cases`,{testCases});
    await adminPost(`/api/admin/v1/problem-drafts/${draft.draftId}/commit`,{});
    ElMessage.success("已保存为未发布题目");await router.push(adminPath("/problems"));
  } catch(cause) { ElMessage.error(cause instanceof Error?cause.message:"草稿保存失败"); }
  finally { saving.value=false; }
}

function goCreate() {
  const target = path.value.replace(/\/$/, "") + "/new";
  void router.push(adminPath(target));
}

watch(() => [route.fullPath, page.value, pageSize.value, keyword.value] as const, () => {
  if (isEditorRoute.value && workspace.value.resource) { applyForm(); return; }
  if (path.value === "/ai/chat") { void loadChatHistory(); return; }
  void load();
}, { immediate: true });
onMounted(() => { if (isEditorRoute.value && workspace.value.resource && !dialogOpen.value) applyForm(); });
const workspaceElement = ref<HTMLElement>();
const chatHeight = ref("calc(100dvh - 120px)");
let chatResizeObserver: ResizeObserver | undefined;
function fitChatToViewport() {
  if (!workspaceElement.value || workspace.value.kind !== "chat") return;
  const viewport = window.visualViewport;
  const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
  chatHeight.value = `${Math.max(0, Math.floor(bottom - workspaceElement.value.getBoundingClientRect().top - 20))}px`;
}
onMounted(() => {
  window.addEventListener("resize", fitChatToViewport);
  window.visualViewport?.addEventListener("resize", fitChatToViewport);
  chatResizeObserver = new ResizeObserver(fitChatToViewport);
  if (workspaceElement.value) chatResizeObserver.observe(workspaceElement.value);
  fitChatToViewport();
});
watch(() => route.fullPath, () => { void nextTick(fitChatToViewport); });
onBeforeUnmount(() => {
  chatResizeObserver?.disconnect();
  window.removeEventListener("resize", fitChatToViewport);
  window.visualViewport?.removeEventListener("resize", fitChatToViewport);
});
</script>

<template>
  <section ref="workspaceElement" class="admin-workspace page-container" :class="{'chat-screen': workspace.kind === 'chat'}" :style="workspace.kind === 'chat' ? { height: chatHeight } : undefined">
    
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><template #default><el-button link type="primary" @click="load">重试</el-button></template></el-alert>

    <template v-if="workspace.kind === 'chat'">
      <el-card class="chat-card" shadow="never">
        <div class="chat-layout">
          <aside class="chat-sessions">
            <el-button class="new-chat-button" :disabled="chatBusy || chatHistoryLoading" @click="newChat">新聊天</el-button>
            <div><el-button text size="small" :disabled="chatBusy" @click="exportChatHistory">导出本地记录</el-button><el-button text size="small" :disabled="chatBusy || chatHistoryLoading" @click="migrateServerHistory">迁移旧记录</el-button></div>
            <el-skeleton v-if="chatHistoryLoading" :rows="4" animated />
            <el-alert v-else-if="chatError && !chatSessions.length" type="error" :title="chatError" :closable="false">
              <template #default><el-button link type="primary" @click="loadChatHistory">重试</el-button></template>
            </el-alert>
            <el-empty v-else-if="!chatSessions.length" description="暂无聊天历史" />
            <div v-for="session in chatSessions" :key="session.id" class="session-row" :class="{ active: activeChatId === session.id }">
              <button type="button" @click="selectChat(session)">{{ session.title }}</button>
              <el-dropdown trigger="click">
                <el-button text>···</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="renameChat(session)">重命名</el-dropdown-item>
                    <el-dropdown-item @click="deleteChat(session)">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </aside>
          <div class="chat-conversation">
            <div class="chat-history">
              <el-empty v-if="!chatMessages.length" description="请输入问题或添加附件开始对话" />
              <article v-for="(message, index) in chatMessages" :key="message.id" class="chat-message" :class="message.role">
                <strong>{{ message.role === 'user' ? '我' : 'QOJ AI 管理助手' }}</strong>
                <div v-if="message.images?.length" class="chat-message-assets">
                  <el-button v-for="image in message.images" :key="image.id" class="chat-image-link" @click="openStoredImage(image)">{{ image.name }}</el-button>
                </div>
                <div v-if="message.files?.length" class="chat-message-assets">
                  <el-button v-for="file in message.files" :key="file.id" class="chat-file-link" @click="openFilePreview(file, message.files || [], message.content)">
                    {{ file.name }} · {{ file.entryCount }} 个文件
                  </el-button>
                </div>
                <AdminChatMarkdown v-if="message.content && message.role === 'assistant'" :content="message.content" @download-file="downloadChatFile" @open-import="openImport" />
                <pre v-else-if="message.content">{{ message.content }}</pre>
                <span v-else-if="chatBusy && index === chatMessages.length - 1" class="chat-placeholder">正在生成…</span>
                <small v-if="message.role === 'assistant' && message.completedAt != null && message.durationMs != null" class="chat-message-meta">
                  {{ message.generationStatus === 'stopped' ? '已停止' : message.generationStatus === 'error' ? '失败' : '完成' }} · 耗时{{ message.timingEstimate ? '约' : '' }} {{ formatChatDuration(message.durationMs) }} · {{ formatChatTime(message.completedAt) }}
                </small>
                <el-button
                  v-if="message.role === 'assistant' && message.continuationToken && message.generationStatus !== 'complete' && !chatBusy && activeChatId"
                  link type="primary"
                  @click="runChatStream(activeChatId!, message.id, contextMessages(activeSession, chatMessages.slice(0, index)), message.continuationToken, undefined, true)"
                >继续处理</el-button>
              </article>
              <p v-if="chatProgress" class="chat-progress" role="status">{{ chatProgress }}</p>
            </div>
            <el-alert v-if="chatError" type="error" :title="chatError" :closable="false">
              <template #default><el-button v-if="chatStopFailure" link type="primary" @click="retryChatStop">重试停止</el-button></template>
            </el-alert>
            <section v-if="chatApproval" class="approval-card">
              <strong>需要确认后台操作</strong>
              <p>{{ chatApproval.description }}</p>
              <el-radio-group v-model="approvalChoice">
                <el-radio-button value="yes">允许</el-radio-button>
                <el-radio-button value="no">拒绝</el-radio-button>
                <el-radio-button value="custom">自定义回复</el-radio-button>
              </el-radio-group>
              <el-input v-if="approvalChoice === 'custom'" v-model="approvalCustomText" type="textarea" :rows="2" maxlength="1000" placeholder="输入问题或处理意见；当前操作会跳过" />
              <el-button type="primary" :loading="approvalBusy" :disabled="approvalChoice === 'custom' && !approvalCustomText.trim()" @click="answerApproval">{{ approvalChoice === 'custom' ? '发送回复' : '确认并继续' }}</el-button>
            </section>
            <AdminChatAttachments
              ref="chatAttachmentRef"
              :disabled="chatBusy || Boolean(chatApproval) || Boolean(chatStopFailure)"
              :instructions="chatInput"
              @error="chatError = $event"
              @preview-image="openDraftImage"
              @preview-file="filePreview = $event"
            />
            <div class="chat-input">
              <el-input
                v-model="chatInput"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="描述要处理的题目、数据或后台问题"
                :disabled="chatBusy || Boolean(chatApproval) || Boolean(chatStopFailure)"
                @paste="handleChatPaste"
                @keydown="handleChatKeydown"
              />
              <el-button v-if="chatBusy" type="danger" @click="stopChat">停止</el-button>
              <el-button v-else type="primary" :disabled="Boolean(chatStopFailure) || (!chatInput.trim() && !chatAttachmentRef?.hasAttachments()) || !chatAttachmentRef?.allReady()" @click="sendChat()">发送</el-button>
            </div>
            <div class="chat-context" aria-label="上下文使用情况">
              <div><span>累计输入 · {{ contextUsed.toLocaleString() }} tokens（服务商返回）</span><span>模型窗口 {{ contextWindow.toLocaleString() }} tokens</span></div>
              <small v-if="compacting">正在压缩旧对话…</small>
              <small v-if="activeSession?.summarizedCount">已将前 {{ activeSession.summarizedCount }} 条消息压缩为摘要，完整记录保留在本地。</small>
            </div>
            <small class="chat-hint">聊天记录仅保存在当前浏览器，按账号隔离；清理浏览器数据会删除记录。Enter 发送，Shift + Enter 换行。</small>
          </div>
        </div>
      </el-card>
      <AdminChatFilePreviewDialog v-if="filePreview" :source="filePreview" @close="filePreview = null" />
      <AdminChatImportDialog v-if="importSource" :source="importSource" :approve="approveChatImport" @close="importSource = null" />
      <el-dialog class="qoj-management-dialog" :model-value="Boolean(imagePreview)" :title="imagePreview?.name || '图片预览'" width="min(900px, 94vw)" @close="closeImagePreview">
        <img v-if="imagePreview" class="chat-image-full" :src="imagePreview.src" :alt="imagePreview.name" />
      </el-dialog>
    </template>

    <template v-else-if="workspace.kind === 'generator'">
      <div class="generator-grid"><el-card shadow="never"><template #header><strong>题目要求</strong></template><el-form label-position="top"><el-form-item label="题目名称（可选）"><el-input v-model="generatorForm.title" maxlength="200"/></el-form-item><div class="form-two-col"><el-form-item label="难度区间"><el-input v-model="generatorForm.difficultyRating" placeholder="例如 800-1200"/></el-form-item><el-form-item label="测试点数量"><el-input-number v-model="generatorForm.testCaseCount" :min="5" :max="200"/></el-form-item></div><el-form-item label="题目背景"><el-input v-model="generatorForm.background" type="textarea" :rows="3" maxlength="800"/></el-form-item><el-form-item label="题目详细描述" required><el-input v-model="generatorForm.description" type="textarea" :rows="7" maxlength="5000" show-word-limit/></el-form-item><el-form-item label="知识点（用顿号、逗号或换行分隔）"><el-input v-model="generatorForm.knowledgePoints" type="textarea" :rows="3" placeholder="贪心、排序、前缀和"/></el-form-item><div class="generator-actions"><el-button v-if="generatorBusy" type="danger" @click="cancelGeneration">取消任务</el-button><el-button v-else type="primary" :loading="generatorBusy" @click="startGeneration">开始生成</el-button><el-button v-if="generatedProblem" :loading="saving" @click="saveGeneratedDraft">保存为未发布题目</el-button></div></el-form></el-card><el-card shadow="never" class="progress-card"><template #header><strong>实时进度</strong></template><el-progress :percentage="generatorProgress" :status="generatorError?'exception':generatorProgress===100?'success':undefined"/><el-alert v-if="generatorError" type="error" :title="generatorError" :closable="false"/><div class="generator-logs"><p v-for="(log,index) in generatorLogs" :key="index">{{log}}</p><el-empty v-if="!generatorLogs.length" description="生成任务提交后显示 Agent 的实时反馈"/></div></el-card></div>
      <el-card v-if="generatedProblem" shadow="never" class="generated-card"><template #header><div class="generated-heading"><strong>生成结果预览</strong><el-tag type="success">候选题目</el-tag></div></template><el-form label-position="top"><el-form-item label="题目名称"><el-input v-model="generatedProblem.title"/></el-form-item><div class="tag-row"><el-tag v-for="item in generatedProblem.knowledgePoints" :key="item">{{item}}</el-tag><el-tag type="info">难度 {{generatedProblem.rating}}</el-tag></div><el-form-item label="题目描述 HTML"><el-input v-model="generatedProblem.statementHtml" type="textarea" :rows="8"/></el-form-item><el-form-item label="题目描述 LaTeX"><el-input v-model="generatedProblem.statementLatex" type="textarea" :rows="5"/></el-form-item><div class="form-two-col"><el-form-item label="输入格式"><el-input v-model="generatedProblem.inputFormatHtml" type="textarea" :rows="4"/></el-form-item><el-form-item label="输出格式"><el-input v-model="generatedProblem.outputFormatHtml" type="textarea" :rows="4"/></el-form-item></div></el-form><el-divider content-position="left">样例</el-divider><el-card v-for="(sample,index) in generatedProblem.samples" :key="index" shadow="never"><template #header>样例 {{index+1}}</template><div class="form-two-col"><el-input v-model="sample.input" type="textarea" :rows="4" placeholder="输入"/><el-input v-model="sample.output" type="textarea" :rows="4" placeholder="输出"/></div><el-input v-model="sample.explanation" type="textarea" :rows="2" placeholder="说明（可选）"/></el-card><el-alert v-if="generatedWorkspace?.files.length" type="info" :closable="false" :title="`Agent 还返回了 ${generatedWorkspace.files.length} 个文件；当前保存流程将先保存题面和样例，隐藏测试数据仍需在题目编辑器中补充。`"/></el-card>
    </template>

    <template v-else-if="workspace.kind === 'settings'">
      <el-card shadow="never" class="settings-card"><div class="settings-note">接口配置数据支持结构化查看和保存。修改前请保留原有字段；密钥类字段不会由服务端回显。</div><el-input v-model="jsonText" type="textarea" :rows="20" spellcheck="false"/><div class="settings-actions"><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></div></el-card>
    </template>

    <template v-else-if="workspace.kind === 'report'">
      <el-skeleton v-if="loading" :rows="7" animated/><el-empty v-else-if="!detail" description="没有可展示的数据"/><el-card v-else shadow="never"><el-descriptions :column="2" border><el-descriptions-item v-for="([key,value]) in settingEntries" :key="key" :label="key"><pre v-if="value && typeof value === 'object'">{{ JSON.stringify(value,null,2) }}</pre><span v-else>{{ value ?? '-' }}</span></el-descriptions-item></el-descriptions><div class="report-actions"><el-button v-for="action in workspace.actions" :key="action.label" type="primary" @click="runAction(action,{id:idFromPath})">{{ action.label }}</el-button><el-button v-if="workspace.resource" @click="applyForm(detail!)">编辑</el-button></div></el-card>
    </template>

    <template v-else>
      <el-card shadow="never" class="table-card"><div class="table-toolbar management-inline-toolbar"><el-input v-model="keyword" clearable placeholder="搜索关键词" @keyup.enter="page=1;load()"/><el-button @click="page=1;load()">搜索</el-button><div class="management-card-actions"><header class="workspace-heading"><div class="heading-actions"><el-button v-if="workspace.resource && !path.includes('/edit') && !path.endsWith('/new') && !path.startsWith('/problem-folders/') && !path.startsWith('/courses/') && !path.startsWith('/contests/') && path!='/problems'" type="primary" @click="applyForm()">{{ workspace.createLabel || '新增' }}</el-button><el-button v-if="workspace.resource && path==='/problems'" type="primary" @click="router.push(adminPath('/problems/new'))">新增题目</el-button><el-button v-if="workspace.resource && (path.endsWith('/new') || path.includes('/edit'))" type="primary" @click="applyForm()">打开编辑器</el-button></div></header></div></div><el-table v-loading="loading" :data="displayRows" stripe row-key="id" empty-text="暂无数据" @row-dblclick="(row: Row) => applyForm(row)"><el-table-column v-if="workspace.title.includes('排行榜')" label="排名" width="80"><template #default="{ $index }">#{{ (page-1)*pageSize+$index+1 }}</template></el-table-column><el-table-column v-for="key in columns" :key="key" :prop="key" :label="key" min-width="130" show-overflow-tooltip><template #default="{row}"><el-tag v-if="/status|verdict/i.test(key)" :type="String(row[key]).includes('AC')||row[key]==='ACTIVE'?'success':String(row[key]).includes('PENDING')?'warning':'info'">{{ row[key] ?? '-' }}</el-tag><span v-else-if="row[key] && typeof row[key] === 'object'">{{ Array.isArray(row[key]) ? `共 ${row[key].length} 项` : '详情' }}</span><span v-else>{{ row[key] ?? '-' }}</span></template></el-table-column><el-table-column label="操作" width="250" fixed="right"><template #default="{row}"><el-button v-if="workspace.resource" link type="primary" @click="applyForm(row)">编辑</el-button><el-button v-for="action in workspace.actions" :key="action.label" link type="primary" @click="runAction(action,row)">{{ action.label }}</el-button><el-button v-if="workspace.resource && !workspace.actions?.length" link type="danger" @click="remove(row)">删除</el-button><el-button v-if="path==='/problems'" link type="primary" @click="router.push(adminPath(`/problems/${row.id}/edit`))">题目编辑</el-button><el-button v-if="path==='/contests'" link type="primary" @click="router.push(adminPath(`/contests/${row.id}`))">详情</el-button><el-button v-if="path==='/classes'" link type="primary" @click="router.push(adminPath(`/classes/${row.id}`))">成员</el-button></template></el-table-column></el-table><div class="table-footer"><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[10,20,50,100]"/></div></el-card>
    </template>

    
<el-dialog class="qoj-management-dialog" v-model="dialogOpen" :title="editingId ? '编辑记录' : '新增记录'" width="min(760px,94vw)" destroy-on-close><el-alert v-if="!workspace.fields?.length" type="info" :closable="false" title="高级 JSON 编辑" description="请保留接口要求的字段结构。字符串形式的 JSON 数组或对象会在保存时解析。"/><div v-if="workspace.fields?.length" class="form-fields"><el-form ref="formRef" label-position="top"><el-form-item v-for="field in workspace.fields" :key="field.key" :label="field.label" :required="field.required"><el-input v-if="field.type==='textarea'" v-model="form[field.key] as string" type="textarea" :rows="4"/><el-input v-else-if="field.type==='password'" v-model="form[field.key] as string" type="password" show-password/><el-input-number v-else-if="field.type==='number'" v-model="form[field.key] as number" :min="0"/><el-switch v-else-if="field.type==='boolean'" v-model="form[field.key] as boolean"/><el-input v-else v-model="form[field.key] as string"/></el-form-item></el-form></div><el-switch v-if="!workspace.fields?.length" v-model="jsonMode" active-text="编辑原始 JSON"/><el-input v-if="!workspace.fields?.length || jsonMode" v-model="jsonText" type="textarea" :rows="17" spellcheck="false"/><template #footer><el-button @click="dialogOpen=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="detailDialog" title="详情 / 代码" width="min(900px,95vw)" destroy-on-close><pre class="detail-code">{{ detail?.code ?? JSON.stringify(detail,null,2) }}</pre></el-dialog>
  </section>
</template>

<style scoped>
.chat-context{flex-shrink:0;color:var(--qoj-color-text-1);font-size:12px;padding:8px 0}.chat-context>div:first-child{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px}.chat-context small{display:block;margin-top:5px}



.admin-workspace{display:flex;flex-direction:column;gap:16px}.workspace-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.workspace-heading h1{margin:0;font-size:22px}.workspace-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.heading-actions,.table-toolbar,.table-footer,.settings-actions,.report-actions{display:flex;align-items:center;gap:10px}.table-card,.settings-card,.chat-card{border:0}.table-toolbar{margin-bottom:14px}.table-toolbar .el-input{max-width:320px}.table-footer{justify-content:space-between;margin-top:14px}.form-fields{max-height:65vh;overflow:auto;padding:6px 4px}.settings-note{margin-bottom:12px;color:var(--el-text-color-secondary);font-size:13px}.settings-actions,.report-actions{justify-content:flex-end;margin-top:14px}.chat-history{height:min(62vh,620px);overflow:auto;display:flex;flex-direction:column;gap:12px;padding:6px}.chat-message{max-width:88%;padding:12px 14px;border-radius:10px;background:var(--page-bg)}.chat-message.user{align-self:flex-end;background:var(--el-color-primary-light-9)}.chat-message strong{display:block;margin-bottom:5px;color:var(--el-text-color-regular);font-size:12px}.chat-message pre,.detail-code{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.chat-input{display:flex;align-items:flex-end;gap:10px;margin-top:14px}.detail-code{max-height:70vh;overflow:auto;padding:16px;background:var(--el-text-color-primary);color:var(--card-border);border-radius:8px}@media(max-width:680px){.workspace-heading{align-items:flex-start;flex-direction:column}.table-footer{align-items:flex-start;flex-direction:column}.chat-input{align-items:stretch;flex-direction:column}}
.chat-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;min-height:560px}.chat-sessions{display:flex;flex-direction:column;gap:8px;padding-right:12px;border-right:1px solid var(--card-border)}.new-chat-button{width:100%}.session-row{display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:7px}.session-row.active{background:var(--el-color-primary-light-9)}.session-row>button:first-child{flex:1;min-width:0;overflow:hidden;border:0;background:transparent;color:var(--el-text-color-regular);text-align:left;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.chat-conversation{min-width:0;display:flex;flex-direction:column}.chat-history{flex:1;height:min(62vh,620px);overflow:auto;display:flex;flex-direction:column;gap:12px;padding:6px}.chat-message{max-width:88%;padding:12px 14px;border-radius:10px;background:var(--page-bg)}.chat-message.user{align-self:flex-end;background:var(--el-color-primary-light-9)}.chat-message strong{display:block;margin-bottom:5px;color:var(--el-text-color-regular);font-size:12px}.chat-message pre,.detail-code{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.chat-input{display:flex;align-items:flex-end;gap:10px;margin-top:14px}.chat-hint{margin-top:6px;color:var(--el-text-color-placeholder)}.chat-progress{margin:0;padding:8px 10px;border-radius:6px;background:var(--el-color-primary-light-9);color:var(--el-color-primary)}.approval-card{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px;border:1px solid #fecdca;border-radius:8px;background:#fffbfa}.approval-card p{flex:1 0 100%;margin:0;color:var(--el-text-color-regular)}.detail-code{max-height:70vh;overflow:auto;padding:16px;background:var(--el-text-color-primary);color:var(--card-border);border-radius:8px}.generator-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);gap:14px}.generator-grid .el-input-number{width:100%}.form-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}.generator-actions{display:flex;justify-content:flex-end;gap:10px}.progress-card{min-height:330px}.generator-logs{max-height:420px;overflow:auto;margin-top:12px;padding:12px;border-radius:7px;background:var(--el-fill-color-light);color:var(--el-text-color-secondary);font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}.generator-logs p{margin:0 0 5px}.generated-card{border:0}.generated-heading{display:flex;align-items:center;justify-content:space-between}.generated-card .el-card{margin-bottom:12px}.tag-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px}@media(max-width:920px){.generator-grid{grid-template-columns:1fr}.chat-layout{grid-template-columns:180px minmax(0,1fr)}}@media(max-width:680px){.workspace-heading{align-items:flex-start;flex-direction:column}.table-footer{align-items:flex-start;flex-direction:column}.chat-input{align-items:stretch;flex-direction:column}.chat-layout{grid-template-columns:1fr}.chat-sessions{max-height:220px;overflow:auto;padding:0 0 12px;border-right:0;border-bottom:1px solid var(--card-border)}.form-two-col{grid-template-columns:1fr}}
.chat-message-assets,.chat-message-actions{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}.chat-image-link,.chat-file-link{max-width:240px;overflow:hidden;text-overflow:ellipsis}.chat-file-link{background:var(--content-bg)}.chat-placeholder{color:var(--el-text-color-placeholder);font-size:13px}.chat-image-full{display:block;max-width:100%;max-height:75vh;margin:auto;object-fit:contain}
.chat-message-meta{display:block;margin-top:8px;color:var(--el-text-color-placeholder);font-size:11px}

.chat-screen{min-height:0;overflow:hidden;box-sizing:border-box}
.chat-screen .chat-card{flex:1;min-height:0;overflow:hidden}
.chat-screen .chat-card :deep(.el-card__body){height:100%;min-height:0;box-sizing:border-box}
.chat-screen .chat-layout{height:100%;min-height:0;overflow:hidden}
.chat-screen .chat-conversation{min-height:0;overflow:hidden}
.chat-screen .chat-history{height:0;min-height:0;overflow:auto;scrollbar-width:none}
.chat-screen .chat-sessions{min-height:0;overflow:auto;scrollbar-width:none}
.chat-screen .chat-history::-webkit-scrollbar,.chat-screen .chat-sessions::-webkit-scrollbar{display:none}
.chat-screen .chat-conversation>:not(.chat-history){flex-shrink:0}
.chat-screen .chat-input>.el-button{flex-shrink:0;min-width:72px;white-space:nowrap}
.chat-screen .chat-input :deep(.el-textarea){min-width:0;flex:1}
@media(max-width:680px){.chat-screen .chat-layout{grid-template-rows:minmax(48px,20%) minmax(0,1fr)}.chat-screen .chat-sessions{max-height:none}.chat-screen .chat-input{flex-direction:row;align-items:flex-end}}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminDelete, adminDownload, adminGet, adminPost } from "../../../admin/api/adminClient";
import { teacherDelete, teacherDownload, teacherGet, teacherPost, type TeacherStudent } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import { languageLabel, SUBMISSION_LANGUAGE_OPTIONS } from "../../../data/languages";
import { formatDisplayDateTime } from "../../../lib/format";

type View = "submissions" | "statistics" | "queue";
type Submission = { id: number; userId: number; username?: string | null; displayName?: string | null; problemId?: number | null; problemTitle?: string | null; contestId?: number | null; contestTitle?: string | null; contestProblemId?: number | null; contestProblemLabel?: string | null; practiceId?: number | null; practiceTitle?: string | null; participantId?: number | null; teamId?: number | null; codeLength?: number | null; language?: string | null; status?: string | null; score?: number | null; timeUsed?: number | null; memoryUsed?: number | null; identityType?: string | null; identityId?: number | null; judgeServer?: string | null; priority?: number | null; retryCount?: number | null; judgeMessage?: string | null; errorMessage?: string | null; submitTime?: string | null; isContestSubmission?: boolean | null; isFrozen?: boolean | null; isRejudged?: boolean | null; createdAt?: string | null; updatedAt?: string | null; passedCaseCount?: number | null; totalCaseCount?: number | null; code?: string | null; cases?: Array<{ id?: number | null; caseNo: number; status: string; score?: number | null; maxScore?: number | null; timeMs?: number | null; memoryKb?: number | null; judgeMessage?: string | null }> };
type QueueRow = { queueId: number; submissionId: number; contestId?: number | null; contestTitle?: string | null; problemId: number; contestProblemId?: number | null; problemLabel?: string | null; problemTitle: string; userId: number; username?: string | null; displayName: string; language: string; status: string; statusText: string; judgeServer?: string | null; priority: number; submitTime: string; startJudgeTime?: string | null; finishTime?: string | null; waitingTimeMillis: number; runningTimeMillis: number; retryCount: number; errorMessage?: string | null };
type QueueStats = { waiting: number; judging: number; finished: number; currentConcurrent: number; maxConcurrent: number; total: number };
type Page<T> = { list: T[]; total: number };
type Option = { id: number; title?: string; name?: string; username?: string; displayName?: string };
const props = withDefaults(defineProps<{ view: View; portal?: "admin" | "teacher"; practiceOnly?: boolean }>(), { view: "submissions" });
const route = useRoute();
const teacher = computed(() => props.portal === "teacher");
function get<T>(path: string) { return teacher.value ? teacherGet<T>(path) : adminGet<T>(path); }
function post<T>(path: string, body?: unknown) { return teacher.value ? teacherPost<T>(path, body) : adminPost<T>(path, body); }
function remove<T>(path: string) { return teacher.value ? teacherDelete<T>(path) : adminDelete<T>(path); }
function download(path: string, filename: string) { return teacher.value ? teacherDownload(path, filename) : adminDownload(path, filename); }
const contestId = computed(() => String(route.params.contestId ?? new URLSearchParams(route.fullPath.split("?")[1] || "").get("contestId") ?? ""));
const title = computed(() => props.view === "queue" ? "判题队列" : props.view === "statistics" ? "提交统计" : "提交管理");
const rows = ref<Submission[]>([]); const queueRows = ref<QueueRow[]>([]); const total = ref(0); const loading = ref(false); const error = ref(""); const page = ref(1); const pageSize = ref(props.view === "statistics" ? 20 : 10);
const paused = ref(false); const stats = ref<QueueStats | null>(null);
const filters = reactive({ keyword: "", id: "", userId: "", classId: "", problemId: "", contestId: "", contestProblemId: "", practiceId: "", language: "", status: "", judgeServer: "", identityType: "", from: "", to: "", sortBy: "submitTime", sortOrder: "desc" });
const classes = ref<Option[]>([]); const problems = ref<Option[]>([]); const contests = ref<Option[]>([]); const students = ref<Option[]>([]); const studentKeyword = ref(""); const studentLoading = ref(false);
const detail = ref<Submission | null>(null); const detailLoading = ref(false); const codeDialog = ref(false); const codeText = ref(""); const codeLoading = ref(false);
const log = ref<Record<string, unknown> | null>(null); const priorityTarget = ref<QueueRow | null>(null); const priority = ref(0); const priorityBusy = ref(false); const exporting = ref(false);
const detailDialog = computed({ get: () => detail.value !== null, set: (open: boolean) => { if (!open && !detailLoading.value) detail.value = null; } });
const logDialog = computed({ get: () => log.value !== null, set: (open: boolean) => { if (!open) log.value = null; } });
const priorityDialog = computed({ get: () => priorityTarget.value !== null, set: (open: boolean) => { if (!open && !priorityBusy.value) priorityTarget.value = null; } });
let studentTimer: number | undefined; let pollingTimer: number | undefined; let sequence = 0; let statsSequence = 0;
const statusOptions = ["PENDING", "JUDGING", "COMPILING", "RUNNING", "AC", "WA", "TLE", "MLE", "RE", "CE", "NOO", "SE", "FAILED", "REJUDGE_PENDING", "WAITING"];
const sortOptions = computed(() => props.view === "queue" ? [
  { label: "提交时间", value: "submitTime" }, { label: "提交 ID", value: "submissionId" },
  { label: "状态", value: "status" }, { label: "优先级", value: "priority" },
  { label: "开始判题", value: "startJudgeTime" }, { label: "完成时间", value: "finishTime" },
] : [
  { label: "提交时间", value: "submitTime" }, { label: "创建时间", value: "createdAt" },
  { label: "更新时间", value: "updatedAt" }, { label: "提交 ID", value: "id" },
  { label: "状态", value: "status" }, { label: "分数", value: "score" }, { label: "运行时间", value: "timeUsed" },
]);
const languages = SUBMISSION_LANGUAGE_OPTIONS;
const endpoint = computed(() => props.view === "queue" ? "/api/admin/v1/submission-queue" : "/api/admin/v1/submissions");
function api(path: string) { return teacher.value ? path : adminPath(path); }
function dash(value: unknown) { return value === null || value === undefined || value === "" ? "-" : String(value); }
function date(value?: string | null) { return value ? formatDisplayDateTime(value) : "-"; }
function statusType(status?: string | null) { const value = (status ?? "").toUpperCase(); if (["AC", "ACCEPTED", "FINISHED"].includes(value)) return "success"; if (["PENDING", "WAITING", "JUDGING", "COMPILING", "RUNNING", "REJUDGE_PENDING"].includes(value)) return "primary"; if (["TLE", "MLE"].includes(value)) return "warning"; if (["SE", "FAILED"].includes(value)) return "info"; return "danger"; }
function formatDuration(ms?: number | null) { const seconds = Math.floor(Math.max(0, ms ?? 0) / 1000); if (seconds < 60) return `${seconds}s`; const minutes = Math.floor(seconds / 60); return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function query(includePaging = true) {
  const params = new URLSearchParams();
  if (includePaging) { params.set("page", String(page.value)); params.set("pageSize", String(pageSize.value)); }
  params.set("sortBy", filters.sortBy); params.set("sortOrder", filters.sortOrder);
  const keys = props.view === "queue" ? ["contestId", "problemId", "userId", "language", "status", "judgeServer", "from", "to"] as const : Object.keys(filters) as Array<keyof typeof filters>;
  keys.forEach(key => { const value = filters[key]?.trim(); if (value && key !== "sortBy" && key !== "sortOrder") params.set(key, value); });
  if (contestId.value) params.set("contestId", contestId.value);
  if (props.practiceOnly) params.set("practiceOnly", "true");
  return params.toString();
}
function queueStatsQuery() {
  const params = new URLSearchParams();
  for (const key of ["contestId", "problemId", "userId", "language"] as const) { const value = key === "contestId" && contestId.value ? contestId.value : filters[key].trim(); if (value) params.set(key, value); }
  return params.toString();
}
async function load() {
  const current = ++sequence; loading.value = true; error.value = "";
  try {
    const result = await get<Page<Submission | QueueRow>>(api(`${endpoint.value}?${query()}`));
    if (current !== sequence) return;
    if (props.view === "queue") queueRows.value = result.list as QueueRow[]; else rows.value = result.list as Submission[];
    total.value = result.total ?? 0;
  } catch (cause) { if (current === sequence) error.value = cause instanceof Error ? cause.message : "提交数据加载失败"; }
  finally { if (current === sequence) loading.value = false; }
}
async function loadStats() {
  if (props.view !== "queue") return;
  const current = ++statsSequence;
  try { const params = queueStatsQuery(); const result = await get<QueueStats>(api(`/api/admin/v1/submission-queue/stats${params ? `?${params}` : ""}`)); if (current === statsSequence) stats.value = result; } catch { /* Keep the last queue snapshot when statistics are temporarily unavailable. */ }
}
async function loadOptions() {
  const [classResult, problemResult, contestResult] = await Promise.allSettled([
    get<Option[]>(api(teacher.value ? "/api/teacher/v1/classes" : "/api/admin/v1/classes")),
    get<Page<Option>>(api("/api/admin/v1/problems?page=1&pageSize=200")),
    get<Page<Option>>(api("/api/admin/v1/contests?page=1&pageSize=200")),
  ]);
  if (classResult.status === "fulfilled") classes.value = classResult.value;
  if (problemResult.status === "fulfilled") problems.value = problemResult.value.list ?? [];
  if (contestResult.status === "fulfilled") contests.value = contestResult.value.list ?? [];
}
function searchStudents() {
  if (studentTimer) window.clearTimeout(studentTimer);
  studentTimer = window.setTimeout(async () => {
    studentLoading.value = true;
    try { const params = new URLSearchParams({ page: "1", pageSize: "50", role: "STUDENT" }); if (studentKeyword.value.trim()) params.set("keyword", studentKeyword.value.trim()); if (teacher.value) {
      const result = await teacherGet<TeacherStudent[]>("/api/teacher/v1/students");
      const keyword = studentKeyword.value.trim().toLocaleLowerCase();
      students.value = result.filter(user => !keyword || `${user.displayName ?? ""} ${user.username ?? ""} ${user.studentNo ?? ""}`.toLocaleLowerCase().includes(keyword)).map(user => ({ id: user.userId, username: user.username ?? undefined, displayName: user.displayName ?? undefined }));
    } else {
      students.value = (await get<Page<Option>>(api(`/api/admin/v1/users?${params}`))).list ?? [];
    } }
    catch { students.value = []; }
    finally { studentLoading.value = false; }
  }, 300);
}
function chooseStudent(id?: number) { filters.userId = id ? String(id) : ""; page.value = 1; }
function resetFilters() {
  Object.assign(filters, { keyword: "", id: "", userId: "", classId: "", problemId: "", contestId: contestId.value, contestProblemId: "", practiceId: "", language: "", status: "", judgeServer: "", identityType: "", from: "", to: "", sortBy: "submitTime", sortOrder: "desc" });
  studentKeyword.value = ""; page.value = 1;
}
async function exportCsv() {
  exporting.value = true;
  try { await download(api(`/api/admin/v1/submissions/export?${query(false)}`), "submissions.csv"); ElMessage.success("提交记录已开始下载"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "导出失败"); }
  finally { exporting.value = false; }
}
async function openDetail(row: Submission) {
  detailLoading.value = true;
  try { detail.value = await get<Submission>(api(`/api/admin/v1/submissions/${row.id}`)); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "提交详情加载失败"); }
  finally { detailLoading.value = false; }
}
async function openCode(row: Submission | QueueRow) {
  codeLoading.value = true; codeDialog.value = true;
  try { codeText.value = await get<string>(api(`/api/admin/v1/submissions/${"submissionId" in row ? row.submissionId : row.id}/code`)); }
  catch (cause) { codeText.value = cause instanceof Error ? cause.message : "代码加载失败"; }
  finally { codeLoading.value = false; }
}
async function deleteSubmission(row: Submission) {
  try { await ElMessageBox.confirm(`确定删除提交 #${row.id} 吗？`, "删除提交", { type: "warning" }); await remove(api(`/api/admin/v1/submissions/${row.id}`)); ElMessage.success("提交已删除"); await load(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
async function rejudgeSubmission(row: Submission) {
  try {
    await ElMessageBox.confirm(`确定重判提交 #${row.id} 吗？`, "重判提交", { type: "warning" });
    await post(api(`/api/admin/v1/submissions/${row.id}/rejudge`));
    ElMessage.success("已提交重判");
    await load();
  } catch (cause) {
    if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "重判失败");
  }
}
async function queueAction(row: QueueRow, action: "rejudge" | "cancel") {
  try { await post(api(`/api/admin/v1/submission-queue/${row.queueId}/${action}`)); ElMessage.success(action === "rejudge" ? "已提交重判" : "已取消队列任务"); await Promise.all([load(), loadStats()]); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : `${action}操作失败`); }
}
async function openLogs(row: QueueRow) {
  try { log.value = await get(api(`/api/admin/v1/submission-queue/${row.queueId}/logs`)); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "日志加载失败"); }
}
async function savePriority() {
  if (!priorityTarget.value) return;
  priorityBusy.value = true;
  try { await post(api(`/api/admin/v1/submission-queue/${priorityTarget.value.queueId}/priority`), { priority: priority.value }); priorityTarget.value = null; ElMessage.success("优先级已更新"); await load(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "优先级更新失败"); }
  finally { priorityBusy.value = false; }
}
async function deleteQueue(row: QueueRow) {
  try { await ElMessageBox.confirm(`确定删除提交 #${row.submissionId} 及其判题结果？`, "删除队列任务", { type: "warning", confirmButtonText: "继续" }); await ElMessageBox.confirm("删除后不可恢复，请再次确认。", "二次确认", { type: "error", confirmButtonText: "确认删除" }); await remove(api(`/api/admin/v1/submission-queue/${row.queueId}`)); ElMessage.success("队列任务已删除"); await Promise.all([load(), loadStats()]); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
function statusText(row: QueueRow) { return row.statusText || row.status; }
// Reset before the request watcher runs, so a changed filter never queries an old page.
watch(() => [...Object.values(filters), pageSize.value], () => { page.value = 1; }, { flush: "sync" });
watch(() => [props.view, contestId.value, props.practiceOnly], () => { resetFilters(); stats.value = null; statsSequence += 1; }, { flush: "sync" });
watch(() => [props.view, route.fullPath, page.value, pageSize.value, ...Object.values(filters)] as const, () => { void load(); void loadStats(); }, { immediate: true });
watch(() => props.view, () => { void loadOptions(); });
watch(paused, (pause) => {
  if (pollingTimer) window.clearInterval(pollingTimer);
  if (props.view === "queue" && !pause) pollingTimer = window.setInterval(() => { void load(); void loadStats(); }, 3000);
}, { immediate: true });
watch(() => props.view, () => { if (pollingTimer) window.clearInterval(pollingTimer); if (props.view === "queue" && !paused.value) pollingTimer = window.setInterval(() => { void load(); void loadStats(); }, 3000); });
watch(() => props.view, (view) => { if (teacher.value || view === "statistics" || view === "queue") void loadOptions(); }, { immediate: true });
onBeforeUnmount(() => { if (pollingTimer) window.clearInterval(pollingTimer); if (studentTimer) window.clearTimeout(studentTimer); sequence += 1; statsSequence += 1; });
</script>

<template>
  <section class="submission-management page-container">
    <el-alert v-if="error" type="error" :closable="false" :title="error"/>
    <template v-if="view==='queue'"><div class="queue-stats"><el-card shadow="never"><small>等待判题</small><strong>{{ stats?.waiting??0 }}</strong></el-card><el-card shadow="never"><small>正在判题</small><strong>{{ stats?.judging??0 }}</strong></el-card><el-card shadow="never"><small>已完成</small><strong>{{ stats?.finished??0 }}</strong></el-card><el-card shadow="never"><small>总任务</small><strong>{{ stats?.total??0 }}</strong></el-card><el-card shadow="never"><small>当前 / 最大并发</small><strong>{{ stats?.currentConcurrent??0 }} / {{ stats?.maxConcurrent??2 }}</strong><el-progress :percentage="stats&&stats.maxConcurrent?Math.min(100,Math.round(stats.currentConcurrent/stats.maxConcurrent*100)):0" :show-text="false"/></el-card></div></template>
    <el-card shadow="never"><div class="filters management-inline-toolbar">
      <el-input v-if="view!=='queue'" v-model="filters.keyword" clearable :maxlength="100" placeholder="搜索学生、题目、题单或提交 ID"/><template v-if="view==='submissions'"><el-input v-model="filters.id" placeholder="提交 ID"/><el-input v-model="filters.userId" placeholder="用户 ID"/><el-input v-model="filters.problemId" placeholder="题目 ID"/><el-input v-model="filters.contestId" :disabled="!!contestId" placeholder="比赛 ID"/><el-input v-model="filters.contestProblemId" placeholder="比赛题目 ID"/><el-input v-model="filters.practiceId" placeholder="题单 ID"/><el-input v-model="filters.judgeServer" placeholder="判题机"/><el-input v-model="filters.identityType" placeholder="身份类型"/><el-select v-if="teacher" v-model="filters.classId" clearable filterable placeholder="按班级筛选"><el-option v-for="item in classes" :key="item.id" :label="item.name||''" :value="String(item.id)"/></el-select><el-input v-else v-model="filters.classId" placeholder="班级 ID"/><el-select v-model="filters.language" clearable filterable placeholder="语言"><el-option v-for="item in languages" :key="item.apiValue" :label="item.label" :value="item.apiValue"/></el-select></template>
      <template v-else><el-select v-if="view==='statistics'" v-model="filters.userId" filterable remote clearable :remote-method="(value:string)=>{studentKeyword=value;searchStudents()}" :loading="studentLoading" placeholder="搜索学生" @focus="searchStudents"><el-option v-for="user in students" :key="user.id" :label="user.displayName||user.username||`#${user.id}`" :value="String(user.id)"/></el-select><el-input v-if="view==='queue'" v-model="filters.userId" placeholder="用户 ID"/><el-select v-if="view==='statistics'" v-model="filters.classId" clearable filterable placeholder="按班级筛选"><el-option v-for="item in classes" :key="item.id" :label="item.name||''" :value="String(item.id)"/></el-select><el-select v-model="filters.problemId" clearable filterable placeholder="按题目筛选"><el-option v-for="item in problems" :key="item.id" :label="item.title||`#${item.id}`" :value="String(item.id)"/></el-select><el-select v-model="filters.contestId" clearable filterable :disabled="!!contestId" placeholder="按比赛筛选"><el-option v-for="item in contests" :key="item.id" :label="item.title||`#${item.id}`" :value="String(item.id)"/></el-select><el-select v-model="filters.language" clearable filterable placeholder="语言"><el-option v-for="item in languages" :key="item.apiValue" :label="item.label" :value="item.apiValue"/></el-select></template>
      <el-select v-model="filters.status" clearable filterable placeholder="状态"><el-option v-for="item in statusOptions" :key="item" :label="item" :value="item"/></el-select><el-date-picker v-if="view==='submissions'||view==='statistics'" v-model="filters.from" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="开始时间"/><el-date-picker v-if="view==='submissions'||view==='statistics'" v-model="filters.to" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="结束时间"/><el-select v-model="filters.sortBy" placeholder="排序字段"><el-option v-for="item in sortOptions" :key="item.value" :label="item.label" :value="item.value"/></el-select><el-select v-model="filters.sortOrder"><el-option label="降序" value="desc"/><el-option label="升序" value="asc"/></el-select><el-button @click="resetFilters">重置</el-button><el-switch v-if="view==='queue'" v-model="paused" active-text="暂停自动刷新" inactive-text="3 秒自动刷新"/>
    <div class="management-card-actions"><header class="page-heading"><div class="heading-actions"><el-button v-if="view!=='queue'" type="success" :loading="exporting" @click="exportCsv">导出 CSV</el-button></div></header></div></div></el-card>
    <el-card shadow="never">
      <el-table v-if="view==='queue'" v-loading="loading" :data="queueRows" stripe row-key="queueId" empty-text="暂无队列任务"><el-table-column prop="contestTitle" label="比赛" min-width="150"/><el-table-column label="题目" min-width="190"><template #default="{row}"><strong v-if="row.problemLabel">{{ row.problemLabel }}.</strong> {{ row.problemTitle }}</template></el-table-column><el-table-column label="用户" min-width="150"><template #default="{row}">{{ row.displayName||row.username||'-' }}<small class="sub-line">{{ row.username }}</small></template></el-table-column><el-table-column prop="language" label="语言" width="105"><template #default="{row}">{{ languageLabel(row.language) }}</template></el-table-column><el-table-column prop="statusText" label="状态" width="145"><template #default="{row}"><el-tag :type="statusType(row.status)">{{ statusText(row) }}</el-tag></template></el-table-column><el-table-column prop="judgeServer" label="判题机" width="120"/><el-table-column prop="submitTime" label="提交时间" min-width="165"><template #default="{row}">{{ date(row.submitTime) }}</template></el-table-column><el-table-column prop="startJudgeTime" label="开始判题" min-width="165"><template #default="{row}">{{ date(row.startJudgeTime) }}</template></el-table-column><el-table-column prop="finishTime" label="完成时间" min-width="165"><template #default="{row}">{{ date(row.finishTime) }}</template></el-table-column><el-table-column prop="waitingTimeMillis" label="等待时长" width="100"><template #default="{row}">{{ formatDuration(row.waitingTimeMillis) }}</template></el-table-column><el-table-column prop="runningTimeMillis" label="运行时长" width="100"><template #default="{row}">{{ formatDuration(row.runningTimeMillis) }}</template></el-table-column><el-table-column label="操作" width="330" fixed="right"><template #default="{row}"><el-button link type="primary" @click="queueAction(row,'rejudge')">重判</el-button><el-button link type="warning" @click="queueAction(row,'cancel')">取消</el-button><el-button link @click="priorityTarget=row;priority=row.priority">优先级</el-button><el-button link @click="openLogs(row)">日志</el-button><el-button link @click="openCode(row)">代码</el-button><el-button link type="danger" @click="deleteQueue(row)">删除</el-button></template></el-table-column></el-table>
      <el-table v-else v-loading="loading" :data="rows" stripe row-key="id" empty-text="暂无提交"><el-table-column prop="id" label="ID" width="80"/><el-table-column label="用户" min-width="135"><template #default="{row}">{{ row.displayName||row.username||'-' }}<small class="sub-line">#{{ row.userId }}</small></template></el-table-column><el-table-column label="题目" min-width="190"><template #default="{row}">{{ row.contestProblemLabel?`${row.contestProblemLabel}. `:'' }}{{ row.problemTitle||'-' }}<small class="sub-line">#{{ row.problemId }}</small></template></el-table-column><el-table-column prop="contestTitle" label="比赛" min-width="145"/><el-table-column prop="practiceTitle" label="题单" min-width="145"/><el-table-column prop="language" label="语言" width="100"><template #default="{row}">{{ languageLabel(row.language) }}</template></el-table-column><el-table-column prop="status" label="状态" width="110"><template #default="{row}"><el-tag :type="statusType(row.status)">{{ row.status||'-' }}</el-tag></template></el-table-column><el-table-column prop="score" label="分数" width="85"/><el-table-column label="测试点" width="90"><template #default="{row}">{{ row.passedCaseCount??0 }}/{{ row.totalCaseCount??0 }}</template></el-table-column><el-table-column prop="timeUsed" label="时间 ms" width="90"/><el-table-column prop="memoryUsed" label="内存 KB" width="95"/><el-table-column prop="codeLength" label="代码长度" width="95"/><el-table-column label="提交时间" min-width="165"><template #default="{row}">{{ date(row.submitTime) }}</template></el-table-column><el-table-column label="操作" width="245" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openDetail(row)">查看</el-button><el-button link @click="openCode(row)">代码</el-button><el-button link type="warning" @click="rejudgeSubmission(row)">重判</el-button><el-button link type="danger" @click="deleteSubmission(row)">删除</el-button></template></el-table-column></el-table>
      <div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[10,20,50,100]"/></div>
    </el-card>
    
<el-dialog class="qoj-management-dialog" v-model="detailDialog" :title="detail?`提交详情 #${detail.id}`:'提交详情'" width="min(1100px,96vw)"><el-skeleton v-if="detailLoading" :rows="8" animated/><template v-else-if="detail"><el-descriptions :column="3" border><el-descriptions-item label="提交 ID">{{ detail.id }}</el-descriptions-item><el-descriptions-item label="用户">{{ detail.displayName||detail.username||'-' }} (#{{ detail.userId }})</el-descriptions-item><el-descriptions-item label="题目">{{ detail.problemTitle||'-' }} (#{{ detail.problemId }})</el-descriptions-item><el-descriptions-item label="比赛">{{ detail.contestTitle||'-' }} (#{{ detail.contestId??'-' }})</el-descriptions-item><el-descriptions-item label="题单">{{ detail.practiceTitle||'-' }} (#{{ detail.practiceId??'-' }})</el-descriptions-item><el-descriptions-item label="语言">{{ languageLabel(detail.language) }}</el-descriptions-item><el-descriptions-item label="判题结果">{{ detail.status }}</el-descriptions-item><el-descriptions-item label="分数">{{ detail.score??'-' }}</el-descriptions-item><el-descriptions-item label="测试点">{{ detail.passedCaseCount??0 }}/{{ detail.totalCaseCount??0 }}</el-descriptions-item><el-descriptions-item label="运行时间">{{ detail.timeUsed??'-' }} ms</el-descriptions-item><el-descriptions-item label="运行内存">{{ detail.memoryUsed??'-' }} KB</el-descriptions-item><el-descriptions-item label="判题机">{{ detail.judgeServer||'-' }}</el-descriptions-item><el-descriptions-item label="判题信息" :span="3"><pre class="judge-message">{{ detail.judgeMessage||detail.errorMessage||'暂无' }}</pre></el-descriptions-item></el-descriptions><h3>测试点结果</h3><el-table :data="detail.cases??[]" size="small"><el-table-column prop="caseNo" label="测试点" width="90"/><el-table-column prop="status" label="状态" width="120"><template #default="{row}"><el-tag :type="statusType(row.status)">{{ row.status }}</el-tag></template></el-table-column><el-table-column prop="score" label="得分" width="90"/><el-table-column prop="maxScore" label="满分" width="90"/><el-table-column prop="timeMs" label="时间 ms" width="100"/><el-table-column prop="memoryKb" label="内存 KB" width="105"/><el-table-column prop="judgeMessage" label="判题信息"/></el-table><h3>提交代码</h3><pre class="code-viewer">{{ detail.code||'(无代码)' }}</pre></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="codeDialog" title="提交代码" width="min(980px,95vw)"><el-skeleton v-if="codeLoading" :rows="10" animated/><pre v-else class="code-viewer">{{ codeText }}</pre></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="logDialog" title="错误日志" width="min(720px,95vw)"><el-descriptions v-if="log" :column="1" border><el-descriptions-item label="状态">{{ log.status }}</el-descriptions-item><el-descriptions-item label="判题机">{{ log.judgeServer||'-' }}</el-descriptions-item><el-descriptions-item label="提交时间">{{ date(String(log.submitTime||'')) }}</el-descriptions-item><el-descriptions-item label="开始判题">{{ date(String(log.startJudgeTime||'')) }}</el-descriptions-item><el-descriptions-item label="完成时间">{{ date(String(log.finishTime||'')) }}</el-descriptions-item></el-descriptions><pre v-if="log" class="judge-message">{{ log.errorMessage||log.judgeMessage||'暂无错误日志' }}</pre></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="priorityDialog" title="调整优先级" width="min(420px,95vw)"><el-input-number v-model="priority" :min="0" :max="1000"/><template #footer><el-button @click="priorityTarget=null">取消</el-button><el-button type="primary" :loading="priorityBusy" @click="savePriority">保存</el-button></template></el-dialog>
  </section>
</template>

<style scoped>.submission-management{display:flex;flex-direction:column;gap:14px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.heading-actions{display:flex;gap:8px;flex-wrap:wrap}.filters{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:10px;align-items:center}.filters .el-date-editor,.filters .el-select,.filters .el-input{width:100%}.queue-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.queue-stats .el-card :deep(.el-card__body){display:flex;flex-direction:column;gap:8px}.queue-stats small{color:var(--el-text-color-secondary)}.queue-stats strong{font-size:25px}.pagination{display:flex;justify-content:space-between;align-items:center;margin-top:14px;color:var(--el-text-color-secondary)}.sub-line{display:block;color:var(--el-text-color-placeholder);font-size:11px}.judge-message{max-height:220px;overflow:auto;padding:12px;border-radius:6px;background:var(--el-fill-color-light);white-space:pre-wrap;overflow-wrap:anywhere}.code-viewer{max-height:60vh;overflow:auto;padding:14px;border-radius:8px;background:var(--el-text-color-primary);color:var(--card-border);white-space:pre;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.submission-management h3{margin:18px 0 8px}@media(max-width:1000px){.filters{grid-template-columns:repeat(3,minmax(120px,1fr))}.queue-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.page-heading{align-items:flex-start;flex-direction:column}.filters{grid-template-columns:1fr 1fr}.queue-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pagination{align-items:flex-start;flex-direction:column}}</style>

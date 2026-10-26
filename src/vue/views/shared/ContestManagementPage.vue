<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import type { AdminContest, ContestDraftPayload, ContestPayload, ContestProblemPayload } from "../../../data/apiClient";
import { adminDelete, adminDownload, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";
import { teacherDelete, teacherDownload, teacherGet, teacherPost, teacherPut } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import ContestPolygonImportDialog from "../../components/ContestPolygonImportDialog.vue";
import ContestRosterImportDialog from "../../components/ContestRosterImportDialog.vue";
import AdminContestMessaging from "../../components/AdminContestMessaging.vue";
import ContestInspectionPanel from "../../components/ContestInspectionPanel.vue";
import FolderProblemPicker from "../../components/FolderProblemPicker.vue";
import HtmlMathEditor from "../../components/HtmlMathEditor.vue";
import HtmlMath from "../../components/HtmlMath.vue";

type Portal = "admin" | "teacher";
type ProblemOption = { id: number; title: string; difficulty?: number; testCaseCount?: number; tags?: string[] };
type ContestClass = { id: number; name: string };
type Registration = { id: number; userId: number; username: string; displayName: string; studentNo?: string; status?: string; registeredAt?: string };
type ContestDetail = AdminContest & { registrationCount?: number; problemCount?: number; createdAt?: string; updatedAt?: string };

const props = withDefaults(defineProps<{ portal?: Portal }>(), { portal: "admin" });
const route = useRoute();
const router = useRouter();
const browserWindow = window;
const teacher = computed(() => props.portal === "teacher");
const routeId = computed(() => Number(route.params.contestId ?? 0) || 0);
const mode = computed(() => route.path.endsWith("/new") || route.path.endsWith("/edit") ? "editor" : routeId.value && !route.path.endsWith("/submissions") && !route.path.endsWith("/judge/queue") ? "detail" : "list");
const isEditing = computed(() => route.path.endsWith("/edit") && routeId.value > 0);
const listPath = computed(() => teacher.value ? "/teacher/contests" : adminPath("/contests"));
const error = ref("");
const loading = ref(false);
const saving = ref(false);
const keyword = ref("");
const contestPage = ref(1);
const contestPageSize = ref(10);
const contests = ref<AdminContest[]>([]);
const contest = ref<ContestDetail | null>(null);
const clockNow = ref(Date.now());
const clockTimer = window.setInterval(() => { clockNow.value = Date.now(); }, 1000);
const contestStatusLabels: Record<string, string> = { NOT_STARTED: "未开始", RUNNING: "进行中", ENDED: "已结束" };
const registrationLabels: Record<string, string> = { PUBLIC: "公开报名", PASSWORD: "密码报名", PRIVATE: "指定名单", INVITE: "邀请报名" };
const contestDuration = computed(() => {
  if (!contest.value) return "—";
  const minutes = Math.round((new Date(contest.value.endTime).getTime() - new Date(contest.value.startTime).getTime()) / 60000);
  return Number.isFinite(minutes) ? `${minutes} 分钟` : "—";
});
const contestCountdown = computed(() => {
  if (!contest.value) return "—";
  const start = new Date(contest.value.startTime).getTime();
  const end = new Date(contest.value.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "时间待确认";
  if (clockNow.value >= end) return "比赛已结束";
  const seconds = Math.max(0, Math.ceil(((clockNow.value < start ? start : end) - clockNow.value) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = String(Math.floor(seconds % 86400 / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
  return `${clockNow.value < start ? "距离开始" : "距离结束"} ${days ? `${days}天 ` : ""}${hours}:${minutes}:${String(seconds % 60).padStart(2, "0")}`;
});
const audienceSummary = computed(() => contest.value?.audiences?.map(item => item.name || (item.audienceType === "ALL" ? "所有用户" : `班级 #${item.audienceId}`)).join("、") || (contest.value?.audience === "CLASS" ? "指定班级" : "所有用户"));

const classes = ref<ContestClass[]>([]);
const problems = ref<ProblemOption[]>([]);
const testCases = ref<Record<number, Array<{ caseNo?: number; id?: number }>>>({});
const registrations = ref<Registration[]>([]);
const registrationCandidates = ref<Array<{ id: number; username: string; displayName: string; studentNo?: string }>>([]);
const candidateKeyword = ref("");
const candidateDialog = ref(false);
const registrationKeyword = ref("");
const registrationPage = ref(1);
const candidateLoading = ref(false);
const activeTab = ref("overview");
const polygonImportOpen = ref(false);
const rosterImportOpen = ref(false);
const draft = reactive<ContestDraftPayload>({
  title: "", durationMinutes: 180, startTime: "", endTime: "", description: "", type: "ACM", audience: "ALL", audienceTypes: ["ALL"], classIds: [],
  frozen: false, freezeTime: null, enableRollingScoreboard: false, goldRatio: 10, silverRatio: 20, bronzeRatio: 30,
  allowAfterEndSubmit: false, allowAfterEndViewProblem: true, allowAfterEndViewCode: false, enableCodeTemplates: false,
  scoreboardEnabled: true, resultsPublished: false, publicScoreboardEnabled: false, showClassOnScoreboard: false, allowStarRegistration: false, allowViewAllSubmissions: true,
  registrationPassword: "", allowedIpRanges: "", hidden: false, totalScore: 100, problems: [],
});
const editingHasPassword = ref(false);
const sourceLocked = ref(false);
let draftTimer: number | undefined;

function apiPath(path: string) { return teacher.value ? path : adminPath(path); }
function get<T>(path: string) { return teacher.value ? teacherGet<T>(apiPath(path)) : adminGet<T>(apiPath(path)); }
function post<T>(path: string, body?: unknown) { return teacher.value ? teacherPost<T>(apiPath(path), body) : adminPost<T>(apiPath(path), body); }
function put<T>(path: string, body?: unknown) { return teacher.value ? teacherPut<T>(apiPath(path), body) : adminPut<T>(apiPath(path), body); }
function del<T>(path: string) { return teacher.value ? teacherDelete<T>(apiPath(path)) : adminDelete<T>(apiPath(path)); }
function localDate(value?: string | null) {
  if (!value) return "";
  const normalized = value.replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) return normalized.slice(0, 19);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 19);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 19);
}
function nowLocal() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 19); }
function endFromDuration(start: string, duration: number) {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() + Math.max(1, duration));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 19);
}
function formatDate(value?: string | null) { return value ? new Date(value.replace(" ", "T")).toLocaleString() : "-"; }
function listFrom<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.list)) return record.list as T[];
    if (Array.isArray(record.records)) return record.records as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}
function labels(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) { const remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26); }
  return result;
}
const selectedProblems = computed(() => draft.problems ?? []);
const selectedTotalScore = computed(() => selectedProblems.value.reduce((sum, item) => sum + Number(item.score ?? 0), 0));

const filteredContests = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return contests.value.filter((item) => !query || item.title.toLowerCase().includes(query) || String(item.id).includes(query));
});
const pagedContests = computed(() => teacher.value ? filteredContests.value : filteredContests.value.slice((contestPage.value - 1) * contestPageSize.value, contestPage.value * contestPageSize.value));
watch([keyword, contestPageSize], () => { contestPage.value = 1; });
watch(() => filteredContests.value.length, total => { contestPage.value = Math.min(contestPage.value, Math.max(1, Math.ceil(total / contestPageSize.value))); });
const registeredRows = computed(() => registrations.value.filter((row) => !row.status || row.status === "APPROVED"));
const filteredRegistrations = computed(() => {
  const query = registrationKeyword.value.trim().toLocaleLowerCase();
  return registeredRows.value.filter((row) => !query || [row.studentNo, row.username, row.displayName].some((value) => value?.toLocaleLowerCase().includes(query)));
});
const pagedRegistrations = computed(() => filteredRegistrations.value.slice((registrationPage.value - 1) * 20, registrationPage.value * 20));
const audienceAll = computed({
  get: () => draft.audienceTypes?.includes("ALL") ?? true,
  set: (checked: boolean) => { draft.audienceTypes = checked ? ["ALL"] : ["CLASS"]; draft.audience = checked ? "ALL" : "CLASS"; },
});
const audienceClass = computed({
  get: () => draft.audienceTypes?.includes("CLASS") ?? false,
  set: (checked: boolean) => { draft.audienceTypes = checked ? ["CLASS"] : ["ALL"]; draft.audience = checked ? "CLASS" : "ALL"; },
});

async function loadList() {
  loading.value = true; error.value = "";
  try {
    const all: AdminContest[] = [];
    let page = 1;
    while (true) {
      const result = await get<{ list: AdminContest[]; total: number }>(`/api/admin/v1/contests?page=${page}&pageSize=200`);
      const batch = listFrom<AdminContest>(result);
      all.push(...batch);
      if (teacher.value || !batch.length || all.length >= result.total) break;
      page += 1;
    }
    contests.value = all;
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "比赛列表加载失败"; }
  finally { loading.value = false; }
}
async function loadEditor() {
  loading.value = true; error.value = "";
  try {
    const requests: [Promise<unknown>, Promise<unknown>, Promise<unknown>, Promise<unknown>] = [
      isEditing.value ? get<ContestDetail>(`/api/admin/v1/contests/${routeId.value}`) : get<ContestDraftPayload | null>("/api/admin/v1/contests/draft"),
      get(teacher.value ? "/api/teacher/v1/classes" : "/api/admin/v1/classes"),
      get("/api/admin/v1/problems?page=1&pageSize=5000"),
      get("/api/admin/v1/problem-folders"),
    ];
    const [record, classResult, problemResult] = await Promise.all(requests);
    classes.value = listFrom<ContestClass>(classResult);
    problems.value = listFrom<ProblemOption>(problemResult);
    const initial = (record ?? {}) as Partial<ContestDetail & ContestDraftPayload>;
    const startTime = isEditing.value ? localDate(initial.startTime) : nowLocal();
    const duration = Number(initial.durationMinutes ?? 180);
    const classIds = isEditing.value
      ? ((initial.audiences ?? []).filter((item) => item.audienceType === "CLASS" && item.audienceId > 0).map((item) => item.audienceId))
      : (initial.classIds ?? []);
    Object.assign(draft, {
      title: initial.title ?? "", description: initial.description ?? "", type: initial.type ?? "ACM", durationMinutes: duration,
      startTime, endTime: localDate(initial.endTime) || endFromDuration(startTime, duration),
      audience: initial.audience ?? "ALL", audienceTypes: initial.audienceTypes ?? (initial.audience === "CLASS" ? ["CLASS"] : ["ALL"]), classIds,
      frozen: initial.frozen ?? false, freezeTime: initial.freezeTime ? localDate(initial.freezeTime) : null,
      enableRollingScoreboard: initial.enableRollingScoreboard ?? false, goldRatio: initial.goldRatio ?? 10, silverRatio: initial.silverRatio ?? 20, bronzeRatio: initial.bronzeRatio ?? 30,
      allowAfterEndSubmit: initial.allowAfterEndSubmit ?? false, allowAfterEndViewProblem: initial.allowAfterEndViewProblem ?? true, allowAfterEndViewCode: initial.allowAfterEndViewCode ?? false,
      scoreboardEnabled: initial.scoreboardEnabled ?? initial.type !== "LANQIAO", resultsPublished: initial.resultsPublished ?? false,
      enableCodeTemplates: initial.enableCodeTemplates ?? false, publicScoreboardEnabled: initial.publicScoreboardEnabled ?? false, showClassOnScoreboard: initial.showClassOnScoreboard ?? false,
      allowStarRegistration: initial.allowStarRegistration ?? false, allowViewAllSubmissions: initial.allowViewAllSubmissions ?? true,
      registrationPassword: "", allowedIpRanges: initial.allowedIpRanges ?? "", hidden: Boolean(initial.hidden), totalScore: initial.problems?.length ? initial.problems.reduce((sum, item) => sum + Number(item.score ?? 0), 0) : initial.totalScore ?? 100,
      problems: (initial.problems ?? []).map((item, index) => ({ problemId: item.problemId, contestProblemId: item.contestProblemId, label: item.label || labels(index), score: item.score ?? 0, displayOrder: item.displayOrder ?? index + 1, caseScores: item.caseScores ?? [] })),
    });
    if (draft.type !== "ACM") {
      await Promise.all((draft.problems ?? []).filter((item) => !item.caseScores?.length).map((item) => loadCaseScores(item.problemId, Number(item.score ?? 0))));
    }
    editingHasPassword.value = Boolean((initial as ContestDetail).hasPassword);
    sourceLocked.value = Boolean((initial as ContestDetail).sourceContestId);
    if (!isEditing.value) await saveDraft();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "比赛编辑数据加载失败"; }
  finally { loading.value = false; }
}
async function saveDraft() {
  if (isEditing.value || !draft.title?.trim()) return;
  try { await put("/api/admin/v1/contests/draft", { ...draft, problems: draft.problems }); }
  catch (cause) { if (cause instanceof Error) ElMessage.error(`草稿保存失败：${cause.message}`); }
}
async function loadDetail(background = false) {
  if (!background) loading.value = true;
  error.value = "";
  try {
    const [record, problemRows, registrationRows] = await Promise.all([
      get<ContestDetail>(`/api/admin/v1/contests/${routeId.value}`),
      get<unknown>(`/api/admin/v1/contests/${routeId.value}/problems`),
      get<unknown>(`/api/admin/v1/contests/${routeId.value}/registrations`),
    ]);
    contest.value = record;
    if (problemRows && Array.isArray(problemRows)) record.problems = problemRows as ContestDetail["problems"];
    registrations.value = listFrom<Registration>(registrationRows);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "比赛详情加载失败"; }
  finally { if (!background) loading.value = false; }
}
function onPolygonImported(id: number) { void router.push(teacher.value ? `/teacher/contests/${id}/edit` : adminPath(`/contests/${id}/edit`)); }
function resetEditor() {
  Object.assign(draft, { title: "", durationMinutes: 180, startTime: nowLocal(), description: "", type: "ACM", audience: "ALL", audienceTypes: ["ALL"], classIds: [], frozen: false, freezeTime: null, enableRollingScoreboard: false, goldRatio: 10, silverRatio: 20, bronzeRatio: 30, allowAfterEndSubmit: false, allowAfterEndViewProblem: true, allowAfterEndViewCode: false, enableCodeTemplates: false, scoreboardEnabled: true, resultsPublished: false, publicScoreboardEnabled: false, showClassOnScoreboard: false, allowStarRegistration: false, allowViewAllSubmissions: true, registrationPassword: "", allowedIpRanges: "", hidden: false, totalScore: 100, problems: [] });
  draft.endTime = endFromDuration(draft.startTime ?? "", 180);
}
async function distributeScores() {
  if (draft.type === "ACM" || !selectedProblems.value.length) return;
  const total = Math.max(1, Math.floor(Number(draft.totalScore ?? 100)));
  draft.totalScore = total;
  const count = selectedProblems.value.length;
  draft.problems = selectedProblems.value.map((item, index) => ({ ...item,
    score: Math.floor(total / count) + (index < total % count ? 1 : 0), caseScores: [] }));
  await Promise.all(selectedProblems.value.map(item => loadCaseScores(item.problemId, Number(item.score ?? 0))));
}
async function resetTotalScore() {
  draft.totalScore = 100;
  await distributeScores();
}
async function publishResults() {
  if (!contest.value) return;
  try {
    contest.value = await put(`/api/admin/v1/contests/${routeId.value}`, { resultsPublished: true, scoreboardEnabled: true });
    ElMessage.success("成绩榜单已发布");
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "发布失败"); }
}
function addProblem(problem: ProblemOption) {
  if (selectedProblems.value.some(item => item.problemId === problem.id)) return;
  if (!problems.value.some(item => item.id === problem.id)) problems.value.push(problem);
  const next = [...selectedProblems.value, { problemId: problem.id, label: labels(selectedProblems.value.length), score: 0, displayOrder: selectedProblems.value.length + 1, caseScores: [] }];
  draft.problems = next;
  if (draft.type !== "ACM") void distributeScores();
}
function removeProblem(id: number) { draft.problems = selectedProblems.value.filter((item) => item.problemId !== id).map((item, index) => ({ ...item, displayOrder: index + 1, label: labels(index) })); void distributeScores(); }
function moveProblem(index: number, delta: number) {
  const next = [...selectedProblems.value]; const target = index + delta;
  if (target < 0 || target >= next.length) return;
  const [item] = next.splice(index, 1); next.splice(target, 0, item);
  draft.problems = next.map((problem, order) => ({ ...problem, displayOrder: order + 1, label: labels(order) }));
}
async function loadCaseScores(problemId: number, points: number) {
  try {
    const cases = listFrom<{ caseNo?: number; id?: number }>(await get(`/api/admin/v1/problems/${problemId}/test-cases`));
    if (selectedProblems.value.find(item => item.problemId === problemId)?.score !== points) return;
    testCases.value = { ...testCases.value, [problemId]: cases };
    const each = cases.length ? Math.floor(points / cases.length) : 0;
    let remainder = points - each * cases.length;
    draft.problems = selectedProblems.value.map((problem) => problem.problemId !== problemId ? problem : ({ ...problem, caseScores: cases.map((item, index) => ({ caseNo: Number(item.caseNo ?? item.id ?? index + 1), score: each + (remainder-- > 0 ? 1 : 0) })) }));
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "测试点加载失败"); }
}
function setProblemScore(problemId: number, value: number | undefined) {
  const score = Number(value ?? 0);
  const cases = testCases.value[problemId] ?? [];
  const quotient = Math.floor(score / Math.max(1, cases.length));
  const remainder = score % Math.max(1, cases.length);
  draft.problems = selectedProblems.value.map((item) => {
    if (item.problemId !== problemId) return item;
    return {
      ...item,
      score,
      caseScores: cases.map((test, index) => ({
        caseNo: Number(test.caseNo ?? test.id ?? index + 1),
        score: quotient + (index < remainder ? 1 : 0),
      })),
    };
  });
  draft.totalScore = selectedTotalScore.value;
}
function validateEditor() {
  if (!draft.title?.trim()) return "请输入比赛名称";
  if (!draft.startTime || !draft.endTime || new Date(draft.endTime).getTime() <= new Date(draft.startTime).getTime()) return "比赛结束时间必须晚于开始时间";
  if (!selectedProblems.value.length) return "请至少选择一道比赛题目";
  if (draft.audienceTypes?.includes("CLASS") && !(draft.classIds?.length)) return "请选择至少一个参赛班级";
  return "";
}
async function submitEditor() {
  const validation = validateEditor();
  if (validation) { ElMessage.warning(validation); return; }
  const audienceTypes: Array<"ALL" | "CLASS"> = draft.audienceTypes?.includes("ALL") ? ["ALL"] : (draft.audienceTypes ?? ["ALL"]).filter((item): item is "CLASS" => item === "CLASS");
  const audiences: NonNullable<ContestPayload["audiences"]> = [];
  for (const audienceType of audienceTypes) {
    if (audienceType === "ALL") audiences.push({ audienceType: "ALL", audienceId: 0 });
    else for (const audienceId of draft.classIds ?? []) audiences.push({ audienceType: "CLASS", audienceId });
  }
  const durationMinutes = Math.round((new Date(draft.endTime!).getTime() - new Date(draft.startTime!).getTime()) / 60000);
  const payload: ContestPayload = {
    title: draft.title!.trim(), description: draft.description ?? "", durationMinutes: Math.max(1, durationMinutes),
    startTime: draft.startTime!, endTime: draft.endTime!, type: draft.type ?? "ACM", audience: audiences[0]?.audienceType ?? "ALL", audienceId: audiences[0]?.audienceId ?? 0, audiences,
    registrationType: draft.registrationPassword?.trim() || editingHasPassword.value ? "PASSWORD" : "PUBLIC",
    ...(draft.registrationPassword?.trim() ? { registrationPassword: draft.registrationPassword.trim() } : {}),
    frozen: Boolean(draft.frozen), freezeTime: draft.frozen ? draft.freezeTime : null, enableRollingScoreboard: Boolean(draft.frozen && draft.enableRollingScoreboard),
    goldRatio: Number(draft.goldRatio ?? 10), silverRatio: Number(draft.silverRatio ?? 20), bronzeRatio: Number(draft.bronzeRatio ?? 30),
    allowAfterEndSubmit: Boolean(draft.allowAfterEndSubmit), allowAfterEndViewProblem: draft.allowAfterEndViewProblem !== false, allowAfterEndViewCode: Boolean(draft.allowAfterEndViewCode),
    scoreboardEnabled: draft.scoreboardEnabled !== false, resultsPublished: Boolean(draft.resultsPublished),
    enableCodeTemplates: Boolean(draft.enableCodeTemplates), publicScoreboardEnabled: Boolean(draft.publicScoreboardEnabled), showClassOnScoreboard: Boolean(draft.showClassOnScoreboard),
    allowStarRegistration: Boolean(draft.allowStarRegistration), allowViewAllSubmissions: draft.allowViewAllSubmissions !== false, allowedIpRanges: draft.allowedIpRanges?.trim() ?? "", hidden: Boolean(draft.hidden),
    problems: selectedProblems.value.map((problem, index): ContestProblemPayload => ({ ...problem, label: labels(index), displayOrder: index + 1, ...(draft.type !== "ACM" ? {} : { score: problem.score ?? 0 }) })),
  };
  saving.value = true;
  try {
    if (isEditing.value) await put(`/api/admin/v1/contests/${routeId.value}`, { ...payload, ...(sourceLocked.value ? { problems: undefined } : {}) });
    else { await post("/api/admin/v1/contests", payload); await del("/api/admin/v1/contests/draft").catch(() => undefined); }
    ElMessage.success(isEditing.value ? "比赛已更新" : "比赛已创建");
    await router.push(listPath.value);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存比赛失败"); }
  finally { saving.value = false; }
}
async function removeContest(row: AdminContest) {
  try { await ElMessageBox.confirm(`确认删除比赛“${row.title}”？`, "删除比赛", { type: "warning" }); await del(`/api/admin/v1/contests/${row.id}`); ElMessage.success("比赛已删除"); await loadList(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
async function replay(row: AdminContest) {
  try {
    await ElMessageBox.confirm(`将根据“${row.title}”创建重现赛，题目会复制并锁定。`, "创建重现赛", { type: "info" });
    const created = await post<AdminContest>(`/api/admin/v1/contests/${row.id}/replay`);
    ElMessage.success("重现赛已创建");
    await router.push(teacher.value ? `/teacher/contests/${created.id}/edit` : adminPath(`/contests/${created.id}/edit`));
  } catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "创建重现赛失败"); }
}
async function exportFile(path: string, filename: string) {
  try { if (teacher.value) await teacherDownload(apiPath(path), filename); else await adminDownload(apiPath(path), filename); ElMessage.success("导出完成"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "导出失败"); }
}
async function loadCandidates() {
  candidateLoading.value = true;
  try { const query = candidateKeyword.value.trim() ? `?keyword=${encodeURIComponent(candidateKeyword.value.trim())}` : ""; registrationCandidates.value = listFrom(await get(`/api/admin/v1/contests/${routeId.value}/registration-candidates${query}`)); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "候选学生加载失败"); }
  finally { candidateLoading.value = false; }
}
async function addRegistration(candidate: { id: number }) {
  try { await post(`/api/admin/v1/contests/${routeId.value}/registrations`, { userId: candidate.id }); ElMessage.success("已添加报名"); await loadDetail(); await loadCandidates(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "添加报名失败"); }
}
async function removeRegistration(row: Registration) {
  try { await ElMessageBox.confirm(`移除 ${row.displayName || row.username} 的报名？`, "移除报名", { type: "warning" }); await del(`/api/admin/v1/contests/${routeId.value}/registrations/${row.id}`); ElMessage.success("报名已移除"); await loadDetail(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "移除报名失败"); }
}

async function unbindContest() {
  try { await ElMessageBox.confirm("解除重现赛与原比赛的关联？", "解除关联", { type: "warning" }); contest.value = await post(`/api/admin/v1/contests/${routeId.value}/unbind`); ElMessage.success("关联已解除"); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "解除关联失败"); }
}
watch(() => [route.fullPath, props.portal] as const, () => {
  if (draftTimer) window.clearTimeout(draftTimer);
  if (mode.value === "editor") {
    if (!isEditing.value) resetEditor();
    void loadEditor();
  } else if (mode.value === "detail") void loadDetail();
  else void loadList();
}, { immediate: true });
watch(() => draft.type, (type) => {
  if (loading.value) return;
  draft.scoreboardEnabled = type !== "LANQIAO";
  draft.resultsPublished = false;
  draft.publicScoreboardEnabled = false;
  if (type === "LANQIAO") draft.allowViewAllSubmissions = false;
  if (type !== "ACM") void distributeScores();
});
watch(draft, () => {
  if (mode.value !== "editor" || isEditing.value || loading.value || !draft.title?.trim()) return;
  if (draftTimer) window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => void saveDraft(), 700);
}, { deep: true });
watch(() => [draft.startTime, draft.endTime] as const, ([start, end]) => {
  const minutes = (new Date(end ?? "").getTime() - new Date(start ?? "").getTime()) / 60000;
  if (Number.isFinite(minutes) && minutes > 0) draft.durationMinutes = Math.max(1, Math.round(minutes));
});
onBeforeUnmount(() => { window.clearInterval(clockTimer); if (draftTimer) window.clearTimeout(draftTimer); });
</script>

<template>
  <main class="contest-management page-container">
    
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />

    <template v-if="mode==='list'">
      <el-card shadow="never"><div class="toolbar"><el-input v-model="keyword" clearable placeholder="搜索比赛名称或 ID" style="max-width:340px"/><span>共 {{ filteredContests.length }} 场比赛</span><div class="row-actions"><el-button v-if="!teacher" @click="polygonImportOpen=true">导入 Polygon</el-button><el-button type="primary" @click="router.push(`${listPath}/new`)">创建比赛</el-button></div></div>
        <el-table v-loading="loading" :data="pagedContests" stripe row-key="id" empty-text="暂无比赛">
          <el-table-column v-if="teacher" prop="id" label="ID" width="82"/>
          <el-table-column prop="title" label="比赛名称" min-width="220"><template #default="{row}"><div class="title-cell"><strong>{{ row.title }}</strong><small>{{ row.ownerName || `用户 ${row.ownerId}` }}</small></div></template></el-table-column>
          <el-table-column prop="type" label="赛制" width="85"><template #default="{row}"><el-tag :type="row.type==='OI'?'warning':'primary'">{{ row.type === "LANQIAO" ? "蓝桥杯" : row.type }}</el-tag></template></el-table-column>
          <el-table-column prop="status" label="状态" width="110"><template #default="{row}">{{ contestStatusLabels[row.status] || row.status }}</template></el-table-column>
          <el-table-column label="参赛 / 提交" width="130"><template #default="{row}">{{ row.participantCount ?? 0 }} / {{ row.submissionCount ?? 0 }}</template></el-table-column>
          <el-table-column prop="startTime" label="开始时间" min-width="180"><template #default="{row}">{{ formatDate(row.startTime) }}</template></el-table-column>
          <el-table-column label="操作" width="390" fixed="right"><template #default="{row}"><div class="row-actions"><el-button link type="primary" @click="router.push(`${listPath}/${row.id}`)">详情</el-button><el-button link type="primary" @click="router.push(`${listPath}/${row.id}/edit`)">编辑</el-button><el-button link type="primary" @click="contest=row;rosterImportOpen=true">导入名单</el-button><el-button link type="primary" @click="replay(row)">重现赛</el-button><el-button v-if="!teacher" link type="primary" @click="exportFile(`/api/admin/v1/contests/${row.id}/polygon/export`,`contest-${row.id}-polygon.zip`)">Polygon 导出</el-button><el-button link type="danger" @click="removeContest(row)">删除</el-button></div></template></el-table-column>
        </el-table>
        <div v-if="!teacher" class="pagination"><Pagination v-model:page="contestPage" v-model:limit="contestPageSize" :page-sizes="[10,20,50]" :total="filteredContests.length" /></div>
      </el-card>
      <ContestPolygonImportDialog v-if="!teacher" v-model="polygonImportOpen" @imported="onPolygonImported"/>
      <ContestRosterImportDialog :teacher="teacher" v-model="rosterImportOpen" :contest-id="contest?.id??0" :contest-title="contest?.title??''" @imported="loadList"/>
    </template>

    <template v-else-if="mode==='editor'">
      <el-skeleton v-if="loading" :rows="12" animated/>
      <el-form v-else :model="draft" label-position="top" class="editor-grid">
        <el-card shadow="never" class="wide"><template #header>基本信息</template><div class="form-grid"><el-form-item label="比赛名称" required><el-input v-model="draft.title" maxlength="120" show-word-limit/></el-form-item><el-form-item label="赛制"><el-select v-model="draft.type"><el-option label="ACM" value="ACM"/><el-option label="OI" value="OI"/><el-option label="蓝桥杯" value="LANQIAO"/></el-select></el-form-item><el-form-item label="开始时间" required><el-date-picker v-model="draft.startTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%"/></el-form-item><el-form-item label="结束时间" required><el-date-picker v-model="draft.endTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%"/></el-form-item><el-form-item label="报名密码（留空保留原密码）"><el-input v-model="draft.registrationPassword" type="password" show-password/></el-form-item></div><el-form-item label="比赛说明"><HtmlMathEditor v-model="draft.description" :rows="5"/></el-form-item></el-card>
        <el-card shadow="never"><template #header>参赛范围</template><div class="audience-options"><el-checkbox v-model="audienceAll">所有用户</el-checkbox><el-checkbox v-model="audienceClass">指定班级</el-checkbox></div><el-select v-if="draft.audienceTypes?.includes('CLASS')" v-model="draft.classIds" multiple filterable collapse-tags placeholder="选择参赛班级" style="width:100%;margin-top:14px"><el-option v-for="item in classes" :key="item.id" :label="item.name" :value="item.id"/></el-select><el-form-item label="隐藏比赛" style="margin-top:16px"><el-switch v-model="draft.hidden"/><span style="margin-left:12px">仅已通过报名的用户可在前台查看，网段限制仍然生效</span></el-form-item><el-form-item label="允许 IP 网段" style="margin-top:16px"><el-input v-model="draft.allowedIpRanges" type="textarea" placeholder="每行一个 CIDR 或 IP"/></el-form-item></el-card>
        <el-card shadow="never"><template #header>比赛权限与榜单</template><div class="switch-list"><el-checkbox v-model="draft.allowAfterEndSubmit">比赛结束后仍可提交</el-checkbox><el-checkbox v-model="draft.allowAfterEndViewProblem">比赛结束后可查看题目</el-checkbox><el-checkbox v-model="draft.allowAfterEndViewCode">比赛结束后可查看代码</el-checkbox><el-checkbox v-model="draft.allowViewAllSubmissions">参赛者可查看所有提交</el-checkbox><el-checkbox v-model="draft.allowStarRegistration">允许收藏用户报名</el-checkbox><el-checkbox v-model="draft.enableCodeTemplates">启用比赛代码模板</el-checkbox><el-checkbox v-model="draft.scoreboardEnabled">开启前台榜单</el-checkbox><el-checkbox v-model="draft.publicScoreboardEnabled">开启公开外榜</el-checkbox><el-checkbox v-if="draft.type === 'LANQIAO'" v-model="draft.resultsPublished" :disabled="new Date(draft.endTime || '').getTime() > clockNow">赛后发布成绩榜单</el-checkbox><el-checkbox v-model="draft.showClassOnScoreboard">榜单显示班级</el-checkbox></div></el-card>
        <el-card shadow="never"><template #header>封榜与奖牌</template><el-checkbox v-model="draft.frozen">启用封榜</el-checkbox><el-form-item v-if="draft.frozen" label="封榜时间" style="margin-top:14px"><el-date-picker v-model="draft.freezeTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%"/></el-form-item><el-checkbox v-if="draft.frozen" v-model="draft.enableRollingScoreboard">启用滚榜</el-checkbox><div class="ratio-grid"><el-form-item label="金牌比例"><el-input-number v-model="draft.goldRatio" :min="0" :max="100"/></el-form-item><el-form-item label="银牌比例"><el-input-number v-model="draft.silverRatio" :min="0" :max="100"/></el-form-item><el-form-item label="铜牌比例"><el-input-number v-model="draft.bronzeRatio" :min="0" :max="100"/></el-form-item></div></el-card>
        <el-card shadow="never" class="wide"><template #header><div class="section-header"><span>比赛题目</span><el-tag v-if="sourceLocked" type="warning">重现赛题目已锁定</el-tag></div></template><FolderProblemPicker v-if="!sourceLocked" :teacher="teacher" :selected-ids="selectedProblems.map(item => item.problemId)" @add="addProblem" /><el-table :data="selectedProblems" row-key="problemId" empty-text="请从上方添加比赛题目"><el-table-column prop="label" label="编号" width="80"/><el-table-column label="题目" min-width="180"><template #default="{row}">{{ problems.find((item)=>item.id===row.problemId)?.title || `题目 ${row.problemId}` }}</template></el-table-column><el-table-column v-if="draft.type!=='ACM'" label="分数" width="150"><template #default="{row}"><el-input-number :model-value="Number(row.score??0)" :min="0" :precision="0" :disabled="sourceLocked" @change="setProblemScore(row.problemId,$event)"/></template></el-table-column><el-table-column v-if="!sourceLocked" label="顺序" width="130"><template #default="{ $index }"><el-button link :disabled="$index===0" @click="moveProblem($index,-1)">上移</el-button><el-button link :disabled="$index===selectedProblems.length-1" @click="moveProblem($index,1)">下移</el-button></template></el-table-column><el-table-column v-if="!sourceLocked" label="操作" width="80"><template #default="{row}"><el-button link type="danger" @click="removeProblem(row.problemId)">移除</el-button></template></el-table-column></el-table><section v-if="draft.type!=='ACM'" class="score-settings" aria-label="比赛分值设置">
          <div class="score-settings__controls">
            <span id="contest-total-score-label">比赛总分</span>
            <el-input-number v-model="draft.totalScore" :min="1" :max="2147483647" :precision="0" :disabled="sourceLocked" aria-label="比赛总分" @change="distributeScores"/>
            <el-button :disabled="sourceLocked" @click="resetTotalScore">设为 100 分</el-button>
            <el-button :disabled="sourceLocked||!selectedProblems.length" @click="distributeScores">按总分均分题目</el-button>
            <span class="score-settings__total">当前题目总分：{{ selectedTotalScore }} 分</span>
          </div>
          <p class="muted">总分可自定义，默认 100 分。修改总分后按题目均分，再按测试点均分，余数依次分配；每题分数可单独修改。</p>
        </section></el-card>
        <div class="editor-actions wide"><el-button @click="router.push(listPath)">取消</el-button><el-button type="primary" :loading="saving" @click="submitEditor">{{ isEditing ? '保存修改' : '创建比赛' }}</el-button></div>
      </el-form>
    </template>

    <template v-else>
      <el-skeleton v-if="loading" :rows="10" animated/>
      <template v-else-if="contest">
        <el-card shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><header v-if="mode==='detail'" class="page-heading">
      
      <div class="heading-actions"><el-button v-if="mode==='detail'" @click="router.push(listPath)">返回列表</el-button></div>
    </header></div></div></template><div class="contest-identity"><div><h1>{{ contest.title }}</h1><p>比赛 #{{ contest.id }} · {{ contest.type === "LANQIAO" ? "蓝桥杯" : contest.type }} · 时长 {{ contestDuration }}</p></div><div class="contest-timing"><el-tag :type="contest.status==='RUNNING'?'success':contest.status==='ENDED'?'info':'warning'">{{ contestStatusLabels[contest.status] || contest.status }}</el-tag><strong>{{ contestCountdown }}</strong></div></div>
        <div class="detail-summary"><el-card shadow="never"><small>报名总人数</small><strong>{{ contest.registrationCount ?? registrations.length }}</strong></el-card><el-card shadow="never"><small>报名通过人数</small><strong>{{ registeredRows.length }}</strong></el-card><el-card shadow="never"><small>实际参赛人数（有提交）</small><strong>{{ contest.activeParticipantCount ?? '—' }}</strong></el-card><el-card shadow="never"><small>提交总数</small><strong>{{ contest.submissionCount ?? 0 }}</strong></el-card></div></el-card>
        <el-tabs v-model="activeTab"><el-tab-pane label="比赛信息" name="overview"><el-card shadow="never"><el-descriptions :column="2" border><el-descriptions-item label="比赛名称">{{ contest.title }}</el-descriptions-item><el-descriptions-item label="赛制">{{ contest.type === "LANQIAO" ? "蓝桥杯" : contest.type }}</el-descriptions-item><el-descriptions-item label="开始时间">{{ formatDate(contest.startTime) }}</el-descriptions-item><el-descriptions-item label="结束时间">{{ formatDate(contest.endTime) }}</el-descriptions-item><el-descriptions-item label="参赛范围">{{ audienceSummary }}</el-descriptions-item><el-descriptions-item label="报名方式">{{ registrationLabels[contest.registrationType] || contest.registrationType }}</el-descriptions-item><el-descriptions-item label="前台可见性"><el-tag :type="contest.hidden?'warning':'success'">{{ contest.hidden?'隐藏比赛':'公开比赛' }}</el-tag><span v-if="contest.hidden"> 仅已通过报名的用户可查看</span></el-descriptions-item><el-descriptions-item label="允许 IP 网段"><span class="preserve-lines">{{ contest.allowedIpRanges || '不限网段' }}</span></el-descriptions-item><el-descriptions-item label="报名密码">{{ contest.hasPassword?'已设置':'未设置' }}</el-descriptions-item><el-descriptions-item label="比赛时长">{{ contestDuration }}</el-descriptions-item><el-descriptions-item label="题目数量">{{ contest.problemCount ?? contest.problems?.length ?? 0 }}</el-descriptions-item></el-descriptions><el-divider content-position="left">比赛规则摘要</el-divider><el-descriptions :column="2" border class="contest-rules">
<el-descriptions-item label="封榜">{{ contest.frozen ? `已开启 · ${formatDate(contest.freezeTime ?? '')}` : '未开启' }}</el-descriptions-item><el-descriptions-item label="滚榜">{{ contest.enableRollingScoreboard?'已开启':'未开启' }}</el-descriptions-item><el-descriptions-item label="前台榜单">{{ contest.scoreboardEnabled === false ? '已关闭' : '已开启' }}</el-descriptions-item><el-descriptions-item v-if="contest.type === 'LANQIAO'" label="成绩发布">{{ contest.resultsPublished ? '已发布' : '未发布' }}<el-button v-if="!contest.resultsPublished && new Date(contest.endTime).getTime() <= clockNow" link type="primary" @click="publishResults">发布成绩榜单</el-button></el-descriptions-item><el-descriptions-item label="公开榜单">{{ contest.publicScoreboardEnabled?'已开启（仍受隐藏与网段限制）':'未开启' }}</el-descriptions-item><el-descriptions-item label="榜单显示班级">{{ contest.showClassOnScoreboard?'显示':'不显示' }}</el-descriptions-item><el-descriptions-item label="赛后提交">{{ contest.allowAfterEndSubmit?'允许':'不允许' }}</el-descriptions-item><el-descriptions-item label="赛后查看题目">{{ contest.allowAfterEndViewProblem?'允许':'不允许' }}</el-descriptions-item><el-descriptions-item label="赛后查看代码">{{ contest.allowAfterEndViewCode?'允许':'不允许' }}</el-descriptions-item><el-descriptions-item label="参赛者查看所有提交">{{ contest.allowViewAllSubmissions?'允许':'不允许' }}</el-descriptions-item><el-descriptions-item label="比赛代码模板">{{ contest.enableCodeTemplates?'已启用':'未启用' }}</el-descriptions-item><el-descriptions-item label="奖牌比例">金 {{ contest.goldRatio }}% · 银 {{ contest.silverRatio }}% · 铜 {{ contest.bronzeRatio }}%</el-descriptions-item>
</el-descriptions><div class="detail-actions"><el-button @click="router.push(`${listPath}/${contest!.id}/scoreboard`)">查看完整榜单</el-button><el-button type="primary" @click="router.push(`${listPath}/${contest!.id}/edit`)">编辑比赛</el-button><el-button v-if="contest.publicScoreboardEnabled" @click="browserWindow.open(`/contests/${contest!.id}/public-scoreboard`,'_blank')">打开公开榜单</el-button><el-button @click="exportFile(`/api/admin/v1/contests/${contest!.id}/scoreboard/export`,`contest-${contest!.id}-scoreboard.csv`)">导出榜单</el-button><el-button @click="exportFile(`/api/admin/v1/contests/${contest!.id}/submissions/export`,`contest-${contest!.id}-submissions.zip`)">导出提交</el-button><el-button @click="exportFile(`/api/admin/v1/contests/${contest!.id}/registrations/export`,`contest-${contest!.id}-registrations.csv`)">导出报名</el-button><el-button v-if="contest.sourceContestId" @click="unbindContest">解除重现赛关联</el-button></div></el-card><el-card shadow="never" class="detail-card"><template #header>比赛题目</template><el-table :data="contest.problems ?? []" stripe><el-table-column prop="label" label="编号" width="90"/><el-table-column prop="title" label="题目"/><el-table-column v-if="teacher" prop="score" label="分数" width="100"/><el-table-column prop="submissionCount" label="提交" width="100"/><el-table-column prop="acceptedCount" label="通过" width="100"/></el-table></el-card></el-tab-pane>
          <el-tab-pane label="比赛介绍" name="introduction"><el-card shadow="never"><HtmlMath v-if="contest.description?.trim()" class="contest-description-view" :value="contest.description"/><el-empty v-else description="暂无比赛介绍"/></el-card></el-tab-pane>
          <el-tab-pane :label="`报名名单 (${registeredRows.length})`" name="registrations">
            <div class="tab-actions">
              <el-input v-model="registrationKeyword" clearable placeholder="搜索学号、用户名或姓名" style="max-width:280px" @input="registrationPage=1"/>
              <el-button @click="rosterImportOpen=true">批量导入名单</el-button>
              <el-button type="primary" @click="candidateDialog=true;loadCandidates()">添加人员</el-button>
              <el-button @click="exportFile(`/api/admin/v1/contests/${contest.id}/registrations/export`,`contest-${contest.id}-registration-users.csv`)">导出报名人</el-button>
              
            </div>
            <el-card shadow="never"><el-table :data="pagedRegistrations" stripe><el-table-column prop="studentNo" label="学号"/><el-table-column prop="username" label="用户名"/><el-table-column prop="displayName" label="姓名"/><el-table-column prop="registeredAt" label="报名时间"><template #default="{row}">{{ formatDate(row.registeredAt) }}</template></el-table-column><el-table-column label="操作" width="100"><template #default="{row}"><el-button link type="danger" @click="removeRegistration(row)">移除</el-button></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="registrationPage" :limit="20" :total="filteredRegistrations.length"/></div></el-card>
          </el-tab-pane>
          <el-tab-pane label="答疑与广播" name="messages"><AdminContestMessaging :teacher="teacher" :contest-id="contest.id"/></el-tab-pane>
          <el-tab-pane label="比赛巡查" name="inspection"><ContestInspectionPanel :teacher="teacher" :contest-id="contest.id" :active="activeTab==='inspection'"/><div class="detail-actions"><el-button type="primary" @click="router.push(`${listPath}/${contest!.id}/submissions?contestId=${contest!.id}`)">打开本场提交列表</el-button><el-button type="primary" @click="router.push(`${listPath}/${contest!.id}/judge/queue?contestId=${contest!.id}`)">打开本场判题队列</el-button><el-button @click="exportFile(`/api/admin/v1/contests/${contest!.id}/scoreboard/export`,`contest-${contest!.id}-scoreboard.csv`)">导出排行榜 CSV</el-button><el-button @click="exportFile(`/api/admin/v1/contests/${contest!.id}/submissions/export`,`contest-${contest!.id}-submissions.zip`)">导出提交代码 ZIP</el-button></div></el-tab-pane>
        </el-tabs>
        <el-dialog class="qoj-management-dialog" v-model="candidateDialog" title="添加报名用户" width="min(720px,95vw)" @open="loadCandidates"><div class="candidate-search"><el-input v-model="candidateKeyword" clearable placeholder="输入姓名、用户名或学号" @keyup.enter="loadCandidates"/><el-button @click="loadCandidates">搜索</el-button></div><el-table v-loading="candidateLoading" :data="registrationCandidates" stripe><el-table-column prop="username" label="用户名"/><el-table-column prop="displayName" label="姓名"/><el-table-column prop="studentNo" label="学号"/><el-table-column label="操作" width="100"><template #default="{row}"><el-button link type="primary" @click="addRegistration(row)">添加</el-button></template></el-table-column></el-table></el-dialog>
        <ContestRosterImportDialog :teacher="teacher" v-model="rosterImportOpen" :contest-id="contest.id" :contest-title="contest.title" @imported="loadDetail(true)"/>
      </template>
    </template>
  
</main>
</template>

<style scoped>
.score-settings{margin-top:20px;padding-top:16px;border-top:1px solid var(--el-border-color-light)}
.score-settings__controls{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.score-settings__controls :deep(.el-button){margin:0}
.score-settings__total{color:var(--el-text-color-secondary);font-variant-numeric:tabular-nums}
.score-settings p{margin:12px 0 0;line-height:1.6}
.contest-description-view{max-width:100%;overflow-wrap:anywhere}
.contest-description-view :deep(img){max-width:100%;height:auto}.contest-management{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.heading-actions,.row-actions,.detail-actions,.tab-actions,.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.toolbar{justify-content:space-between;margin-bottom:14px;color:var(--el-text-color-secondary)}.title-cell{display:flex;flex-direction:column;gap:3px}.title-cell small,.muted{color:var(--el-text-color-secondary);font-size:12px}.editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.wide{grid-column:1/-1}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.audience-options{display:flex;gap:18px;margin-bottom:10px}.switch-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ratio-grid{display:flex;gap:12px;margin-top:16px}.problem-picker{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}.section-header{display:flex;justify-content:space-between;align-items:center}.editor-actions{display:flex;justify-content:flex-end;gap:10px}.contest-identity{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}.contest-identity h1{margin:0;font-size:24px;overflow-wrap:anywhere}.contest-identity p{margin:8px 0 0;color:var(--el-text-color-secondary)}.contest-timing{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.contest-timing strong{font-variant-numeric:tabular-nums}.detail-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.detail-summary .el-card :deep(.el-card__body){display:flex;flex-direction:column;gap:6px}.detail-summary small{color:var(--el-text-color-secondary)}.detail-summary strong{font-size:22px}.detail-actions{margin-top:16px}.detail-card{margin-top:16px}.tab-actions{justify-content:flex-end;margin-bottom:12px}.candidate-search{display:flex;gap:10px;margin-bottom:12px}.preserve-lines{white-space:pre-wrap}.editor-actions :deep(.el-button){min-width:100px}@media(max-width:820px){.page-heading{align-items:flex-start;flex-direction:column}.editor-grid,.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.detail-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.switch-list{grid-template-columns:1fr}.ratio-grid{flex-wrap:wrap}}
</style>

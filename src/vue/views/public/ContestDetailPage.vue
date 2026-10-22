<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowLeft, Refresh, Trophy, User, UserFilled, Calendar, CircleCheck } from "@element-plus/icons-vue";
import { readAuthToken } from "../../../api/tokenStorage";
import { openFrontendPage } from "../../../api/frontendSessionSync";
import { fetchContest, fetchContestRegistrationOptions, fetchContestScoreboard, fetchContestSubmissions, fetchMyContestAcceptedProblems, fetchMyContestSubmissions, fetchSubmissionDetail, registerContest, type ContestRegistrationOption, type ContestScoreboard, type PublicContest, type SubmissionRecord } from "../../../data/apiClient";
import { languageLabel } from "../../../data/languages";
import { formatDisplayDateTime } from "../../../lib/format";
import { encryptId } from "../../../utils/cipher";
import { sanitizeAnnouncementHtml } from "../../../utils/announcementHtml";

type TabKey = "intro" | "problems" | "submissions" | "my-submissions" | "scoreboard";
const validTabs: TabKey[] = ["intro", "problems", "submissions", "my-submissions", "scoreboard"];
const route = useRoute();
const router = useRouter();
const contestId = computed(() => Number(route.params.contestId));
const contest = ref<PublicContest | null>(null);
const loading = ref(true);
const message = ref("");
const options = ref<ContestRegistrationOption[]>([]);
const registering = ref(false);
const registrationMessage = ref("");
const registrationDialog = ref(false);
const registrationPassword = ref("");
const registrationStarred = ref(false);
const scoreboard = ref<ContestScoreboard | null>(null);
const scoreboardLoading = ref(false);
const scoreboardMessage = ref("");
const mySubmissions = ref<SubmissionRecord[]>([]);
const mySubmissionsTotal = ref(0);
const mySubmissionsLoading = ref(false);
const myPage = ref(1);
const myPageSize = ref(20);
const myProblemFilter = ref<number>();
const myStatusFilter = ref("");
const myStatusOptions = ["PENDING", "JUDGING", "AC", "WA", "TLE", "MLE", "RE", "CE", "SE"];
let myRequest = 0;
const submissions = ref<SubmissionRecord[]>([]);
const submissionsTotal = ref(0);
const submissionsLoading = ref(false);
const acceptedIds = ref(new Set<number>());
const submissionPage = ref(1);
const submissionPageSize = ref(20);
const codeDialog = ref(false);
const codeLoading = ref(false);
const codeSubmission = ref<SubmissionRecord | null>(null);
const now = ref(Date.now());
let clockTimer = 0;

const activeTab = computed<TabKey>(() => {
  const candidate = String(route.query.tab ?? "problems") as TabKey;
  if (!canViewContestTabs.value) return "intro";
  return validTabs.includes(candidate) ? candidate : "problems";
});
const isLoggedIn = computed(() => Boolean(readAuthToken("frontend")));
const registrationClosed = computed(() => Boolean(contest.value && (contest.value.status === "ENDED" || now.value >= new Date(contest.value.endTime).getTime())));
const canViewContestTabs = computed(() => Boolean(contest.value?.registered && contest.value.status !== "NOT_STARTED"));
const canViewProblems = computed(() => Boolean(canViewContestTabs.value && (!registrationClosed.value || contest.value?.allowAfterEndViewProblem !== false)));
const selectedOption = computed(() => options.value.find((option) => option.available) ?? options.value[0] ?? null);
const registrationDisabledReason = computed(() => selectedOption.value && !selectedOption.value.available ? selectedOption.value.disabledReason || "当前账号暂不可报名该比赛" : "");
const contestPhase = computed(() => {
  if (!contest.value) return "";
  const start = new Date(contest.value.startTime).getTime();
  const end = new Date(contest.value.endTime).getTime();
  return now.value < start ? "距离开始" : now.value < end ? "距离结束" : "比赛已结束";
});
const contestStatusLabel = computed(() => contest.value?.status === "RUNNING" ? "进行中" : contest.value?.status === "ENDED" ? "已结束" : "未开始");
const contestTiming = computed(() => {
  const start = new Date(contest.value?.startTime ?? "").getTime();
  const end = new Date(contest.value?.endTime ?? "").getTime();
  const duration = end - start;
  if (!Number.isFinite(duration) || duration <= 0) return { progress: 0, remaining: 0, duration: 0 };
  return {
    progress: Math.round(Math.max(0, Math.min(1, (now.value - start) / duration)) * 100),
    remaining: Math.max(0, Math.ceil((end - Math.max(now.value, start)) / 60000)),
    duration: Math.round(duration / 60000),
  };
});
const audienceLabel = computed(() => contest.value?.audience === "ALL" ? "全校公开" : "指定班级");
const countdown = computed(() => {
  if (!contest.value) return "";
  const target = now.value < new Date(contest.value.startTime).getTime() ? new Date(contest.value.startTime).getTime() : new Date(contest.value.endTime).getTime();
  const remain = Math.max(0, target - now.value);
  const days = Math.floor(remain / 86_400_000);
  const hours = Math.floor((remain % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remain % 3_600_000) / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  return `${days ? `${days}天 ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
const registrationAvailable = computed(() => Boolean(contest.value && !contest.value.registered && !registrationClosed.value && isLoggedIn.value));
const submissionStatusOptions = computed(() => Array.from(new Set(submissions.value.map((item) => item.status).filter(Boolean))).sort());
const submissionProblemFilter = ref("ALL");
const submissionStatusFilter = ref("ALL");
const submissionLanguageFilter = ref("ALL");
const submissionUserFilter = ref("");
const filteredSubmissions = computed(() => {
  const keyword = submissionUserFilter.value.trim().toLowerCase();
  return submissions.value.filter((item) => {
    if (submissionProblemFilter.value !== "ALL" && String(item.problemId) !== submissionProblemFilter.value) return false;
    if (submissionStatusFilter.value !== "ALL" && item.status !== submissionStatusFilter.value) return false;
    if (submissionLanguageFilter.value !== "ALL" && item.language !== submissionLanguageFilter.value) return false;
    if (keyword && ![item.displayName, item.username, item.userId == null ? "" : String(item.userId)].filter(Boolean).join(" ").toLowerCase().includes(keyword)) return false;
    return true;
  });
});

function setTab(tab: TabKey) {
  const query = { ...route.query };
  if (tab === "problems") delete query.tab;
  else query.tab = tab;
  void router.replace({ query });
}
function onTabChange(key: string | number) { setTab(String(key) as TabKey); }
async function loadContest() {
  const id = contestId.value;
  if (!Number.isSafeInteger(id) || id <= 0) { contest.value = null; message.value = "比赛不存在"; loading.value = false; return; }
  if (!isLoggedIn.value) { void router.replace(`/login?redirect=${encodeURIComponent(`/contests/${id}`)}`); return; }
  loading.value = true;
  try {
    contest.value = await fetchContest(id);
    message.value = "";
  } catch (error) {
    contest.value = null;
    message.value = error instanceof Error ? error.message : "比赛加载失败";
  } finally { loading.value = false; }
}
async function loadRegistrationOptions() {
  if (!contest.value || contest.value.registered || registrationClosed.value) { options.value = []; return; }
  try { options.value = await fetchContestRegistrationOptions(contestId.value); }
  catch (error) { options.value = []; registrationMessage.value = error instanceof Error ? error.message : "报名选项加载失败"; }
}
async function loadScoreboard() {
  if (!contest.value?.registered || scoreboard.value) return;
  scoreboardLoading.value = true;
  try { scoreboard.value = await fetchContestScoreboard(contestId.value); scoreboardMessage.value = ""; }
  catch (error) { scoreboard.value = null; scoreboardMessage.value = error instanceof Error ? error.message : "排行榜暂不可用"; }
  finally { scoreboardLoading.value = false; }
}
async function loadMySubmissions() {
  if (!contest.value?.registered) return;
  const requestId = ++myRequest;
  mySubmissionsLoading.value = true;
  try {
    const result = await fetchMyContestSubmissions(contestId.value, myPage.value, myPageSize.value, { problemId: myProblemFilter.value, status: myStatusFilter.value || undefined });
    if (requestId !== myRequest) return;
    mySubmissions.value = result.list;
    mySubmissionsTotal.value = result.total;
  } catch { if (requestId === myRequest) { mySubmissions.value = []; mySubmissionsTotal.value = 0; } }
  finally { if (requestId === myRequest) mySubmissionsLoading.value = false; }
}
async function loadSubmissions() {
  if (!contest.value?.registered) return;
  submissionsLoading.value = true;
  try {
    const result = await fetchContestSubmissions(contestId.value, submissionPage.value, submissionPageSize.value);
    submissions.value = result.list;
    submissionsTotal.value = result.total;
  } catch { submissions.value = []; submissionsTotal.value = 0; }
  finally { submissionsLoading.value = false; }
}
async function loadAcceptedProblems() {
  if (!contest.value?.registered) return;
  try {
    const rows = await fetchMyContestAcceptedProblems(contestId.value);
    acceptedIds.value = new Set(rows.flatMap((row) => [row.problemId, row.contestProblemId].filter((id): id is number => id != null)));
  } catch { /* Preserve the last successfully loaded accepted problem list. */ }
}
async function loadCode(submission: SubmissionRecord) {
  codeLoading.value = true;
  try {
    codeSubmission.value = submission.code ? submission : await fetchSubmissionDetail(submission.id);
    codeDialog.value = true;
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "提交代码加载失败"); }
  finally { codeLoading.value = false; }
}
async function submitRegistration() {
  const current = contest.value;
  if (!current) return;
  if (!isLoggedIn.value) { void router.push(`/login?redirect=${encodeURIComponent(`/contests/${contestId.value}`)}`); return; }
  if (registrationClosed.value) { registrationMessage.value = "比赛已结束，报名已截止。"; return; }
  if (current.registrationType === "PASSWORD" && !registrationPassword.value.trim()) { registrationMessage.value = "请输入比赛报名密码"; return; }
  if (registrationDisabledReason.value) { registrationMessage.value = registrationDisabledReason.value; return; }
  registering.value = true;
  registrationMessage.value = "";
  try {
    await registerContest(contestId.value, { identityType: selectedOption.value?.identityType ?? "PERSONAL", identityId: selectedOption.value?.identityId ?? null, starred: registrationStarred.value, ...(registrationPassword.value.trim() ? { password: registrationPassword.value.trim() } : {}) });
    registrationDialog.value = false;
    registrationPassword.value = "";
    await loadContest();
    setTab("problems");
    ElMessage.success("报名成功");
  } catch (error) { registrationMessage.value = error instanceof Error ? error.message : "报名失败，请稍后重试"; }
  finally { registering.value = false; }
}
function openProblem(problem: NonNullable<PublicContest["problems"]>[number]) {
  if (!isLoggedIn.value) { void router.push(`/login?redirect=${encodeURIComponent(`/contests/${contestId.value}`)}`); return; }
  if (!canViewProblems.value) { registrationMessage.value = "请先报名比赛，报名成功后即可查看题目。"; return; }
  const pid = problem.contestProblemId ?? problem.problemId;
  const query = new URLSearchParams({ contestId: String(contestId.value), contestProblemLabel: problem.label });
  openFrontendPage(`/practice/problem/cp${encryptId(pid)}?${query.toString()}`);
}
function submissionProblemLabel(item: SubmissionRecord) {
  return contest.value?.problems?.find(problem => problem.problemId === item.problemId)?.label || `#${item.problemId}`;
}
function submissionDate(item: SubmissionRecord) { return formatDisplayDateTime(item.submitTime || item.createdAt); }
function usage(value: number | null | undefined, unit: string) { return value == null ? "-" : `${value} ${unit}`; }
function statusTag(status: string) {
  const value = status.toUpperCase();
  if (["AC", "ACCEPTED"].includes(value)) return "success";
  if (["WA", "WRONG_ANSWER", "CE", "COMPILE_ERROR"].includes(value)) return "danger";
  if (["TLE", "TIME_LIMIT_EXCEEDED", "JUDGING", "RUNNING", "COMPILING", "QUEUED", "WAITING", "PENDING"].includes(value)) return "warning";
  return "info";
}
function statusText(status: string) {
  const values: Record<string, string> = { AC: "Accepted", ACCEPTED: "Accepted", WA: "Wrong Answer", WRONG_ANSWER: "Wrong Answer", TLE: "Time Limit Exceeded", TIME_LIMIT_EXCEEDED: "Time Limit Exceeded", MLE: "Memory Limit Exceeded", MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded", RE: "Runtime Error", RUNTIME_ERROR: "Runtime Error", CE: "Compile Error", COMPILE_ERROR: "Compile Error", WAITING: "Waiting", PENDING: "Pending", QUEUED: "Pending", JUDGING: "Judging", COMPILING: "Compiling", RUNNING: "Running", NOO: "No Output", SE: "System Error", FAILED: "Failed" };
  return values[status.toUpperCase()] || status;
}
function cellFor(row: ContestScoreboard["rows"][number], problem: ContestScoreboard["problems"][number]) { return row.cells.find((cell) => (cell.contestProblemId ?? cell.problemId) === (problem.contestProblemId ?? problem.problemId)); }
function scoreboardCellClass(item?: ContestScoreboard["rows"][number]["cells"][number]) { return item?.hasHiddenSubmissions ? "hidden" : item?.accepted ? "accepted" : scoreboard.value?.type === "OI" && (item?.score ?? 0) > 0 ? "partial" : (item?.attempts ?? 0) ? "failed" : "empty"; }
function cellAcceptedMinute(item?: ContestScoreboard["rows"][number]["cells"][number]) {
  if (!item?.accepted || !item.acceptedAt || !scoreboard.value?.startTime) return null;
  const started = new Date(scoreboard.value.startTime).getTime();
  const accepted = new Date(item.acceptedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(accepted)) return null;
  return Math.max(0, Math.floor((accepted - started) / 60000));
}
function attemptText(attempts = 0) { return attempts === 1 ? "1 try" : `${attempts} tries`; }
function scoreboardCellMain(item?: ContestScoreboard["rows"][number]["cells"][number]) {
  if (!item) return "-";
  if (item.hasHiddenSubmissions) return "+";
  const minute = cellAcceptedMinute(item);
  if (minute != null) return `${minute}`;
  if (scoreboard.value?.type === "OI") return item.attempts ? String(item.score) : "-";
  return "-";
}
function scoreboardCellUnit(item?: ContestScoreboard["rows"][number]["cells"][number]) { return cellAcceptedMinute(item) != null ? "min" : scoreboard.value?.type === "OI" && item?.attempts ? "pts" : ""; }
function scoreboardCellSub(item?: ContestScoreboard["rows"][number]["cells"][number]) { return attemptText(item?.hasHiddenSubmissions ? item.hiddenAttempts : item?.attempts); }
function scoreboardCellTitle(item?: ContestScoreboard["rows"][number]["cells"][number]) { return item?.hasHiddenSubmissions ? "封榜后有提交" : item?.accepted ? "已通过" : (item?.attempts ?? 0) > 0 ? "未通过" : "暂无提交"; }
function medalType(medal?: ContestScoreboard["rows"][number]["medal"]) { return medal === "GOLD" ? "warning" : medal === "SILVER" ? "info" : medal === "BRONZE" ? "success" : "info"; }
function medalText(medal?: ContestScoreboard["rows"][number]["medal"]) { return medal === "GOLD" ? "金" : medal === "SILVER" ? "银" : medal === "BRONZE" ? "铜" : ""; }

watch(contestId, () => { contest.value = null; scoreboard.value = null; scoreboardMessage.value = ""; void loadContest(); });
watch(() => [contest.value?.id, contest.value?.registered, registrationClosed.value], () => { void loadRegistrationOptions(); });
watch([activeTab, () => contest.value?.registered], ([tab]) => {
  if (tab === "submissions") void loadSubmissions();
  if (tab === "scoreboard") void loadScoreboard();
  if (tab === "my-submissions" || tab === "problems") { void loadMySubmissions(); void loadAcceptedProblems(); }
}, { immediate: true });
watch([submissionPage, submissionPageSize], () => { if (activeTab.value === "submissions") void loadSubmissions(); });
watch([myProblemFilter, myStatusFilter], () => {
  if (myPage.value !== 1) myPage.value = 1;
  else if (activeTab.value === "my-submissions") void loadMySubmissions();
});
watch([myPage, myPageSize], () => { if (activeTab.value === "my-submissions") void loadMySubmissions(); });
onMounted(() => { clockTimer = window.setInterval(() => { now.value = Date.now(); }, 1000); void loadContest(); });
onUnmounted(() => window.clearInterval(clockTimer));
usePageTitle(computed(() => contest.value?.title ?? null));
</script>

<template>
  <div v-if="loading" class="contest-loading page-container"><el-icon class="is-loading"><Refresh /></el-icon>比赛加载中</div>
  <div v-else-if="!contest" class="contest-page"><el-button text @click="router.push('/contests')"><el-icon><ArrowLeft /></el-icon>返回比赛列表</el-button><el-alert type="error" :title="message || '比赛不存在'" :closable="false" /></div>
  <div v-else class="contest-page">
    <el-card shadow="never" class="overview-card">
      <div class="contest-overview-grid">
        <section class="contest-information">
          <div class="information-label"><span />比赛信息</div>
          <div class="contest-title-row"><h1>{{ contest.title }}</h1><span class="contest-status" :class="contest.status.toLowerCase()"><i />{{ contestStatusLabel }}</span></div>
          <div class="contest-metadata">
            <span><el-icon><Trophy /></el-icon>{{ contest.type === 'ACM' ? 'ACM / ICPC 赛制' : 'OI 赛制' }}</span>
            <span><el-icon><UserFilled /></el-icon>{{ audienceLabel }}</span>
            <span><el-icon><User /></el-icon>{{ contest.registrationType === 'PASSWORD' ? '密码报名' : '公开报名' }}</span>
          </div>
          <div class="contest-time-range">
            <div class="time-range-label"><el-icon><Calendar /></el-icon>比赛时间</div>
            <div class="time-range-values">
              <div><span>开始时间</span><time>{{ formatDisplayDateTime(contest.startTime) }}</time></div>
              <div class="duration-track"><span>{{ contest.durationMinutes || contestTiming.duration }} 分钟</span></div>
              <div><span>结束时间</span><time>{{ formatDisplayDateTime(contest.endTime) }}</time></div>
            </div>
          </div>
        </section>
        <aside class="contest-clock" aria-label="赛事计时">
          <div class="clock-heading"><strong>赛事计时</strong><span class="clock-status"><i />{{ contestStatusLabel }}</span></div>
          <div class="clock-countdown"><span>{{ contestPhase }}</span><strong aria-live="off">{{ countdown }}</strong></div>
          <div class="clock-progress"><el-progress :percentage="contestTiming.progress" :show-text="false" :stroke-width="6" color="#7dd3fc"/><div><span>已进行 {{ contestTiming.progress }}%</span><span>{{ contest.status === 'ENDED' ? '比赛已结束' : `剩余约 ${contestTiming.remaining} 分钟` }}</span></div></div>
        </aside>
      </div>
      <div class="contest-registration-footer">
        <div class="registration-summary"><span class="registration-icon"><el-icon><UserFilled /></el-icon></span><span><strong>{{ contest.registrationCount || contest.participantCount }}</strong> 人报名</span><span v-if="contest.registered" class="registration-badge"><el-icon><CircleCheck /></el-icon>已报名</span></div>
        <el-button v-if="registrationAvailable" type="primary" round :disabled="Boolean(registrationDisabledReason)" @click="registrationDialog = true">报名比赛</el-button>
        <el-button v-else-if="contest.registered" type="primary" round :disabled="!canViewContestTabs" @click="setTab('problems')">{{ canViewContestTabs ? '进入比赛' : '比赛未开始' }}</el-button>
      </div>
      <el-alert v-if="registrationDisabledReason" type="info" :title="registrationDisabledReason" :closable="false" />
      <el-alert v-if="registrationMessage" type="warning" :title="registrationMessage" :closable="false" />
    </el-card>
    <el-tabs :model-value="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="比赛介绍" name="intro"><div v-if="contest.description" class="contest-description announcement-html markdown-math" v-html="sanitizeAnnouncementHtml(contest.description)" /><el-empty v-else description="暂无比赛介绍" /></el-tab-pane>
      <el-tab-pane v-if="canViewProblems" label="题目列表" name="problems"><el-empty v-if="!contest.problems?.length" :description="contest.status === 'NOT_STARTED' ? '比赛尚未开始，题目列表暂未公开' : '暂无题目'" /><el-table v-else class="contest-problems-table" :data="contest.problems" :row-key="(problem: NonNullable<PublicContest['problems']>[number]) => problem.contestProblemId ?? problem.problemId" stripe>
        <el-table-column prop="label" label="编号" width="90" align="center"/>
        <el-table-column prop="title" label="题目" min-width="220" align="center" show-overflow-tooltip><template #default="{ row }"><button class="problem-title" type="button" @click="openProblem(row)">{{ row.title }}</button></template></el-table-column>
        <el-table-column label="提交数" min-width="110" align="center"><template #default="{ row }">{{ row.submissionCount ?? 0 }}</template></el-table-column>
        <el-table-column label="通过数" min-width="110" align="center"><template #default="{ row }">{{ row.acceptedCount ?? 0 }}</template></el-table-column>
        <el-table-column v-if="contest.type === 'OI'" label="分值" min-width="100" align="center"><template #default="{ row }">{{ row.score ?? 100 }}</template></el-table-column>
        <el-table-column label="我的状态" min-width="120" align="center"><template #default="{ row }"><el-tag :type="acceptedIds.has(row.problemId) || acceptedIds.has(row.contestProblemId ?? -1) ? 'success' : 'info'">{{ acceptedIds.has(row.problemId) || acceptedIds.has(row.contestProblemId ?? -1) ? '已通过' : '—' }}</el-tag></template></el-table-column>
      </el-table></el-tab-pane>
      <el-tab-pane v-if="canViewContestTabs" label="我的提交" name="my-submissions">
        <div class="filters my-submission-filters"><el-select v-model="myProblemFilter" clearable placeholder="全部题目" aria-label="筛选我的提交题目"><el-option v-for="problem in contest.problems" :key="problem.problemId" :label="problem.label" :value="problem.problemId"/></el-select><el-select v-model="myStatusFilter" clearable placeholder="全部状态" aria-label="筛选我的提交状态"><el-option v-for="status in myStatusOptions" :key="status" :label="statusText(status)" :value="status"/></el-select><el-button @click="myProblemFilter=undefined;myStatusFilter=''">重置筛选</el-button><el-button :loading="mySubmissionsLoading" @click="loadMySubmissions"><el-icon><Refresh /></el-icon>刷新</el-button></div>
        <el-table :data="mySubmissions" row-key="id" stripe empty-text="暂无提交记录">
          <el-table-column prop="id" label="提交ID" width="100"/>
          <el-table-column label="题号"><template #default="{ row }">{{ submissionProblemLabel(row) }}</template></el-table-column>
          <el-table-column label="语言"><template #default="{ row }">{{ languageLabel(row.language) }}</template></el-table-column>
          <el-table-column label="状态"><template #default="{ row }"><el-tag :type="statusTag(row.status)">{{ statusText(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="时间"><template #default="{ row }">{{ usage(row.timeUsed, 'ms') }}</template></el-table-column>
          <el-table-column label="内存"><template #default="{ row }">{{ usage(row.memoryUsed, 'KB') }}</template></el-table-column>
          <el-table-column label="提交时间"><template #default="{ row }">{{ submissionDate(row) }}</template></el-table-column>
          <el-table-column label="代码" width="110"><template #default="{ row }"><el-button link type="primary" :loading="codeLoading" @click="loadCode(row)">查看代码</el-button></template></el-table-column>
        </el-table>
        <div class="pagination"><Pagination v-model:page="myPage" v-model:limit="myPageSize" :page-sizes="[10,20,50]" :total="mySubmissionsTotal" /></div>
      </el-tab-pane>
      <el-tab-pane v-if="canViewContestTabs" label="实时榜单" name="scoreboard">
        <el-skeleton v-if="scoreboardLoading" :rows="5" animated />
        <el-empty v-else-if="!scoreboard" :description="scoreboardMessage || '排行榜暂不可用'"/>
        <template v-else>
          <el-alert v-if="scoreboard.boardState === 'FROZEN'" type="warning" title="已经封榜" :closable="false"/>
          <div class="table-scroll"><el-table :data="scoreboard.rows" row-key="userId" stripe empty-text="暂无提交数据">
            <el-table-column label="Rank" width="76" align="center"><template #default="{ row }">{{ row.starred ? '打星' : row.rank ?? '-' }}</template></el-table-column>
            <el-table-column label="用户" min-width="190"><template #default="{ row }"><div class="scoreboard-user"><span class="scoreboard-user-name">{{ row.displayName || row.userId }}</span><el-tag v-if="row.medal" :type="medalType(row.medal)" size="small" class="medal-badge">{{ medalText(row.medal) }}</el-tag><el-tag v-if="row.teamName" type="info" size="small" effect="plain" class="team-badge">{{ row.teamName }}</el-tag></div></template></el-table-column>
            <el-table-column prop="solved" label="Solved" width="80" align="center"/>
            <el-table-column :label="scoreboard.type === 'OI' ? 'Score' : 'Penalty'" width="100" align="center"><template #default="{ row }">{{ scoreboard.type === 'OI' ? row.score : row.penalty }}</template></el-table-column>
            <el-table-column v-for="problem in scoreboard.problems" :key="problem.contestProblemId ?? problem.problemId" :label="problem.label" min-width="78" align="center" class-name="score-column"><template #default="{ row }"><span class="score-cell" :class="scoreboardCellClass(cellFor(row, problem))" :title="scoreboardCellTitle(cellFor(row, problem))"><span class="score-cell-main">{{ scoreboardCellMain(cellFor(row, problem)) }}<small v-if="scoreboardCellUnit(cellFor(row, problem))">{{ scoreboardCellUnit(cellFor(row, problem)) }}</small></span><small class="score-cell-tries">{{ scoreboardCellSub(cellFor(row, problem)) }}</small></span></template></el-table-column>
          </el-table></div>
          <el-button class="public-scoreboard-link" text type="primary" @click="router.push(`/contests/${contestId}/public-scoreboard`)">打开公开外榜</el-button>
        </template>
      </el-tab-pane>
      <el-tab-pane v-if="canViewContestTabs" label="提交列表" name="submissions"><div class="filters"><el-select v-model="submissionProblemFilter" clearable placeholder="全部题目" @change="submissionPage = 1"><el-option label="全部题目" value="ALL"/><el-option v-for="problem in contest.problems" :key="problem.problemId" :label="problem.label" :value="String(problem.problemId)"/></el-select><el-select v-model="submissionStatusFilter" placeholder="全部状态" @change="submissionPage = 1"><el-option label="全部状态" value="ALL"/><el-option v-for="status in submissionStatusOptions" :key="status" :label="statusText(status)" :value="status"/></el-select><el-input v-model="submissionUserFilter" clearable placeholder="搜索用户" @input="submissionPage = 1"/><el-button :loading="submissionsLoading" @click="loadSubmissions">刷新</el-button></div><el-table :data="filteredSubmissions" row-key="id" stripe empty-text="暂无提交记录"><el-table-column prop="id" label="提交ID" width="100"/><el-table-column label="用户"><template #default="{ row }">{{ row.displayName || row.username || `User ${row.userId ?? '?'}` }}</template></el-table-column><el-table-column label="题号"><template #default="{ row }">{{ submissionProblemLabel(row) }}</template></el-table-column><el-table-column label="语言"><template #default="{ row }">{{ languageLabel(row.language) }}</template></el-table-column><el-table-column label="状态"><template #default="{ row }"><el-tag :type="statusTag(row.status)">{{ statusText(row.status) }}</el-tag></template></el-table-column><el-table-column label="提交时间"><template #default="{ row }">{{ submissionDate(row) }}</template></el-table-column><el-table-column v-if="contest.status === 'ENDED' && contest.allowAfterEndViewCode" label="代码"><template #default="{ row }"><el-button link type="primary" @click="loadCode(row)">查看代码</el-button></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="submissionPage" v-model:limit="submissionPageSize" :page-sizes="[10,20,50]" :total="submissionsTotal" /></div></el-tab-pane>
    </el-tabs>
    <el-dialog v-model="registrationDialog" title="报名比赛" width="460px"><p v-if="selectedOption">报名身份：{{ selectedOption.name }}</p><el-input v-if="contest.registrationType === 'PASSWORD'" v-model="registrationPassword" type="password" show-password placeholder="比赛报名密码"/><el-checkbox v-if="contest.allowStarRegistration" v-model="registrationStarred">以打星身份报名</el-checkbox><el-alert v-if="registrationMessage" type="warning" :title="registrationMessage" :closable="false"/><template #footer><el-button @click="registrationDialog = false">取消</el-button><el-button type="primary" :loading="registering" @click="submitRegistration">确认报名</el-button></template></el-dialog>
    <el-dialog v-model="codeDialog" :title="`提交代码 #${codeSubmission?.id ?? ''}`" width="min(900px, 92vw)"><pre class="submission-code">{{ codeSubmission?.code || '暂无代码内容' }}</pre></el-dialog>
  </div>
</template>

<style scoped>
.contest-problems-table :deep(.el-table__cell .cell){white-space:nowrap}
.contest-problems-table .problem-title{white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}

.contest-page { display: flex; flex-direction: column; gap: 18px; }
.contest-loading { min-height: 50vh; display: grid; place-content: center; justify-items: center; gap: 12px; color: var(--qoj-color-text-2); }
.overview-card{border:1px solid var(--el-border-color-lighter);border-radius:20px}
.overview-card :deep(.el-card__body){padding:30px}
.contest-overview-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,25%);gap:28px;align-items:stretch}
.contest-information{min-width:0}
.information-label{display:flex;align-items:center;gap:10px;color:var(--el-color-primary);font-size:14px;font-weight:700;letter-spacing:1px;margin:4px 0 20px}
.information-label>span{width:22px;height:3px;border-radius:4px;background:currentColor}
.contest-title-row{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px}
.contest-title-row h1{margin:0;font-size:clamp(26px,2.5vw,40px);line-height:1.25;font-weight:750;overflow-wrap:anywhere}
.contest-status{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;background:var(--el-color-warning-light-9);color:var(--el-color-warning);font-size:14px;font-weight:600;white-space:nowrap}
.contest-status.running{background:var(--el-color-success-light-9);color:var(--el-color-success)}
.contest-status.ended{background:var(--el-fill-color-light);color:var(--el-text-color-secondary)}
.contest-status i,.clock-status i{width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0}
.contest-metadata{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;color:var(--el-text-color-secondary)}
.contest-metadata>span{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--el-border-color-lighter);border-radius:7px;font-size:14px}
.contest-metadata .el-icon{font-size:18px}
.contest-time-range{padding:22px;border:1px solid var(--el-color-primary-light-7);background:color-mix(in srgb,var(--el-color-primary) 3%,var(--el-bg-color));border-radius:14px}
.time-range-label{display:flex;align-items:center;gap:10px;color:var(--el-color-primary);font-size:14px;font-weight:600}
.time-range-label .el-icon{font-size:19px}
.time-range-values{display:grid;grid-template-columns:minmax(0,1fr) minmax(110px,.8fr) minmax(0,1fr);align-items:center;gap:16px;margin-top:22px}
.time-range-values>div:not(.duration-track){display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;min-width:0}
.time-range-values>div>span{font-size:13px;color:var(--el-text-color-placeholder)}
.time-range-values time{font-size:clamp(14px,1.2vw,19px);font-weight:700;font-variant-numeric:tabular-nums}
.duration-track{display:flex;align-items:center;justify-content:center;position:relative}
.duration-track::before{position:absolute;content:"";height:1px;inset-inline:0;background:var(--el-color-primary-light-7)}
.duration-track>span{position:relative;border:1px solid var(--el-color-primary-light-7);border-radius:999px;padding:6px 12px;background:var(--el-color-primary-light-9);color:var(--el-color-primary)!important;font-weight:600;white-space:nowrap}
.contest-clock{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:30px;padding:26px;border:1px solid #47618e;border-radius:16px;background:#192d50;color:#b4c4df;box-shadow:0 12px 32px rgb(25 45 80 / 10%)}
.contest-clock::after{content:"";position:absolute;z-index:-1;width:220px;height:220px;right:-100px;bottom:-120px;border:1px solid rgb(180 196 223 / 15%);border-radius:50%;box-shadow:0 0 0 24px rgb(180 196 223 / 3%),0 0 0 48px rgb(180 196 223 / 3%)}
.clock-heading,.clock-progress>div{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px}
.clock-heading strong{font-size:14px}
.clock-status{display:flex;align-items:center;gap:8px;color:#8cddd1;font-weight:600}
.clock-status i{box-shadow:0 0 0 4px rgb(45 212 191 / 15%)}
.clock-countdown{display:flex;flex-direction:column;gap:12px}
.clock-countdown>span{font-size:14px}
.clock-countdown>strong{font-size:clamp(22px,2.1vw,44px);white-space:nowrap;line-height:1.2;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:1px}
.clock-progress :deep(.el-progress-bar__outer){background:rgb(180 196 223 / 24%)}
.clock-progress>div:last-child{margin-top:10px}
.contest-registration-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;border-top:1px solid var(--el-border-color-lighter);margin-top:26px;padding-top:22px}
.registration-summary{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:14px;color:var(--el-text-color-secondary)}
.registration-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:var(--el-color-primary);background:var(--el-color-primary-light-9);font-size:20px}
.registration-summary strong{font-size:21px;color:var(--el-text-color-primary)}
.registration-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--el-color-success-light-5);border-radius:999px;padding:5px 10px;color:var(--el-color-success);background:var(--el-color-success-light-9);font-size:13px;font-weight:600}
@media(max-width:1100px){.contest-overview-grid{grid-template-columns:minmax(0,1fr)}.contest-clock{min-height:240px}.clock-countdown>strong{font-size:clamp(24px,4vw,36px)}}
@media(max-width:600px){.overview-card :deep(.el-card__body){padding:20px}.contest-overview-grid{gap:20px}.time-range-values{grid-template-columns:1fr;gap:18px}.duration-track{width:80%;justify-self:center}.contest-time-range{padding:18px}.contest-title-row h1{font-size:28px}.contest-clock{padding:22px}.clock-countdown>strong{font-size:clamp(20px,7vw,32px)}}
.tag-row, .contest-stats, .filters, .panel-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.contest-stats { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--qoj-color-border); color: var(--qoj-color-text-2); }
.contest-stats strong { color: var(--qoj-color-text-1); }
.contest-description :deep(table) { display: table; }
.contest-description { padding: 20px; border: 1px solid var(--qoj-color-border); border-radius: 10px; background: white; overflow-wrap: anywhere; }
.problem-list { display: flex; flex-direction: column; gap: 10px; }
.problem-row { display: grid; grid-template-columns: 56px minmax(160px,1fr) repeat(3,auto); align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--qoj-color-border); border-radius: 10px; background: white; }
.problem-row.accepted { border-color: var(--qoj-color-success); }
.problem-label { font-weight: 700; color: var(--qoj-color-primary); }
.problem-title { justify-self: start; padding: 0; border: 0; background: none; color: var(--qoj-color-primary); font: inherit; text-align: left; cursor: pointer; }
.panel-actions { justify-content: flex-end; margin: 0 0 14px; }
.filters { justify-content: flex-end; margin-bottom: 14px; }
.filters .el-select { width: 170px; }
.filters .el-input { width: 200px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.table-scroll { overflow: auto; }
/* 姓名右侧依次显示奖牌与队伍标志。 */
.scoreboard-user { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.scoreboard-user-name { font-weight: 600; }
.medal-badge, .team-badge { flex: none; }
.team-badge { max-width: 116px; }
.team-badge :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 题目列收紧内边距，让相邻题目格间距从 32px 降到 12px 左右。 */
.table-scroll :deep(.score-column .cell) { padding: 0 2px; }
.score-cell { display: inline-flex; min-width: 66px; width: calc(100% - 8px); min-height: 52px; margin: 5px 4px; padding: 5px 7px; align-items: center; justify-content: center; flex-direction: column; gap: 2px; border-radius: 6px; background: var(--qoj-color-fill-0); line-height: 1.25; }
.score-cell-main { display: inline-flex; align-items: baseline; gap: 3px; font-size: 15px; font-weight: 700; }
.score-cell-main small { font-size: 11px; font-weight: 600; opacity: .78; }
.score-cell-tries { font-size: 11px; font-weight: 500; opacity: .82; white-space: nowrap; }
.score-cell.accepted { color: var(--qoj-color-success-dark); background: var(--qoj-color-success-light-default); }
.score-cell.failed { color: var(--qoj-color-danger-dark); background: var(--qoj-color-danger-light-default); }
.score-cell.partial { color: var(--qoj-color-warning-dark); background: var(--qoj-color-warning-light-default); }
.score-cell.hidden { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.public-scoreboard-link { margin-top: 10px; }
.submission-code { max-height: 65vh; overflow: auto; padding: 16px; border-radius: 8px; background: #101827; color: var(--card-border); white-space: pre-wrap; overflow-wrap: anywhere; }
@media(max-width: 760px) { .overview-top { flex-direction: column; } .overview-top h1 { font-size: 22px; } .problem-row { grid-template-columns: 40px minmax(120px,1fr); } .filters, .filters .el-select, .filters .el-input { width: 100%; } }
</style>

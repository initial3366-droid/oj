<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { readAuthToken } from "../../../api/tokenStorage";
import { fetchContestProblemDetail, fetchProblemDetail } from "../../../api/problem";
import { fetchMyProblemSubmissions, fetchSubmissionDetail, runCodeInSandbox, submitCode, type SubmissionRecord } from "../../../api/submission";
import { acceptProblemSolutionLevel, advanceProblemSolutionLevel, fetchProblemSolution, viewProblemSolutionLevel, type ProblemSolutionLevel } from "../../../api/solution";
import { fetchCodeTemplateSettings, fetchContest, fetchPracticeDetail, type CodeTemplateSettings } from "../../../data/apiClient";
import type { Problem } from "../../../data/types";
import { languageLabel, submissionLanguageFromValue, SUBMISSION_LANGUAGE_OPTIONS, type SubmissionLanguage } from "../../../data/languages";
import { useOjDataStore } from "../../stores/ojData";
import { decryptIdFromUrl } from "../../../utils/cipher";
import { wsClient } from "../../../utils/websocket";
import { sanitizeAnnouncementHtml } from "../../../utils/announcementHtml";
import { copyTextToClipboard } from "../../../utils/clipboard";
import { COMMUNICATION_TEMPLATES, COMMUNICATION_TUTORIAL_HTML } from "../../../components/problems/communicationTutorialContent";
import CodeEditor from "../../components/CodeEditor.vue";
import HtmlMath from "../../components/HtmlMath.vue";
import EmailBindingGate from "../../components/EmailBindingGate.vue";
import { VERDICT_GUIDES } from "../../../pages/about/guide";

const route = useRoute();
const router = useRouter();
const ojData = useOjDataStore();
const rawProblemId = computed(() => String(route.params.problemId ?? ""));
const numericProblemId = computed(() => {
  const match = rawProblemId.value.match(/^(?:cp|p)(\d{8})$/);
  return match ? decryptIdFromUrl(match[1]) : null;
});
const contestId = computed(() => route.query.contestId ? Number(route.query.contestId) : null);
const practiceId = computed(() => route.query.practiceId ? Number(route.query.practiceId) : null);
const contestLabel = computed(() => String(route.query.contestProblemLabel || "").trim());
const contestTitle = ref("");
// 比赛未结束时不在做题界面暴露测试点通过数量，避免中途得知用例分布。
const contestRunning = ref(false);
const contestMode = computed(() => contestId.value != null);
const problem = ref<Problem | null>(null);
const problemStatus = ref<"loading" | "ready" | "not-found">("loading");
const practiceEndTime = ref<string | null>(null);
const problemMessage = ref("");
const codeTemplates = ref<CodeTemplateSettings | null>(null);
const templatesEnabled = ref(false);
const language = ref<SubmissionLanguage>("C");
const code = ref("");
const editorTheme = ref<"light" | "dark">("light");

const fontSize = ref(18);
const leftWidth = ref(47);
const resizing = ref(false);
const leftTab = ref<"statement" | "submissions" | "solution">("statement");
const communicationTutorialOpen = ref(false);
const tutorialLanguage = ref("c");
const tutorialTemplates = ["c", "cpp17", "java", "python"].map((language) => COMMUNICATION_TEMPLATES.find((item) => item.language === language)!);
const debugOpen = ref(false);
const debugHeight = ref(273);
let debugDrag: { y: number; height: number; max: number } | null = null;
function beginDebugResize(event: PointerEvent) {
  const handle = event.currentTarget as HTMLElement;
  const panel = handle.nextElementSibling as HTMLElement;
  debugDrag = { y: event.clientY, height: panel.getBoundingClientRect().height, max: (panel.parentElement?.clientHeight ?? window.innerHeight) * 0.75 };
  handle.setPointerCapture(event.pointerId);
}
function moveDebugResize(event: PointerEvent) {
  if (!debugDrag) return;
  debugHeight.value = Math.max(120, Math.min(debugDrag.max, debugDrag.height + debugDrag.y - event.clientY));
}
function endDebugResize() { debugDrag = null; }
function keyboardDebugResize(event: KeyboardEvent) {
  debugHeight.value = Math.max(120, debugHeight.value + (event.key === "ArrowUp" ? 20 : -20));
}
const debugInput = ref("");
const debugOutput = ref("");
const debugError = ref("");
const debugAlert = ref("");
const debugAlertType = ref<"success" | "warning" | "error" | "info">("info");
const debugMetrics = ref<{ time: string; memory: string } | null>(null);
const running = ref(false);
const submitting = ref(false);
const submissionPanel = ref(false);
const submissionStatus = ref("PENDING");
const submissionTimeLimit = ref(0);
const submissionMetrics = ref<{ time: number | null; memory: number | null }>({ time: null, memory: null });
const submissionColor = computed(() => {
  const status = submissionStatus.value.toUpperCase();
  if (["AC", "ACCEPTED"].includes(status)) return "#16a34a";
  if (["WA", "WRONG_ANSWER"].includes(status)) return "#dc2626";
  if (["TLE", "TIME_LIMIT_EXCEEDED"].includes(status)) return "#d97706";
  if (["MLE", "MEMORY_LIMIT_EXCEEDED"].includes(status)) return "#9333ea";
  if (["RE", "RUNTIME_ERROR"].includes(status)) return "#ea580c";
  if (["CE", "COMPILE_ERROR"].includes(status)) return "#ca8a04";
  if (["NOO", "NO_OUTPUT"].includes(status)) return "#0891b2";
  return runningStatus(status) ? "#2563eb" : "#64748b";
});
function updateSubmissionResult(result: Partial<SubmissionRecord>) {
  submissionStatus.value = result.status || "PENDING";
  submissionMetrics.value = {
    time: result.timeUsed == null ? null : Math.floor(Math.min(result.timeUsed, submissionTimeLimit.value + 2)),
    memory: result.memoryUsed == null ? null : Math.floor(result.memoryUsed),
  };
}
const sampleIndex = ref<number | "custom">("custom");
const submissions = ref<SubmissionRecord[]>([]);
const submissionsLoading = ref(false);
const submissionsError = ref("");
const selectedCode = ref<SubmissionRecord | null>(null);
const selectedCodeLoading = ref(false);
const solution = ref<ProblemSolutionLevel | null>(null);
const solutionLoading = ref(false);
const solutionBusy = ref(false);
const solutionError = ref("");
const judgeEnabled = computed(() => ojData.state.judgeSettings?.enabled !== false);
const sandboxEnabled = computed(() => ojData.state.judgeSettings?.enableSandbox !== false);
const samples = computed(() => problem.value?.samples ?? []);
const selectedSample = computed(() => typeof sampleIndex.value === "number" ? samples.value[sampleIndex.value] : null);
const monacoLanguage = computed(() => SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === language.value)?.monacoLanguage ?? "cpp");
const templateKey = computed(() => SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === language.value)?.templateKey ?? "cpp");
const runningSubmission = ref(false);
const storageOwner = computed(() => {
  try {
    const token = readAuthToken("frontend");
    if (!token) return "guest";
    const encoded = token.split(".")[1] ?? "";
    const payload = JSON.parse(window.atob(encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return String(payload.userId ?? payload.sub ?? "guest");
  } catch { return "guest"; }
});
function codeKey(lang: SubmissionLanguage) { return `qoj.code.user.${storageOwner.value}.${rawProblemId.value}.${lang}`; }
function languageKey() { return `qoj.code.language.user.${storageOwner.value}.${rawProblemId.value}`; }
function templateFor(lang: SubmissionLanguage) {
  const key = SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === lang)?.templateKey ?? "cpp";
  return codeTemplates.value?.[key] ?? "";
}
function normalizeLanguage(value: string | null | undefined): SubmissionLanguage | null { return submissionLanguageFromValue(value); }
function readDraft(lang: SubmissionLanguage) { try { return window.localStorage.getItem(codeKey(lang)); } catch { return null; } }
function saveDraft() {
  if (!problem.value) return;
  try { window.localStorage.setItem(codeKey(language.value), code.value); window.localStorage.setItem(languageKey(), language.value); }
  catch { ElMessage.warning("当前浏览器无法保存代码草稿，请及时复制备份"); }
}
function switchLanguage(value: string | number) {
  const next = String(value) as SubmissionLanguage;
  if (!SUBMISSION_LANGUAGE_OPTIONS.some((item) => item.label === next)) return;
  language.value = next;
}
function normalizeOutput(value: string) { return value.replace(/\r\n/g, "\n").replace(/[ \t]+(?=\n|$)/g, "").replace(/\n+$/, ""); }
function finalStatus(value?: string | null) { return ["AC", "ACCEPTED", "WA", "WRONG_ANSWER", "TLE", "TIME_LIMIT_EXCEEDED", "MLE", "MEMORY_LIMIT_EXCEEDED", "RE", "RUNTIME_ERROR", "CE", "COMPILE_ERROR", "NOO", "NO_OUTPUT", "SE", "SYSTEM_ERROR", "FAILED"].includes(String(value || "").toUpperCase().replace(/\s+/g, "_")); }
function runningStatus(value?: string | null) { return ["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(String(value || "").toUpperCase()); }
function verdictGuide(value?: string | null) {
  const key = String(value || "PENDING").trim().toUpperCase().replace(/\s+/g, "_");
  const aliases: Record<string, string> = { ACCEPTED: "AC", WRONG_ANSWER: "WA", TIME_LIMIT_EXCEEDED: "TLE", MEMORY_LIMIT_EXCEEDED: "MLE", RUNTIME_ERROR: "RE", COMPILE_ERROR: "CE", NO_OUTPUT: "NOO", SYSTEM_ERROR: "SE", QUEUED: "PENDING" };
  return VERDICT_GUIDES.find(item => item.code === (aliases[key] ?? key));
}
function statusLabel(value?: string | null) { return verdictGuide(value)?.chinese ?? String(value || "PENDING"); }
/** 提交结果提示；比赛未结束时省略测试点通过数量。 */
function submissionResultText(status?: string | null, passed?: number | null, total?: number | null) {
  const base = `提交结果：${statusLabel(status)}`;
  if (runningStatus(status) || (contestMode.value && contestRunning.value)) return base;
  return `${base} · ${passed ?? 0}/${total ?? 0} 通过`;
}
function loadCodeTemplate(lang: SubmissionLanguage) {
  const saved = readDraft(lang);
  if (saved !== null) return saved;
  if (problem.value?.communication) {
    const communication = COMMUNICATION_TEMPLATES.find((item) => item.language === (SUBMISSION_LANGUAGE_OPTIONS.find((option) => option.label === lang)?.apiValue));
    if (communication) return communication.code;
  }
  return templateFor(lang);
}
let watcherCleanup: (() => void) | null = null;
let pollTimer: number | null = null;
let loadSequence = 0;
let resizeMove: ((event: MouseEvent) => void) | null = null;
let resizeEnd: (() => void) | null = null;
let deadlineTimer: number | null = null;

async function loadProblem() {
  const sequence = ++loadSequence;
  const thisLoad = () => loadSequence === sequence;
  problem.value = null;
  contestTitle.value = "";
  problemStatus.value = "loading";
  problemMessage.value = "";
  submissions.value = [];
  leftTab.value = "statement";
  if (!numericProblemId.value) { problemStatus.value = "not-found"; return; }
  const local = ojData.state.problems.find((item) => item.id === rawProblemId.value);
  if (local && !practiceId.value && !contestId.value) {
    problem.value = local;
    problemStatus.value = "ready";
  } else {
    try {
      let loaded: Problem;
      if (contestId.value) loaded = await fetchContestProblemDetail(contestId.value, numericProblemId.value);
      else if (practiceId.value) {
        const practice = await fetchPracticeDetail(practiceId.value);
        practiceEndTime.value = practice.endTime ?? null;
        const found = practice.problems.find((item) => item.id === rawProblemId.value || decodeProblemId(item.id) === numericProblemId.value);
        if (!found) throw new Error("题单题目不存在或已隐藏");
        loaded = found;
      } else loaded = await fetchProblemDetail(numericProblemId.value);
      if (!thisLoad()) return;
      problem.value = loaded;
      problemStatus.value = "ready";
    } catch (error) {
      if (!thisLoad()) return;
      problemMessage.value = error instanceof Error ? error.message : "题目不存在或无权访问";
      problemStatus.value = "not-found";
      return;
    }
  }

  const savedLanguage = (() => {
    try { return window.localStorage.getItem(languageKey()); } catch { return null; }
  })();
  const saved = SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === savedLanguage)?.label;
  language.value = saved ?? "C";
  try {
    const latest = await fetchMyProblemSubmissions(numericProblemId.value, contestId.value, 1, 1);
    const latestLanguage = normalizeLanguage(latest[0]?.language);
    if (!saved && latestLanguage) language.value = latestLanguage;
  } catch { /* Guests and first-time solvers use the C starter template. */ }

  try {
    if (contestId.value) {
      const contest = await fetchContest(contestId.value);
      contestTitle.value = contest.title;
      contestRunning.value = contest.status !== "ENDED";
      templatesEnabled.value = contest.enableCodeTemplates;
      if (contest.enableCodeTemplates) codeTemplates.value = await fetchCodeTemplateSettings();
      else codeTemplates.value = null;
    } else {
      templatesEnabled.value = true;
      codeTemplates.value = await fetchCodeTemplateSettings();
    }
  } catch { templatesEnabled.value = false; codeTemplates.value = null; }
  code.value = loadCodeTemplate(language.value);
}
function decodeProblemId(value: string) {
  const match = value.match(/^(?:cp|p)(\d{8})$/);
  return match ? decryptIdFromUrl(match[1]) : null;
}
async function loadMySubmissions() {
  if (!numericProblemId.value) return;
  submissionsLoading.value = true;
  submissionsError.value = "";
  try { submissions.value = await fetchMyProblemSubmissions(numericProblemId.value, contestId.value, 1, 50); }
  catch (error) { submissions.value = []; submissionsError.value = error instanceof Error ? error.message : "提交记录加载失败"; }
  finally { submissionsLoading.value = false; }
}
async function loadSolution() {
  if (!numericProblemId.value || contestMode.value) return;
  solutionLoading.value = true;
  solutionError.value = "";
  try { solution.value = await fetchProblemSolution(numericProblemId.value, practiceId.value ?? undefined); }
  catch (error) { solution.value = null; solutionError.value = error instanceof Error ? error.message : "题解加载失败"; }
  finally { solutionLoading.value = false; }
}
async function solutionAction(action: "accept" | "next" | number) {
  if (!numericProblemId.value || !solution.value) return;
  solutionBusy.value = true;
  solutionError.value = "";
  try {
    if (action === "accept") solution.value = await acceptProblemSolutionLevel(numericProblemId.value, solution.value.currentLevel, practiceId.value ?? undefined);
    else if (action === "next") solution.value = await advanceProblemSolutionLevel(numericProblemId.value, practiceId.value ?? undefined);
    else solution.value = await viewProblemSolutionLevel(numericProblemId.value, action, practiceId.value ?? undefined);
  } catch (error) { solutionError.value = error instanceof Error ? error.message : "题解操作失败"; }
  finally { solutionBusy.value = false; }
}
function selectTab(tab: "statement" | "submissions" | "solution") {
  leftTab.value = tab;
}
function selectSample(value: string | number) {
  if (value === "custom") { sampleIndex.value = "custom"; debugInput.value = ""; }
  else {
    const index = Number(value);
    sampleIndex.value = index;
    debugInput.value = samples.value[index]?.input ?? "";
  }
  debugOutput.value = "";
  debugAlert.value = "";
  debugMetrics.value = null;
  debugOpen.value = true;
}
function clearWatcher() {
  watcherCleanup?.();
  watcherCleanup = null;
  if (pollTimer != null) window.clearTimeout(pollTimer);
  pollTimer = null;
}
async function refreshSubmission(id: number) {
  try {
    const detail = await fetchSubmissionDetail(id);
    updateSubmissionResult(detail);
    debugAlert.value = submissionResultText(detail.status, detail.passedCaseCount, detail.totalCaseCount);
    debugAlertType.value = detail.status === "AC" || detail.status === "ACCEPTED" ? "success" : runningStatus(detail.status) ? "info" : "error";
    if (finalStatus(detail.status)) { runningSubmission.value = false; submitting.value = false; clearWatcher(); if (leftTab.value === "submissions") void loadMySubmissions(); }
  } catch { /* Keep retrying until the API returns a definitive result. */ }
}
function watchSubmission(id: number) {
  clearWatcher();
  runningSubmission.value = true;
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  const stop = () => { stopped = true; unsubscribe?.(); unsubscribe = null; if (pollTimer != null) window.clearTimeout(pollTimer); pollTimer = null; };
  watcherCleanup = stop;
  void wsClient.subscribeToSubmission(id, (update) => {
    if (stopped) return;
    submissionStatus.value = update.status;
    debugAlert.value = `提交结果：${statusLabel(update.status)}`;
    debugAlertType.value = finalStatus(update.status) ? update.status === "AC" ? "success" : "error" : "info";
    void refreshSubmission(id);
  }).then((dispose) => { if (stopped) dispose(); else unsubscribe = dispose; }).catch(() => undefined);
  const poll = async () => {
    if (stopped) return;
    await refreshSubmission(id);
    if (!stopped) pollTimer = window.setTimeout(poll, 1800);
  };
  void poll();
}
async function runDebug() {
  if (!problem.value || !judgeEnabled.value || !sandboxEnabled.value || running.value || submitting.value) return;
  debugOpen.value = true;
  submissionPanel.value = false;
  running.value = true;
  debugOutput.value = "";
  debugError.value = "";
  debugAlert.value = "";
  debugMetrics.value = null;
  try {
    const option = SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === language.value);
    const result = await runCodeInSandbox({ language: option?.apiValue ?? language.value.toLowerCase(), code: code.value, input: debugInput.value });
    debugOutput.value = result.output ?? "";
    debugError.value = result.error ?? "";
    debugMetrics.value = { time: `${result.timeUsed ?? "-"} ms`, memory: `${result.memoryUsed ?? "-"} KB` };
    const status = String(result.status || "").toUpperCase();
    if (status === "CE" || status === "COMPILE_ERROR") { debugAlert.value = "编译失败"; debugAlertType.value = "error"; }
    else if (status !== "AC" && status !== "ACCEPTED") { debugAlert.value = statusLabel(status); debugAlertType.value = "error"; }
    else if (problem.value.isSpecialJudge) { debugAlert.value = "特殊判题题目，请自行检查调试输出。"; debugAlertType.value = "warning"; }
    else if (selectedSample.value) {
      const accepted = normalizeOutput(result.output || "") === normalizeOutput(selectedSample.value.output || "");
      debugAlert.value = accepted ? "你的测试结果与样例一致" : "你的测试结果与样例不一致";
      debugAlertType.value = accepted ? "success" : "error";
    }
  } catch (error) { debugOutput.value = ""; debugAlert.value = error instanceof Error ? error.message : "调试失败"; debugAlertType.value = "error"; }
  finally { running.value = false; }
}
async function submitSolution() {
  if (!problem.value || !numericProblemId.value || !judgeEnabled.value || running.value || submitting.value) return;
  if (!readAuthToken("frontend")) { void router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`); return; }
  submitting.value = true;
  submissionPanel.value = true;
  submissionStatus.value = "PENDING";
  submissionMetrics.value = { time: null, memory: null };
  submissionTimeLimit.value = problem.value.timeLimit * (["C", "C++17", "C++20", "C++23"].includes(language.value) ? 1 : 2);
  runningSubmission.value = false;
  debugOpen.value = true;
  debugAlert.value = "正在发送到后端判题队列…";
  debugAlertType.value = "info";
  const option = SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === language.value);
  try {
    clearWatcher();
    const result = await submitCode({ problemId: numericProblemId.value, practiceId: practiceId.value ?? undefined, contestId: contestId.value ?? undefined, language: option?.apiValue ?? language.value.toLowerCase(), code: code.value });
    updateSubmissionResult(result);
    debugAlert.value = submissionResultText(result.status, result.passedCaseCount, result.totalCaseCount);
    debugAlertType.value = result.status === "AC" || result.status === "ACCEPTED" ? "success" : runningStatus(result.status) ? "info" : "error";
    if (result.id && !finalStatus(result.status)) watchSubmission(result.id);
    else { submitting.value = false; if (leftTab.value === "submissions") void loadMySubmissions(); }
  } catch (error) { submissionStatus.value = "FAILED"; debugAlert.value = error instanceof Error ? error.message : "提交失败，请检查后端服务。"; debugAlertType.value = "error"; submitting.value = false; }
}
async function copySample(value: string) {
  // HTTP 页面下 navigator.clipboard 不可用，统一走带同步选区降级的工具方法。
  if (await copyTextToClipboard(value)) ElMessage.success("已复制到剪贴板");
  else ElMessage.error("复制失败，请手动选择内容复制");
}
async function openSubmissionCode(item: SubmissionRecord) {
  selectedCodeLoading.value = true;
  try { selectedCode.value = item.code ? item : await fetchSubmissionDetail(item.id); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "提交代码加载失败"); }
  finally { selectedCodeLoading.value = false; }
}
function beginResize(event: MouseEvent) {
  event.preventDefault();
  resizing.value = true;
  const move = (current: MouseEvent) => { leftWidth.value = Math.max(18, Math.min(82, current.clientX / window.innerWidth * 100)); };
  const end = () => { resizing.value = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", end); resizeMove = null; resizeEnd = null; };
  resizeMove = move; resizeEnd = end;
  window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
}
function sampleValue(value: string) { return value; }
function routeToHistory() { void router.push(`/practice/history/${rawProblemId.value}`); }
watch(language, (next) => {
  code.value = loadCodeTemplate(next);
  saveDraft();
});
watch(code, saveDraft);
watch([rawProblemId, contestId, practiceId], () => { clearWatcher(); solution.value = null; practiceEndTime.value = null; void loadProblem(); });
watch(leftTab, (tab) => { if (tab === "submissions") void loadMySubmissions(); if (tab === "solution") void loadSolution(); });
watch(practiceEndTime, (end) => {
  if (deadlineTimer != null) window.clearTimeout(deadlineTimer);
  if (!end) return;
  const remaining = new Date(end).getTime() - Date.now();
  if (remaining <= 0) { problem.value = null; problemStatus.value = "not-found"; return; }
  deadlineTimer = window.setTimeout(() => { problem.value = null; problemStatus.value = "not-found"; }, remaining);
});
onMounted(() => { void ojData.hydrate(); void loadProblem(); });
onBeforeUnmount(() => { clearWatcher(); if (deadlineTimer != null) window.clearTimeout(deadlineTimer); if (resizeMove) window.removeEventListener("mousemove", resizeMove); if (resizeEnd) window.removeEventListener("mouseup", resizeEnd); });
usePageTitle(computed(() => problem.value ? `${contestMode.value ? `${contestLabel.value || numericProblemId.value} - ` : ""}${problem.value.title}${contestTitle.value ? ` - ${contestTitle.value}` : ""}` : null));
</script>

<template>
  <EmailBindingGate>
    <div v-if="problemStatus === 'loading'" class="problem-state"><el-icon class="is-loading"><span class="loader-dot">◌</span></el-icon>加载题目中…</div>
    <div v-else-if="!problem" class="problem-state"><el-result icon="error" title="题目不存在" :sub-title="problemMessage || '该题目不存在、已被隐藏，或你没有访问权限。'"><template #extra><el-button type="primary" @click="router.push('/problems')">返回题库</el-button></template></el-result></div>
    <main v-else class="practice-workspace" :class="{ resizing }" :style="{ gridTemplateColumns: `${leftWidth}fr 6px ${100 - leftWidth}fr` }">
      <section class="pane problem-pane">
        <header class="pane-header problem-header"><div class="problem-heading"><el-tag type="primary">{{ contestMode ? '比赛题目' : '题目' }}</el-tag><h1>{{ contestLabel ? `${contestLabel} - ` : '' }}{{ problem.title }}</h1><template v-if="problem.communication"><el-tag type="warning">通信题 · 两阶段</el-tag><el-button link type="primary" @click="communicationTutorialOpen = true">通信题教程</el-button></template><el-tag v-else-if="problem.isSpecialJudge">Special Judge</el-tag></div></header>
        <nav v-if="!contestMode" class="side-tabs"><el-button text v-for="tab in [{ id: 'statement', name: '题目描述' }, { id: 'submissions', name: '我的提交' }, { id: 'solution', name: '题解' }]" :key="tab.id" :type="leftTab === tab.id ? 'primary' : undefined" @click="selectTab(tab.id as 'statement' | 'submissions' | 'solution')">{{ tab.name }}</el-button></nav>
        <div class="problem-scroll">
          <article v-if="contestMode || leftTab === 'statement'" v-memo="[problem]" class="statement-content">
            <section><h2>题目描述</h2><HtmlMath :value="problem.statement || problem.summary" class-name="problem-rich-text" /></section>
            <section><h2>输入描述</h2><div class="io-block"><HtmlMath :value="problem.inputFormat || '输入数据。'" /></div></section>
            <section><h2>输出描述</h2><div class="io-block"><HtmlMath :value="problem.outputFormat || '输出答案。'" /></div></section>
            <fieldset class="limits"><legend>评测信息</legend><div><span>C/C++</span><span>时间限制：{{ problem.timeLimit / 1000 }} 秒</span><span>内存限制：{{ problem.memoryLimit }} MB</span></div><div><span>其他语言</span><span>时间限制：{{ problem.timeLimit / 500 }} 秒</span><span>内存限制：{{ problem.memoryLimit * 2 }} MB</span></div></fieldset>
            <section v-for="(sample, index) in samples" :key="`${sample.caseNo}-${index}`" class="sample-block"><h2>示例 {{ index + 1 }}</h2><div class="sample-card"><div class="sample-label">输入 <el-button link @click="copySample(sample.input)">复制</el-button></div><HtmlMath :value="sampleValue(sample.input)" class-name="sample-value" :preserve-plain-text-whitespace="true"/><div class="sample-label">输出 <el-button link @click="copySample(sample.output)">复制</el-button></div><HtmlMath :value="sampleValue(sample.output)" class-name="sample-value" :preserve-plain-text-whitespace="true"/><template v-if="sample.explanation"><div class="sample-label">解释</div><HtmlMath :value="sample.explanation" class-name="sample-value"/></template></div></section>
          </article>
          <section v-else-if="leftTab === 'submissions'" class="submissions-panel"><el-skeleton v-if="submissionsLoading" :rows="5" animated/><el-alert v-else-if="submissionsError" type="warning" :title="submissionsError.includes('登录') ? '登录后可以查看自己的提交记录。' : submissionsError" :closable="false"/><el-empty v-else-if="!submissions.length" description="还没有提交记录"/><article v-for="submission in submissions" v-else :key="submission.id" class="submission-row"><div><el-tag :type="submission.status === 'AC' || submission.status === 'ACCEPTED' ? 'success' : runningStatus(submission.status) ? 'warning' : 'danger'">{{ statusLabel(submission.status) }}</el-tag><p>{{ languageLabel(submission.language) }} · {{ submission.submitTime || submission.createdAt }}</p></div><span>{{ submission.passedCaseCount ?? 0 }}/{{ submission.totalCaseCount ?? 0 }} 通过</span><el-button size="small" :loading="selectedCodeLoading" @click="openSubmissionCode(submission)">查看代码</el-button></article></section>
          <section v-else class="solution-panel"><el-skeleton v-if="solutionLoading" :rows="5" animated/><el-alert v-else-if="solutionError && !solution" type="warning" :title="solutionError.includes('登录') ? '登录后可以逐层查看题解。' : solutionError" :closable="false"/><el-empty v-else-if="!solution || solution.height === 0" description="这道题还没有发布题解"/><template v-else><header><h2>渐进题解</h2><p>从第一层提示开始，没想通就点“下一关”。开启下一层后，之前的层级只能回看。</p></header><div class="solution-levels"><el-button v-for="level in solution.height" :key="level" :type="level === solution.currentLevel ? 'primary' : solution.acceptedLevel === level ? 'success' : ''" :disabled="solutionBusy || level > solution.maxViewedLevel || level === solution.currentLevel" @click="solutionAction(level)">第 {{ level }} 层 · {{ solution.levelAcceptedCounts[level - 1] ?? 0 }} 人 AC</el-button></div><el-card shadow="never"><h3>第 {{ solution.currentLevel }} 层 / 共 {{ solution.height }} 层</h3><p>已有 {{ solution.acceptedCount }} 人在本层 AC</p><div class="announcement-html markdown-math" v-html="sanitizeAnnouncementHtml(solution.content)"/><el-button type="success" :disabled="solutionBusy || solution.acceptedLevel != null || solution.currentLevel < solution.maxViewedLevel" :loading="solutionBusy" @click="solutionAction('accept')">{{ solution.acceptedLevel != null ? `已在第 ${solution.acceptedLevel} 层 AC` : '本关 AC' }}</el-button><el-button :disabled="solutionBusy || solution.currentLevel >= solution.height" :loading="solutionBusy" @click="solutionAction('next')">下一关</el-button><el-alert v-if="solutionError" type="error" :title="solutionError" :closable="false"/></el-card></template></section>
        </div>
      </section>
      <div class="resize-divider" role="separator" aria-label="拖动调整题面和代码区域比例" @mousedown="beginResize"/>
      <section class="pane editor-pane" :class="editorTheme">
        <header class="editor-toolbar"><div class="toolbar-left"><el-select :model-value="language" aria-label="选择提交语言" @change="switchLanguage"><el-option v-for="item in SUBMISSION_LANGUAGE_OPTIONS" :key="item.label" :label="item.label" :value="item.label"/></el-select><el-button circle aria-label="减小字体" @click="fontSize = Math.max(12, fontSize - 1)">−</el-button><span>{{ fontSize }}px</span><el-button circle aria-label="增大字体" @click="fontSize = Math.min(28, fontSize + 1)">+</el-button><el-switch v-model="editorTheme" active-value="dark" inactive-value="light" active-text="黑色背景" aria-label="代码编辑器黑色背景"/></div><div class="toolbar-actions"><el-button v-if="!contestMode" @click="routeToHistory">历史提交</el-button><el-button class="editor-action" round :disabled="running || submitting" @click="submissionPanel = false; debugOpen = !debugOpen">调试</el-button><el-button class="editor-action" round type="success" :loading="submitting" :disabled="!judgeEnabled || running || submitting" @click="submitSolution">{{ submitting ? '提交中' : '提交' }}</el-button></div></header>
        <div class="editor-area"><CodeEditor v-model="code" :language="monacoLanguage" :theme="editorTheme" :font-size="fontSize"/></div>
        <div v-if="debugOpen" class="debug-resize-handle" role="separator" aria-label="上下调整调试面板高度" aria-orientation="horizontal" tabindex="0" :aria-valuenow="Math.round(debugHeight)" aria-valuemin="120" @pointerdown.prevent="beginDebugResize" @pointermove="moveDebugResize" @pointerup="endDebugResize" @pointercancel="endDebugResize" @lostpointercapture="endDebugResize" @keydown.up.prevent="keyboardDebugResize" @keydown.down.prevent="keyboardDebugResize" />
        <section v-if="debugOpen" class="debug-panel" :style="{ height: `${debugHeight}px` }">
          <header><strong>{{ submissionPanel ? '提交结果' : '调试面板' }}</strong><div class="debug-actions"><el-select v-if="!submissionPanel" :model-value="sampleIndex === 'custom' ? 'custom' : String(sampleIndex)" :disabled="Boolean(problem.communication)" @change="selectSample"><el-option label="自定义输入" value="custom"/><el-option v-for="(_, index) in samples" :key="index" :label="`样例 ${index + 1}`" :value="String(index)"/></el-select><el-button type="primary" :loading="running" :disabled="submitting || !judgeEnabled || !sandboxEnabled" @click="runDebug">{{ running ? '调试中' : '运行调试' }}</el-button><el-button type="danger" round @click="debugOpen = false">取消</el-button></div></header>
          <el-alert v-if="!judgeEnabled" type="warning" title="判题服务已关闭，无法提交或运行代码。" :closable="false"/>
          <el-alert v-else-if="!sandboxEnabled" type="warning" title="管理员已关闭代码调试功能。" :closable="false"/>
          <el-alert v-if="debugAlert && !submissionPanel" :type="debugAlertType" :title="debugAlert" :closable="false"/>
          <pre v-if="debugError && !submissionPanel" class="debug-error">{{ debugError }}</pre>
          <div v-if="debugMetrics && !submissionPanel" class="debug-metrics">运行时间：{{ debugMetrics.time }} · 运行内存：{{ debugMetrics.memory }}</div>
          <div v-if="submissionPanel" class="submission-result" role="status" aria-live="polite" :style="{ color: submissionColor }">
            <strong>{{ statusLabel(submissionStatus) }}</strong>
            <div class="submission-resources"><span>耗时：{{ submissionMetrics.time == null ? '—' : `${submissionMetrics.time} ms` }}</span><span>内存：{{ submissionMetrics.memory == null ? '—' : `${submissionMetrics.memory} KB` }}</span></div>
            <p v-if="submissionStatus === 'FAILED'">{{ debugAlert }}</p>
          </div>
          <div v-else class="debug-fields"><label>输入<textarea v-model="debugInput" aria-label="调试输入" placeholder="在这里输入自定义数据，支持换行" spellcheck="false" @input="sampleIndex = 'custom'; debugOutput = ''; debugAlert = ''; debugMetrics = null"/></label><label>输出<textarea :value="debugOutput" aria-label="调试输出" readonly spellcheck="false"/></label></div>
        </section>
      </section>
    </main>
    <el-dialog v-model="communicationTutorialOpen" title="通信题教程" width="min(1120px, 94vw)" align-center>
      <div class="communication-guide">
        <section class="communication-introduction"><HtmlMath :value="COMMUNICATION_TUTORIAL_HTML" /></section>
        <section class="communication-templates" aria-label="通信题代码模板">
          <el-tabs v-model="tutorialLanguage">
            <el-tab-pane v-for="template in tutorialTemplates" :key="template.language" :label="template.label" :name="template.language">
              <el-button @click="copyTextToClipboard(template.code).then(() => ElMessage.success('模板已复制'))">复制 {{ template.label }} 模板</el-button>
              <pre class="communication-template-code"><code>{{ template.code }}</code></pre>
            </el-tab-pane>
          </el-tabs>
        </section>
      </div>
    </el-dialog>
    <el-dialog :model-value="Boolean(selectedCode)" :title="`提交代码 #${selectedCode?.id ?? ''}`" width="min(900px, 92vw)" @close="selectedCode = null"><CodeEditor v-if="selectedCode" :key="selectedCode.id" :model-value="selectedCode.code || ''" :language="SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.label === normalizeLanguage(selectedCode?.language))?.monacoLanguage || 'cpp'" read-only :theme="editorTheme"/></el-dialog>
  </EmailBindingGate>
</template>

<style scoped>
.problem-state { min-height: 100vh; display: grid; place-content: center; background: var(--qoj-color-bg-1); color: var(--el-text-color-secondary); }
.loader-dot { font-size: 24px; animation: rotate 1s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
.practice-workspace { position: fixed; inset: 0; z-index: 30; display: grid; overflow: hidden; background: var(--qoj-color-bg-1); }
.pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
.problem-pane { background: var(--content-bg); }
.pane-header { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--card-border); }
.problem-heading { min-width: 0; display: flex; align-items: center; gap: 10px; }
.problem-heading h1 { min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
.side-tabs { display: flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 16px; border-bottom: 1px solid var(--card-border); }
.problem-scroll { min-height: 0; flex: 1; overflow: auto; padding: 20px; }
.statement-content { display: grid; gap: 26px; color: var(--qoj-color-text-1); line-height: 1.8; }
.statement-content h2 { margin: 0 0 10px; color: var(--qoj-color-text-0); font-size: 17px; }
.io-block { padding: 14px 18px; border-left: 4px solid var(--el-color-primary); background: var(--el-fill-color-light); }
.limits { min-width: 0; margin: 0; border: 1px solid var(--card-border); border-radius: 8px; padding: 4px 12px 6px; line-height: 1.5; }
.limits div + div { border-top: 1px solid var(--el-border-color); }
.limits legend { padding: 0 6px; font-weight: 700; }
.limits div { display: grid; grid-template-columns: 80px minmax(0, 1fr) minmax(0, 1fr); gap: 12px; padding: 4px 0; }
.sample-card { overflow: hidden; border: 1px solid var(--card-border); border-radius: 8px; background: var(--el-fill-color-light); }
.sample-label { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; font-weight: 600; color: var(--el-text-color-regular); }
.sample-value { padding: 12px 16px; border-left: 4px solid var(--el-color-primary); background: var(--content-bg); font-family: ui-monospace, monospace; white-space: pre-wrap; }
.statement-content :deep(pre) { margin: 6px 0; padding: 8px 14px; white-space: pre-wrap; line-height: 1.5; }
.statement-content :deep(pre:first-child) { margin-top: 0; }
.statement-content :deep(pre:last-child) { margin-bottom: 0; }
.sample-value:has(pre) { white-space: normal; }
.sample-value :deep(pre) { margin: 0; padding: 8px 14px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-fill-color-light); }
.communication-guide { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.communication-introduction,.communication-templates { min-width: 0; max-height: 70vh; overflow: auto; }
.communication-introduction { padding-right: 24px; border-right: 1px solid var(--el-border-color); line-height: 1.7; }
.communication-template-code { padding: 12px; overflow: auto; background: var(--el-fill-color-light); border-radius: 6px; font: 13px/1.5 ui-monospace, monospace; }
@media(max-width:620px) { .communication-guide { grid-template-columns: 1fr; } .communication-introduction { border-right: 0; padding-right: 0; max-height: 35vh; } }
.submissions-panel { display: flex; flex-direction: column; gap: 12px; }
.submission-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px; border: 1px solid var(--card-border); border-radius: 8px; }
.submission-row p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
.solution-panel { display: grid; gap: 16px; }
.solution-panel header h2 { margin: 0; }
.solution-panel header p { color: var(--el-text-color-secondary); }
.solution-levels { display: flex; flex-wrap: wrap; gap: 8px; }
.solution-panel :deep(.el-card__body) { display: grid; gap: 12px; }
.resize-divider { z-index: 8; cursor: col-resize; background: var(--card-border); }
.resize-divider:hover { background: var(--el-color-primary); }
.editor-pane { container-type: inline-size; background: var(--content-bg); }
.editor-pane.dark { background: #1e1e1e; }
.editor-toolbar { min-height: 56px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; background: var(--content-bg); border-bottom: 1px solid var(--card-border); }
.toolbar-left,.toolbar-actions,.debug-actions { display: flex; align-items: center; gap: 8px; }
.editor-toolbar { flex-wrap: wrap; }
.toolbar-left { flex-wrap: wrap; min-width: 0; }
.toolbar-left > .el-select { width: 140px; flex-shrink: 0; }
.toolbar-left .el-switch { flex-shrink: 0; white-space: nowrap; }
.toolbar-left :deep(.el-switch__label) { white-space: nowrap; }
.toolbar-actions .el-button { margin-left: 0; }
.toolbar-actions .editor-action { min-width: 56px; height: 32px; padding: 0 12px; border-radius: 999px; font-size: 14px; }
.debug-resize-handle { height: 8px; flex-shrink: 0; cursor: row-resize; touch-action: none; background: var(--el-fill-color-light); }
.debug-resize-handle:hover,.debug-resize-handle:focus-visible { background: var(--el-color-primary-light-5); }
.debug-actions :deep(.el-select__wrapper) { min-height: 40px; box-sizing: border-box; }
.debug-actions .el-button { height: 40px; border-radius: 999px; }
.toolbar-actions { flex-shrink: 0; margin-left: auto; }
.debug-panel > header,.debug-actions { flex-wrap: wrap; }
.debug-actions { min-width: 0; }
.debug-actions > .el-select { width: 150px; flex-shrink: 0; }
.debug-actions > .el-button { flex-shrink: 0; min-height: 40px; padding: 10px 18px; white-space: nowrap; }
.debug-actions > .el-button--primary { min-width: 112px; }
.toolbar-left > span { min-width: 44px; text-align: center; color: var(--el-text-color-regular); font-size: 12px; }
@container (max-width: 680px) {
  .toolbar-left,.toolbar-actions { gap: 6px; }
  .toolbar-left > .el-select { width: 110px; }
  .toolbar-left > span { min-width: 28px; }
  .toolbar-left :deep(.el-switch__label) { display: none; }
}
.editor-area { min-height: 0; flex: 1; overflow: hidden; }
.debug-panel { display: flex; flex-direction: column; box-sizing: border-box; flex-shrink: 0; min-height: 120px; max-height: 75%; padding: 12px; gap: 10px; overflow: auto; border-top: 1px solid #cbd5e1; background: var(--content-bg); }
.debug-panel > header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.debug-panel > .el-alert,.debug-metrics { flex-shrink: 0; }
.debug-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; min-height: 166px; flex: 1 0 166px; }
.debug-fields label { min-width: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
.debug-fields textarea { box-sizing: border-box; width: 100%; min-height: 140px; flex: 1; padding: 5px 11px; resize: none; border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); background: var(--el-input-bg-color, var(--el-fill-color-blank)); color: var(--el-text-color-regular); font: 400 14px/1.5 ui-monospace, monospace; transition: border-color .15s; }
.debug-fields textarea:focus { outline: none; border-color: var(--el-color-primary); }
.debug-fields textarea::placeholder { color: var(--el-text-color-placeholder); }
.debug-error { flex-shrink: 0; max-height: 25%; overflow: auto; margin: 0; padding: 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.debug-metrics { color: var(--el-text-color-regular); font-size: 13px; }
.submission-result { display: flex; flex: 1; min-width: 0; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
.submission-result > strong { font-size: 36px; line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
.submission-resources { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 32px; font-size: 16px; font-weight: 600; }
.editor-action.el-button--success { border: 0; }
.editor-pane.dark .editor-action.el-button--success { --el-button-disabled-border-color: transparent; }
.editor-pane.dark .editor-toolbar { background: #252526; color: #d4d4d4; border-color: #3e3e42; }
@media(max-width:850px) { .practice-workspace { grid-template-columns: 42fr 4px 58fr !important; } .problem-heading { flex-wrap: wrap; } .problem-heading h1 { max-width: 48vw; } .toolbar-left .el-switch { display: none; } .toolbar-actions .el-button:first-child { display: none; } }
@media(max-width:620px) { .practice-workspace { grid-template-columns: 1fr !important; grid-template-rows: minmax(34vh, 42fr) 4px minmax(0,58fr) !important; } .resize-divider { cursor: row-resize; } .editor-toolbar { flex-wrap: wrap; } .debug-fields { grid-template-columns: 1fr; } }
</style>

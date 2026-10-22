<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import { readAuthToken } from "../../../api/tokenStorage";
import { formatDisplayDate } from "../../../lib/format";
import { fetchMyProblemSubmissions, fetchProblemDetail, fetchSubmissionDetail, type SubmissionRecord } from "../../../data/apiClient";
import type { Problem } from "../../../data/types";
import { decryptIdFromUrl } from "../../../utils/cipher";
import { languageLabel } from "../../../data/languages";

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting", PENDING: "Pending", QUEUED: "Pending", REJUDGE_PENDING: "Rejudge Pending", JUDGING: "Judging", COMPILING: "Compiling", RUNNING: "Running",
  AC: "Accepted", ACCEPTED: "Accepted", WA: "Wrong Answer", WRONG_ANSWER: "Wrong Answer", TLE: "Time Limit Exceeded", TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
  MLE: "Memory Limit Exceeded", MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded", RE: "Runtime Error", RUNTIME_ERROR: "Runtime Error", CE: "Compile Error", COMPILE_ERROR: "Compile Error", NOO: "No Output", SE: "System Error", SYSTEM_ERROR: "System Error", FAILED: "Failed",
};
const route = useRoute();
const router = useRouter();
const problemId = computed(() => String(route.params.problemId ?? ""));
const numericProblemId = computed(() => {
  const prefix = problemId.value.startsWith("cp") ? "cp" : problemId.value.startsWith("p") ? "p" : "";
  const encoded = problemId.value.slice(prefix.length);
  return encoded && /^\d{8}$/.test(encoded) ? decryptIdFromUrl(encoded) : null;
});
const contestId = computed(() => Number(route.query.contestId) || null);
const hasAccessToken = computed(() => Boolean(readAuthToken("frontend")));
const problem = ref<Problem | null>(null);
const submissions = ref<SubmissionRecord[]>([]);
const selectedSubmission = ref<SubmissionRecord | null>(null);
const codeLoadingId = ref<number | null>(null);
const message = ref("");
const loading = ref(true);
const caseCountText = (submission: SubmissionRecord) => {
  const passed = submission.passedCaseCount ?? 0;
  const total = submission.totalCaseCount ?? 0;
  return total > 0 ? `${passed} / ${total}` : String(passed);
};

watch([numericProblemId, contestId], async ([id, currentContestId], _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  problem.value = null;
  submissions.value = [];
  message.value = "";
  loading.value = true;
  if (!id) { message.value = "题目 ID 无效"; loading.value = false; return; }
  try {
    const [problemData, submissionData] = await Promise.all([fetchProblemDetail(id), fetchMyProblemSubmissions(id, currentContestId)]);
    if (live) { problem.value = problemData; submissions.value = submissionData; }
  } catch (error) {
    if (live) { submissions.value = []; message.value = error instanceof Error ? error.message : "提交记录加载失败"; }
  } finally { if (live) loading.value = false; }
}, { immediate: true });

async function openCode(submission: SubmissionRecord) {
  if (!hasAccessToken.value) { message.value = "请先登录后查看提交代码"; return; }
  codeLoadingId.value = submission.id;
  try {
    const detail = submission.code ? submission : await fetchSubmissionDetail(submission.id);
    selectedSubmission.value = detail;
    submissions.value = submissions.value.map((item) => item.id === detail.id ? { ...item, ...detail } : item);
  } catch (error) { message.value = error instanceof Error ? error.message : "提交代码加载失败"; }
  finally { codeLoadingId.value = null; }
}
function statusType(status?: string | null) {
  const value = (status || "").toUpperCase();
  if (["AC", "ACCEPTED"].includes(value)) return "success";
  if (["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(value)) return "warning";
  if (["SE", "SYSTEM_ERROR", "FAILED"].includes(value)) return "info";
  return "danger";
}
function returnToCode() {
  if (!problemId.value) { void router.push("/problems"); return; }
  void router.push(`/practice/problem/${problemId.value}${contestId.value ? `?contestId=${contestId.value}` : ""}`);
}
usePageTitle(computed(() => problem.value ? `${numericProblemId.value} - ${problem.value.title} - 提交记录` : null));
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header">
      <div class="page-container-title-row">
        <div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">{{ problem?.title || "本道题提交记录" }}</h1><span class="submission-subtitle">Submissions</span><p>查看{{ contestId ? "本场比赛" : "本道题" }}的提交时间和测评状态。</p></div>
        <el-button text @click="returnToCode"><el-icon><ArrowLeft /></el-icon>返回写代码</el-button>
      </div>
    </header>
    <el-alert v-if="message" class="submission-alert" type="error" :title="message" :closable="false" />
    <el-card shadow="never" class="submission-card">
      <el-table :data="submissions" row-key="id" stripe v-loading="loading" empty-text="暂无提交记录">
        <el-table-column label="代码" width="140"><template #default="{ row }"><el-button text type="primary" :loading="codeLoadingId === row.id" :disabled="!hasAccessToken || codeLoadingId === row.id" @click="openCode(row)">{{ !hasAccessToken ? "登录后查看" : codeLoadingId === row.id ? "加载中" : "查看代码" }}</el-button></template></el-table-column>
        <el-table-column v-if="!contestId" label="测试点通过数量" width="160"><template #default="{ row }"><strong>{{ caseCountText(row) }}</strong></template></el-table-column>
        <el-table-column label="时间" min-width="190"><template #default="{ row }"><div>{{ formatDisplayDate(row.submitTime || row.createdAt) }}</div><small>{{ languageLabel(row.language) }}</small></template></el-table-column>
        <el-table-column label="状态" min-width="180"><template #default="{ row }"><div class="submission-status"><el-tag :type="statusType(row.status)">{{ STATUS_LABELS[row.status.toUpperCase()] || row.status }}</el-tag><small v-if="typeof row.timeUsed === 'number' || typeof row.memoryUsed === 'number'">{{ typeof row.timeUsed === 'number' ? `${row.timeUsed} ms` : "-" }} / {{ typeof row.memoryUsed === 'number' ? `${row.memoryUsed} KB` : "-" }}</small></div></template></el-table-column>
      </el-table>
    </el-card>
    <el-dialog :model-value="Boolean(selectedSubmission)" title="提交代码" width="min(960px, 92vw)" @close="selectedSubmission = null">
      <template v-if="selectedSubmission"><small class="submission-code-date">{{ formatDisplayDate(selectedSubmission.submitTime || selectedSubmission.createdAt) }}</small><pre class="submission-code"><code>{{ selectedSubmission.code || "（无代码）" }}</code></pre></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-container { width: 100%; }
.submission-subtitle { display: block; margin-top: 5px; color: var(--qoj-color-text-2); }
.page-container-title-content > p { margin: 8px 0 0; color: var(--qoj-color-text-2); }
.submission-alert { margin-bottom: 20px; }
.submission-card { border: 1px solid var(--qoj-color-border); }
.submission-card :deep(.el-card__body) { padding: 0; }
.submission-status { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.submission-status small, .submission-card small { color: var(--qoj-color-text-2); }
.submission-code-date { display: block; margin-bottom: 12px; color: var(--qoj-color-text-2); }
.submission-code { max-height: 60vh; overflow: auto; padding: 16px; border: 1px solid var(--qoj-color-border); border-radius: 8px; background: #f7f9fc; font-family: "SFMono-Regular",Consolas,monospace; white-space: pre; }
</style>

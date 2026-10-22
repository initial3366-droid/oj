<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { formatDisplayDate } from "../../../lib/format";
import { decryptIdFromUrl } from "../../../utils/cipher";
import { fetchProblemDetail } from "../../../api/problem";
import { fetchProblemSubmissions, fetchSubmissionDetail, type SubmissionRecord } from "../../../api/submission";
import { languageLabel } from "../../../data/languages";

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting", PENDING: "Pending", QUEUED: "Queued", REJUDGE_PENDING: "Rejudge Pending", JUDGING: "Judging", COMPILING: "Compiling", RUNNING: "Running",
  AC: "Accepted", ACCEPTED: "Accepted", WA: "Wrong Answer", WRONG_ANSWER: "Wrong Answer", TLE: "Time Limit Exceeded", TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
  MLE: "Memory Limit Exceeded", MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded", RE: "Runtime Error", RUNTIME_ERROR: "Runtime Error", CE: "Compile Error", COMPILE_ERROR: "Compile Error", COMPILATION_ERROR: "Compile Error", NOO: "No Output", SE: "System Error", SYSTEM_ERROR: "System Error", FAILED: "Failed",
};
const route = useRoute();
const router = useRouter();
const problemId = computed(() => String(route.params.problemId ?? ""));
const numericProblemId = computed(() => {
  const prefix = problemId.value.startsWith("cp") ? "cp" : problemId.value.startsWith("p") ? "p" : "";
  const encoded = problemId.value.slice(prefix.length);
  if (!encoded || !/^\d{8}$/.test(encoded)) return null;
  return decryptIdFromUrl(encoded);
});
const problemTitle = ref("");
const submissions = ref<SubmissionRecord[]>([]);
const loading = ref(false);
const historyCodeLoading = ref(false);
const currentPage = ref(1);
const codeRecord = ref<{ submissionId: number; language: string; submittedAt: string; code: string } | null>(null);
const pagedSubmissions = computed(() => submissions.value.slice((currentPage.value - 1) * 10, currentPage.value * 10));

watch(numericProblemId, async (id, _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  problemTitle.value = "";
  submissions.value = [];
  currentPage.value = 1;
  if (!id) return;
  void fetchProblemDetail(id).then((problem) => { if (live) { problemTitle.value = problem.title; } }).catch(() => undefined);
  loading.value = true;
  try { submissions.value = await fetchProblemSubmissions(id, null, 1, 200); }
  catch { submissions.value = []; }
  finally { if (live) loading.value = false; }
}, { immediate: true });

function statusType(value?: string | null) {
  const status = (value || "").toUpperCase();
  if (status === "AC" || status === "ACCEPTED") return "success";
  if (["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(status)) return "warning";
  if (["SE", "SYSTEM_ERROR", "FAILED"].includes(status)) return "info";
  return "danger";
}
async function viewCode(record: SubmissionRecord) {
  historyCodeLoading.value = true;
  try {
    const detail = await fetchSubmissionDetail(record.id);
    codeRecord.value = { submissionId: record.id, language: record.language, submittedAt: record.createdAt, code: detail.code ?? record.code ?? "" };
  } catch { /* Backend visibility rules decide whether the source is available. */ }
  finally { historyCodeLoading.value = false; }
}
function goToProblem() { if (problemId.value) void router.push(`/practice/problem/${problemId.value}`); }
usePageTitle(computed(() => problemTitle.value ? `${numericProblemId.value} - ${problemTitle.value} - 历史提交` : null));
</script>

<template>
  <section class="history-page page-container">
    <div class="history-header"><h1>历史提交{{ problemTitle ? ` · ${problemTitle}` : "" }}</h1><el-button @click="goToProblem">返回写题</el-button></div>
    <el-table :data="pagedSubmissions" row-key="id" stripe v-loading="loading" empty-text="暂无提交记录">
      <el-table-column prop="displayName" label="提交者" min-width="140"><template #default="{ row }">{{ row.displayName || "-" }}</template></el-table-column>
      <el-table-column prop="problemTitle" label="题目名称" min-width="180"><template #default="{ row }">{{ row.problemTitle || "-" }}</template></el-table-column>
      <el-table-column label="代码长度" width="110" align="center"><template #default="{ row }">{{ row.codeLength != null ? `${row.codeLength} B` : "-" }}</template></el-table-column>
      <el-table-column label="运行时间" width="110" align="center"><template #default="{ row }">{{ row.timeUsed != null ? `${row.timeUsed} ms` : "-" }}</template></el-table-column>
      <el-table-column label="内存" width="110" align="center"><template #default="{ row }">{{ row.memoryUsed != null ? `${row.memoryUsed} KB` : "-" }}</template></el-table-column>
      <el-table-column label="提交状态" width="150" align="center"><template #default="{ row }"><el-tag v-if="row.status" :type="statusType(row.status)">{{ STATUS_LABELS[row.status.toUpperCase()] || row.status }}</el-tag><span v-else>-</span></template></el-table-column>
      <el-table-column label="提交时间" min-width="180"><template #default="{ row }">{{ formatDisplayDate(row.createdAt) }}</template></el-table-column>
      <el-table-column label="查看代码" width="120" align="center"><template #default="{ row }"><el-button size="small" :loading="historyCodeLoading" @click="viewCode(row)">查看代码</el-button></template></el-table-column>
    </el-table>
    <Pagination v-if="submissions.length > 10" v-model:page="currentPage" :limit="10" :total="submissions.length" />
    <el-dialog :model-value="Boolean(codeRecord)" :title="codeRecord ? `提交代码 #${codeRecord.submissionId}（${languageLabel(codeRecord.language)}）` : '提交代码'" width="min(900px, 92vw)" @close="codeRecord = null">
      <div v-if="codeRecord" class="history-code-meta">提交时间：{{ formatDisplayDate(codeRecord.submittedAt) }}</div>
      <pre v-if="codeRecord" class="history-code"><code>{{ codeRecord.code || "（无代码）" }}</code></pre>
    </el-dialog>
  </section>
</template>

<style scoped>
.history-page { width: min(1100px,100%); margin: 0 auto; padding: 24px 24px 48px; }
.history-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.history-header h1 { margin: 0; font-size: 20px; }
.history-page :deep(.el-pagination) { justify-content: center; margin-top: 18px; }
.history-code-meta { margin-bottom: 12px; color: var(--qoj-color-text-2); }
.history-code { max-height: 60vh; overflow: auto; padding: 16px; border: 1px solid var(--qoj-color-border); border-radius: 8px; background: #f7f9fc; font-family: "SFMono-Regular",Consolas,monospace; white-space: pre; }
@media (max-width: 640px) { .history-page { padding: 16px 8px 32px; } .history-header { align-items: flex-start; } }
</style>

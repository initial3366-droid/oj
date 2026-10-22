<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { adminGet } from "../../../admin/api/adminClient";
import { teacherGet } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import { languageLabel, monacoLanguage } from "../../../data/languages";
import { formatDisplayDate } from "../../../lib/format";
import CodeEditor from "../../components/CodeEditor.vue";

type Ranking = { userId: number; displayName: string; score: number; solved: number; submissionCount: number };
type Submission = { id: number; userId: number; displayName: string; problemId: number; problemTitle: string; language: string; status: string; timeUsed: number; memoryUsed: number; createdAt: string };
type Report = { practiceId: number; participantCount: number; submissionCount: number; rankings: Ranking[]; submissions: Submission[] };
const route = useRoute();
const router = useRouter();
const teacherMode = computed(() => route.path.startsWith("/teacher/"));
const basePath = computed(() => teacherMode.value ? "/teacher" : adminPath(""));
const isPublicationReport = computed(() => route.path.includes("/publications/"));
const reportId = computed(() => Number(route.params.publicationId ?? route.params.practiceId) || null);
const courseId = computed(() => Number(route.query.courseId) || null);
const loading = ref(false);
const report = ref<Report | null>(null);
const codeDialog = ref(false);
const codeLoading = ref(false);
const code = ref("");
const codeLanguage = ref("plaintext");
const backPath = computed(() => !teacherMode.value && courseId.value ? `${basePath.value}/courses/${courseId.value}` : `${basePath.value}/practices`);

async function load() {
  if (!reportId.value) { ElMessage.error("发布实例参数无效"); return; }
  loading.value = true;
  try {
    const reportPath = isPublicationReport.value
      ? `/api/admin/v1/practices/publications/${reportId.value}/report`
      : `/api/admin/v1/practices/${reportId.value}/report`;
    report.value = teacherMode.value
      ? await teacherGet<Report>(reportPath)
      : await adminGet<Report>(reportPath);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "加载报告失败"); }
  finally { loading.value = false; }
}
async function viewCode(row: Submission) {
  codeDialog.value = true;
  codeLoading.value = true;
  code.value = "";
  codeLanguage.value = monacoLanguage(row.language);
  try {
    code.value = teacherMode.value
      ? await teacherGet<string>(`/api/teacher/v1/submissions/${row.id}/code`)
      : await adminGet<string>(`/api/admin/v1/submissions/${row.id}/code`);
  } catch { code.value = "加载代码失败"; }
  finally { codeLoading.value = false; }
}
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function exportRows(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
function exportRankings() {
  if (!report.value?.rankings.length) return;
  exportRows(`publication_${reportId.value}_rankings.csv`, ["排名", "用户ID", "用户名", "得分", "通过题数", "提交次数"], report.value.rankings.map((row, index) => [index + 1, row.userId, row.displayName, row.score, row.solved, row.submissionCount]));
}
function exportSubmissions() {
  if (!report.value?.submissions.length) return;
  exportRows(`publication_${reportId.value}_submissions.csv`, ["提交ID", "用户ID", "用户名", "题目ID", "题目名称", "语言", "状态", "耗时(ms)", "内存(KB)", "提交时间"], report.value.submissions.map(row => [row.id, row.userId, row.displayName, row.problemId, row.problemTitle, languageLabel(row.language), row.status, row.timeUsed, row.memoryUsed, row.createdAt]));
}
function statusType(status: string) {
  if (["AC", "ACCEPTED"].includes(status)) return "success";
  if (["TLE", "MLE", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED"].includes(status)) return "warning";
  if (["WA", "WRONG_ANSWER", "RE", "RUNTIME_ERROR"].includes(status)) return "danger";
  return "info";
}
watch(() => route.fullPath, () => { void load(); }, { immediate: true });
</script>

<template>
    <section class="report-page page-container"><el-row v-loading="loading" :gutter="14"><el-col :xs="24" :sm="8"><el-card shadow="never"><el-statistic title="参与人数" :value="report?.participantCount??0"/></el-card></el-col><el-col :xs="24" :sm="8"><el-card shadow="never"><el-statistic title="总提交数" :value="report?.submissionCount??0"/></el-card></el-col><el-col :xs="24" :sm="8"><el-card shadow="never"><el-statistic title="通过题数（最高）" :value="report?.rankings?.length?Math.max(...report.rankings.map(row=>row.solved)):0"/></el-card></el-col></el-row>
    <el-card shadow="never"><template #header><div class="management-card-heading"><div class="management-card-title"><div class="card-header"><strong>学生排名</strong><el-button :disabled="!report?.rankings.length" @click="exportRankings">导出排名 CSV</el-button></div></div><div class="management-card-actions"><header class="page-heading"><div><el-button @click="router.push(backPath)">返回</el-button></div></header></div></div></template><el-table v-loading="loading" :data="report?.rankings??[]" stripe><el-table-column label="排名" width="90"><template #default="{ $index }"><el-tag :type="$index<3?'warning':'info'">#{{$index+1}}</el-tag></template></el-table-column><el-table-column prop="displayName" label="用户名" min-width="150"/><el-table-column prop="score" label="得分" width="100" sortable/><el-table-column prop="solved" label="通过题数" width="110"/><el-table-column prop="submissionCount" label="提交次数" width="110"/></el-table><el-empty v-if="!loading&&!report?.rankings.length" description="暂无排名数据"/></el-card>
    <el-card shadow="never"><template #header><div class="card-header"><strong>提交记录</strong><el-button :disabled="!report?.submissions.length" @click="exportSubmissions">导出提交 CSV</el-button></div></template><el-table v-loading="loading" :data="report?.submissions??[]" stripe><el-table-column v-if="teacherMode" prop="id" label="提交 ID" width="100"/><el-table-column prop="displayName" label="用户" min-width="130"/><el-table-column prop="problemTitle" label="题目" min-width="180"/><el-table-column label="语言" width="100"><template #default="{row}">{{languageLabel(row.language)}}</template></el-table-column><el-table-column prop="status" label="状态" width="130"><template #default="{row}"><el-tag :type="statusType(row.status)">{{row.status}}</el-tag></template></el-table-column><el-table-column label="耗时" width="100"><template #default="{row}">{{row.timeUsed?`${row.timeUsed}ms`:"-"}}</template></el-table-column><el-table-column label="内存" width="110"><template #default="{row}">{{row.memoryUsed?`${row.memoryUsed}KB`:"-"}}</template></el-table-column><el-table-column label="提交时间" min-width="165"><template #default="{row}">{{row.createdAt?formatDisplayDate(row.createdAt):"-"}}</template></el-table-column><el-table-column label="代码" width="90"><template #default="{row}"><el-button link type="primary" @click="viewCode(row)">查看</el-button></template></el-table-column></el-table><el-empty v-if="!loading&&!report?.submissions.length" description="暂无提交记录"/></el-card>
    
<el-dialog class="qoj-management-dialog" v-model="codeDialog" title="提交代码" width="min(1000px, 92vw)"><el-skeleton v-if="codeLoading" :rows="8" animated/><div v-else class="code-viewer"><CodeEditor v-model="code" :language="codeLanguage" read-only/></div></el-dialog>
  </section>
</template>

<style scoped>
.report-page{display:flex;flex-direction:column;gap:16px}.page-heading,.card-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.code-viewer{height:60vh;min-height:360px}
</style>

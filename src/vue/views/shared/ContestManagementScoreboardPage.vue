<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminGet } from "../../../admin/api/adminClient";
import { teacherGet } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import type { ContestScoreboard } from "../../../data/apiClient";

const props = withDefaults(defineProps<{ portal?: "admin" | "teacher" }>(), { portal: "admin" });
const route = useRoute();
const router = useRouter();
const board = ref<ContestScoreboard | null>(null);
const loading = ref(false);
const error = ref("");
const classFilter = ref("");
const nameFilter = ref("");
const page = ref(1);
const pageSize = ref(10);
const classes = computed(() => Array.from(new Map((board.value?.rows ?? []).map(row =>
  [String(row.classId ?? "none"), { id: String(row.classId ?? "none"), name: row.className || "未分班" }])).values()));
const rows = computed(() => (board.value?.rows ?? []).filter(row =>
  (!classFilter.value || String(row.classId ?? "none") === classFilter.value)
  && (!nameFilter.value.trim() || row.displayName?.toLocaleLowerCase().includes(nameFilter.value.trim().toLocaleLowerCase()))));
const pagedRows = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch([classFilter, nameFilter, pageSize], () => { page.value = 1; });
watch(() => rows.value.length, total => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))); });
function score(row: ContestScoreboard["rows"][number], problem: ContestScoreboard["problems"][number]) {
  const cell = row.cells.find(item => (item.contestProblemId ?? item.problemId) === (problem.contestProblemId ?? problem.problemId));
  return board.value?.type === "ACM" ? (cell?.accepted ? 100 : 0) : cell?.score ?? 0;
}
async function load() {
  loading.value = true;
  error.value = "";
  board.value = null;
  try {
    board.value = await (props.portal === "teacher" ? teacherGet : adminGet)<ContestScoreboard>(`/api/admin/v1/contests/${Number(route.params.contestId)}/management-scoreboard`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "榜单加载失败";
  } finally { loading.value = false; }
}
watch(() => route.params.contestId, () => { classFilter.value = ""; nameFilter.value = ""; void load(); }, { immediate: true });
</script>

<template>
  <main class="page-container ranking-page">
    <el-card shadow="never" class="ranking-card">
      <template #header><div class="management-card-heading">
        <div class="management-card-title"><strong>{{ board ? `${board.title} · 完整榜单` : '比赛完整榜单' }}</strong></div>
        <div class="management-card-actions"><el-button @click="router.push(props.portal === 'teacher' ? `/teacher/contests/${route.params.contestId}` : adminPath(`/contests/${route.params.contestId}`))">返回比赛</el-button></div>
      </div></template>
      <div class="ranking-filters toolbar">

        <el-select v-model="classFilter" clearable placeholder="全部班级" aria-label="筛选班级" class="ranking-filter-field"><el-option v-for="item in classes" :key="item.id" :label="item.name" :value="item.id" /></el-select>
        <el-input v-model="nameFilter" clearable placeholder="搜索姓名" aria-label="搜索姓名" class="ranking-filter-field" />
        <el-button @click="classFilter='';nameFilter=''">重置筛选</el-button>
        <el-button :loading="loading" @click="load">刷新榜单</el-button>
        <span>共 {{ rows.length }} 人</span>
      </div>
      <el-skeleton v-if="loading" :rows="5" animated />
      <el-alert v-else-if="error" :title="error" type="error" :closable="false" />
      <template v-else-if="board">
        <table class="management-score-table">
          <thead><tr><th>排名</th><th>姓名</th><th>班级</th><th>总分</th><th v-for="problem in board.problems" :key="problem.contestProblemId ?? problem.problemId" :title="problem.title" class="problem-column">{{ problem.label }}<span class="problem-max-score">{{ board.type === 'ACM' ? 100 : problem.score ?? 0 }}分</span></th></tr></thead>
          <tbody>
            <tr v-for="row in pagedRows" :key="row.userId">
              <td data-label="排名">{{ row.starred ? '打星' : row.rank }}</td>
              <td data-label="姓名">{{ row.displayName }}</td>
              <td data-label="班级">{{ row.className || '未分班' }}</td>
              <td data-label="总分">{{ row.score }}</td>
              <td v-for="problem in board.problems" :key="problem.contestProblemId ?? problem.problemId" class="problem-column">{{ score(row, problem) }}</td>
            </tr>
          </tbody>
        </table>
        <el-empty v-if="!rows.length" description="暂无符合条件的参赛者" />
        <div class="ranking-pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10,20,50]" :total="rows.length" layout="total, sizes, prev, pager, next" :pager-count="5" /></div>
      </template>
    </el-card>
  </main>
</template>

<style scoped>
.ranking-page{display:flex;flex-direction:column;min-width:0;box-sizing:border-box}
.ranking-card{min-width:0}
.ranking-filters{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.ranking-filter-field{width:220px;max-width:100%}
.ranking-filters :deep(.el-button){margin:0}
.management-score-table{width:100%;table-layout:fixed;border-collapse:collapse;color:var(--el-text-color-regular)}
.management-score-table th,.management-score-table td{padding:12px;text-align:left;border-bottom:1px solid var(--el-border-color-lighter);overflow-wrap:anywhere}
.management-score-table th{background:var(--el-fill-color-light)}
.management-score-table th:nth-child(1){width:7%}.management-score-table th:nth-child(2){width:16%}.management-score-table th:nth-child(3){width:16%}.management-score-table th:nth-child(4){width:8%}
.management-score-table tbody tr:nth-child(even){background:var(--el-fill-color-lighter)}
.management-score-table .problem-column{text-align:center;padding-inline:4px}
.problem-max-score{display:block;white-space:normal;word-break:break-all;line-break:anywhere;overflow-wrap:anywhere;font-size:12px;font-weight:400;color:var(--el-text-color-secondary)}
.ranking-pagination{display:flex;justify-content:flex-end;margin-top:20px;min-width:0}
.ranking-pagination :deep(.el-pagination){flex-wrap:wrap;gap:8px;white-space:normal}
@media(max-width:640px){
  .management-score-table th,.management-score-table td{padding:8px 2px;font-size:12px}
  .management-score-table th:nth-child(1){width:9%}.management-score-table th:nth-child(2){width:17%}.management-score-table th:nth-child(3){width:17%}.management-score-table th:nth-child(4){width:10%}
  .problem-max-score{font-size:10px}
  .ranking-pagination{justify-content:flex-start}
}
</style>

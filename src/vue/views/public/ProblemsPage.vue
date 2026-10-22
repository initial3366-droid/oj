<script setup lang="ts">
import { openFrontendPage } from "../../../api/frontendSessionSync";
import { computed, onMounted, ref, watch } from "vue";
import { Search } from "@element-plus/icons-vue";
import { fetchProblems } from "../../../data/apiClient";
import type { Difficulty, Problem } from "../../../data/types";
import "../../../pages/ProblemsPage.css";

type AttemptState = "passed" | "failed" | "unattempted";
const DIFFICULTIES: Difficulty[] = ["入门", "简单", "中等", "困难", "地狱"];
const ATTEMPT_OPTIONS = [
  { value: "failed", label: "未通过" },
  { value: "passed", label: "通过" },
  { value: "unattempted", label: "未尝试" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const sourceProblems = ref<Problem[]>([]);
const keyword = ref("");
const selectedDifficulties = ref<Difficulty[]>([]);
const selectedTags = ref<string[]>([]);
const selectedAttemptState = ref<AttemptState | "">("");
const message = ref("");
const loading = ref(true);
const currentPage = ref(1);
const pageSize = ref(20);

function getAttemptState(status?: string | null): AttemptState {
  const normalized = status?.trim().toUpperCase();
  if (!normalized) return "unattempted";
  return normalized === "AC" || normalized === "ACCEPTED" ? "passed" : "failed";
}
const allTags = computed(() => {
  const counts = new Map<string, number>();
  for (const problem of sourceProblems.value) for (const tag of problem.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
});
const problems = computed(() => {
  const normalized = keyword.value.trim().toLowerCase();
  return sourceProblems.value.filter((problem) => {
    if (normalized && !problem.title.toLowerCase().includes(normalized) && !problem.tags.some((tag) => tag.toLowerCase().includes(normalized))) return false;
    if (selectedDifficulties.value.length && !selectedDifficulties.value.includes(problem.difficulty)) return false;
    if (selectedTags.value.length && !selectedTags.value.every((tag) => problem.tags.includes(tag))) return false;
    if (selectedAttemptState.value && getAttemptState(problem.attemptStatus) !== selectedAttemptState.value) return false;
    return true;
  });
});
const pageCount = computed(() => Math.max(1, Math.ceil(problems.value.length / pageSize.value)));
const pagedProblems = computed(() => problems.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value));
const currentStart = computed(() => problems.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0);
const currentEnd = computed(() => Math.min(currentPage.value * pageSize.value, problems.value.length));

async function loadProblems() {
  loading.value = true;
  try {
    const data = await fetchProblems();
    sourceProblems.value = data;
    const remainingTags = new Set(data.flatMap((problem) => problem.tags));
    selectedTags.value = selectedTags.value.filter((tag) => remainingTags.has(tag));
    message.value = "";
  } catch (error) {
    sourceProblems.value = [];
    message.value = error instanceof Error ? error.message : "题库加载失败";
  } finally {
    loading.value = false;
  }
}

watch([keyword, selectedDifficulties, selectedTags, selectedAttemptState], () => { currentPage.value = 1; });
function difficultyType(difficulty: string) {
  const value = difficulty.toLowerCase();
  if (value.includes("简单") || value === "easy" || value === "入门") return "success";
  if (value.includes("中等") || value === "medium") return "warning";
  if (value.includes("困难") || value === "hard" || value === "地狱") return "danger";
  return "info";
}
function attemptType(problem: Problem) {
  const state = getAttemptState(problem.attemptStatus);
  return state === "passed" ? "success" : state === "failed" ? "danger" : "info";
}
function attemptLabel(problem: Problem) {
  const state = getAttemptState(problem.attemptStatus);
  return state === "passed" ? "已通过" : state === "failed" ? "未通过" : "未尝试";
}
function openProblem(id: string) { openFrontendPage(`/practice/problem/${encodeURIComponent(id)}`); }

onMounted(() => { void loadProblems(); });
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">题库</h1></div></div></header>
    <el-alert v-if="message" class="problems-notice" type="error" :title="message" show-icon :closable="false" />
    <div class="problems-toolbar">
      <el-input v-model="keyword" class="problems-search" aria-label="搜索题目或标签" placeholder="搜索题目或标签" clearable><template #prefix><el-icon><Search /></el-icon></template></el-input>
      <el-select v-model="selectedDifficulties" class="problems-filter" multiple collapse-tags collapse-tags-tooltip clearable placeholder="难度" aria-label="筛选难度"><el-option v-for="difficulty in DIFFICULTIES" :key="difficulty" :label="difficulty" :value="difficulty" /></el-select>
      <el-select v-model="selectedTags" class="problems-filter problems-tags-filter" multiple collapse-tags collapse-tags-tooltip filterable clearable placeholder="标签" aria-label="筛选标签"><el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" /></el-select>
      <el-select v-model="selectedAttemptState" class="problems-filter problems-status-filter" clearable placeholder="是否通过" aria-label="筛选是否通过"><el-option label="全部状态" value="" /> <el-option v-for="item in ATTEMPT_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select>
      <el-button v-if="selectedDifficulties.length || selectedTags.length || selectedAttemptState || keyword" text @click="keyword = ''; selectedDifficulties = []; selectedTags = []; selectedAttemptState = ''">清除筛选</el-button>
      <el-button :loading="loading" @click="loadProblems">刷新</el-button>
      <span class="problems-count">共 {{ problems.length }} 题</span>
    </div>
    <div v-if="loading" class="problems-empty" role="status">题库加载中…</div>
    <div v-else class="problems-table-wrap">
      <el-table class="problems-table" :data="pagedProblems" row-key="id" stripe :empty-text="keyword || selectedDifficulties.length || selectedTags.length || selectedAttemptState ? '未找到匹配的题目，试试调整筛选条件' : '暂无题目'">
        <el-table-column label="题目" min-width="210" align="center" show-overflow-tooltip><template #default="{ row }"><button class="problems-title-link" type="button" @click="openProblem(row.id)">{{ row.title }}</button></template></el-table-column>
        <el-table-column label="标签" min-width="210" align="center" show-overflow-tooltip><template #default="{ row }"><div class="problems-tags"><span v-for="tag in row.tags" :key="tag" class="problems-tag">{{ tag }}</span></div></template></el-table-column>
        <el-table-column label="难度" min-width="120" align="center"><template #default="{ row }"><el-tag :type="difficultyType(row.difficulty)">{{ row.difficulty }}</el-tag></template></el-table-column>
        <el-table-column label="是否通过" min-width="130" align="center"><template #default="{ row }"><el-tag :type="attemptType(row)">{{ attemptLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column label="AC 率" min-width="100" align="center"><template #default="{ row }">{{ row.acRate }}%</template></el-table-column>
        <el-table-column label="操作" width="100" align="center"><template #default="{ row }"><button class="problems-action-link" type="button" @click="openProblem(row.id)">答题</button></template></el-table-column>
      </el-table>
    </div>
    <div v-if="problems.length && !loading" class="problems-pagination">
      <span>显示第 {{ currentStart }} 条-第 {{ currentEnd }} 条，共 {{ problems.length }} 条</span>
      <div class="problems-pagination-controls"><label>每页 <el-select v-model="pageSize" aria-label="每页题数" style="width:84px"><el-option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :label="size" :value="size" /></el-select> 条</label><el-button :disabled="currentPage <= 1" aria-label="上一页" @click="currentPage -= 1">‹</el-button><span>{{ currentPage }} / {{ pageCount }}</span><el-button :disabled="currentPage >= pageCount" aria-label="下一页" @click="currentPage += 1">›</el-button></div>
    </div>
  </section>
</template>

<style scoped>
.problems-table :deep(.el-table__cell .cell){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.problems-table .problems-tags{display:flex;flex-wrap:nowrap;justify-content:center}
.problems-title-link{white-space:nowrap}

.page-container { width: 100%; }
.problems-toolbar { align-items: center; }
.problems-search { width: min(100%, 280px); }
.problems-filter { width: 208px; min-width: 208px; }
.problems-tags-filter { width: 240px; }
.problems-status-filter { width: 150px; }
.problems-count { margin-left: auto; color: var(--qoj-color-text-2); font-size: 13px; }
.problems-table-wrap { overflow-x: auto; }
.problems-title-link, .problems-action-link { border: 0; padding: 0; background: transparent; color: var(--qoj-color-text-0); font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
.problems-title-link:hover, .problems-action-link:hover { color: var(--qoj-color-primary); }
.problems-action-link { color: var(--qoj-color-primary); }
.problems-pagination-controls label { display: flex; align-items: center; gap: 6px; }
.problems-pagination-controls .el-button { margin: 0; }
@media (max-width:680px) { .problems-search, .problems-filter, .problems-tags-filter, .problems-status-filter { width: 100%; } .problems-count { margin-left: 0; } }
</style>

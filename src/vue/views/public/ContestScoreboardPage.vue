<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, CaretBottom, Loading } from "@element-plus/icons-vue";
import { fetchContestScoreboard, type ContestScoreboard, type ContestScoreboardCell, type ContestScoreboardProblem, type ContestScoreboardRow } from "../../../data/apiClient";
import { formatDisplayDateTime } from "../../../lib/format";

const route = useRoute();
const router = useRouter();
const contestId = computed(() => Number(route.params.contestId));
const scoreboard = ref<ContestScoreboard | null>(null);
const loading = ref(true);
const message = ref("");
watch(contestId, async (id, _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  scoreboard.value = null;
  message.value = "";
  loading.value = true;
  if (!Number.isSafeInteger(id) || id <= 0) { message.value = "比赛不存在"; loading.value = false; return; }
  try { scoreboard.value = await fetchContestScoreboard(id); }
  catch (error) { message.value = error instanceof Error ? error.message : "榜单加载失败"; }
  finally { if (live) loading.value = false; }
}, { immediate: true });

function statusText(status: ContestScoreboard["status"]) { return status === "RUNNING" ? "进行中" : status === "ENDED" ? "已结束" : "未开始"; }
function medalText(medal?: ContestScoreboardRow["medal"]) { return medal === "GOLD" ? "金" : medal === "SILVER" ? "银" : medal === "BRONZE" ? "铜" : "-"; }
function medalType(medal?: ContestScoreboardRow["medal"]) { return medal === "GOLD" ? "warning" : medal === "SILVER" ? "info" : medal === "BRONZE" ? "success" : "info"; }
function problemId(problem: ContestScoreboardProblem | ContestScoreboardCell) { return problem.contestProblemId ?? problem.problemId; }
function cell(row: ContestScoreboardRow, problem: ContestScoreboardProblem) {
  return row.cells.find((item) => problemId(item) === problemId(problem));
}
function cellClass(scoreboard: ContestScoreboard, item?: ContestScoreboardCell) {
  if (!item) return "scoreboard-cell-empty";
  if (item.hasHiddenSubmissions) return "scoreboard-cell-hidden";
  if (item.accepted) return "scoreboard-cell-accepted";
  if (scoreboard.type !== "ACM" && item.score > 0) return "scoreboard-cell-partial";
  if (item.attempts > 0) return "scoreboard-cell-failed";
  return "scoreboard-cell-empty";
}
function cellText(scoreboard: ContestScoreboard, item?: ContestScoreboardCell) {
  if (!item) return "-";
  if (item.hasHiddenSubmissions) return `+ ${item.hiddenAttempts ?? 0} tries`;
  if (scoreboard.type !== "ACM") return item.attempts > 0 ? item.score : "-";
  if (item.accepted) return `+${item.attempts > 1 ? item.attempts - 1 : ""}`;
  return item.attempts > 0 ? `-${item.attempts}` : "-";
}
function rankText(row: ContestScoreboardRow) { return row.starred ? "打星" : row.rank ?? "-"; }
usePageTitle(computed(() => scoreboard.value ? `${scoreboard.value.title} - 实时榜单` : null));
</script>

<template>
  <section v-if="loading" class="scoreboard-loading page-container" role="status"><el-icon class="is-loading"><Loading /></el-icon><span>榜单加载中</span></section>
  <el-alert v-else-if="!scoreboard" type="error" :title="message || '榜单不存在'" :closable="false" />
  <div v-else class="contest-scoreboard-page">
    <el-button @click="router.push('/contests')"><el-icon><ArrowLeft /></el-icon>返回比赛</el-button>
    <el-card shadow="never" class="scoreboard-summary">
      <div class="scoreboard-summary-header">
        <div><div class="scoreboard-tags"><el-tag type="primary">{{ scoreboard.type }}</el-tag><el-tag>{{ statusText(scoreboard.status) }}</el-tag></div><h1>{{ scoreboard.title }}</h1><p>{{ formatDisplayDateTime(scoreboard.startTime) }} - {{ formatDisplayDateTime(scoreboard.endTime) }} · {{ scoreboard.durationMinutes }} 分钟</p></div>
        <div class="public-scoreboard-label"><el-icon><CaretBottom /></el-icon><span>Public Scoreboard</span></div>
      </div>
    </el-card>
    <el-alert v-if="scoreboard.boardState === 'FROZEN'" type="warning" title="已经封榜" :closable="false" />
    <div class="scoreboard-table-wrap">
      <el-table :data="scoreboard.rows" row-key="userId" stripe empty-text="暂无提交数据" table-layout="auto">
        <el-table-column label="Rank" width="88" fixed="left" align="center"><template #default="{ row }">{{ rankText(row) }}</template></el-table-column>
        <el-table-column label="Medal" width="88" align="center"><template #default="{ row }"><el-tag v-if="row.medal" :type="medalType(row.medal)">{{ medalText(row.medal) }}</el-tag><span v-else>-</span></template></el-table-column>
        <el-table-column label="User" width="220" align="center"><template #default="{ row }"><div class="scoreboard-user"><strong>{{ row.displayName || row.userId }}</strong><small>个人{{ row.starred ? " · 打星" : "" }}</small></div></template></el-table-column>
        <el-table-column prop="solved" label="Solved" width="88" align="center" />
        <el-table-column :label="scoreboard.type !== 'ACM' ? 'Score' : 'Penalty'" prop="penalty" width="96" align="center"><template #default="{ row }">{{ scoreboard.type !== "ACM" ? row.score : row.penalty }}</template></el-table-column>
        <el-table-column v-for="problem in scoreboard.problems" :key="problemId(problem)" :label="problem.label" min-width="76" align="center">
          <template #header><div :title="problem.title"><strong>{{ problem.label }}</strong><small v-if="scoreboard.type !== 'ACM'">{{ problem.score ?? 0 }}</small></div></template>
          <template #default="{ row }"><div :class="['scoreboard-cell', cellClass(scoreboard, cell(row, problem))]">{{ cellText(scoreboard, cell(row, problem)) }}</div></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.scoreboard-loading { min-height: 50vh; display: grid; place-content: center; justify-items: center; gap: 12px; color: var(--qoj-color-text-2); }
.scoreboard-loading .el-icon { font-size: 28px; }
.contest-scoreboard-page { display: flex; flex-direction: column; gap: 20px; }
.scoreboard-summary { border: 1px solid var(--qoj-color-border); }
.scoreboard-summary-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.scoreboard-tags { display: flex; gap: 8px; }
.scoreboard-summary h1 { margin: 12px 0 0; font-size: 26px; }
.scoreboard-summary p { margin: 8px 0 0; color: var(--qoj-color-text-2); }
.public-scoreboard-label { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; background: var(--qoj-color-warning-light-default); color: var(--qoj-color-warning-dark); }
.scoreboard-table-wrap { min-width: 0; overflow: hidden; border: 1px solid var(--front-table-border,#cbd8e8); border-radius: 14px; background: var(--content-bg); }
.scoreboard-user { display: flex; flex-direction: column; gap: 4px; }
.scoreboard-user small { color: var(--qoj-color-text-2); }
.scoreboard-cell { display: flex; align-items: center; justify-content: center; min-height: 32px; margin: 0 auto; border-radius: 6px; padding: 4px 6px; font-size: 12px; font-weight: 600; }
.scoreboard-cell-accepted { background: var(--qoj-color-success-light-default); color: var(--qoj-color-success-dark); }
.scoreboard-cell-hidden { min-height: 48px; flex-direction: column; background: var(--el-color-primary-light-9); border: 1px solid #91caff; color: var(--el-color-primary); }
.scoreboard-cell-partial { background: var(--qoj-color-warning-light-default); color: var(--qoj-color-warning-dark); }
.scoreboard-cell-failed { background: var(--qoj-color-danger-light-default); color: var(--qoj-color-danger-dark); }
.scoreboard-cell-empty { background: var(--qoj-color-fill-0); color: var(--qoj-color-text-2); }
.scoreboard-table-wrap :deep(.el-table th:first-child), .scoreboard-table-wrap :deep(.el-table td:first-child) { position: sticky; left: 0; z-index: 3; }
</style>

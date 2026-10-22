<script setup lang="ts">
import { usePageTitle } from "../../composables/usePageTitle";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { Lock, Refresh, Star } from "@element-plus/icons-vue";
import { fetchContestPublicScoreboard, type ContestPublicScoreboard, type ContestPublicScoreboardProblemStatus, type ContestPublicScoreboardRow } from "../../../data/apiClient";
import EmailBindingGate from "../../components/EmailBindingGate.vue";

const route = useRoute();
const scoreboard = ref<ContestPublicScoreboard | null>(null);
const loading = ref(false);
const message = ref("");
const contestId = computed(() => Number(route.params.contestId));
const isOi = computed(() => scoreboard.value?.contestType === "OI");
const showClass = computed(() => Boolean(scoreboard.value?.showClassOnScoreboard));
const boardState = computed(() => scoreboard.value?.boardState ?? "LIVE");

async function load() {
  const id = contestId.value;
  if (!Number.isSafeInteger(id) || id < 1) {
    scoreboard.value = null;
    message.value = "比赛不存在";
    return;
  }
  loading.value = true;
  try {
    scoreboard.value = await fetchContestPublicScoreboard(id);
    message.value = "";
  } catch (error) {
    scoreboard.value = null;
    message.value = error instanceof Error ? error.message : "外榜加载失败";
  } finally {
    loading.value = false;
  }
}
watch(contestId, () => { void load(); }, { immediate: true });

function rowKey(row: ContestPublicScoreboardRow) { return `${row.userId}-${row.username}`; }
function rowStyle({ row }: { row: ContestPublicScoreboardRow }) { return row.revealed === false ? { opacity: 0.82 } : undefined; }
function rankText(row: ContestPublicScoreboardRow) { return row.starred ? "打星" : row.rank ?? "-"; }
function stateText(state: string) {
  return state === "FROZEN" ? "封榜中" : state === "ROLLING" ? "滚榜中" : state === "FINAL" ? "最终榜" : "实时榜";
}
function stateTag(state: string) { return state === "FROZEN" ? "warning" : state === "ROLLING" ? "primary" : state === "FINAL" ? "success" : "info"; }
function acceptedTimestamp(startTime: string, status?: ContestPublicScoreboardProblemStatus) {
  if (!status?.accepted) return null;
  if (status.acceptedAt) {
    const timestamp = new Date(status.acceptedAt).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  if (status.timeMinutes != null) {
    const start = new Date(startTime).getTime();
    if (Number.isFinite(start)) return start + Math.max(0, status.timeMinutes) * 60_000;
  }
  return null;
}
function acceptedMinute(startTime: string, status?: ContestPublicScoreboardProblemStatus) {
  if (!status?.accepted) return null;
  if (status.timeMinutes != null) return Math.max(0, Math.floor(status.timeMinutes));
  const timestamp = acceptedTimestamp(startTime, status);
  const start = new Date(startTime).getTime();
  return timestamp != null && Number.isFinite(start) ? Math.max(0, Math.floor((timestamp - start) / 60_000)) : null;
}
const firstBloodByProblem = computed(() => {
  const first = new Map<string, { key: string; time: number }>();
  const board = scoreboard.value;
  if (!board) return new Map<string, string>();
  for (const row of board.rows) {
    for (const problem of board.problems) {
      const time = acceptedTimestamp(board.startTime, row.problems?.[problem.label]);
      if (time == null) continue;
      const current = first.get(problem.label);
      if (!current || time < current.time) first.set(problem.label, { key: rowKey(row), time });
    }
  }
  return new Map(Array.from(first, ([label, value]) => [label, value.key]));
});
const problemStats = computed(() => {
  const result = new Map<string, { submissions: number; accepted: number }>();
  const board = scoreboard.value;
  if (!board) return result;
  board.problems.forEach((problem) => result.set(problem.label, { submissions: 0, accepted: 0 }));
  board.rows.forEach((row) => board.problems.forEach((problem) => {
    const status = row.problems?.[problem.label];
    const stat = result.get(problem.label);
    if (!stat) return;
    stat.submissions += status?.attempts ?? 0;
    if (status?.accepted) stat.accepted += 1;
  }));
  return result;
});
function problemStat(problemLabel: string, key: "submissions" | "accepted") {
  return problemStats.value.get(problemLabel)?.[key] ?? 0;
}
function statusFor(row: ContestPublicScoreboardRow, label: string) { return row.problems?.[label]; }
function isFirstBlood(row: ContestPublicScoreboardRow, label: string, status?: ContestPublicScoreboardProblemStatus) {
  return Boolean(status?.accepted && firstBloodByProblem.value.get(label) === rowKey(row));
}
function cellClass(row: ContestPublicScoreboardRow, label: string, status?: ContestPublicScoreboardProblemStatus) {
  if (status?.hasHiddenSubmissions) return "hidden";
  if (isFirstBlood(row, label, status)) return "first-blood";
  if (status?.accepted) return "accepted";
  if (isOi.value && (status?.score ?? 0) > 0) return "partial";
  if ((status?.attempts ?? 0) > 0) return "failed";
  return "empty";
}
function attemptText(attempts = 0) { return attempts === 1 ? "1 try" : `${attempts} tries`; }
function medalType(medal?: ContestPublicScoreboardRow["medal"]) {
  return medal === "GOLD" ? "warning" : medal === "SILVER" ? "info" : medal === "BRONZE" ? "success" : "info";
}
function medalText(medal?: ContestPublicScoreboardRow["medal"]) {
  return medal === "GOLD" ? "金" : medal === "SILVER" ? "银" : medal === "BRONZE" ? "铜" : "";
}
usePageTitle(computed(() => scoreboard.value ? `${scoreboard.value.contestTitle} - 公开榜单` : null));
</script>

<template>
  <EmailBindingGate>
    <div class="public-scoreboard-page">
      <div class="public-scoreboard-content">
        <el-card v-if="scoreboard" shadow="never" class="public-scoreboard-heading">
          <div class="heading-main"><el-icon><Lock /></el-icon><h1>{{ scoreboard.contestTitle }}</h1><el-tag type="primary">{{ scoreboard.contestType }}</el-tag><el-tag :type="stateTag(boardState)">{{ stateText(boardState) }}</el-tag></div>
          <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
        </el-card>
        <el-skeleton v-if="loading && !scoreboard" :rows="6" animated />
        <el-alert v-else-if="!scoreboard" type="error" :title="message || '外榜未开启'" :closable="false" />
        <template v-else>
          <el-alert v-if="boardState === 'FROZEN' || boardState === 'ROLLING'" :type="boardState === 'FROZEN' ? 'warning' : 'info'" :title="boardState === 'FROZEN' ? '已经封榜' : '当前正在滚榜，只显示已揭晓参赛者的最终变化。'" :closable="false" />
          <div class="table-wrap">
            <el-table :data="scoreboard.rows" :row-key="rowKey" stripe empty-text="暂无提交数据" table-layout="auto" :row-style="rowStyle">
              <el-table-column label="排名" width="88" fixed="left" align="center"><template #default="{ row }">{{ rankText(row) }}</template></el-table-column>
              <el-table-column label="用户" width="230" align="center"><template #default="{ row }"><div class="user-cell"><div class="user-title">{{ row.displayName || row.username || row.userId }}<el-tag v-if="row.medal" :type="medalType(row.medal)" size="small" class="medal-badge">{{ medalText(row.medal) }}</el-tag><el-tag v-if="row.teamName" type="info" size="small" effect="plain" class="team-badge">{{ row.teamName }}</el-tag><el-tag v-if="scoreboard.problems.length > 0 && row.solved === scoreboard.problems.length" type="warning" size="small">AK</el-tag></div><small>个人{{ row.starred ? ' · 打星' : '' }}</small></div></template></el-table-column>
              <el-table-column v-if="showClass" prop="className" label="班级" width="170" align="center"><template #default="{ row }">{{ row.className || '-' }}</template></el-table-column>
              <el-table-column prop="solved" label="通过" width="88" align="center" />
              <el-table-column :label="isOi ? '分数' : '时间'" :prop="isOi ? 'totalScore' : 'penalty'" width="96" align="center" />
              <el-table-column v-for="problem in scoreboard.problems" :key="problem.label" :min-width="isOi ? 96 : 84" align="center" class-name="problem-column">
                <template #header><div class="problem-heading" :title="problem.title"><strong>{{ problem.label }}</strong><small>提交 {{ problem.submissionCount ?? problemStat(problem.label, 'submissions') }} / 通过 {{ problem.acceptedCount ?? problemStat(problem.label, 'accepted') }}</small><small v-if="isOi">{{ problem.score ?? 0 }} 分</small></div></template>
                <template #default="{ row }"><div class="problem-cell" :class="cellClass(row, problem.label, statusFor(row, problem.label))" :title="statusFor(row, problem.label)?.hasHiddenSubmissions ? '封榜后有提交' : isFirstBlood(row, problem.label, statusFor(row, problem.label)) ? '一血' : statusFor(row, problem.label)?.accepted ? '已通过' : (statusFor(row, problem.label)?.attempts ?? 0) > 0 ? '未通过' : '暂无提交'">
                  <el-icon v-if="isFirstBlood(row, problem.label, statusFor(row, problem.label)) && !statusFor(row, problem.label)?.hasHiddenSubmissions" class="first-blood-icon"><Star /></el-icon>
                  <template v-if="statusFor(row, problem.label)?.hasHiddenSubmissions"><span>+</span><small>{{ attemptText(statusFor(row, problem.label)?.hiddenAttempts) }}</small></template>
                  <template v-else><span>{{ statusFor(row, problem.label)?.accepted && acceptedMinute(scoreboard.startTime, statusFor(row, problem.label)) != null ? `${acceptedMinute(scoreboard.startTime, statusFor(row, problem.label))} min` : '-' }}</span><small v-if="isOi && (statusFor(row, problem.label)?.attempts ?? 0) > 0">{{ statusFor(row, problem.label)?.score ?? 0 }} pts</small><small>{{ attemptText(statusFor(row, problem.label)?.attempts) }}</small></template>
                </div></template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </div>
    </div>
  </EmailBindingGate>
</template>

<style scoped>
.public-scoreboard-page { min-height: 100vh; padding: 24px; background: var(--qoj-color-bg-1); }
.public-scoreboard-content { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.public-scoreboard-heading { border: 1px solid var(--qoj-color-border); }
.public-scoreboard-heading :deep(.el-card__body), .heading-main { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.heading-main { justify-content: flex-start; flex-wrap: wrap; }
.heading-main h1 { margin: 0; font-size: 20px; }
.heading-main > .el-icon { color: var(--qoj-color-primary); }
.table-wrap { overflow: auto; border: 1px solid var(--front-table-border,#cbd8e8); border-radius: 12px; background: var(--content-bg); }
/* 题目列收紧内边距，让相邻题目格间距从 32px 降到 12px 左右。 */
.table-wrap :deep(.problem-column .cell) { padding: 0 2px; }
.user-cell, .problem-heading { display: flex; align-items: center; flex-direction: column; gap: 4px; }
.user-title { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; }
.medal-badge, .team-badge { flex: none; }
.team-badge { max-width: 116px; }
.team-badge :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-cell small, .problem-heading small { color: var(--qoj-color-text-2); font-size: 11px; font-weight: 400; white-space: nowrap; }
.problem-cell { position: relative; display: flex; min-width: 66px; width: calc(100% - 8px); min-height: 64px; margin: 5px 4px; padding: 6px; align-items: center; justify-content: center; flex-direction: column; gap: 2px; border: 1px solid transparent; border-radius: 6px; font-size: 13px; font-weight: 600; }
.problem-cell small { color: inherit; font-size: 11px; font-weight: 400; opacity: .82; white-space: nowrap; }
.problem-cell.hidden { background: var(--el-color-primary-light-9); border-color: #91caff; color: var(--el-color-primary); }
.problem-cell.first-blood { background: #047857; border-color: #065f46; color:var(--el-color-white); }
.problem-cell.accepted { background: #a7f3d0; border-color: #6ee7b7; color: #065f46; }
.problem-cell.partial { background: var(--qoj-color-warning-light-default); color: var(--qoj-color-warning-dark); }
.problem-cell.failed { background: var(--qoj-color-danger-light-default); color: var(--qoj-color-danger-dark); }
.problem-cell.empty { background: var(--qoj-color-fill-0); color: var(--qoj-color-text-2); }
.first-blood-icon { position: absolute; top: 4px; left: 5px; color: var(--el-color-warning-light-9); font-size: 10px; }
@media(max-width: 768px) { .public-scoreboard-page { padding: 14px; } .heading-main h1 { width: 100%; font-size: 18px; } }
</style>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { School, Search, Trophy } from "@element-plus/icons-vue";
import { fetchClassLeaderboard, fetchGlobalLeaderboard, type ClassRank, type RatingUser } from "../../../api/rank";
import "../../../pages/LeaderboardPage.css";

interface RatingRow extends RatingUser { rank: number }
const router = useRouter();
const rows = ref<RatingRow[]>([]);
const classRows = ref<ClassRank[]>([]);
const loading = ref(true);
const message = ref("");
const classMessage = ref("");
const keyword = ref("");
const classFilter = ref("all");
const page = ref(1);
const pageSize = ref(10);
let generation = 0;

async function load() {
  const current = ++generation;
  loading.value = true;
  const [globalRank, classRank] = await Promise.allSettled([fetchGlobalLeaderboard(1000), fetchClassLeaderboard(3)]);
  if (current !== generation) return;
  if (globalRank.status === "fulfilled") {
    rows.value = globalRank.value.map((item, index) => ({ ...item, rank: index + 1 }));
    message.value = "";
  } else message.value = globalRank.reason instanceof Error ? globalRank.reason.message : "个人排行榜加载失败，请重试";
  if (classRank.status === "fulfilled") { classRows.value = classRank.value; classMessage.value = ""; }
  else classMessage.value = classRank.reason instanceof Error ? classRank.reason.message : "班级排行榜加载失败，请重试";
  loading.value = false;
}

const classOptions = computed(() => [
  { label: "全部班级", value: "all" },
  ...Array.from(new Set(rows.value.map((row) => row.className).filter((name): name is string => Boolean(name))))
    .sort((a, b) => a.localeCompare(b, "zh-CN")).map((name) => ({ label: name, value: `class:${name}` })),
  ...(rows.value.some((row) => !row.className) ? [{ label: "未加入班级", value: "none" }] : []),
]);
const filtered = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return rows.value.filter((row) => (!query || (row.name || "").toLocaleLowerCase().includes(query) || String(row.userId).includes(query))
    && (classFilter.value === "all" || (classFilter.value === "none" ? !row.className : `class:${row.className}` === classFilter.value)));
});
const currentPage = computed(() => Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / pageSize.value))));
const pageRows = computed(() => filtered.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value));

function resetFilters() { keyword.value = ""; classFilter.value = "all"; page.value = 1; }
function rankTone(rank: number) { return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "normal"; }
function openUser(userId: number) { void router.push(`/users/${userId}`); }
function formatNumber(value: number) { return value.toLocaleString("zh-CN"); }

void load();
onUnmounted(() => { generation += 1; });
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header">
      <div class="page-container-title-row">
        <div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">排行榜</h1></div>
      </div>
    </header>

    <div class="leaderboard-shell">
      <el-card class="leaderboard-table-card" shadow="never">
        <template #header><div class="leaderboard-section-title"><el-icon><School /></el-icon><span>班级最多 AC<small>班内学生的非比赛 AC 之和 · 最多延迟 1 分钟更新</small></span></div></template>
        <el-alert v-if="classMessage" type="error" :title="`班级榜：${classMessage}`" :closable="false" />
        <div v-if="loading && !classRows.length" class="leaderboard-loading" role="status">班级排行榜加载中…</div>
        <div v-else class="leaderboard-table-wrap leaderboard-class-table-wrap">
          <el-table :data="classRows" row-key="classId" stripe empty-text="暂无班级排行榜数据">
            <el-table-column label="排名" width="120"><template #default="{ $index }"><span class="leaderboard-rank-badge" :class="`leaderboard-rank-${rankTone($index + 1)}`">{{ $index + 1 }}</span></template></el-table-column>
            <el-table-column prop="className" label="班级" min-width="180" />
            <el-table-column prop="teacherName" label="教师" min-width="140" />
            <el-table-column label="非比赛 AC" min-width="130"><template #default="{ row }"><span class="leaderboard-ac-count">{{ formatNumber(row.acCount) }}</span></template></el-table-column>
          </el-table>
        </div>
      </el-card>

      <el-card class="leaderboard-table-card" shadow="never">
        <template #header><div class="leaderboard-section-title"><el-icon><Trophy /></el-icon><span>所有人排行榜<small>保留榜单原始名次，筛选后不重新排名</small></span></div></template>
        <el-alert v-if="message" type="error" :title="`个人榜：${message}`" :closable="false" />
        <div class="leaderboard-toolbar">
          <div class="leaderboard-filters">
            <el-input v-model="keyword" aria-label="搜索排行榜用户" placeholder="搜索姓名或用户 ID" clearable @input="page = 1"><template #prefix><el-icon><Search /></el-icon></template></el-input>
            <el-select v-model="classFilter" aria-label="筛选排行榜班级" @change="page = 1"><el-option v-for="option in classOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
            <el-button v-if="keyword || classFilter !== 'all'" text @click="resetFilters">重置筛选</el-button>
          </div>
          <span class="leaderboard-result-count" role="status">{{ keyword || classFilter !== "all" ? `匹配 ${filtered.length} / ${rows.length} 人` : `共 ${rows.length} 人` }}</span>
        </div>
        <div v-if="loading && !rows.length" class="leaderboard-loading" role="status">个人排行榜加载中…</div>
        <div v-else class="leaderboard-table-wrap">
          <el-table class="leaderboard-table-user-lb" :data="pageRows" row-key="userId" stripe :empty-text="keyword || classFilter !== 'all' ? '没有匹配的用户，请尝试其他搜索或班级' : message ? '个人榜暂时不可用，请稍后重试' : '暂无排行榜数据'">
            <el-table-column label="排名" width="120"><template #default="{ row }"><span class="leaderboard-rank-badge" :class="`leaderboard-rank-${rankTone(row.rank)}`">{{ row.rank }}</span></template></el-table-column>
            <el-table-column label="用户" min-width="220">
              <template #default="{ row }"><button type="button" class="leaderboard-table-user" @click="openUser(row.userId)"><el-avatar :size="30" :src="row.avatarUrl || undefined">{{ (row.name?.trim() || String(row.userId)).charAt(0).toUpperCase() }}</el-avatar><strong>{{ row.name || `#${row.userId}` }}</strong></button></template>
            </el-table-column>
            <el-table-column label="班级" min-width="150"><template #default="{ row }">{{ row.className || "未加入班级" }}</template></el-table-column>
            <el-table-column label="非比赛 AC" min-width="130"><template #default="{ row }"><span class="leaderboard-ac-count">{{ formatNumber(row.acCount) }}</span></template></el-table-column>
            <el-table-column label="连续训练" min-width="130"><template #default="{ row }"><span class="leaderboard-streak">{{ row.streak ?? 0 }}<small>天</small></span></template></el-table-column>
          </el-table>
        </div>
        <div v-if="filtered.length" class="leaderboard-pagination">
          <Pagination v-model:page="page" v-model:limit="pageSize" :page-sizes="[10,20,50,100]" :total="filtered.length" />
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.page-container { width: 100%; margin: 0 auto; }
.leaderboard-description { margin: 8px 0 0; color: var(--qoj-color-text-2); }
.leaderboard-table-card :deep(.el-card__body) { padding: 0; }
.leaderboard-section-title { display: flex; align-items: flex-start; gap: 10px; }
.leaderboard-section-title > .el-icon { margin-top: 2px; color: var(--qoj-color-primary); }
.leaderboard-section-title small { display: block; margin-top: 6px; font-size: 12px; font-weight: 400; line-height: 1.6; color: var(--qoj-color-text-2); }
.leaderboard-table-wrap :deep(.el-table) { min-width: 650px; }
.leaderboard-class-table-wrap :deep(.el-table) { min-width: 520px; }
.leaderboard-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 20px 24px; border-bottom: 1px solid var(--qoj-color-border, var(--card-border)); }
.leaderboard-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; min-width: 0; }
.leaderboard-filters .el-input { width: 260px; max-width: 100%; }
.leaderboard-filters .el-select { width: 200px; max-width: 100%; }
.leaderboard-result-count { font-size: 13px; color: var(--qoj-color-text-2); white-space: nowrap; }
.leaderboard-table-user { display: inline-flex; align-items: center; gap: 10px; border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
.leaderboard-table-user:hover { color: var(--qoj-color-primary); }
.leaderboard-rank-badge { display: inline-grid; place-items: center; min-width: 34px; height: 30px; padding: 0 5px; border-radius: 9px; background: #f3f5f8; color: var(--el-text-color-secondary); font-weight: 700; font-variant-numeric: tabular-nums; }
.leaderboard-rank-gold { background: #fff1c9; color: #8a5900; }
.leaderboard-rank-silver { background: #edf1f7; color: var(--el-text-color-regular); }
.leaderboard-rank-bronze { background: #ffedde; color: #995023; }
.leaderboard-ac-count { color: var(--qoj-color-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
.leaderboard-streak small { margin-left: 5px; color: var(--qoj-color-text-2); }
.leaderboard-loading { padding: 44px 20px; text-align: center; color: var(--qoj-color-text-2); }
.leaderboard-pagination { padding: 16px 24px 20px; }
.leaderboard-pagination :deep(.pagination-container) { padding-top: 0; }
@media (max-width: 600px) { .leaderboard-shell { gap: 16px; } .leaderboard-overview { gap: 8px; } .leaderboard-overview > div { flex-direction: column; align-items: flex-start; gap: 12px; padding: 14px 12px; } .leaderboard-metric-icon { width: 34px; height: 34px; border-radius: 10px; } .leaderboard-overview strong { font-size: 22px; } .leaderboard-overview em { display: block; margin: 4px 0 0; } .leaderboard-toolbar { padding: 16px; } .leaderboard-filters { width: 100%; } .leaderboard-filters .el-input, .leaderboard-filters .el-select { width: 100%; } .leaderboard-refresh small { display: none; } }
</style>

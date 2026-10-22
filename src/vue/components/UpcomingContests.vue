<script setup lang="ts">
import { computed } from "vue";
import { useOjDataStore } from "../stores/ojData";
import { formatDisplayDateTime } from "../../lib/format";
import SectionTitle from "../../../vendor/vue3-element-admin/src/components/SectionTitle/index.vue";
const ojData = useOjDataStore();
const contests = computed(() => ojData.state.contests.slice(0, 5));
function tagType(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("进行中") || normalized === "running") return "success";
  if (normalized.includes("未开始") || normalized === "upcoming") return "warning";
  return "info";
}
</script>
<template>
  <el-card shadow="never" class="upcoming-contests">
    <template #header><div class="flex-x-between flex-wrap gap-2"><SectionTitle title="近期比赛" /><RouterLink to="/contests"><el-button text type="primary">查看全部</el-button></RouterLink></div></template>
    <div class="contest-list">
      <RouterLink v-for="contest in contests" :key="contest.id" :to="`/contests/${contest.id}`" class="contest-option">
        <div class="contest-info"><strong>{{ contest.title }}</strong><div>{{ formatDisplayDateTime(contest.startsAt) }} · {{ contest.type }} · {{ contest.audience }}</div></div>
        <el-tag :type="tagType(contest.status)">{{ contest.status }}</el-tag>
      </RouterLink>
      <el-empty v-if="!contests.length" description="暂无比赛" />
    </div>
  </el-card>
</template>

<style scoped>
.upcoming-contests{display:flex;flex-direction:column}
.upcoming-contests :deep(.el-card__body){flex:1;min-height:0;overflow:auto}
.contest-list{display:flex;flex-direction:column;gap:12px}
.contest-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:96px;padding:20px 16px;border-radius:6px;background:var(--el-fill-color-light);transition:background .15s}
.contest-option:hover,.contest-option:focus-visible{background:var(--el-color-primary-light-9)}
.contest-option:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
.contest-info{min-width:0;overflow-wrap:anywhere}
.contest-info strong{color:var(--el-color-primary);font-size:16px}
.contest-info div{margin-top:8px;font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}
.contest-option .el-tag{flex-shrink:0}
</style>

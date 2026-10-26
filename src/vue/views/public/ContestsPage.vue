<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Calendar, Check, Clock, Delete, Search, UserFilled } from "@element-plus/icons-vue";
import { fetchContests, type PublicContest } from "../../../data/apiClient";
import { formatDisplayDateTime } from "../../../lib/format";
import "../../../pages/ContestsPage.css";

const PAGE_SIZE = 10;
const REQUEST_PAGE_SIZE = 100;
type StatusFilter = "ALL" | PublicContest["status"];
const contests = ref<PublicContest[]>([]);
const loading = ref(true);
const message = ref("");
const searchKeyword = ref("");
const typeFilter = ref("");
const statusFilter = ref<StatusFilter>("ALL");
const joinedOnly = ref(false);
const currentPage = ref(1);

async function fetchAllVisibleContests() {
  const firstPage = await fetchContests(1, REQUEST_PAGE_SIZE);
  const totalPages = Math.ceil(firstPage.total / REQUEST_PAGE_SIZE);
  if (totalPages <= 1) return firstPage.list;
  const pages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchContests(index + 2, REQUEST_PAGE_SIZE)));
  return [firstPage.list, ...pages.map((item) => item.list)].flat().slice(0, firstPage.total);
}

const filteredContests = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  return contests.value.filter((contest) => (!keyword || contest.title.toLowerCase().includes(keyword))
    && (!typeFilter.value || contest.type === typeFilter.value)
    && (statusFilter.value === "ALL" || contest.status === statusFilter.value)
    && (!joinedOnly.value || contest.registered));
});
const pagedContests = computed(() => filteredContests.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE));
const runningCount = computed(() => contests.value.filter((contest) => contest.status === "RUNNING").length);
const recentCount = computed(() => contests.value.filter((contest) => {
  if (contest.status !== "NOT_STARTED") return false;
  const start = new Date(contest.startTime).getTime();
  const now = Date.now();
  return Number.isFinite(start) && start >= now && start - now <= 3 * 24 * 60 * 60 * 1000;
}).length);
const joinedCount = computed(() => contests.value.filter((contest) => contest.registered).length);

watch([joinedOnly, searchKeyword, statusFilter, typeFilter], () => { currentPage.value = 1; });
onMounted(async () => {
  loading.value = true;
  try { contests.value = await fetchAllVisibleContests(); message.value = ""; }
  catch (error) { contests.value = []; message.value = error instanceof Error ? error.message : "比赛加载失败"; }
  finally { loading.value = false; }
});

function statusText(status: PublicContest["status"]) { return status === "RUNNING" ? "进行中" : status === "ENDED" ? "已结束" : "未开始"; }
function statusClass(status: PublicContest["status"]) { return status === "RUNNING" ? "is-running" : status === "ENDED" ? "is-ended" : "is-upcoming"; }
function audienceText(contest: PublicContest) {
  if (contest.audiences?.some((item) => item.audienceType !== "ALL")) return contest.audiences.filter((item) => item.audienceType === "CLASS").map((item) => item.name).join("、") || "指定范围";
  if (contest.audience === "CLASS") return "指定范围";
  return "全校公开";
}
function registrationText(value: string) { const normalized = value.toUpperCase(); return normalized === "PASSWORD" ? "密码报名" : normalized === "PUBLIC" ? "公开报名" : "邀请码报名"; }
function clearFilters() { searchKeyword.value = ""; typeFilter.value = ""; statusFilter.value = "ALL"; joinedOnly.value = false; }
function openContest(id: number) { window.location.assign(`/contests/${id}`); }
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">比赛</h1></div></div></header>
    <el-alert v-if="message" class="contest-load-alert" type="info" :title="message" :closable="false" />
    <el-card v-if="loading" class="contests-loading-card" shadow="never"><el-skeleton :rows="5" animated /></el-card>
    <el-card v-else-if="!contests.length" class="contests-empty-card" shadow="never"><el-empty description="暂无比赛" /></el-card>
    <div v-else class="contests-page-content">
      <section class="contests-summary-grid" aria-label="比赛统计">
        <div class="contests-summary-card"><div><span class="contests-summary-label">进行中</span><strong class="contests-summary-value">{{ runningCount }}</strong><span class="contests-summary-hint">现在可以进入</span></div><span class="contests-summary-mark is-blue" aria-hidden="true">●</span></div>
        <div class="contests-summary-card"><div><span class="contests-summary-label">近期比赛</span><strong class="contests-summary-value">{{ recentCount }}</strong><span class="contests-summary-hint">未来 3 天内</span></div><span class="contests-summary-mark is-amber" aria-hidden="true">◷</span></div>
        <div class="contests-summary-card"><div><span class="contests-summary-label">已报名比赛</span><strong class="contests-summary-value">{{ joinedCount }}</strong><span class="contests-summary-hint">你已报名的比赛</span></div><span class="contests-summary-mark is-violet" aria-hidden="true">✓</span></div>
      </section>

      <section class="contests-filter-panel" aria-label="比赛筛选">
        <div class="contests-filter-heading"><strong>筛选比赛</strong><span>共 {{ filteredContests.length }} 场比赛</span></div>
        <div class="contests-filter-controls">
          <div class="contests-status-tabs" role="group" aria-label="比赛状态">
            <button v-for="item in [{ value: 'ALL', label: '全部' }, { value: 'RUNNING', label: '进行中' }, { value: 'NOT_STARTED', label: '即将开始' }, { value: 'ENDED', label: '已结束' }]" :key="item.value" type="button" class="contests-status-tab" :class="{ 'is-active': statusFilter === item.value }" @click="statusFilter = item.value as StatusFilter">{{ item.label }}</button>
          </div>
          <el-input v-model="searchKeyword" class="contests-search-field" placeholder="搜索比赛名称" clearable><template #prefix><el-icon><Search /></el-icon></template></el-input>
          <el-select v-model="typeFilter" class="contests-type-field" placeholder="全部赛制" clearable><el-option label="ACM" value="ACM" /><el-option label="OI" value="OI" /><el-option label="蓝桥杯" value="LANQIAO" /></el-select>
          <el-checkbox v-model="joinedOnly">只看已报名</el-checkbox>
          <button type="button" class="contests-clear-button" @click="clearFilters"><el-icon><Delete /></el-icon>清空筛选</button>
        </div>
      </section>

      <el-card class="contests-list-card" shadow="never" :body-style="{ padding: '0' }">
        <template #header><div class="contests-list-heading"><h2>赛程列表</h2></div></template>
        <div class="contests-list-body">
          <div v-if="!pagedContests.length" class="contests-empty-state">没有找到符合条件的比赛，试试清空筛选。</div>
          <article v-for="contest in pagedContests" :key="contest.id" class="contest-list-item">
            <div class="contest-list-status" :class="statusClass(contest.status)"><strong>{{ statusText(contest.status) }}</strong></div>
            <div class="contest-list-main">
              <div class="contest-list-title-row"><button class="contest-list-title" type="button" @click="openContest(contest.id)">{{ contest.title }}</button><el-tag :class="['contest-type-tag', { 'is-oi': contest.type === 'OI' }]">{{ contest.type === "LANQIAO" ? "蓝桥杯" : contest.type }}</el-tag><el-tag v-if="contest.registered" class="contest-joined-tag" type="success"><el-icon><Check /></el-icon>已报名</el-tag></div>
              <div class="contest-list-meta">
                <span class="contest-list-time"><el-icon><Calendar /></el-icon><b>时间</b><span class="contest-list-date-range"><time :datetime="contest.startTime">{{ formatDisplayDateTime(contest.startTime) }}</time><span> – </span><time :datetime="contest.endTime">{{ formatDisplayDateTime(contest.endTime) }}</time></span></span>
                <span><el-icon><Clock /></el-icon><b>时长</b>{{ contest.durationMinutes }} 分钟</span>
                <span><el-icon><UserFilled /></el-icon>{{ contest.participantCount ?? 0 }} 人</span>
                <span class="contest-audience-tag">{{ audienceText(contest) }}</span>
              </div>
              <span class="contest-list-registration">{{ registrationText(contest.registrationType) }}</span>
            </div>
            <div class="contest-list-side"><button class="contest-list-action" type="button" @click="openContest(contest.id)">查看详情</button></div>
          </article>
        </div>
        <div v-if="filteredContests.length" class="contests-pagination-wrap">
          <span>显示第 {{ Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredContests.length) }}-{{ Math.min(currentPage * PAGE_SIZE, filteredContests.length) }} 条，共 {{ filteredContests.length }} 条</span>
          <Pagination v-model:page="currentPage" :limit="PAGE_SIZE" :total="filteredContests.length" />
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.page-container { width: 100%; }
.contest-load-alert { margin-bottom: 16px; }
.contests-list-card :deep(.el-card__header) { padding: 18px 24px; }
.contests-list-heading h2 { margin: 0; font-size: 18px; }
.contests-list-body { padding: 0 24px; }
.contest-list-title { border: 0; padding: 0; background: transparent; color: var(--qoj-color-text-0); font: inherit; font-weight: 650; cursor: pointer; }
.contest-list-title:hover, .contest-list-action:hover { color: var(--qoj-color-primary); }
.contest-list-action { border: 0; background: transparent; color: var(--qoj-color-primary); font: inherit; font-weight: 600; cursor: pointer; }
.contests-pagination-wrap { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px 24px; color: var(--qoj-color-text-2); font-size: 13px; }
.contests-pagination-wrap .el-pagination { margin-left: auto; }
.contest-list-meta .el-icon { margin-right: 5px; }
@media (max-width: 720px) { .contests-list-body { padding: 0 12px; } .contests-pagination-wrap { padding: 16px 12px; } .contests-pagination-wrap .el-pagination { margin-left: 0; } }
</style>

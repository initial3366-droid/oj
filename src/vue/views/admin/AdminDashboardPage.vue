<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import { adminGet } from "../../../admin/api/adminClient";
import { languageLabel } from "../../../data/languages";
import type { AdminDashboard } from "../../../api/admin";
import { formatDisplayDateTime } from "../../../lib/format";

const data = ref<AdminDashboard | null>(null);
const loading = ref(true);
const error = ref("");
const difficultyNames: Record<number, string> = { 1: "入门", 2: "简单", 3: "中等", 4: "困难", 5: "地狱" };
const verdictColors: Record<string, string> = { AC: "#10b981", WA: "#ef4444", TLE: "#f59e0b", CE: "#8b5cf6", RE: "#ec4899", MLE: "#06b6d4", NOO: "#94a3b8", SE: "#64748b", FAILED: "#94a3b8" };
const difficultyColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#7c3aed"];
const trend = computed(() => data.value?.submissionTrend ?? []);
const maxTrend = computed(() => Math.max(1, ...trend.value.map((item) => item.total)));
const maxDifficulty = computed(() => Math.max(1, ...(data.value?.difficultyDistribution ?? []).map((item) => item.count)));
const maxHourly = computed(() => Math.max(1, ...(data.value?.hourlyActivity ?? []).map((item) => item.count)));
const roleBreakdown = computed(() => Object.entries(data.value?.totalStats.userByRole ?? {}).filter(([role]) => ["STUDENT", "TEACHER"].includes(role)).map(([role, count]) => `${role === "STUDENT" ? "学生" : "教师"} ${count}`).join(" / "));
const difficultyBreakdown = computed(() => Object.entries(data.value?.totalStats.problemByDifficulty ?? {}).map(([key, count]) => `${difficultyNames[Number(key)] || key} ${count}`).join(" / "));
const contestBreakdown = computed(() => Object.entries(data.value?.totalStats.contestByType ?? {}).map(([key, count]) => `${key} ${count}`).join(" / "));
const verdictTotal = computed(() => (data.value?.verdictDistribution ?? []).reduce((total, item) => total + item.count, 0));
const donut = computed(() => {
  let current = 0;
  const colors: string[] = [];
  (data.value?.verdictDistribution ?? []).forEach((item) => {
    const next = current + (verdictTotal.value ? item.count / verdictTotal.value * 100 : 0);
    colors.push(`${verdictColors[item.verdict] || "#94a3b8"} ${current}% ${next}%`);
    current = next;
  });
  return colors.length ? `conic-gradient(${colors.join(",")})` : "#e5e7eb";
});
const languages = computed(() => {
  const merged = new Map<string, number>();
  (data.value?.languageUsage ?? []).forEach((item) => {
    const lang = ["cpp", "cpp17", "cpp20", "cpp23", "c++", "c++17", "c++20", "c++23"].includes(item.language.toLowerCase()) ? "C++" : languageLabel(item.language);
    merged.set(lang, (merged.get(lang) ?? 0) + item.count);
  });
  const total = Array.from(merged.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(merged, ([language, count]) => ({ language, count, percentage: total ? count * 100 / total : 0 })).sort((a, b) => b.count - a.count);
});
const growthPath = computed(() => {
  const rows = data.value?.userGrowth ?? [];
  if (rows.length < 2) return "";
  const maximum = Math.max(1, ...rows.map((item) => item.cumulative));
  return rows.map((item, index) => `${index ? "L" : "M"} ${index * 100 / (rows.length - 1)} ${94 - item.cumulative / maximum * 80}`).join(" ");
});

async function load() {
  loading.value = true;
  error.value = "";
  try { data.value = await adminGet<AdminDashboard>("/api/admin/v1/dashboard", true); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "仪表盘加载失败"; }
  finally { loading.value = false; }
}
function number(value: number) { return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString(); }
function recentStatus(status: string) { return status === "RUNNING" ? "进行中" : status === "ENDED" ? "已结束" : "未开始"; }
onMounted(() => { void load(); });
</script>

<template>
  <div class="dashboard-page page-container">
    
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><template #default></template></el-alert>
    <el-skeleton v-if="loading && !data" :rows="8" animated />
    <template v-if="data">
      <section class="today-grid">
        <article v-for="stat in [{label:'今日提交',value:data.todaySubmissionCount,color:'blue'}, {label:'今日 AC 数量',value:data.todayAcceptedCount,color:'green'}, {label:'今日活跃用户',value:data.todayActiveUserCount,color:'purple'}, {label:'进行中比赛',value:data.activeContestCount,color:'orange'}]" :key="stat.label" class="today-card" :class="stat.color"><small>{{ stat.label }}</small><strong>{{ number(stat.value) }}</strong></article>
      </section>
      <section class="summary-grid">
        <article class="summary-card"><small>注册用户</small><strong>{{ number(data.totalStats.userCount) }}</strong><p>{{ roleBreakdown }}</p></article>
        <article class="summary-card"><small>题库总量</small><strong>{{ number(data.totalStats.problemCount) }}</strong><p>{{ difficultyBreakdown }}</p></article>
        <article class="summary-card"><small>累计提交</small><strong>{{ number(data.totalStats.submissionCount) }}</strong><p>通过率 {{ data.totalStats.passRate }}%</p></article>
        <article class="summary-card"><small>历史比赛</small><strong>{{ number(data.totalStats.contestCount) }}</strong><p>{{ contestBreakdown }}</p></article>
      </section>
      <section class="chart-grid first-row">
        <article class="chart-card wide"><h2>近 7 日提交趋势</h2><div v-if="!trend.length" class="empty-chart">暂无数据</div><div v-else class="trend-chart"><div class="chart-y-axis"><span>{{ maxTrend }}</span><span>{{ Math.round(maxTrend/2) }}</span><span>0</span></div><div class="trend-columns"><div v-for="item in trend" :key="item.date" class="trend-column" :title="`${item.date}：总提交 ${item.total}，通过 ${item.accepted}`"><div class="trend-bars"><i class="total-bar" :style="{height:`${Math.max(2,item.total/maxTrend*100)}%`}"/><i class="accepted-bar" :style="{height:`${Math.max(1,item.accepted/maxTrend*100)}%`}"/></div><small>{{ item.date.slice(-5) }}</small></div></div><div class="chart-legend"><span><i class="blue-dot"/>总提交</span><span><i class="green-dot"/>通过</span></div></div></article>
        <article class="chart-card"><h2>评测结果分布</h2><div v-if="!data.verdictDistribution.length" class="empty-chart">暂无数据</div><template v-else><div class="donut-wrap"><div class="donut" :style="{background:donut}"><div><strong>{{ number(verdictTotal) }}</strong><small>次评测</small></div></div></div><div class="verdict-legend"><span v-for="item in data.verdictDistribution" :key="item.verdict"><i :style="{background:verdictColors[item.verdict] || '#94a3b8'}"/>{{ item.verdict }} <small>{{ verdictTotal ? (item.count*100/verdictTotal).toFixed(1) : 0 }}%</small></span></div></template></article>
      </section>
      <section class="chart-grid thirds">
        <article class="chart-card"><h2>语言使用分布</h2><div v-if="!languages.length" class="empty-chart">暂无数据</div><div v-else class="language-bars"><div v-for="(item,index) in languages" :key="item.language"><div><span>{{ item.language }}</span><small>{{ number(item.count) }} ({{ item.percentage.toFixed(1) }}%)</small></div><el-progress :percentage="item.percentage" :show-text="false" :color="['#2563eb','#3b82f6','#60a5fa','#93c5fd'][index%4]"/></div></div></article>
        <article class="chart-card"><h2>题目难度分布</h2><div v-if="!data.difficultyDistribution.length" class="empty-chart">暂无数据</div><div v-else class="bar-chart difficulty-bars"><div v-for="(item,index) in data.difficultyDistribution" :key="item.difficulty" :title="`${difficultyNames[item.difficulty] || item.difficulty}：${item.count} 道题`"><div class="bar-track"><i :style="{height:`${Math.max(2,item.count/maxDifficulty*100)}%`,background:difficultyColors[item.difficulty-1] || '#94a3b8'}"/></div><small>{{ difficultyNames[item.difficulty] || item.difficulty }}</small></div></div></article>
        <article class="chart-card"><h2>今日逐时活动</h2><div v-if="!data.hourlyActivity.length" class="empty-chart">暂无数据</div><div v-else class="bar-chart hourly-bars"><div v-for="item in data.hourlyActivity" :key="item.hour" :title="`${item.hour}:00 ${item.count} 次提交`"><div class="bar-track"><i :class="{current:item.hour === new Date().getHours()}" :style="{height:`${Math.max(2,item.count/maxHourly*100)}%`}"/></div><small v-if="item.hour%4===0">{{ String(item.hour).padStart(2,'0') }}</small><small v-else>&nbsp;</small></div></div></article>
      </section>
      <section class="chart-grid halves">
        <article class="chart-card"><h2>用户增长趋势</h2><div v-if="data.userGrowth.length < 2" class="empty-chart">暂无数据</div><div v-else class="growth-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="累计用户增长趋势"><path :d="growthPath" fill="none" stroke="#8b5cf6" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><div class="growth-labels"><span v-for="item in data.userGrowth" :key="item.month">{{ item.month }}</span></div></div></article>
        <article class="chart-card"><h2>热门题目 TOP 5</h2><el-empty v-if="!data.topProblems.length" description="暂无数据"/><div v-else class="top-problems"><div v-for="(problem,index) in data.topProblems" :key="problem.problemId" class="top-problem"><b :class="`rank-${index+1}`">{{ index+1 }}</b><div class="problem-meta"><strong>{{ problem.title }}</strong><small>{{ number(problem.submissions) }} 次提交 · {{ difficultyNames[problem.difficulty] || problem.difficulty }}</small></div><div class="rate" :class="{high:problem.acRate>=70,mid:problem.acRate>=40 && problem.acRate<70}">{{ problem.acRate }}%<small>通过率</small></div></div></div></article>
      </section>
      <el-card shadow="never" class="recent-card"><template #header><strong>近期比赛</strong></template><el-table :data="data.recentContests" row-key="id" stripe empty-text="暂无比赛"><el-table-column prop="title" label="比赛名称" min-width="220"/><el-table-column prop="type" label="类型" width="100"/><el-table-column label="状态" width="120"><template #default="{row}"><el-tag :type="row.status === 'RUNNING' ? 'success' : row.status === 'ENDED' ? 'info' : 'warning'">{{ recentStatus(row.status) }}</el-tag></template></el-table-column><el-table-column label="开始时间" min-width="190"><template #default="{row}">{{ formatDisplayDateTime(row.startTime) }}</template></el-table-column></el-table></el-card>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page { display:flex; flex-direction:column; gap:16px; }
.dashboard-title { display:flex; align-items:center; justify-content:space-between; }
.dashboard-title h1 { margin:0; font-size:22px; }
.dashboard-title p { margin:5px 0 0; color:var(--el-text-color-secondary); font-size:13px; }
.today-grid,.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.today-card { position:relative; display:flex; min-height:106px; flex-direction:column; justify-content:space-between; padding:18px 20px; border-radius:12px; color:white; overflow:hidden; }
.today-card::after { content:""; position:absolute; width:78px; height:78px; top:-20px; right:-17px; border-radius:50%; background:#ffffff22; }
.today-card small { opacity:.84; font-size:13px; }
.today-card strong { font-size:30px; line-height:1.1; }
.today-card.blue { background:linear-gradient(135deg,var(--el-color-primary),var(--el-color-primary)); }
.today-card.green { background:linear-gradient(135deg,var(--el-color-success),var(--el-color-success-light-3)); }
.today-card.purple { background:linear-gradient(135deg,#8b5cf6,#a78bfa); }
.today-card.orange { background:linear-gradient(135deg,var(--el-color-warning),#fbbf24); }
.summary-card { min-width:0; padding:16px 18px; border-radius:10px; background:var(--content-bg); }
.summary-card small { display:block; color:var(--el-text-color-secondary); font-size:12px; }
.summary-card strong { display:block; margin:5px 0; font-size:26px; }
.summary-card p { margin:0; overflow:hidden; color:#a0a7b4; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.chart-grid { display:grid; gap:14px; }
.first-row { grid-template-columns:minmax(0,2fr) minmax(280px,1fr); }
.thirds { grid-template-columns:repeat(3,minmax(0,1fr)); }
.halves { grid-template-columns:repeat(2,minmax(0,1fr)); }
.chart-card { min-width:0; min-height:252px; padding:18px; border-radius:10px; background:var(--content-bg); }
.chart-card h2 { margin:0 0 14px; color:var(--el-text-color-regular); font-size:15px; }
.empty-chart { height:200px; display:grid; place-items:center; color:#c0c4cc; font-size:13px; }
.trend-chart { position:relative; height:190px; display:flex; padding:8px 2px 0 30px; }
.chart-y-axis { position:absolute; top:10px; bottom:24px; left:0; display:flex; flex-direction:column; justify-content:space-between; color:#9aa3af; font-size:10px; }
.trend-columns { display:flex; flex:1; align-items:stretch; justify-content:space-around; gap:7px; border-bottom:1px solid var(--card-border); background:repeating-linear-gradient(to bottom,transparent 0,transparent 61px,var(--page-bg) 62px); }
.trend-column { min-width:0; flex:1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:5px; }
.trend-bars { width:min(44px,90%); flex:1; display:flex; align-items:flex-end; justify-content:center; gap:3px; }
.trend-bars i { width:40%; min-height:2px; border-radius:4px 4px 0 0; }
.total-bar { background:var(--el-color-primary); }.accepted-bar { background:var(--el-color-success); }
.trend-column small { padding-bottom:4px; color:var(--el-text-color-secondary); font-size:10px; }
.chart-legend { display:flex; justify-content:center; gap:16px; margin-top:6px; color:var(--el-text-color-secondary); font-size:11px; }
.chart-legend span,.verdict-legend span { display:flex; align-items:center; gap:5px; }
.chart-legend i,.verdict-legend i { width:8px; height:8px; border-radius:50%; }
.blue-dot { background:var(--el-color-primary); }.green-dot { background:var(--el-color-success); }
.donut-wrap { height:142px; display:grid; place-items:center; }
.donut { width:118px; height:118px; display:grid; place-items:center; border-radius:50%; }
.donut > div { width:76px; height:76px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:50%; background:var(--content-bg); }
.donut strong { font-size:15px; }.donut small { color:var(--el-text-color-placeholder); font-size:10px; }
.verdict-legend { display:flex; flex-wrap:wrap; justify-content:center; gap:7px 12px; font-size:10px; color:var(--el-text-color-secondary); }
.verdict-legend small { color:var(--el-text-color-placeholder); }
.language-bars { display:flex; flex-direction:column; gap:14px; padding-top:8px; }
.language-bars > div > div { display:flex; justify-content:space-between; margin-bottom:5px; font-size:12px; }
.language-bars small { color:var(--el-text-color-placeholder); }
.bar-chart { height:178px; display:flex; align-items:stretch; justify-content:space-around; gap:7px; border-bottom:1px solid var(--card-border); }
.bar-chart > div { min-width:0; flex:1; display:flex; align-items:center; flex-direction:column; justify-content:flex-end; gap:4px; }
.bar-track { height:148px; width:100%; display:flex; align-items:flex-end; justify-content:center; background:repeating-linear-gradient(to bottom,transparent 0,transparent 48px,var(--page-bg) 49px); }
.bar-track i { width:min(32px,74%); min-height:2px; border-radius:4px 4px 0 0; background:#60a5fa; }
.bar-track i.current { background:var(--el-color-primary); }
.bar-chart small { height:16px; color:var(--el-text-color-secondary); font-size:10px; white-space:nowrap; }
.growth-chart { height:180px; display:flex; flex-direction:column; justify-content:space-between; }
.growth-chart svg { width:100%; height:150px; overflow:visible; background:repeating-linear-gradient(to bottom,transparent 0,transparent 48px,var(--page-bg) 49px); }
.growth-labels { display:flex; justify-content:space-between; color:var(--el-text-color-secondary); font-size:10px; }
.top-problems { display:flex; flex-direction:column; }
.top-problem { min-width:0; display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--page-bg); }
.top-problem:last-child { border-bottom:0; }
.top-problem > b { width:28px; height:28px; display:grid; flex:none; place-items:center; border-radius:8px; background:var(--page-bg); color:var(--el-text-color-secondary); font-size:12px; }
.top-problem > b.rank-1 { background:var(--el-color-warning-light-9); color:#d97706; }.top-problem > b.rank-2 { background:#e0e7ff; color:#4f46e5; }.top-problem > b.rank-3 { background:#fce7f3; color:#db2777; }
.problem-meta { min-width:0; flex:1; display:flex; flex-direction:column; gap:4px; }
.problem-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
.problem-meta small,.rate small { color:var(--el-text-color-placeholder); font-size:10px; }
.rate { display:flex; flex-direction:column; align-items:flex-end; color:var(--el-color-danger); font-size:16px; font-weight:700; }
.rate.mid { color:var(--el-color-warning); }.rate.high { color:var(--el-color-success); }
.recent-card { border:0; }
@media(max-width:1000px) { .today-grid,.summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .first-row,.thirds,.halves { grid-template-columns:1fr; } }
@media(max-width:580px) { .today-grid,.summary-grid { grid-template-columns:1fr; } .chart-card { padding:14px; } }
</style>

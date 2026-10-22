<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchTeacherDashboard, type TeacherDashboard } from "../../../teacher/teacherApi";
import { isCppLanguage, languageLabel } from "../../../data/languages";

const data = ref<TeacherDashboard | null>(null);
const loading = ref(true);
const error = ref("");
const verdictColors: Record<string, string> = { AC: "#10b981", WA: "#ef4444", TLE: "#f59e0b", CE: "#8b5cf6", RE: "#ec4899", MLE: "#06b6d4", NOO: "#94a3b8", SE: "#64748b", FAILED: "#94a3b8" };
const difficultyNames: Record<number, string> = { 1: "入门", 2: "简单", 3: "中等", 4: "困难", 5: "地狱" };
const difficultyColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#7c3aed"];
const verdictTotal = computed(() => (data.value?.verdictDistribution ?? []).reduce((sum, item) => sum + item.count, 0));
const donut = computed(() => {
  let current = 0;
  const parts = (data.value?.verdictDistribution ?? []).map((item) => {
    const next = current + (verdictTotal.value ? item.count / verdictTotal.value * 100 : 0);
    const part = `${verdictColors[item.verdict] || "#94a3b8"} ${current}% ${next}%`; current = next; return part;
  });
  return parts.length ? `conic-gradient(${parts.join(",")})` : "#e5e7eb";
});
const trend = computed(() => data.value?.submissionTrend ?? []);
const maxTrend = computed(() => Math.max(1, ...trend.value.map((item) => item.total)));
const difficulty = computed(() => data.value?.difficultyDistribution ?? []);
const maxDifficulty = computed(() => Math.max(1, ...difficulty.value.map((item) => item.count)));
const hourly = computed(() => data.value?.hourlyActivity ?? []);
const maxHourly = computed(() => Math.max(1, ...hourly.value.map((item) => item.count)));
const languages = computed(() => {
  const merged = new Map<string, number>();
  for (const item of data.value?.languageUsage ?? []) {
    const language = isCppLanguage(item.language) ? "C++" : languageLabel(item.language);
    merged.set(language, (merged.get(language) ?? 0) + item.count);
  }
  const total = [...merged.values()].reduce((sum, value) => sum + value, 0);
  return [...merged.entries()].map(([language, count]) => ({ language, count, percentage: total ? count * 100 / total : 0 })).sort((a, b) => b.count - a.count);
});
const userGrowthPath = computed(() => {
  const values = data.value?.userGrowth ?? [];
  if (values.length < 2) return "";
  const max = Math.max(1, ...values.map((item) => item.cumulative));
  return values.map((item, index) => `${index ? "L" : "M"} ${index * 100 / (values.length - 1)} ${94 - item.cumulative / max * 80}`).join(" ");
});

async function load() {
  loading.value = true; error.value = "";
  try { data.value = await fetchTeacherDashboard(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "仪表盘加载失败"; ElMessage.error(error.value); }
  finally { loading.value = false; }
}
function number(value: number) { return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString(); }
function onMountedLoad() { void load(); }
onMounted(onMountedLoad);
</script>

<template>
  <section class="dashboard page-container" v-loading="loading && !data">
    
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><template #default></template></el-alert>
    <template v-if="data">
      <section class="metric-grid today">
        <article v-for="item in [{label:'今日提交',value:data.todaySubmissionCount,color:'blue'},{label:'今日通过',value:data.todayAcceptedCount,color:'green'},{label:'活跃学生',value:data.todayActiveUserCount,color:'purple'},{label:'进行中比赛',value:data.activeContestCount,color:'orange'}]" :key="item.label" :class="item.color"><small>{{ item.label }}</small><strong>{{ number(item.value) }}</strong></article>
      </section>
      <section class="metric-grid summary">
        <article><small>我的学生</small><strong>{{ number(data.totalStats.userCount) }}</strong></article><article><small>练习题目</small><strong>{{ number(data.totalStats.problemCount) }}</strong></article><article><small>累计提交</small><strong>{{ number(data.totalStats.submissionCount) }}</strong></article><article><small>通过率</small><strong>{{ data.totalStats.passRate }}%</strong></article>
      </section>
      <section class="chart-grid trend-row">
        <article class="chart-card"><h2>近 7 日提交趋势</h2><div v-if="!trend.length" class="empty">暂无数据</div><div v-else class="trend-chart"><div v-for="item in trend" :key="item.date" class="trend-item" :title="`${item.date}：总提交 ${item.total}，通过 ${item.accepted}`"><div class="bars"><i class="total" :style="{height:`${Math.max(2,item.total/maxTrend*100)}%`}"/><i class="accepted" :style="{height:`${Math.max(1,item.accepted/maxTrend*100)}%`}"/></div><small>{{ item.date.slice(-5) }}</small></div></div><div class="legend"><span><i class="blue"/>总提交</span><span><i class="green"/>通过</span></div></article>
        <article class="chart-card"><h2>评测结果分布</h2><div v-if="!data.verdictDistribution.length" class="empty">暂无数据</div><template v-else><div class="donut-wrap"><div class="donut" :style="{background:donut}"><div><strong>{{ number(verdictTotal) }}</strong><small>次评测</small></div></div></div><div class="verdict-legend"><span v-for="item in data.verdictDistribution" :key="item.verdict"><i :style="{background:verdictColors[item.verdict]||'#94a3b8'}"/>{{ item.verdict }}<small>{{ verdictTotal ? (item.count*100/verdictTotal).toFixed(1) : 0 }}%</small></span></div></template></article>
      </section>
      <section class="chart-grid thirds">
        <article class="chart-card"><h2>语言使用分布</h2><div v-if="!languages.length" class="empty">暂无数据</div><div v-else class="language-bars"><div v-for="(item,index) in languages" :key="item.language"><div><span>{{ item.language }}</span><small>{{ number(item.count) }}（{{ item.percentage.toFixed(1) }}%）</small></div><el-progress :percentage="item.percentage" :show-text="false" :color="['#2563eb','#3b82f6','#60a5fa','#93c5fd'][index%4]"/></div></div></article>
        <article class="chart-card"><h2>题目难度分布</h2><div v-if="!difficulty.length" class="empty">暂无数据</div><div v-else class="bar-chart"> <div v-for="item in difficulty" :key="item.difficulty" :title="`${difficultyNames[item.difficulty]||item.difficulty}：${item.count} 道题`"><div class="bar-track"><i :style="{height:`${Math.max(2,item.count/maxDifficulty*100)}%`,background:difficultyColors[item.difficulty-1]||'#94a3b8'}"/></div><small>{{ difficultyNames[item.difficulty]||item.difficulty }}</small></div></div></article>
        <article class="chart-card"><h2>今日逐时活动</h2><div v-if="!hourly.length" class="empty">暂无数据</div><div v-else class="bar-chart"> <div v-for="item in hourly" :key="item.hour" :title="`${item.hour}:00 ${item.count} 次提交`"><div class="bar-track"><i :class="{current:item.hour===new Date().getHours()}" :style="{height:`${Math.max(2,item.count/maxHourly*100)}%`}"/></div><small v-if="item.hour%4===0">{{ String(item.hour).padStart(2,'0') }}</small><small v-else>&nbsp;</small></div></div></article>
      </section>
      <section class="chart-grid halves">
        <article class="chart-card"><h2>学生增长趋势</h2><div v-if="data.userGrowth.length<2" class="empty">暂无数据</div><div v-else class="growth-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="学生累计增长趋势"><path :d="userGrowthPath" fill="none" stroke="#8b5cf6" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><div><span v-for="item in data.userGrowth" :key="item.month">{{ item.month }}</span></div></div></article>
        <article class="chart-card"><h2>热门题目 TOP 5</h2><el-empty v-if="!data.topProblems.length" description="暂无数据"/><div v-else class="top-problems"><div v-for="(problem,index) in data.topProblems" :key="problem.problemId" class="top-problem"><b :class="`rank-${index+1}`">{{ index+1 }}</b><div><strong>{{ problem.title }}</strong><small>{{ number(problem.submissions) }} 次提交 · {{ difficultyNames[problem.difficulty]||problem.difficulty }}</small></div><span :class="{high:problem.acRate>=70,mid:problem.acRate>=40&&problem.acRate<70}">{{ problem.acRate }}%<small>通过率</small></span></div></div></article>
      </section>
      <el-card v-if="data.recentContests.length" shadow="never"><template #header>近期比赛</template><el-table :data="data.recentContests" stripe><el-table-column prop="title" label="比赛" min-width="180"/><el-table-column prop="status" label="状态" width="120"/><el-table-column prop="startTime" label="开始时间" min-width="180"/></el-table></el-card>
    </template>
  </section>
</template>

<style scoped>
.dashboard{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:5px 0 0;color:var(--el-text-color-secondary);font-size:13px}.metric-grid,.chart-grid{display:grid;gap:14px}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.today article{min-height:100px;display:flex;flex-direction:column;justify-content:space-between;padding:17px 19px;border-radius:11px;color:var(--el-color-white)}.today small{font-size:13px;opacity:.85}.today strong{font-size:28px}.today .blue{background:linear-gradient(135deg,var(--el-color-primary),var(--el-color-primary))}.today .green{background:linear-gradient(135deg,var(--el-color-success),var(--el-color-success-light-3))}.today .purple{background:linear-gradient(135deg,#8b5cf6,#a78bfa)}.today .orange{background:linear-gradient(135deg,var(--el-color-warning),#fbbf24)}.summary article{padding:16px 18px;border-radius:10px;background:var(--content-bg)}.summary small{display:block;color:var(--el-text-color-secondary);font-size:12px}.summary strong{display:block;margin-top:5px;font-size:25px}.chart-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.trend-row{grid-template-columns:minmax(0,2fr) minmax(260px,1fr)}.halves{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-card{min-width:0;min-height:250px;padding:18px;border-radius:10px;background:var(--content-bg)}.chart-card h2{margin:0 0 14px;color:var(--el-text-color-regular);font-size:15px}.empty{height:190px;display:grid;place-items:center;color:var(--el-text-color-placeholder);font-size:13px}.trend-chart{height:180px;display:flex;align-items:stretch;justify-content:space-around;gap:7px;border-bottom:1px solid var(--card-border);background:repeating-linear-gradient(to bottom,transparent 0,transparent 57px,var(--page-bg) 58px)}.trend-item{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}.bars{flex:1;width:min(44px,90%);display:flex;align-items:flex-end;justify-content:center;gap:3px}.bars i{width:40%;min-height:2px;border-radius:4px 4px 0 0}.bars .total{background:var(--el-color-primary)}.bars .accepted{background:var(--el-color-success)}.trend-item small{color:var(--el-text-color-secondary);font-size:10px}.legend{display:flex;justify-content:center;gap:16px;margin-top:10px;color:var(--el-text-color-secondary);font-size:11px}.legend span{display:flex;align-items:center;gap:5px}.legend i,.verdict-legend i{width:8px;height:8px;border-radius:50%}.legend .blue{background:var(--el-color-primary)}.legend .green{background:var(--el-color-success)}.donut-wrap{height:138px;display:grid;place-items:center}.donut{width:116px;height:116px;display:grid;place-items:center;border-radius:50%}.donut>div{width:74px;height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:var(--content-bg)}.donut strong{font-size:15px}.donut small{color:var(--el-text-color-placeholder);font-size:10px}.verdict-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:7px 12px;font-size:10px;color:var(--el-text-color-secondary)}.verdict-legend span{display:flex;align-items:center;gap:4px}.verdict-legend small{color:var(--el-text-color-placeholder)}.language-bars{display:flex;flex-direction:column;gap:14px;padding-top:8px}.language-bars>div>div{display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px}.language-bars small{color:var(--el-text-color-placeholder)}.bar-chart{height:178px;display:flex;align-items:stretch;justify-content:space-around;gap:6px;border-bottom:1px solid var(--card-border)}.bar-chart>div{min-width:0;flex:1;display:flex;align-items:center;flex-direction:column;justify-content:flex-end;gap:4px}.bar-track{height:148px;width:100%;display:flex;align-items:flex-end;justify-content:center;background:repeating-linear-gradient(to bottom,transparent 0,transparent 48px,var(--page-bg) 49px)}.bar-track i{width:min(32px,75%);min-height:2px;border-radius:4px 4px 0 0;background:#93c5fd}.bar-track i.current{background:var(--el-color-primary)}.bar-chart small{height:16px;color:var(--el-text-color-secondary);font-size:10px;white-space:nowrap}.growth-chart{height:178px;display:flex;flex-direction:column;justify-content:space-between}.growth-chart svg{width:100%;height:148px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 48px,var(--page-bg) 49px)}.growth-chart>div{display:flex;justify-content:space-between;color:var(--el-text-color-secondary);font-size:10px}.top-problems{display:flex;flex-direction:column}.top-problem{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--page-bg)}.top-problem:last-child{border:0}.top-problem>b{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:8px;background:var(--page-bg);color:var(--el-text-color-secondary);font-size:12px}.top-problem>b.rank-1{background:var(--el-color-warning-light-9);color:#d97706}.top-problem>b.rank-2{background:#e0e7ff;color:#4f46e5}.top-problem>b.rank-3{background:#fce7f3;color:#db2777}.top-problem>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.top-problem strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.top-problem small{color:var(--el-text-color-placeholder);font-size:10px}.top-problem>span{display:flex;flex-direction:column;align-items:flex-end;color:var(--el-color-danger);font-size:16px;font-weight:700}.top-problem>span.mid{color:var(--el-color-warning)}.top-problem>span.high{color:var(--el-color-success)}@media(max-width:1000px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.trend-row,.chart-grid,.halves{grid-template-columns:1fr}}@media(max-width:560px){.metric-grid{grid-template-columns:1fr}.chart-card{padding:14px}}
</style>

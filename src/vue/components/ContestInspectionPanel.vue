<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { adminGet } from "../../admin/api/adminClient";
import { teacherGet } from "../../teacher/teacherApi";
import { adminPath } from "../../utils/adminPath";
import { formatDisplayDateTime } from "../../lib/format";
type QueueStats = { waiting: number; judging: number; finished: number; total: number };
type Failure = { id: number; displayName?: string; username?: string; problemTitle?: string; contestProblemLabel?: string; status: string; errorMessage?: string; judgeMessage?: string };
type Page = { total: number; list: Failure[] };
type Snapshot = { stats: QueueStats; failures: number; recentFailures: Failure[]; updatedAt: string };
const props = defineProps<{ contestId: number; active?: boolean; teacher?: boolean }>();
function get<T>(path: string) { return props.teacher ? teacherGet<T>(path) : adminGet<T>(adminPath(path)); }
const loading = ref(false); const error = ref(""); const snapshot = ref<Snapshot | null>(null); let timer: number | undefined; let disposed = false;
async function load() {
  if (!props.active || disposed) return;
  loading.value = true;
  try {
    const query = new URLSearchParams({ contestId: String(props.contestId), page: "1", pageSize: "5", sortBy: "updatedAt", sortOrder: "desc" });
    const [stats, systemErrors, failed] = await Promise.all([
      get<QueueStats>(`/api/admin/v1/submission-queue/stats?contestId=${props.contestId}`),
      get<Page>(`/api/admin/v1/submissions?${query}&status=SE`),
      get<Page>(`/api/admin/v1/submissions?${query}&status=FAILED`),
    ]);
    if (![stats.waiting, stats.judging, stats.finished, stats.total, systemErrors.total, failed.total].every(Number.isFinite)) throw new Error("巡查统计暂不可用，请检查访问权限后重试");
    snapshot.value = { stats, failures: systemErrors.total + failed.total, recentFailures: [...systemErrors.list, ...failed.list], updatedAt: new Date().toISOString() }; error.value = "";
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "巡查统计加载失败"; }
  finally { loading.value = false; if (props.active && !disposed) timer = window.setTimeout(() => void load(), 15000); }
}
function refresh() { if (timer) window.clearTimeout(timer); void load(); }
watch(() => [props.contestId, props.active] as const, () => { if (timer) window.clearTimeout(timer); snapshot.value = null; error.value = ""; void load(); }, { immediate: true });
onMounted(() => { disposed = false; });
onUnmounted(() => { disposed = true; if (timer) window.clearTimeout(timer); });
</script>

<template>
  <section class="inspection"><div class="inspection-heading"><div><h2>判题巡查</h2><p>每 15 秒刷新本场队列统计和系统失败提交{{ snapshot ? ` · 更新于 ${formatDisplayDateTime(snapshot.updatedAt)}` : '' }}</p></div></div><el-alert v-if="error" type="warning" :closable="false" :title="`${error}${snapshot?'；下方保留上次统计，请刷新后确认。':''}`"/><el-skeleton v-if="!snapshot&&loading" :rows="4" animated/><template v-if="snapshot"><div class="stats"><article v-for="[label,value] in [['总提交',snapshot.stats.total],['等待判题',snapshot.stats.waiting],['正在判题',snapshot.stats.judging],['已完成',snapshot.stats.finished],['系统失败',snapshot.failures]]" :key="label"><small>{{ label }}</small><strong>{{ value }}</strong></article></div><el-alert :type="snapshot.failures?'error':'success'" :closable="false" :title="snapshot.failures?`发现 ${snapshot.failures} 条系统失败提交（SE / FAILED），请检查错误日志与判题服务。`:'当前未发现 SE / FAILED 系统失败提交。'"/><el-alert v-if="snapshot.stats.waiting>0" type="info" :closable="false" :title="`当前有 ${snapshot.stats.waiting} 条提交等待判题；若持续积压，请检查本场判题队列。`"/><el-card v-if="snapshot.recentFailures.length" shadow="never"><template #header>系统失败记录（SE、FAILED 各最多 5 条）</template><article v-for="item in snapshot.recentFailures" :key="item.id" class="failure"><div><el-tag type="danger">{{ item.status }}</el-tag><strong>提交 #{{ item.id }}</strong><span>{{ item.displayName||item.username||'未知选手' }}</span><span>{{ item.contestProblemLabel }} {{ item.problemTitle }}</span></div><p>{{ item.errorMessage||item.judgeMessage||'暂无错误说明，请打开判题队列查看日志。' }}</p></article></el-card></template></section>
</template>

<style scoped>.inspection{display:flex;flex-direction:column;gap:12px}.inspection-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.inspection-heading h2{margin:0;font-size:18px}.inspection-heading p{margin:5px 0 0;color:var(--el-text-color-secondary);font-size:12px}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.stats article{display:flex;flex-direction:column;gap:7px;padding:16px;border-radius:8px;background:var(--content-bg)}.stats small{color:var(--el-text-color-secondary)}.stats strong{font-size:22px}.failure{padding:12px 0;border-bottom:1px solid var(--card-border)}.failure:last-child{border-bottom:0}.failure>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.failure p{margin:8px 0 0;color:var(--el-text-color-secondary);white-space:pre-wrap}@media(max-width:760px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.inspection-heading{align-items:flex-start;flex-direction:column}}</style>

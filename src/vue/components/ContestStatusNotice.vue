<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { fetchContest, fetchContests } from "../../data/apiClient";
import { wsClient } from "../../utils/websocket";

type Target = { id: number; title: string; endAt: number; status: string };
type Observation = { endAt: number; sawBeforeEnd: boolean; status: string };
const route = useRoute();
const contestId = computed(() => Number(route.path.match(/(?:^|\/)contests\/(\d+)(?:\/|$)/)?.[1] ?? 0));
const targets = ref<Target[]>([]);
const observations = new Map<number, Observation>();
const handled = new Set<number>();
const queue = ref<number[]>([]);
const activeId = computed(() => queue.value[0] ?? null);
const active = computed(() => targets.value.find((item) => item.id === activeId.value));
let cleanups: Array<() => void> = [];
let cancelled = false;
let timer = 0;

function normalized(status: string) {
  const value = status.toUpperCase();
  if (value === "ENDED" || value.includes("已结束")) return "ENDED";
  if (value === "RUNNING" || value.includes("进行中")) return "RUNNING";
  if (value === "NOT_STARTED" || value.includes("未开始")) return "NOT_STARTED";
  return value;
}
function enqueue(id: number) { if (handled.has(id)) return; handled.add(id); queue.value.push(id); }
function mapContest(row: Record<string, unknown>): Target | null {
  const id = Number(row.id ?? 0);
  const end = new Date(String(row.endTime ?? row.endsAt ?? "")).getTime();
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(end)) return null;
  return { id, title: String(row.title ?? `比赛 #${id}`), endAt: end, status: String(row.status ?? "") };
}
function observe(rows: Target[]) {
  const now = Date.now();
  const next = new Map(targets.value.map((item) => [item.id, item]));
  rows.forEach((item) => next.set(item.id, item));
  targets.value = [...next.values()];
  rows.forEach((target) => {
    const status = normalized(target.status);
    const previous = observations.get(target.id);
    if (!previous || previous.endAt !== target.endAt) {
      observations.set(target.id, { endAt: target.endAt, sawBeforeEnd: now < target.endAt && status !== "ENDED", status });
      return;
    }
    if (previous.status !== "ENDED" && status === "ENDED") enqueue(target.id);
    previous.status = status;
  });
}
async function load() {
  cancelled = false;
  cleanups.forEach((cleanup) => cleanup()); cleanups = [];
  const currentPath = route.path.replace(/\/$/, "");
  const listPage = currentPath === "/contests";
  const current = contestId.value;
  const requests: Promise<unknown>[] = [];
  if (listPage) requests.push(fetchContests(1,100).then((result) => result.list as unknown[]));
  if (current > 0) requests.push(fetchContest(current).then((result) => [result]));
  if (!requests.length) { targets.value = []; return; }
  try {
    const results = await Promise.all(requests);
    if (cancelled) return;
    const flattened = results.flatMap((value) => Array.isArray(value) ? value : []) as Array<Record<string,unknown>>;
    const mapped = flattened.map(mapContest).filter((item):item is Target=>Boolean(item));
    observe(mapped);
    for (const target of mapped) {
      wsClient.subscribeToContestStatus(target.id, (update) => {
        if (normalized(update.status) === "ENDED") { observe([{ ...target, status: "ENDED" }]); }
      }).then((cleanup) => { if (cancelled) cleanup(); else cleanups.push(cleanup); }).catch(() => undefined);
    }
  } catch { /* Time based transition detection remains available for pages with cached contests. */ }
}
function checkEndTimes() {
  const now = Date.now();
  targets.value.forEach((target) => {
    const seen = observations.get(target.id);
    if (!seen || !seen.sawBeforeEnd || now < seen.endAt) return;
    seen.sawBeforeEnd = false; seen.status = "ENDED"; enqueue(target.id);
  });
}
watch(() => route.fullPath, () => { void load(); }, { immediate: true });
timer = window.setInterval(checkEndTimes,1000);
onUnmounted(() => { cancelled = true; cleanups.forEach((cleanup)=>cleanup()); window.clearInterval(timer); });
function acknowledge() { queue.value = queue.value.slice(1); }
</script>

<template><el-dialog :model-value="activeId!==null" title="比赛已结束" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" width="420px"><p>{{ active?.title ? `“${active.title}”已结束，请手动刷新页面获取最新状态。` : "比赛已结束，请手动刷新页面获取最新状态。" }}</p><template #footer><el-button type="primary" @click="acknowledge">确定</el-button></template></el-dialog></template>

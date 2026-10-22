<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { readAuthToken } from "../../api/tokenStorage";
import { createContestMessageRequestId, getContestMessages, readContestMessages, sendContestMessage, type ContestMessage, type ContestMessageFeed } from "../../api/contestMessages";
import { formatDisplayDateTime } from "../../lib/format";
import { wsClient } from "../../utils/websocket";

const route = useRoute();
const pathId = computed(() => route.path.match(/^\/contests\/(\d+)(?:\/|$)/)?.[1]);
const practiceContestId = computed(() => route.path.startsWith("/practice/problem/") ? new URLSearchParams(route.fullPath.split("?")[1] || "").get("contestId") : null);
const contestId = computed(() => Number(pathId.value ?? practiceContestId.value ?? 0));
const token = ref(readAuthToken("frontend"));
const messages = ref<ContestMessage[]>([]);
const feed = ref<ContestMessageFeed | null>(null);
const error = ref("");
const denied = ref(false);
const open = ref(false);
const tab = ref<"chat" | "broadcast">("chat");
const draft = ref("");
const sending = ref(false);
const sendError = ref("");
const readThrough = ref(0);
const notice = ref<ContestMessage | null>(null);
const scrollArea = ref<HTMLElement>();
const root = ref<HTMLElement>();
const position = ref({ right: window.innerWidth <= 600 ? 16 : 24, bottom: window.innerWidth <= 600 ? 16 : 24 });
const dragging = ref(false);
const dragGesture = ref<{ pointerId: number; x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null);
const suppressClick = ref(false);
const dragStyle = computed(() => ({ right: `${position.value.right}px`, bottom: `${position.value.bottom}px` }));
const visibleMessages = computed(() => messages.value.filter((item) => tab.value === "broadcast" ? item.kind === "BROADCAST" : item.kind !== "BROADCAST"));
const latestId = computed(() => messages.value[messages.value.length - 1]?.id ?? 0);
const readId = computed(() => Math.max(readThrough.value, feed.value?.readThroughId ?? 0));
const unread = computed(() => messages.value.filter((item) => item.kind !== "QUESTION" && item.id > readId.value));
let unsubscribe: (() => void) | undefined;
let feedGeneration = 0;
let cursor = 0;
let loading = false;
let refreshAgain = false;
let sendingContent = "";
let requestId = "";
let noticeTimer = 0;
let rootObserver: ResizeObserver | undefined;

function clampPosition(next: { right: number; bottom: number }) {
  const bounds = root.value?.getBoundingClientRect();
  if (!bounds) return next;
  const edge = 8;
  return {
    right: Math.max(edge, Math.min(next.right, window.innerWidth - bounds.width - edge)),
    bottom: Math.max(edge, Math.min(next.bottom, window.innerHeight - bounds.height - edge)),
  };
}
function fitPosition() { position.value = clampPosition(position.value); }
function startDrag(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return;
  const nestedControl = (event.target as HTMLElement).closest("button, input, textarea, a");
  if (nestedControl && event.currentTarget !== nestedControl) return;
  suppressClick.value = false;
  dragGesture.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...position.value, moved: false };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function moveDrag(event: PointerEvent) {
  const gesture = dragGesture.value;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
  gesture.moved = true;
  suppressClick.value = true;
  dragging.value = true;
  position.value = clampPosition({ right: gesture.right - dx, bottom: gesture.bottom - dy });
}
function endDrag(event: PointerEvent) {
  if (dragGesture.value?.pointerId !== event.pointerId) return;
  if (event.type !== "pointerup") suppressClick.value = false;
  dragGesture.value = null;
  dragging.value = false;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
}
function handleClickCapture(event: MouseEvent) {
  if (!suppressClick.value) return;
  event.preventDefault(); event.stopPropagation(); suppressClick.value = false;
}

function merge(incoming: ContestMessage[]) {
  const map = new Map(messages.value.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  messages.value = [...map.values()].sort((a, b) => a.id - b.id);
  const unreadMessages = messages.value.filter((item) => item.kind !== "QUESTION" && item.id > readId.value);
  const latestUnread = unreadMessages[unreadMessages.length - 1];
  if (latestUnread && latestUnread.id > (notice.value?.id ?? 0)) {
    notice.value = latestUnread;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice.value = null; }, 10000);
  }
}
async function refresh() {
  if (loading) { refreshAgain = true; return; }
  if (denied.value || !contestId.value) return;
  const generation = feedGeneration;
  const id = contestId.value;
  loading = true;
  try {
    let hasMore = true;
    while (hasMore) {
      const result = await getContestMessages(id, cursor);
      if (generation !== feedGeneration) return;
      feed.value = result;
      merge(result.messages);
      if (result.messages.length) cursor = result.messages[result.messages.length - 1].id;
      error.value = "";
      hasMore = result.hasMore && result.messages.length > 0;
    }
  } catch (cause) {
    if (generation !== feedGeneration) return;
    const status = cause instanceof Error && "status" in cause ? Number((cause as Error & {status:number}).status) : 0;
    const text = cause instanceof Error ? cause.message : "比赛消息加载失败";
    error.value = text;
    if ([401,403,404,405].includes(status) || /无权|权限|未登录|比赛不存在|IP|报名/.test(text)) { denied.value = true; messages.value = []; feed.value = null; }
  } finally {
    if (generation !== feedGeneration) return;
    loading = false;
    if (refreshAgain) { refreshAgain = false; void refresh(); }
  }
}
async function markRead() {
  const id = contestId.value, throughId = latestId.value;
  try { await readContestMessages(id, throughId); if (id === contestId.value) { readThrough.value = throughId; notice.value = null; } }
  catch (cause) { sendError.value = cause instanceof Error ? cause.message : "标记已读失败"; }
}
async function send() {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  const generation = feedGeneration;
  sending.value = true; sendError.value = "";
  if (sendingContent !== content) { sendingContent = content; requestId = createContestMessageRequestId(); }
  try { await sendContestMessage(contestId.value, content, requestId, "QUESTION"); if (generation !== feedGeneration) return; draft.value = ""; sendingContent = ""; requestId = ""; }
  catch (cause) { if (generation === feedGeneration) sendError.value = cause instanceof Error ? cause.message : "发送失败，请重试"; }
  finally { if (generation === feedGeneration) sending.value = false; }
}
watch([contestId, token], ([id, nextToken], _previous, onCleanup) => {
  feedGeneration++; draft.value = ""; sending.value = false; sendingContent = ""; requestId = ""; sendError.value = ""; notice.value = null; window.clearTimeout(noticeTimer);
  unsubscribe?.(); unsubscribe = undefined; cursor = 0; loading = false; refreshAgain = false; messages.value = []; feed.value = null; error.value = ""; denied.value = false; readThrough.value = 0;
  if (!nextToken || !Number.isSafeInteger(id) || id <= 0) return;
  let cancelled = false;
  unsubscribe = wsClient.subscribeContestMessages((event) => { if (!cancelled && event.contestId === id) merge([event.message]); }, () => { void refresh(); }, (connected) => { if (!connected && !cancelled) error.value ||= "消息连接已断开，正在重连"; });
  void refresh();
  const resume = () => { if (document.visibilityState === "visible") void refresh(); };
  window.addEventListener("focus", resume); document.addEventListener("visibilitychange", resume);
  onCleanup(() => { cancelled = true; window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); });
}, { immediate: true });
watch(() => route.fullPath, () => { token.value = readAuthToken("frontend"); });
watch([open, tab], async ([isOpen]) => { if (isOpen) { await nextTick(); if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight; } });
watch(feed, async (value) => {
  if (!value) { rootObserver?.disconnect(); rootObserver = undefined; window.removeEventListener("resize", fitPosition); return; }
  await nextTick();
  if (!root.value) return;
  rootObserver?.disconnect();
  rootObserver = new ResizeObserver(fitPosition);
  rootObserver.observe(root.value);
  window.removeEventListener("resize", fitPosition);
  window.addEventListener("resize", fitPosition);
  fitPosition();
}, { immediate: true });
function closeNotice() { notice.value = null; }
onUnmounted(() => { unsubscribe?.(); window.clearTimeout(noticeTimer); rootObserver?.disconnect(); window.removeEventListener("resize", fitPosition); });
</script>

<template>
  <div v-if="token && contestId > 0 && !denied && feed" ref="root" class="contest-chat" :class="{ 'is-dragging': dragging }" :style="dragStyle" data-testid="contest-messaging" @click.capture="handleClickCapture" @keydown.capture="suppressClick=false">
    <aside v-if="!open && notice && notice.id > readId" class="chat-notice" role="status" aria-live="polite"><div class="notice-title"><strong>{{ notice.kind === "BROADCAST" ? "比赛广播" : "答疑回复" }}</strong><button type="button" aria-label="关闭提示" @click="closeNotice">×</button></div><p>{{ notice.content }}</p><button type="button" @click="tab=notice?.kind==='BROADCAST'?'broadcast':'chat';open=true">查看消息</button></aside>
    <section v-if="open" class="chat-panel" aria-label="比赛答疑与广播"><header class="drag-handle" title="拖动标题栏可移动聊天窗口" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag"><div><strong>比赛答疑与广播</strong><small>{{ feed.contestTitle }}</small></div><button aria-label="关闭比赛消息" @click="open=false">×</button></header><nav><button :class="{selected:tab==='chat'}" @click="tab='chat'">我的答疑</button><button :class="{selected:tab==='broadcast'}" @click="tab='broadcast'">比赛广播</button><button class="read-button" :disabled="!unread.length" @click="markRead">全部已读</button></nav><p v-if="error" class="chat-error">{{ error }}</p><div ref="scrollArea" class="chat-messages"><p v-if="!visibleMessages.length" class="chat-empty">{{ tab==='broadcast'?'暂无广播':'有比赛问题可以在这里询问，只有你和比赛管理人员可以查看。' }}</p><article v-for="item in visibleMessages" :key="item.id" :class="{own:item.kind==='QUESTION'}"><div><b>{{ item.kind==='QUESTION'?'我':item.kind==='BROADCAST'?'比赛广播':'比赛管理人员' }}</b><time>{{ formatDisplayDateTime(item.createdAt) }}</time><i v-if="item.kind!=='QUESTION'&&item.id>readId" aria-label="未读"/></div><p>{{ item.content }}</p></article></div><p v-if="sendError" class="chat-error">{{ sendError }}</p><form v-if="tab==='chat'" class="chat-compose" @submit.prevent="send"><textarea v-model="draft" aria-label="比赛答疑问题" placeholder="请输入比赛问题（仅你与管理人员可见）" maxlength="2000" rows="3" :disabled="sending"/><div><small>{{ draft.length }}/2000</small><button type="submit" :disabled="sending||!draft.trim()">{{ sending?'发送中…':'发送问题' }}</button></div></form></section>
    <button class="chat-launcher drag-handle" title="点击打开或收起，拖动可移动位置" :aria-expanded="open" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" @click="open=!open">比赛答疑<span v-if="unread.length">{{ unread.length>99?'99+':unread.length }}</span></button>
  </div>
</template>

<style scoped>
.contest-chat{position:fixed;z-index:1500;font-size:13px}.drag-handle{touch-action:none;user-select:none;cursor:grab}.is-dragging .drag-handle{cursor:grabbing}.chat-launcher{min-height:44px;padding:0 16px;border:0;border-radius:24px;background:var(--el-color-primary);color:var(--el-color-white);font-weight:600;box-shadow:0 8px 22px #102a5a3d;cursor:pointer}.chat-launcher span{margin-left:9px;padding:2px 7px;border-radius:10px;background:var(--el-color-danger);color:var(--el-color-white);font-size:11px}.chat-panel{width:min(380px,calc(100vw - 28px));height:min(560px,calc(100vh - 100px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--card-border);border-radius:14px;background:var(--content-bg);box-shadow:0 18px 50px #1018282e}.chat-panel header,.notice-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid var(--card-border)}.chat-panel header>div{display:flex;flex-direction:column;gap:4px}.chat-panel header small{color:var(--el-text-color-placeholder)}.chat-panel header button,.notice-title button{border:0;background:none;color:var(--el-text-color-secondary);font-size:20px;cursor:pointer}.chat-panel nav{display:flex;gap:5px;padding:8px;border-bottom:1px solid var(--card-border)}.chat-panel nav button{padding:7px 9px;border:0;border-radius:6px;background:transparent;color:var(--el-text-color-secondary);cursor:pointer}.chat-panel nav button.selected{background:var(--el-color-primary-light-9);color:var(--el-color-primary)}.chat-panel nav .read-button{margin-left:auto}.chat-panel nav .read-button:disabled{opacity:.45;cursor:not-allowed}.chat-messages{flex:1;overflow:auto;padding:14px;background:var(--el-fill-color-light)}.chat-messages article{margin-bottom:12px;padding:10px 11px;border-radius:9px;background:var(--content-bg)}.chat-messages article.own{background:var(--el-color-primary-light-9)}.chat-messages article>div{display:flex;align-items:center;gap:8px;color:var(--el-text-color-regular);font-size:11px}.chat-messages time{margin-left:auto;color:var(--el-text-color-placeholder)}.chat-messages i{width:7px;height:7px;border-radius:50%;background:#f04438}.chat-messages article p{margin:8px 0 0;color:var(--el-text-color-regular);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}.chat-empty{margin:25px 4px;color:var(--el-text-color-placeholder);text-align:center;line-height:1.5}.chat-compose{padding:11px;border-top:1px solid var(--card-border)}.chat-compose textarea{width:100%;resize:vertical;box-sizing:border-box;padding:9px;border:1px solid var(--el-border-color);border-radius:7px;font:inherit}.chat-compose>div{display:flex;align-items:center;justify-content:space-between;margin-top:8px}.chat-compose small{color:var(--el-text-color-placeholder)}.chat-compose button,.chat-notice>button{padding:7px 11px;border:0;border-radius:6px;background:var(--el-color-primary);color:var(--el-color-white);cursor:pointer}.chat-compose button:disabled{opacity:.5;cursor:not-allowed}.chat-error{margin:7px 12px;color:var(--el-color-danger);font-size:12px}.chat-notice{width:min(310px,calc(100vw - 30px));margin-bottom:10px;overflow:hidden;border:1px solid var(--card-border);border-radius:12px;background:var(--content-bg);box-shadow:0 12px 34px #10182824}.chat-notice .notice-title{padding:10px 12px}.chat-notice p{margin:10px 12px;color:var(--el-text-color-regular);line-height:1.45}.chat-notice>button{display:block;margin:0 12px 12px auto}@media(max-width:520px){.chat-panel{height:calc(100vh - 84px)}}
</style>

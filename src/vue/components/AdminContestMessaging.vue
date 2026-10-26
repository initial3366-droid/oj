<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { createContestMessageRequestId, getContestMessages, sendContestMessage, type ContestMessage, type ContestMessageFeed } from "../../api/contestMessages";
import { formatDisplayDateTime } from "../../lib/format";
import { adminWsClient, teacherWsClient } from "../../utils/websocket";

const props = defineProps<{ contestId: number; teacher?: boolean }>();
const messages = ref<ContestMessage[]>([]); const feed = ref<ContestMessageFeed | null>(null); const error = ref(""); const loading = ref(false);
const selected = ref<number | null>(null); const mode = ref<"reply" | "broadcast">("reply"); const drafts = ref<Record<string, string>>({});
const sending = ref(false); const sendError = ref(""); const sent = ref(""); let unsubscribe: (() => void) | undefined; let cursor = 0; let again = false; let request: { key: string; id: string } | null = null;
const threads = computed(() => {
  const grouped = new Map<number, { id: number; name: string; last: ContestMessage }>();
  for (const item of messages.value) {
    if (item.participantId == null) continue;
    const previous = grouped.get(item.participantId);
    grouped.set(item.participantId, { id: item.participantId, name: item.kind === "QUESTION" ? item.authorName : previous?.name || `选手 #${item.participantId}`, last: item });
  }
  return [...grouped.values()].sort((a, b) => Number(b.last.kind === "QUESTION") - Number(a.last.kind === "QUESTION") || b.last.id - a.last.id);
});
const selectedId = computed(() => selected.value ?? threads.value[0]?.id ?? null);
const draftKey = computed(() => mode.value === "broadcast" ? "broadcast" : String(selectedId.value));
const visibleMessages = computed(() => messages.value.filter((item) => mode.value === "broadcast" ? item.kind === "BROADCAST" : item.participantId === selectedId.value));
function merge(incoming: ContestMessage[]) { const byId = new Map(messages.value.map((item) => [item.id, item])); incoming.forEach((item) => byId.set(item.id, item)); messages.value = [...byId.values()].sort((a, b) => a.id - b.id); }
async function refresh() {
  if (loading.value) { again = true; return; }
  loading.value = true;
  try {
    let more = true;
    while (more) { const result = await getContestMessages(props.contestId, cursor, true, props.teacher); feed.value = result; merge(result.messages); if (result.messages.length) cursor = result.messages[result.messages.length - 1].id; more = result.hasMore && result.messages.length > 0; }
    error.value = "";
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "比赛消息加载失败"; }
  finally { loading.value = false; if (again) { again = false; void refresh(); } }
}
async function send() {
  const content = (drafts.value[draftKey.value] ?? "").trim();
  if (!content || sending.value || (mode.value === "reply" && selectedId.value == null)) return;
  const key = `${draftKey.value}:${content}`; if (request?.key !== key) request = { key, id: createContestMessageRequestId() };
  sending.value = true; sendError.value = ""; sent.value = "";
  try {
    await sendContestMessage(props.contestId, content, request.id, mode.value === "broadcast" ? "BROADCAST" : "REPLY", selectedId.value ?? undefined, props.teacher);
    drafts.value = { ...drafts.value, [draftKey.value]: "" }; request = null; sent.value = mode.value === "broadcast" ? "广播已发送，所有报名选手可接收并在刷新后补看。" : "回复已发送，仅该选手可查看。"; await refresh();
  } catch (cause) { sendError.value = cause instanceof Error ? cause.message : "发送失败，请重试"; }
  finally { sending.value = false; }
}
watch(() => props.contestId, (id) => {
  unsubscribe?.(); messages.value = []; feed.value = null; error.value = ""; cursor = 0; again = false;
  if (!id) return;
  unsubscribe = (props.teacher ? teacherWsClient : adminWsClient).subscribeContestMessages((event) => { if (event.contestId === id) merge([event.message]); }, () => { void refresh(); }, (connected) => { if (!connected) error.value ||= "消息连接已断开，正在重连"; });
  void refresh();
}, { immediate: true });
onUnmounted(() => unsubscribe?.());
</script>

<template>
  <section class="admin-chat" aria-label="管理比赛答疑与广播"><div class="mode-buttons"><el-button :type="mode==='reply'?'primary':'default'" :disabled="sending" @click="mode='reply';sendError='';sent=''">选手答疑（{{ threads.filter((item)=>item.last.kind==='QUESTION').length }} 待回复）</el-button><el-button :type="mode==='broadcast'?'primary':'default'" :disabled="sending" @click="mode='broadcast';sendError='';sent=''">比赛广播</el-button></div><el-alert v-if="error" type="warning" :closable="false" :title="error"/><el-alert v-if="mode==='broadcast'" type="info" :closable="false" title="广播会发送给所有报名通过的选手。"/><div v-if="feed" class="chat-layout" :class="{broadcast:mode==='broadcast'}"><aside v-if="mode==='reply'" class="thread-list" aria-label="答疑选手列表"><el-empty v-if="!threads.length" description="暂无选手提问" :image-size="70"/><button v-for="thread in threads" :key="thread.id" type="button" :class="{selected:selectedId===thread.id}" :disabled="sending" @click="selected=thread.id;sendError='';sent=''"><strong>{{ thread.name }}</strong><small>#{{ thread.id }} · {{ formatDisplayDateTime(thread.last.createdAt) }}</small><span>{{ thread.last.content }}</span><el-tag v-if="thread.last.kind==='QUESTION'" type="warning" size="small">待回复</el-tag></button></aside><div class="chat-main"><div class="chat-history" :aria-label="mode==='broadcast'?'已发送广播':'选手答疑对话'"><el-empty v-if="!visibleMessages.length" :description="mode==='broadcast'?'暂无广播':'选择选手查看对话'" :image-size="70"/><article v-for="item in visibleMessages" :key="item.id"><div><strong>{{ item.kind==='QUESTION'?item.authorName:item.kind==='BROADCAST'?`广播 · ${item.authorName}`:`回复 · ${item.authorName}` }}</strong><time>{{ formatDisplayDateTime(item.createdAt) }}</time></div><p>{{ item.content }}</p></article></div><el-input v-model="drafts[draftKey]" type="textarea" :rows="4" maxlength="2000" show-word-limit :disabled="sending||(mode==='reply'&&selectedId==null)" :aria-label="mode==='broadcast'?'广播内容':'答疑回复内容'" :placeholder="mode==='broadcast'?'输入要发送给所有已报名选手的广播':'输入对该选手的回复'"/><el-alert v-if="sendError" type="error" :closable="false" :title="sendError"/><el-alert v-if="sent" type="success" :closable="false" :title="sent"/><el-button type="primary" :loading="sending" :disabled="!(drafts[draftKey]??'').trim()||(mode==='reply'&&selectedId==null)" @click="send">{{ mode==='broadcast'?'发送广播':'发送回复' }}</el-button></div></div><el-skeleton v-else-if="loading" :rows="6" animated/></section>
</template>

<style scoped>.admin-chat{display:flex;flex-direction:column;gap:12px;padding:12px 0}.mode-buttons{display:flex;gap:8px;flex-wrap:wrap}.chat-layout{display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:16px}.chat-layout.broadcast{grid-template-columns:minmax(0,1fr)}.thread-list{max-height:500px;overflow:auto;border:1px solid var(--card-border);border-radius:8px;background:var(--content-bg)}.thread-list button{position:relative;display:flex;width:100%;flex-direction:column;gap:5px;padding:12px 10px;border:0;border-bottom:1px solid var(--card-border);background:var(--content-bg);text-align:left;cursor:pointer}.thread-list button.selected{background:var(--el-color-primary-light-9)}.thread-list button strong{font-size:13px}.thread-list button small{color:var(--el-text-color-placeholder)}.thread-list button span{overflow:hidden;color:var(--el-text-color-regular);text-overflow:ellipsis;white-space:nowrap}.thread-list .el-tag{position:absolute;right:8px;top:8px}.chat-main{display:flex;flex-direction:column;gap:10px;min-width:0}.chat-history{height:320px;overflow:auto;padding:12px;border-radius:8px;background:var(--el-fill-color-light)}.chat-history article{margin-bottom:10px;padding:12px;border-radius:8px;background:var(--content-bg)}.chat-history article>div{display:flex;justify-content:space-between;gap:12px;color:var(--el-text-color-secondary);font-size:12px}.chat-history time{white-space:nowrap;color:var(--el-text-color-placeholder)}.chat-history p{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;color:var(--el-text-color-regular)}@media(max-width:760px){.chat-layout{grid-template-columns:1fr}.thread-list{max-height:220px}}</style>

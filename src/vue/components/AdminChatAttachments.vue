<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Document, Paperclip, Refresh } from "@element-plus/icons-vue";
import { adminDelete, adminPost } from "../../admin/api/adminClient";
import { CHAT_FILE_ACCEPT, CHAT_FILE_API, CHAT_IMAGE_API, type ChatAttachment, type ChatFileData, type ChatImageData, type FilePreviewSource } from "../../api/adminChat";

const props = withDefaults(defineProps<{ disabled?: boolean; instructions?: string }>(), { disabled: false, instructions: "" });
const emit = defineEmits<{ error: [message: string]; previewImage: [source: { src: string; name: string }]; previewFile: [source: FilePreviewSource] }>();
const input = ref<HTMLInputElement>();
const attachments = ref<ChatAttachment[]>([]);
const ready = computed(() => attachments.value.every((item) => item.status === "ready"));
const hasItems = computed(() => attachments.value.length > 0);

function isImage(file: File) { return file.type.startsWith("image/") || /\.(?:jpe?g|png|gif|webp)$/i.test(file.name); }
function deleteStored(value: ChatImageData | ChatFileData) {
  const endpoint = "entryCount" in value ? CHAT_FILE_API : CHAT_IMAGE_API;
  void adminDelete(`${endpoint}/${encodeURIComponent(value.id)}`).catch((error: unknown) => emit("error", `附件删除失败：${error instanceof Error ? error.message : "请稍后重试"}`));
}
function change(update: (current: ChatAttachment[]) => ChatAttachment[]) { attachments.value = update(attachments.value); }
function addFiles(files: File[]) {
  emit("error", "");
  for (const file of files) {
    if (attachments.value.length >= 4) { emit("error", "每条消息最多上传 4 个附件"); break; }
    const image = isImage(file);
    if (image && !["image/jpeg", "image/png", "image/gif", "image/webp", ""].includes(file.type)) { emit("error", "仅支持 JPEG、PNG、GIF、WebP 图片"); continue; }
    if (file.size > (image ? 5 : 50) * 1024 * 1024) { emit("error", image ? "单张图片不能超过 5 MB" : "单个文件不能超过 50 MB"); continue; }
    const key = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ChatAttachment = { key, file, src: image ? URL.createObjectURL(file) : "", status: "uploading" };
    attachments.value = [...attachments.value, item];
    void upload(item);
  }
}

async function upload(item: ChatAttachment) {
  change((items) => items.map((current) => current.key === item.key ? { ...current, status: "uploading", error: undefined } : current));
  try {
    const body = new FormData(); body.append("file", item.file);
    const image = isImage(item.file);
    const stored = await adminPost<ChatImageData | ChatFileData>(image ? CHAT_IMAGE_API : CHAT_FILE_API, body, true, 120000);
    if (!attachments.value.some((current) => current.key === item.key)) { deleteStored(stored); return; }
    change((items) => items.map((current) => current.key === item.key ? { ...current, status: "ready", ...(image ? { image: stored as ChatImageData } : { document: stored as ChatFileData }) } : current));
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败，请重试";
    change((items) => items.map((current) => current.key === item.key ? { ...current, status: "error", error: message } : current));
  }
}

function remove(key: string) {
  const item = attachments.value.find((current) => current.key === key);
  change((items) => items.filter((current) => current.key !== key));
  if (!item) return;
  if (item.src) URL.revokeObjectURL(item.src);
  if (item.image) deleteStored(item.image);
  if (item.document) deleteStored(item.document);
}

function openFile(item: ChatAttachment) {
  if (!item.document) return;
  emit("previewFile", { file: item.document, files: attachments.value.flatMap((current) => current.document ? [current.document] : []), instructions: props.instructions });
}
function onSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  addFiles(Array.from(target.files ?? [])); target.value = "";
}
function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? []).filter((item) => item.kind === "file").flatMap((item) => { const file = item.getAsFile(); return file ? [file] : []; });
  if (files.length) { event.preventDefault(); addFiles(files); }
}
function take() { const saved = attachments.value; attachments.value = []; return saved; }
function release(items: ChatAttachment[]) { items.forEach((item) => { if (item.src) URL.revokeObjectURL(item.src); }); }
function restore(items: ChatAttachment[]) {
  if (!attachments.value.length) attachments.value = items;
  else release(items);
}
function clear(deleteFiles = true) {
  const previous = attachments.value; attachments.value = []; release(previous);
  if (deleteFiles) previous.forEach((item) => { if (item.image) deleteStored(item.image); if (item.document) deleteStored(item.document); });
}
function readyData() {
  return { images: attachments.value.flatMap((item) => item.image ? [item.image] : []), files: attachments.value.flatMap((item) => item.document ? [item.document] : []) };
}
function allReady() { return ready.value; }
function hasAttachments() { return hasItems.value; }

defineExpose({ attachments, ready, hasItems, addFiles, take, release, restore, clear, readyData, allReady, hasAttachments });
onBeforeUnmount(() => clear());
</script>

<template>
  <div class="attachment-box">
    <div v-if="attachments.length" class="attachment-list" aria-label="待发送附件">
      <div v-for="item in attachments" :key="item.key" class="attachment" :class="{ file: !item.src }">
        <button v-if="item.src" type="button" class="image-preview" :aria-label="`预览图片：${item.file.name}`" @click="emit('previewImage', { src: item.src, name: item.file.name })"><img :src="item.src" :alt="item.file.name" /></button>
        <button v-else type="button" class="file-preview" :aria-label="`预览文件：${item.file.name}`" :disabled="!item.document" @click="openFile(item)"><el-icon><Document /></el-icon><span><strong>{{ item.file.name }}</strong><small>{{ item.document ? `已提取 ${item.document.entryCount} 个文件` : "准备解析" }}</small></span></button>
        <button type="button" class="remove" :aria-label="`删除附件：${item.file.name}`" @click="remove(item.key)"><el-icon><Delete /></el-icon></button>
        <span v-if="item.status==='uploading'" class="status">上传中…</span>
        <div v-if="item.status==='error'" class="upload-error" role="alert"><span>{{ item.error }}</span><el-button link type="primary" @click="upload(item)"><el-icon><Refresh /></el-icon>重试</el-button></div>
      </div>
    </div>
    <input ref="input" type="file" :accept="CHAT_FILE_ACCEPT" multiple hidden :disabled="disabled || attachments.length >= 4" @change="onSelect" />
    <el-button text :disabled="disabled || attachments.length >= 4" @click="input?.click()"><el-icon><Paperclip /></el-icon>添加附件 <small>（最多 4 个）</small></el-button>
  </div>
</template>

<style scoped>
.attachment-box{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.attachment-list{display:flex;flex-wrap:wrap;gap:9px}.attachment{position:relative;width:112px;min-height:84px;padding:4px;border:1px solid var(--card-border);border-radius:9px;background:var(--content-bg)}.attachment.file{width:220px}.image-preview,.file-preview{width:100%;height:76px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:0;border-radius:6px;background:var(--el-fill-color-light);cursor:pointer}.image-preview img{width:100%;height:100%;object-fit:cover}.file-preview{justify-content:flex-start;gap:9px;padding:8px;color:var(--el-text-color-regular);text-align:left}.file-preview>span{min-width:0;display:flex;flex-direction:column;gap:4px}.file-preview strong,.file-preview small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-preview strong{max-width:165px;font-size:12px}.file-preview small{color:var(--el-text-color-placeholder);font-size:10px}.file-preview:disabled{cursor:default}.remove{position:absolute;right:5px;top:5px;width:23px;height:23px;display:grid;place-items:center;border:0;border-radius:50%;background:#101828a8;color:var(--el-color-white);cursor:pointer}.status{position:absolute;inset:auto 4px 4px;padding:2px;border-radius:4px;background:#101828a8;color:var(--el-color-white);text-align:center;font-size:10px}.upload-error{position:absolute;inset:auto 4px 4px;display:flex;align-items:center;justify-content:space-between;gap:4px;padding:3px;border-radius:4px;background:#fff2f0;color:var(--el-color-danger);font-size:10px}.attachment-box :deep(.el-button small){color:var(--el-text-color-placeholder);font-size:11px}
</style>

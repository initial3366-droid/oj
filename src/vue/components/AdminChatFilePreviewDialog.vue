<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { adminGet, adminGetBlob } from "../../admin/api/adminClient";
import { CHAT_FILE_API, type FilePreviewSource } from "../../api/adminChat";

type Preview = { file: FilePreviewSource["file"]; entries: { path: string; size: number; kind: string; encoding: string; text: string; truncated: boolean }[]; warnings: string[] };
const props = defineProps<{ source: FilePreviewSource }>();
const emit = defineEmits<{ close: [] }>();
const preview = ref<Preview | null>(null);
const loading = ref(false);
const downloading = ref(false);
const error = ref("");
const selectedPath = ref("");
const currentEntry = computed(() => preview.value?.entries.find((entry) => entry.path === selectedPath.value));

async function load() {
  loading.value = true; error.value = ""; preview.value = null;
  try {
    preview.value = await adminGet<Preview>(`${CHAT_FILE_API}/${encodeURIComponent(props.source.file.id)}`);
    selectedPath.value = preview.value.entries.find((item) => item.kind === "document")?.path || preview.value.entries[0]?.path || "";
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "文件预览加载失败"; }
  finally { loading.value = false; }
}

async function download() {
  downloading.value = true;
  try {
    const blob = await adminGetBlob(`${CHAT_FILE_API}/${encodeURIComponent(props.source.file.id)}/download`);
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = props.source.file.name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "下载失败"); }
  finally { downloading.value = false; }
}

watch(() => props.source.file.id, load);
onMounted(load);
</script>

<template>
  <el-dialog :model-value="true" :title="`文件预览：${source.file.name}`" width="min(1000px,94vw)" @close="emit('close')">
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false"><template #default><el-button link type="primary" @click="load">重试预览</el-button></template></el-alert>
    <el-skeleton v-else-if="loading" :rows="8" animated />
    <template v-else-if="preview">
      <el-alert v-for="(warning,index) in preview.warnings" :key="index" type="warning" :title="warning" :closable="false" />
      <div class="file-preview-layout"><nav class="entry-list" aria-label="文件清单"><button v-for="entry in preview.entries" :key="entry.path" type="button" :class="{active:entry.path===selectedPath}" @click="selectedPath=entry.path"><strong>{{ entry.path }}</strong><small>{{ entry.encoding }} · {{ entry.size }} 字节</small></button></nav><section class="file-content"><strong>{{ currentEntry?.path }}</strong><pre>{{ currentEntry?.text || "此文件没有可显示的文字内容，原文件仍保留。" }}</pre><el-alert v-if="currentEntry?.truncated" type="info" :closable="false" title="这里显示前 2000 个字符；导入时读取原始测试数据。" /></section></div>
    </template>
    <template #footer><el-button :loading="downloading" @click="download">下载原文件</el-button><el-button type="primary" @click="emit('close')">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.file-preview-layout{min-height:360px;max-height:65vh;display:grid;grid-template-columns:minmax(200px,30%) minmax(0,1fr);gap:14px}.entry-list{display:flex;flex-direction:column;gap:5px;overflow:auto;padding:5px;border-right:1px solid var(--card-border)}.entry-list button{display:flex;flex-direction:column;gap:5px;padding:9px;border:0;border-radius:6px;background:transparent;color:var(--el-text-color-regular);text-align:left;cursor:pointer}.entry-list button.active{background:var(--el-color-primary-light-9);color:#175cd3}.entry-list strong,.entry-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.entry-list strong{font-size:12px}.entry-list small{color:var(--el-text-color-placeholder);font-size:10px}.file-content{min-width:0;overflow:auto}.file-content>strong{display:block;margin-bottom:8px}.file-content pre{min-height:300px;max-height:58vh;overflow:auto;margin:0;padding:12px;border-radius:7px;background:var(--el-fill-color-light);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:650px){.file-preview-layout{grid-template-columns:1fr}.entry-list{max-height:150px;border-right:0;border-bottom:1px solid var(--card-border)}}
</style>

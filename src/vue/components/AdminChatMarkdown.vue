<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import HtmlMath from "./HtmlMath.vue";
import { sanitizeAnnouncementHtml } from "../../utils/announcementHtml";

const props = defineProps<{ content: string }>();
const emit = defineEmits<{ downloadFile: [id: string]; openImport: [id: string] }>();

const html = computed(() => {
  const rendered = marked.parse(props.content, { async: false, gfm: true, breaks: false });
  const template = document.createElement("template");
  template.innerHTML = sanitizeAnnouncementHtml(rendered);
  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    const file = link.getAttribute("href")?.match(/^\/qoj-file\/([A-Za-z0-9-]{1,80})$/);
    const imported = link.getAttribute("href")?.match(/^\/qoj-import\/([A-Za-z0-9-]{1,80})$/);
    if (file) {
      link.dataset.chatFile = file[1];
      link.href = "#";
      link.classList.add("chat-action-link");
    } else if (imported) {
      link.dataset.chatImport = imported[1];
      link.href = "#";
      link.classList.add("chat-action-link");
    } else {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
  return template.innerHTML;
});

function handleClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest<HTMLAnchorElement>("a[data-chat-file], a[data-chat-import]");
  if (!link) return;
  event.preventDefault();
  if (link.dataset.chatFile) emit("downloadFile", link.dataset.chatFile);
  if (link.dataset.chatImport) emit("openImport", link.dataset.chatImport);
}
</script>

<template>
  <div class="admin-chat-markdown" @click="handleClick">
    <HtmlMath :value="html" class-name="admin-chat-markdown__content" />
  </div>
</template>

<style scoped>
.admin-chat-markdown{min-width:0;overflow-wrap:anywhere}.admin-chat-markdown :deep(.admin-chat-markdown__content){font:inherit;font-size:13px;line-height:1.65}.admin-chat-markdown :deep(p){margin:0 0 9px}.admin-chat-markdown :deep(p:last-child){margin-bottom:0}.admin-chat-markdown :deep(h1),.admin-chat-markdown :deep(h2),.admin-chat-markdown :deep(h3),.admin-chat-markdown :deep(h4){margin:12px 0 7px;line-height:1.35}.admin-chat-markdown :deep(ul),.admin-chat-markdown :deep(ol){padding-left:22px}.admin-chat-markdown :deep(pre){max-width:100%;overflow:auto;padding:10px 12px;border-radius:6px;background:var(--el-text-color-primary);color:var(--card-border)}.admin-chat-markdown :deep(code){font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.admin-chat-markdown :deep(:not(pre)>code){padding:1px 4px;border-radius:4px;background:var(--card-border);color:var(--el-text-color-regular)}.admin-chat-markdown :deep(table){display:block;width:max-content;max-width:100%;overflow:auto;border-collapse:collapse}.admin-chat-markdown :deep(th),.admin-chat-markdown :deep(td){padding:6px 9px;border:1px solid var(--el-border-color);text-align:left}.admin-chat-markdown :deep(th){background:var(--page-bg)}.admin-chat-markdown :deep(.chat-action-link){font-weight:600}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchPinnedAnnouncement, type Announcement } from "../../data/apiClient";
import { announcementPlainText, sanitizeAnnouncementHtml } from "../../utils/announcementHtml";
import NoticeDetailDialog from "../../../vendor/vue3-element-admin/src/components/NoticeDetailDialog/index.vue";
const announcement = ref<Announcement | null>(null);
const loading = ref(true);
const visible = ref(false);
const detail = computed(() => announcement.value ? {
  id: String(announcement.value.id), title: announcementPlainText(announcement.value.title),
  content: sanitizeAnnouncementHtml(announcement.value.content), type: 1,
  publisherName: "QOJ", publishTime: new Date(announcement.value.updatedAt || announcement.value.createdAt),
} : null);
onMounted(async () => {
  try { announcement.value = await fetchPinnedAnnouncement(); }
  catch { announcement.value = null; }
  finally { loading.value = false; }
});
</script>
<template>
  <el-card v-if="loading || announcement" v-loading="loading" shadow="never" class="pinned-announcement" data-testid="pinned-announcement">
    <el-button v-if="announcement" text type="primary" class="announcement-title" @click="visible = true">{{ announcementPlainText(announcement.title) }}</el-button>
  </el-card>
  <NoticeDetailDialog v-model="visible" :detail="detail" />
</template>
<style scoped>
.pinned-announcement{margin-bottom:10px;text-align:center}
.announcement-title{max-width:100%;height:auto;min-height:40px;font-size:18px;font-weight:600;white-space:normal}
.announcement-title :deep(span){overflow-wrap:anywhere}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchLatestAnnouncements, type Announcement } from "../../data/apiClient";
import { announcementPlainText, sanitizeAnnouncementHtml } from "../../utils/announcementHtml";
import NoticeDetailDialog from "../../../vendor/vue3-element-admin/src/components/NoticeDetailDialog/index.vue";
const announcements = ref<Announcement[]>([]);
const selected = ref<Announcement | null>(null);
const visible = ref(false);
const loading = ref(true);
const detail = computed(() => selected.value ? {
  id: String(selected.value.id), title: announcementPlainText(selected.value.title),
  content: sanitizeAnnouncementHtml(selected.value.content), type: 1,
  publisherName: "QOJ", publishTime: new Date(selected.value.updatedAt || selected.value.createdAt),
} : null);
onMounted(() => {
  fetchLatestAnnouncements(5).then(data => { announcements.value = data.filter(item => !item.isPinned); }).catch(() => undefined).finally(() => { loading.value = false; });
});
function open(item: Announcement) { selected.value = item; visible.value = true; }
</script>
<template>
  <el-card data-testid="ordinary-announcements" v-if="loading || announcements.length" v-loading="loading" shadow="never">
    <el-table :data="announcements" row-key="id" :show-header="false" empty-text="暂无公告">
      <el-table-column min-width="180" align="center"><template #default="{ row }"><el-button text type="primary" @click="open(row)">{{ announcementPlainText(row.title) }}</el-button></template></el-table-column>
    </el-table>
  </el-card>
  <NoticeDetailDialog v-model="visible" :detail="detail" />
</template>

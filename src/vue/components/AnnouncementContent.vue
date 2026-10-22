<script setup lang="ts">
import { computed } from "vue";
import { sanitizeAnnouncementHtml } from "../../utils/announcementHtml";
import "../../styles/announcement.css";

const props = withDefaults(defineProps<{ content: string; className?: string; emptyText?: string }>(), { className: "", emptyText: "" });
const html = computed(() => sanitizeAnnouncementHtml(props.content));
</script>

<template>
  <div v-if="html" class="announcement-html" :class="className" v-html="html" />
  <div v-else class="announcement-html announcement-html-empty" :class="className">{{ emptyText }}</div>
</template>

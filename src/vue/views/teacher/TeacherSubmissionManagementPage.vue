<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import SubmissionManagementPage from "../shared/SubmissionManagementPage.vue";
const route = useRoute();
const practiceOnly = computed(() => route.path === "/teacher/practices/submissions");
withDefaults(defineProps<{ view?: "submissions" | "statistics" | "queue" }>(), { view: "submissions" });
</script>
<template><SubmissionManagementPage :view="view" portal="teacher" :practice-only="practiceOnly" /></template>

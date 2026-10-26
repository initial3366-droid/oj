<script setup lang="ts">
import SubmissionManagementPage from "../shared/SubmissionManagementPage.vue";
defineProps<{ view: "submissions" | "statistics" | "queue" }>();
</script>
<template><SubmissionManagementPage :view="view" portal="admin" /></template>

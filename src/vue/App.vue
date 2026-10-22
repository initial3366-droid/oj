<script setup lang="ts">
import { useFixedLightTheme } from "./template-adapter/systemTheme";
import DocumentTitle from "./components/DocumentTitle.vue";
import ContestMessaging from "./components/ContestMessaging.vue";
import TemplateApp from "../../vendor/vue3-element-admin/src/App.vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
useFixedLightTheme();
</script>
<template><el-config-provider :locale="zhCn"><DocumentTitle /><TemplateApp /><ContestMessaging /></el-config-provider></template>

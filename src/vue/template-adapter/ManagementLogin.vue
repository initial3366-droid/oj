<script setup lang="ts">
import TemplateLogin from "../../../vendor/vue3-element-admin/src/views/login/index.vue";
</script>

<template><div class="qoj-management-login"><TemplateLogin /></div></template>

<style scoped>
/* QOJ only supports password/captcha sign-in in its management portals. */
.qoj-management-login :deep(.login-toolbar),
.qoj-management-login :deep(.login-card__demo),
.qoj-management-login :deep(.login-card__alt),
.qoj-management-login :deep(.login-card__options > a) {
  display: none;
}
</style>

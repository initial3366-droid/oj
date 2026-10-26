<script setup lang="ts">
import TemplateLogin from "../../../vendor/vue3-element-admin/src/views/login/index.vue";

defineProps<{ formOnly?: boolean }>();
</script>

<template><div class="qoj-management-login" :class="{ 'qoj-management-login--form-only': formOnly }"><TemplateLogin /></div></template>

<style scoped>
/* QOJ only supports password/captcha sign-in in its management portals. */
.qoj-management-login :deep(.login-toolbar),
.qoj-management-login :deep(.login-card__demo),
.qoj-management-login :deep(.login-card__alt),
.qoj-management-login :deep(.login-card__options) {
  display: none;
}

.qoj-management-login--form-only :deep(.login-brand),
.qoj-management-login--form-only :deep(.login-card__title),
.qoj-management-login--form-only :deep(.login-card__desc),
.qoj-management-login--form-only :deep(.login-footer) {
  display: none;
}
.qoj-management-login--form-only :deep(.login-page) {
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-8) 0%,
    var(--el-color-primary-light-9) 45%,
    var(--el-color-primary-light-7) 100%
  );
}
.qoj-management-login--form-only :deep(.login-layout) {
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
  padding: 20px;
}
.qoj-management-login--form-only :deep(.login-card) {
  flex: 0 1 430px;
  min-width: 0;
  padding: 0;
  background: transparent;
}
.qoj-management-login--form-only :deep(.login-card__inner) {
  flex: initial;
  padding: 20px;
}
</style>

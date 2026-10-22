<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Loading, UserFilled } from "@element-plus/icons-vue";
import { fetchPublicUserProfile, type PublicUserProfile } from "../../../data/apiClient";
import { formatDisplayDate } from "../../../lib/format";

const route = useRoute();
const id = computed(() => Number(route.params.userId));
const profile = ref<PublicUserProfile | null>(null);
const loading = ref(true);
const message = ref("");
watch(id, async (userId, _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  profile.value = null;
  message.value = "";
  loading.value = true;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    message.value = "用户不存在";
    loading.value = false;
    return;
  }
  try { const result = await fetchPublicUserProfile(userId); if (live) profile.value = result; }
  catch (error) { if (live) message.value = error instanceof Error ? error.message : "用户资料加载失败"; }
  finally { if (live) loading.value = false; }
}, { immediate: true });
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">{{ profile?.displayName || "用户主页" }}</h1><span class="user-profile-subtitle">User Profile</span></div></div></header>
    <el-alert v-if="message" class="user-profile-error" type="error" :title="message" :closable="false" />
    <el-card class="user-profile-card" shadow="never">
      <div v-if="loading" class="user-profile-loading" role="status"><el-icon class="is-loading"><Loading /></el-icon><span>加载用户资料…</span></div>
      <template v-else-if="profile">
        <div class="user-profile-heading">
          <el-avatar :size="56" class="user-profile-avatar"><template v-if="profile.displayName">{{ profile.displayName.charAt(0).toUpperCase() }}</template><el-icon v-else><UserFilled /></el-icon></el-avatar>
          <div><h2>{{ profile.displayName }}</h2><span>@{{ profile.username }}</span></div>
          <el-tag type="primary" effect="light">{{ profile.role }}</el-tag>
        </div>
        <div class="user-profile-stats">
          <div><span>非比赛 AC</span><strong>{{ profile.acCount }}</strong></div>
          <div><span>提交</span><strong>{{ profile.submitCount }}</strong></div>
          <div><span>总分</span><strong>{{ profile.totalScore }}</strong></div>
        </div>
        <el-text type="info">加入时间：{{ formatDisplayDate(profile.createdAt) }}</el-text>
      </template>
      <el-empty v-else description="用户不存在" :image-size="72" />
    </el-card>
  </section>
</template>

<style scoped>
.page-container { width: 100%; }
.user-profile-subtitle { display: block; margin-top: 5px; color: var(--qoj-color-text-2); }
.user-profile-error { margin-bottom: 20px; }
.user-profile-card { border: 1px solid var(--qoj-color-border); border-radius: 16px; }
.user-profile-card :deep(.el-card__body) { padding: 24px; }
.user-profile-loading { min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--qoj-color-text-2); }
.user-profile-loading .el-icon { font-size: 32px; }
.user-profile-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
.user-profile-heading h2 { margin: 0; font-size: 22px; }
.user-profile-heading > div > span { display: block; margin-top: 6px; color: var(--qoj-color-text-2); }
.user-profile-avatar { background: var(--qoj-color-primary); color:var(--el-color-white); font-size: 22px; font-weight: 700; }
.user-profile-stats { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 12px; margin: 24px 0; }
.user-profile-stats > div { padding: 16px; border: 1px solid var(--qoj-color-border); border-radius: 8px; }
.user-profile-stats span { display: block; color: var(--qoj-color-text-2); font-size: 13px; }
.user-profile-stats strong { display: block; margin-top: 6px; font-size: 20px; }
</style>

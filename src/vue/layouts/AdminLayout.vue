<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { adminGet, adminLogout } from "../../admin/api/adminClient";
import { readAuthToken } from "../../api/tokenStorage";
import { adminPath } from "../../utils/adminPath";

import ManagementShell from "./components/ManagementShell.vue";

interface AdminUserInfo { id: number; username: string; displayName: string; role: string; }

const router = useRouter();
const loading = ref(true);
const loadError = ref("");
const user = ref<AdminUserInfo | null>(null);

const siteTitle = ref("后台管理");
const siteLogo = ref("");
const navGroups = [
  { title: "概览", items: [{ title: "仪表盘", path: adminPath("/dashboard") }] },
  { title: "用户与教学", items: [{ title: "学生管理", path: adminPath("/users/students") }, { title: "教师管理", path: adminPath("/users/teachers") }, { title: "专业管理", path: adminPath("/majors") }, { title: "班级管理", path: adminPath("/classes") }, { title: "队伍管理", path: adminPath("/teams") }] },
  { title: "题库与课程", items: [{ title: "题目管理", path: adminPath("/problems") }, { title: "题目文件夹", path: adminPath("/problem-folders") }, { title: "课程管理", path: adminPath("/courses") }, { title: "练习管理", path: adminPath("/practices") }] },
  { title: "比赛与判题", items: [{ title: "比赛管理", path: adminPath("/contests") }, { title: "提交管理", path: adminPath("/submissions") }, { title: "判题队列", path: adminPath("/judge/queue") }, { title: "榜单管理", path: adminPath("/leaderboard") }] },
  { title: "AI 助手", items: [{ title: "AI 对话", path: adminPath("/ai/chat") }, { title: "题目生成", path: adminPath("/ai/problem-generator") }, { title: "AI 设置", path: adminPath("/ai/settings") }] },
  { title: "系统配置", items: [{ title: "前台设置", path: adminPath("/settings/frontend") }, { title: "注册设置", path: adminPath("/settings/register") }, { title: "系统设置", path: adminPath("/settings/system") }, { title: "判题配置", path: adminPath("/judge/config") }, { title: "代码模板", path: adminPath("/settings/code-templates") }, { title: "公告管理", path: adminPath("/settings/announcements") }, { title: "个人信息", path: adminPath("/profile") }] },
];


async function loadUser() {
  if (!readAuthToken("admin")) { void router.replace(adminPath("/login")); return; }
  loading.value = true;
  loadError.value = "";
  try {
    const current = await adminGet<AdminUserInfo>("/api/admin/v1/me", true);
    if (current.role !== "SUPER_ADMIN") { void router.replace("/"); return; }
    user.value = current;
  } catch (error) {
    if (!readAuthToken("admin")) { void router.replace(adminPath("/login")); return; }
    loadError.value = error instanceof Error ? error.message : "后台信息加载失败";
  } finally { loading.value = false; }
}
async function loadBrand() {
  try {
    const response = await fetch("/api/v1/settings/frontend");
    const result = await response.json();
    if (result?.code === 200) { siteTitle.value = result.data?.siteTitle || siteTitle.value; siteLogo.value = result.data?.siteLogo || ""; }
  } catch { /* Branding is optional in the management shell. */ }
}
async function logout() { await adminLogout().catch(() => undefined); void router.replace(adminPath("/login")); }
function onProfileUpdated(event: Event) {
  const updated = (event as CustomEvent<AdminUserInfo>).detail;
  if (user.value && updated?.id === user.value.id) user.value = { ...user.value, ...updated };
}
onMounted(() => window.addEventListener("qoj:admin-profile-updated", onProfileUpdated));
onBeforeUnmount(() => window.removeEventListener("qoj:admin-profile-updated", onProfileUpdated));
onMounted(() => { void loadUser(); void loadBrand(); });
</script>

<template>
  <div v-if="loading" class="admin-loading"><el-icon class="is-loading"><span>◌</span></el-icon>正在加载后台…</div>
  <div v-else-if="loadError" class="admin-error"><el-result icon="error" title="后台信息加载失败" :sub-title="loadError"><template #extra><el-button type="primary" @click="loadUser">重试</el-button></template></el-result></div>
  <div v-else-if="!user" class="admin-loading">正在跳转…</div>
  <ManagementShell v-else :title="siteTitle" :logo="siteLogo" :username="user.displayName || user.username" :groups="navGroups" :home="adminPath('/dashboard')" :profile="adminPath('/profile')" portal="admin" :logout="logout"><RouterView /></ManagementShell>
</template>
<style scoped>
.admin-loading,.admin-error{min-height:100vh;display:grid;place-content:center;gap:12px;background:var(--page-bg);color:var(--el-text-color-secondary)}
</style>

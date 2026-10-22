<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import LayoutSidebar from "../../../vendor/vue3-element-admin/src/layouts/components/LayoutSidebar.vue";
import { Collection, ArrowDown, Menu, User } from "@element-plus/icons-vue";
import { logout } from "../../api/auth";
import { useOjDataStore } from "../stores/ojData";
import EmailBindingGate from "../components/EmailBindingGate.vue";
const ojData = useOjDataStore();
const route = useRoute();
const router = useRouter();
const mobileMenu = ref(false);
const siteTitle = ref("QOJ");
const siteLogo = ref("");
const logoFailed = ref(false);
async function loadBrand() {
  try {
    const response = await fetch("/api/v1/settings/frontend");
    if (!response.ok) return;
    const result = await response.json();
    if (result.code !== 200) return;
    siteTitle.value = typeof result.data?.siteTitle === "string" && result.data.siteTitle.trim() ? result.data.siteTitle.trim() : "QOJ";
    siteLogo.value = typeof result.data?.siteLogo === "string" ? result.data.siteLogo.trim() : "";
    logoFailed.value = false;
  } catch { /* Keep the default brand when configuration is unavailable. */ }
}
const username = computed(() => ojData.activeUser?.displayName || ojData.activeUser?.username || "个人中心");
const links = [
  { title: "首页", path: "/" }, { title: "题库", path: "/problems" },
  { title: "课程", path: "/courses" },
  { title: "比赛", path: "/contests" }, { title: "排行榜", path: "/leaderboard" },
  { title: "关于", path: "/about" },
];
const menuIcons = ["HomeFilled", "Collection", "Reading", "Trophy", "Histogram", "InfoFilled"];
const menus = links.map((link, index) => ({
  path: link.path,
  meta: { title: link.title, icon: `el-icon-${menuIcons[index]}` },
  component: () => import("../views/public/NotFoundPage.vue"),
})) as RouteRecordRaw[];
watch(() => route.path, path => {
  route.meta.activeMenu = links.find(link => link.path === "/" ? path === "/" : path === link.path || path.startsWith(`${link.path}/`))?.path;
}, { immediate: true });
const isActive = (path: string) => path === "/" ? route.path === "/" : route.path === path || route.path.startsWith(`${path}/`);
async function accountAction(command: string) {
  if (command === "logout") { await logout(); ojData.state.activeUser = null; await router.push("/"); }
  else await router.push("/user-center");
}
watch(() => route.fullPath, () => { mobileMenu.value = false; });
onMounted(() => { void ojData.hydrate(); void loadBrand(); });
</script>

<template>
  <EmailBindingGate>
    <div class="front-site">
      <header class="front-header">
        <div class="front-container front-header-inner">
          <RouterLink to="/" class="front-brand" :aria-label="`${siteTitle} 首页`" :title="siteTitle"><span class="brand-mark" :class="{ 'has-logo': siteLogo && !logoFailed }"><img v-if="siteLogo && !logoFailed" :src="siteLogo" :alt="`${siteTitle} Logo`" @error="logoFailed = true" /><el-icon v-else :size="22"><Collection /></el-icon></span><span class="brand-title">{{ siteTitle }}</span></RouterLink>
          <nav class="front-nav layout-root" aria-label="前台导航">
            <LayoutSidebar :data="menus" base-path="/" menu-mode="horizontal" :collapse-override="false" :ellipsis="false" />
          </nav>
          <div class="front-account">
            <el-dropdown v-if="ojData.activeUser" trigger="click" @command="accountAction"><el-button text class="account-button"><el-icon><User /></el-icon><span class="account-name">{{ username }}</span><el-icon><ArrowDown /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="profile">个人中心</el-dropdown-item><el-dropdown-item command="logout" divided>退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
            <template v-else><RouterLink to="/login"><el-button text>登录</el-button></RouterLink><RouterLink to="/register"><el-button type="primary">注册</el-button></RouterLink></template>
            <el-button class="mobile-menu-button" text aria-label="打开前台导航" @click="mobileMenu=true"><el-icon :size="22"><Menu /></el-icon></el-button>
          </div>
        </div>
      </header>
      <main class="front-container front-main"><RouterView /></main>
      <el-drawer v-model="mobileMenu" title="导航" size="min(320px, 88vw)"><nav class="mobile-nav" aria-label="手机前台导航"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="{ active: isActive(link.path) }" :aria-current="isActive(link.path) ? 'page' : undefined">{{ link.title }}</RouterLink></nav></el-drawer>
    </div>
  </EmailBindingGate>
</template>

<style scoped>
.front-site{min-height:100vh;background:var(--page-bg)}
.front-container{width:90%;max-width:none;margin-inline:auto}
.front-header{background:var(--content-bg);border-bottom:0}
.front-header-inner{display:flex;align-items:center;gap:36px;min-height:72px}
.front-brand{display:inline-flex;align-items:center;gap:10px;flex-shrink:0;font-size:22px;font-weight:750;letter-spacing:.5px;color:var(--el-text-color-primary)}
.brand-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.front-brand{min-width:0;max-width:28%;flex-shrink:1}
.brand-mark img{display:block;width:100%;height:100%;object-fit:contain}
.brand-mark.has-logo{background:transparent}
.brand-mark{flex-shrink:0;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#fff;background:var(--el-color-primary)}
.front-nav{flex:1;min-width:0;align-self:stretch;display:flex;align-items:stretch}
.front-nav :deep(.el-menu--horizontal){border:0;--el-menu-horizontal-height:72px;width:100%;height:100%}
.front-nav :deep(.el-menu--horizontal .el-menu-item){height:100%;min-width:112px;padding-inline:26px;box-sizing:border-box;border:0;border-bottom:3px solid transparent}
.front-nav :deep(.el-menu--horizontal .el-menu-item:hover),
.front-nav :deep(.el-menu--horizontal .el-menu-item.is-active){border-bottom-color:var(--el-color-success);color:var(--el-color-success)!important}
.front-account{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0}
.account-button :deep(>span){display:flex;align-items:center;gap:8px}
.account-name{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.front-main{padding-block:24px;min-height:calc(100vh - 73px)}
.front-main :deep(> .page-container){padding:0;height:auto;min-height:0}
.mobile-menu-button{display:none}
.mobile-nav{display:flex;flex-direction:column;gap:8px}
.mobile-nav a{padding:12px 16px;border-radius:8px;color:var(--el-text-color-regular)}
.mobile-nav a.active{background:var(--el-color-primary-light-9);color:var(--el-color-primary);font-weight:600}
a:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:4px}
@media(max-width:1023px){.front-container{width:calc(100% - 48px)}}
@media(min-width:801px) and (max-width:1279px){.front-header-inner{gap:20px}.front-nav :deep(.el-menu--horizontal .el-menu-item){min-width:80px;padding-inline:12px}}
@media(max-width:1000px){.front-header-inner{gap:24px}.account-name{max-width:80px}}
@media(max-width:800px){.front-container{width:calc(100% - 32px)}.front-header-inner{min-height:64px;gap:16px}.front-nav{display:none}.mobile-menu-button{display:inline-flex}.front-main{padding-block:16px;min-height:calc(100vh - 65px)}.front-brand{font-size:20px;max-width:45%}.account-name{max-width:90px}}
</style>

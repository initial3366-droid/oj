<script setup lang="ts">
import { computed, onBeforeUnmount, provide, watch } from "vue";
import { useRoute } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import TemplateLayout from "../../../../vendor/vue3-element-admin/src/layouts/index.vue";
import { usePermissionStore, useUserStore, useTagsViewStore } from "../../template-adapter/stores";
import defaultAvatar from "../../../../vendor/vue3-element-admin/src/assets/images/logo.png";
import { managementBrandKey } from "../../template-adapter/branding";
import { useSettingsStore } from "../../../../vendor/vue3-element-admin/src/stores/settings";
interface MenuItem { title: string; path: string }
interface MenuGroup { title: string; items: MenuItem[] }
const props = defineProps<{ title: string; logo?: string; username: string; groups: MenuGroup[]; home: string; profile: string; portal: string; logout?: () => Promise<void> }>();
provide(managementBrandKey, computed(() => ({ title: props.title, logo: props.logo, home: props.home })));
const settings = useSettingsStore();
settings.showAppLogo = true;
const emit = defineEmits<{ logout: [] }>();
const route = useRoute();
const permission = usePermissionStore();
const user = useUserStore();
const tags = useTagsViewStore();
const navigationIcons: Record<string, string> = {
  "概览": "Odometer", "仪表盘": "Odometer", "工作概览": "Odometer",
  "用户与教学": "UserFilled", "学生与班级": "School", "学生管理": "User", "学生列表": "User",
  "教师管理": "Avatar", "专业管理": "School", "班级管理": "House", "队伍管理": "UserFilled",
  "题库与课程": "Collection", "题库与教学": "Collection", "题目管理": "Document", "题目文件夹": "FolderOpened",
  "课程管理": "Reading", "练习管理": "EditPen", "练习素材": "EditPen",
  "比赛与判题": "Trophy", "竞赛": "Trophy", "比赛管理": "Trophy", "提交管理": "UploadFilled",
  "提交记录": "Tickets", "练习提交": "Tickets", "判题队列": "List", "榜单管理": "Histogram", "练习统计": "DataAnalysis",
  "AI 助手": "Cpu", "AI 对话": "ChatDotRound", "题目生成": "MagicStick", "AI 设置": "Operation",
  "系统配置": "Setting", "前台设置": "Monitor", "注册设置": "Key", "系统设置": "Setting",
  "判题配置": "SetUp", "代码模板": "DocumentCopy", "公告管理": "Bell", "个人信息": "Postcard",
  "导入学生": "Upload", "加入申请": "Checked", "账户": "UserFilled",
  "首页": "HomeFilled", "题库": "Collection", "课程": "Reading", "我的课程": "Reading", "练习": "EditPen",
  "比赛": "Trophy", "排行榜": "Histogram", "关于": "InfoFilled", "个人中心": "User", "登录": "Key", "注册": "CirclePlus",
};
const menuIcon = (title: string) => `el-icon-${navigationIcons[title] || "Menu"}`;
const menus = computed(() => props.groups.map((group, index) => {
  const children = group.items.map(item => ({ path: item.path, name: `${props.portal}-menu-${item.path}`, meta: { title: item.title, icon: menuIcon(item.title), affix: item.path === props.home }, component: () => import('../../views/public/NotFoundPage.vue') }));
  if (children.length === 1) return { ...children[0], meta: { ...children[0]!.meta, icon: menuIcon(group.title) } } as RouteRecordRaw;
  return { path: `/qoj-menu-${props.portal}-${index}`, meta: { title: group.title, icon: menuIcon(group.title) }, children } as RouteRecordRaw;
}));
watch(menus, value => { permission.routes = value; permission.mixLayoutSideMenus = value; }, { immediate: true });
watch(() => [props.username, props.profile, props.portal], () => {
  user.configure(props.username, defaultAvatar, props.profile, props.portal === 'admin' ? props.home.replace(/\/dashboard$/, '/login') : props.portal === 'teacher' ? '/teacher/login' : '/login', async () => { if (props.logout) await props.logout(); else emit('logout'); });
}, { immediate: true });
watch(() => route.path, path => {
  const active = props.groups.flatMap(group => group.items).filter(item => path === item.path || path.startsWith(`${item.path}/`)).sort((a,b) => b.path.length - a.path.length)[0];
  route.meta.activeMenu = active?.path;
  if (!route.meta.title) route.meta.title = active?.title || props.title;
}, { immediate: true });
onBeforeUnmount(() => { tags.delAllViews(); permission.routes = []; permission.mixLayoutSideMenus = []; });
</script>
<template><div class="qoj-management" :data-portal="portal"><TemplateLayout /></div></template>

<style scoped>
.qoj-management[data-portal="admin"] :deep(.layout-toolbar__item:has(.i-svg\:language)),
.qoj-management[data-portal="admin"] :deep(.layout-toolbar__item:has(.notice__dropdown)){display:none}
</style>

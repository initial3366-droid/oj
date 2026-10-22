<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ADMIN_PREFIX } from "../../config";
import { dynamicPageTitle } from "../composables/usePageTitle";
import { fetchSiteTitle } from "../../data/apiClient";

const route = useRoute();
const siteTitle = ref("QOJ 在线评测系统");
const override = ref<string | null>(null);
const adminBase = `/${ADMIN_PREFIX}`;

function pageTitle(path: string) {
  const adminPath = path.startsWith(adminBase) ? path.slice(adminBase.length) || "/" : "";
  if (adminPath) {
    const rules: Array<[RegExp, string]> = [
      [/^\/login$/, "后台登录"], [/^\/dashboard$/, "后台首页"],
      [/^\/users\/students$/, "学生列表"], [/^\/users\/teachers$/, "教师列表"], [/^\/majors$/, "专业管理"],
      [/^\/problems\/new$/, "添加题目"], [/^\/problems\/\d+\/edit$/, "编辑题目"], [/^\/problems\/\d+\/test-cases$/, "测试数据"], [/^\/problems$/, "题目列表"],
      [/^\/problem-folders(?:\/new|\/\d+)?$/, "题目文件夹"],
      [/^\/courses\/\d+$/, "课程详情"], [/^\/courses$/, "课程管理"],
      [/^\/practices\/new$/, "创建题单"], [/^\/practices\/\d+\/publish$/, "发布题单"], [/^\/practices\/publications\/\d+\/edit$/, "编辑发布题单"], [/^\/practices\/publications\/\d+\/report$/, "发布做题信息"], [/^\/practices\/\d+\/edit$/, "编辑题单"], [/^\/practices$/, "题单列表"],
      [/^\/contests\/new$/, "创建比赛"], [/^\/contests\/\d+\/submissions$/, "提交记录"], [/^\/contests\/\d+\/judge\/queue$/, "判题队列"], [/^\/contests\/\d+\/edit$/, "编辑比赛"], [/^\/contests\/\d+$/, "比赛详情"], [/^\/contests$/, "比赛列表"],
      [/^\/submissions\/statistics$/, "提交统计"], [/^\/submissions$/, "提交列表"], [/^\/(?:judge\/queue|submission-queue)$/, "判题队列"], [/^\/judge\/config$/, "判题配置"],
      [/^\/leaderboard$/, "全站榜单"], [/^\/classes\/\d+$/, "班级详情"], [/^\/classes$/, "班级管理"], [/^\/teams$/, "队伍管理"],
      [/^\/settings\/frontend$/, "前端配置"], [/^\/settings\/register$/, "注册配置"], [/^\/settings\/system$/, "系统配置"], [/^\/settings\/code-templates$/, "代码配置"], [/^\/settings\/announcements$/, "公告管理"],
      [/^\/ai\/chat$/, "AI 控制台 · 对话"], [/^\/ai\/problem-generator$/, "AI 控制台 · 出题"], [/^\/ai\/settings$/, "AI 控制台 · 配置"], [/^\/profile$/, "个人信息"],
    ];
    return rules.find(([pattern]) => pattern.test(adminPath))?.[1] ?? "后台管理";
  }
  const rules: Array<[RegExp, string]> = [
    [/^\/$/, "首页"], [/^\/about$/, "关于"], [/^\/problems$/, "题库"], [/^\/problems\/(?:cp|p)?\d+\/submissions$/, "题目提交记录"],
    [/^\/courses$/, "我的课程"], [/^\/courses\/\d+$/, "课程详情"], [/^\/practice$/, "我的课程"], [/^\/practice\/problem\/(?:cp|p)\d{8}$/, "写代码"], [/^\/practice\/history\/(?:cp|p)\d{8}$/, "历史提交"], [/^\/practice\/\d+$/, "题单详情"],
    [/^\/contests$/, "比赛"], [/^\/contests\/\d+\/scoreboard$/, "比赛榜单"], [/^\/contests\/\d+\/public-scoreboard$/, "公开榜单"], [/^\/contests\/\d+$/, "比赛详情"], [/^\/leaderboard$/, "排行榜"], [/^\/users\/\d+$/, "用户主页"], [/^\/(?:user-center|profile)$/, "用户中心"], [/^\/login$/, "登录"], [/^\/register$/, "注册"],
  ];
  if (path.startsWith("/teacher")) {
    const teacherPath = path.slice("/teacher".length) || "/";
    const teacherRules: Array<[RegExp, string]> = [
      [/^\/login$/, "教师端登录"], [/^\/dashboard$/, "首页"], [/^\/classes$/, "班级管理"], [/^\/students$/, "学生列表"], [/^\/import$/, "导入学生"], [/^\/applications$/, "加入申请"], [/^\/submissions$/, "提交记录"], [/^\/stats$/, "练习统计"], [/^\/practices\/submissions$/, "提交记录"],
      [/^\/practices\/new$/, "创建题单"], [/^\/practices\/\d+\/publish$/, "发布题单"], [/^\/practices\/publications\/\d+\/edit$/, "编辑发布题单"], [/^\/practices\/publications\/\d+\/report$/, "发布做题信息"], [/^\/practices\/\d+\/report$/, "练习报告"], [/^\/practices\/\d+\/edit$/, "编辑题单"], [/^\/practices$/, "题单列表"],
      [/^\/problems\/new$/, "创建题目"], [/^\/problems\/\d+\/edit$/, "编辑题目"], [/^\/problems\/\d+\/test-cases$/, "测试数据"], [/^\/problems$/, "题目列表"], [/^\/problem-folders(?:\/new|\/\d+)?$/, "题目文件夹"], [/^\/courses\/\d+$/, "课程详情"], [/^\/courses$/, "课程管理"], [/^\/contests\/new$/, "创建比赛"], [/^\/contests\/\d+\/edit$/, "编辑比赛"], [/^\/contests\/\d+$/, "比赛详情"], [/^\/contests$/, "比赛管理"], [/^\/profile$/, "个人信息"],
    ];
    return teacherRules.find(([pattern]) => pattern.test(teacherPath))?.[1] ?? "教师端";
  }
  return rules.find(([pattern]) => pattern.test(path))?.[1] ?? "页面不存在";
}

function updateTitle() {
  const title = override.value ?? (dynamicPageTitle.value?.path === route.fullPath ? dynamicPageTitle.value.title : null) ?? pageTitle(route.path);
  const portalTitle = route.path.startsWith(adminBase) ? "后台管理" : route.path.startsWith("/teacher") ? "教师端" : "";
  if (portalTitle) document.title = `${title === portalTitle ? portalTitle : `${title} - ${portalTitle}`} - ${siteTitle.value}`;
  else document.title = title === "首页" ? siteTitle.value : `${title} - ${siteTitle.value}`;
  if (portalTitle) document.body.dataset.qojPortal = route.path.startsWith(adminBase) ? "admin" : "teacher";
  else delete document.body.dataset.qojPortal;
}

function onTitleOverride(event: Event) {
  const title = (event as CustomEvent<{ title?: string | null }>).detail?.title?.trim();
  override.value = title || null;
}

watch(() => [route.path, route.query] as const, () => { override.value = null; updateTitle(); }, { immediate: true });
watch([siteTitle, override, dynamicPageTitle], updateTitle);
onMounted(() => {
  window.addEventListener("qoj:document-title", onTitleOverride);
  void fetchSiteTitle().then((title) => { if (title.trim()) siteTitle.value = title.trim(); }).catch(() => undefined);
});
onUnmounted(() => {
  window.removeEventListener("qoj:document-title", onTitleOverride);
  delete document.body.dataset.qojPortal;
});
</script>

<template><span hidden aria-hidden="true" /></template>

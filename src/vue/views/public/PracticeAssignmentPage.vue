<script setup lang="ts">
import { openFrontendPage } from "../../../api/frontendSessionSync";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Lock } from "@element-plus/icons-vue";
import { formatDisplayDate } from "../../../lib/format";
import { fetchPracticeDetail, type Practice } from "../../../data/apiClient";
import "../../../pages/PracticeAssignmentPage.css";

const route = useRoute();
const router = useRouter();
const practiceIdText = computed(() => String(route.params.practiceId ?? ""));
const numericPracticeId = computed(() => Number(practiceIdText.value));
const practice = ref<Practice | null>(null);
const password = ref("");
const message = ref("");
const loading = ref(true);
const problemPage = ref(1);
const problemPageSize = ref(10);
const pagedProblems = computed(() => practice.value?.problems.slice((problemPage.value - 1) * problemPageSize.value, problemPage.value * problemPageSize.value) ?? []);

watch(practiceIdText, async (value, _previous, onCleanup) => {
  if (value.startsWith("p")) {
    await router.replace(`/practice/problem/${encodeURIComponent(value)}`);
    return;
  }
  let live = true;
  onCleanup(() => { live = false; });
  const id = Number(value);
  practice.value = null;
  message.value = "";
  problemPage.value = 1;
  if (!Number.isSafeInteger(id) || id <= 0) {
    message.value = "题单不存在";
    loading.value = false;
    return;
  }
  loading.value = true;
  try { const result = await fetchPracticeDetail(id); if (live) practice.value = result; }
  catch (error) { if (live) message.value = error instanceof Error ? error.message : "题单加载失败"; }
  finally { if (live) loading.value = false; }
}, { immediate: true });

watch(() => practice.value?.endTime, (endTime, _previous, onCleanup) => {
  if (!endTime) return;
  const deadline = new Date(endTime).getTime();
  if (!Number.isFinite(deadline)) return;
  let timer = 0;
  const check = () => {
    window.clearTimeout(timer);
    const remaining = deadline - Date.now();
    if (remaining <= 0) { practice.value = null; message.value = "题单已截止，无法查看"; }
    else timer = window.setTimeout(check, Math.min(remaining, 24 * 60 * 60 * 1000));
  };
  check();
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  onCleanup(() => {
    window.clearTimeout(timer);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
  });
});

async function unlock() {
  if (!Number.isSafeInteger(numericPracticeId.value) || numericPracticeId.value <= 0) return;
  loading.value = true;
  try { practice.value = await fetchPracticeDetail(numericPracticeId.value, password.value); message.value = ""; }
  catch (error) { message.value = error instanceof Error ? error.message : "题单加载失败"; }
  finally { loading.value = false; }
}
function openProblem(problemId: string) {
  openFrontendPage(`/practice/problem/${encodeURIComponent(problemId)}?practiceId=${practice.value?.id}`);
}
function returnToCourse() { void router.push(practice.value?.courseId ? `/courses/${practice.value.courseId}` : "/courses"); }
function difficultyType(value: string) {
  if (value.includes("简单") || value === "入门") return "success";
  if (value.includes("中等")) return "warning";
  if (value.includes("困难") || value === "地狱") return "danger";
  return "info";
}
</script>

<template>
  <div v-if="loading && !practice" class="practice-assignment-loading page-container" role="status">题单加载中…</div>
  <div v-else-if="!practice && message" class="practice-unlock-wrap">
    <el-card class="practice-unlock-card" shadow="never">
      <template #header><div class="practice-unlock-title"><el-icon><Lock /></el-icon><strong>题单访问</strong></div></template>
      <el-text type="info">{{ message }}</el-text>
      <form class="practice-unlock-form" @submit.prevent="unlock">
        <label v-if="message.includes('密码')">题单密码<el-input v-model="password" type="password" show-password placeholder="请输入题单密码" /></label>
        <el-button v-if="message.includes('密码')" type="primary" native-type="submit" :loading="loading">进入题单</el-button>
        <el-button @click="router.push('/courses')">返回我的课程</el-button>
      </form>
    </el-card>
  </div>
  <div v-else-if="practice" class="practice-assignment-page">
    <el-button @click="returnToCourse">{{ practice.courseId ? "返回课程" : "返回我的课程" }}</el-button>
    <header class="practice-assignment-header">
      <div class="practice-assignment-heading-row">
        <div class="practice-assignment-copy"><span class="practice-assignment-eyebrow">题单</span><h1 class="practice-assignment-title">{{ practice.title }}</h1><p class="practice-assignment-description">{{ practice.description || "暂无说明" }}</p></div>
        <div class="practice-assignment-meta"><el-tag type="primary">{{ practice.problems.length }} 题</el-tag><el-tag v-if="practice.endTime">截止：{{ formatDisplayDate(practice.endTime) }}</el-tag><el-tag v-if="practice.hasPassword" type="success">已验证</el-tag></div>
      </div>
    </header>
    <section class="practice-assignment-table-shell" aria-label="题单题目列表">
      <el-table class="practice-assignment-table" :data="pagedProblems" row-key="id" stripe>
        <el-table-column label="题目" min-width="200"><template #default="{ row }"><span class="practice-assignment-problem-title">{{ row.title }}</span></template></el-table-column>
        <el-table-column label="标签" min-width="200"><template #default="{ row }"><div class="practice-problem-tags"><el-tag v-for="tag in row.tags || []" :key="tag" effect="plain">{{ tag }}</el-tag></div></template></el-table-column>
        <el-table-column label="难度" width="110"><template #default="{ row }"><el-tag :type="difficultyType(row.difficulty)">{{ row.difficulty }}</el-tag></template></el-table-column>
        <el-table-column label="是否完成" width="120"><template #default="{ row }"><el-tag :type="['AC','ACCEPTED'].includes(row.attemptStatus?.trim().toUpperCase() || '') ? 'success' : 'info'">{{ ['AC','ACCEPTED'].includes(row.attemptStatus?.trim().toUpperCase() || '') ? "已完成" : "未完成" }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="130"><template #default="{ row }"><el-button type="primary" @click="openProblem(row.id)">写代码</el-button></template></el-table-column>
      </el-table>
      <Pagination v-if="practice.problems.length > problemPageSize" v-model:page="problemPage" v-model:limit="problemPageSize" :page-sizes="[10,20,50]" :total="practice.problems.length" />
    </section>
  </div>
</template>

<style scoped>
.practice-assignment-loading, .practice-unlock-wrap { min-height: 520px; display: grid; place-items: center; color: var(--qoj-color-text-2); }
.practice-unlock-card { width: min(100%, 480px); }
.practice-unlock-title { display: flex; align-items: center; gap: 12px; font-size: 18px; }
.practice-unlock-title .el-icon { color: var(--qoj-color-primary); }
.practice-unlock-form { display: grid; gap: 14px; margin-top: 20px; }
.practice-unlock-form label { display: grid; gap: 8px; }
.practice-problem-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.practice-assignment-table-shell :deep(.el-pagination) { justify-content: flex-end; margin-top: 16px; }
</style>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Lock, Search } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { fetchPractices, type Practice } from "../../../data/apiClient";

type PracticeScope = "all" | "public" | "class";
const router = useRouter();
const practices = ref<Practice[]>([]);
const total = ref(0);
const message = ref("");
const keyword = ref("");
const scope = ref<PracticeScope>("all");
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const filteredPractices = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return practices.value;
  return practices.value.filter((practice) => practice.title.toLowerCase().includes(query) || practice.description.toLowerCase().includes(query));
});
const currentStart = computed(() => total.value ? (page.value - 1) * pageSize.value + 1 : 0);
const currentEnd = computed(() => Math.min(page.value * pageSize.value, total.value));

watch([page, pageSize, scope], async ([currentPage, currentSize, currentScope], _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  loading.value = true;
  try {
    const result = await fetchPractices(currentPage, currentSize, currentScope);
    if (live) { practices.value = result.list; total.value = result.total; message.value = ""; }
  } catch (error) {
    if (live) message.value = error instanceof Error ? error.message : "题单加载失败";
  } finally { if (live) loading.value = false; }
}, { immediate: true });

function isComplete(practice: Practice) { return practice.problems.length > 0 && practice.problems.every((problem) => ["AC", "ACCEPTED"].includes(problem.attemptStatus?.trim().toUpperCase() || "")); }
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">公共题单</h1></div></div></header>
    <div class="practice-list-toolbar">
      <el-input v-model="keyword" placeholder="筛选题单" clearable aria-label="筛选题单"><template #prefix><el-icon><Search /></el-icon></template></el-input>
      <el-select v-model="scope" aria-label="筛选题单范围"><el-option label="全部范围" value="all" /><el-option label="所有人" value="public" /><el-option label="班级" value="class" /></el-select>
    </div>
    <el-alert v-if="message" class="practice-list-error" type="error" :title="message" :closable="false" />
    <el-table :data="filteredPractices" row-key="id" stripe v-loading="loading" empty-text="暂无题单">
      <el-table-column label="题单名称" min-width="240"><template #default="{ row }"><strong>{{ row.title }}</strong><p class="practice-list-description">{{ row.description || "暂无说明" }}</p></template></el-table-column>
      <el-table-column label="范围" width="120"><template #default="{ row }"><el-tag>{{ row.audience === "CLASS" ? "班级" : "所有人" }}</el-tag></template></el-table-column>
      <el-table-column label="题目" width="100"><template #default="{ row }">{{ row.problems.length }} 题</template></el-table-column>
      <el-table-column label="权限" width="100"><template #default="{ row }"><el-tag v-if="row.hasPassword" type="warning"><el-icon><Lock /></el-icon> 密码</el-tag><el-tag v-else type="success">公开</el-tag></template></el-table-column>
      <el-table-column label="是否完成" width="110"><template #default="{ row }"><el-tag :type="isComplete(row) ? 'success' : 'info'">{{ isComplete(row) ? "已完成" : "未完成" }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="110"><template #default="{ row }"><el-button type="primary" @click="router.push(`/practice/${row.id}`)">查看</el-button></template></el-table-column>
    </el-table>
    <div v-if="total > 0" class="practice-list-pagination"><span>显示第 {{ currentStart }} 条-第 {{ currentEnd }} 条，共 {{ total }} 条</span><Pagination v-model:page="page" v-model:limit="pageSize" :page-sizes="[10,20,50]" :total="total" /></div>
  </section>
</template>

<style scoped>
.page-container { width: 100%; }
.practice-list-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.practice-list-toolbar .el-input { width: 220px; }
.practice-list-toolbar .el-select { width: 160px; }
.practice-list-description { margin: 4px 0 0; color: var(--qoj-color-text-2); font-size: 13px; }
.practice-list-error { margin-bottom: 16px; }
.practice-list-pagination { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 16px; color: var(--qoj-color-text-2); }
.practice-list-pagination .el-pagination { margin-left: auto; }
@media (max-width: 640px) { .practice-list-toolbar .el-input, .practice-list-toolbar .el-select { width: 100%; } .practice-list-pagination .el-pagination { margin-left: 0; } }
</style>

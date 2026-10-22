<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { adminGet } from "../../admin/api/adminClient";
import { teacherGet } from "../../teacher/teacherApi";
import { fetchFolderOptions } from "../../components/practices/practiceEditorApi";
import Pagination from "../../../vendor/vue3-element-admin/src/components/Pagination/index.vue";
interface Problem { id: number; title: string; difficulty?: number; testCaseCount?: number; tags?: string[] }
interface Folder { id: number; name: string; problemCount?: number }
const props = withDefaults(defineProps<{ teacher?: boolean; selectedIds?: number[] }>(), { teacher: false, selectedIds: () => [] });
const emit = defineEmits<{ add: [problem: Problem] }>();
const folders = ref<Folder[]>([]);
const folderId = ref<number>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const rows = ref<Problem[]>([]);
const loading = ref(false);
const error = ref("");
let version = 0;
function get<T>(url: string) { return props.teacher ? teacherGet<T>(url) : adminGet<T>(url); }
const available = computed(() => rows.value.filter(row => !props.selectedIds.includes(row.id)));
async function loadFolders() {
  try { folders.value = await fetchFolderOptions(get); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "文件夹加载失败"; }
}
async function loadProblems() {
  const request = ++version;
  rows.value = [];
  error.value = "";
  if (folderId.value == null) { total.value = 0; loading.value = false; return; }
  loading.value = true;
  try {
    const query = new URLSearchParams({ folderId: String(folderId.value), page: String(page.value), pageSize: String(pageSize.value), keyword: keyword.value.trim() });
    const result = await get<{ list: Problem[]; total: number }>(`/api/admin/v1/problems?${query}`);
    if (request !== version) return;
    rows.value = result.list ?? [];
    total.value = result.total ?? 0;
  } catch (cause) { if (request === version) error.value = cause instanceof Error ? cause.message : "题目加载失败"; }
  finally { if (request === version) loading.value = false; }
}
function search() { if (page.value !== 1) page.value = 1; else void loadProblems(); }
watch(folderId, search);
watch([page, pageSize], () => { void loadProblems(); });
onMounted(() => { void loadFolders(); });
</script>
<template>
  <section class="folder-problem-picker" aria-label="按题目文件夹选择">
    <div class="picker-toolbar">
      <el-select v-model="folderId" filterable clearable placeholder="先选择题目文件夹" aria-label="题目文件夹"><el-option v-for="folder in folders" :key="folder.id" :label="folder.name" :value="folder.id"/></el-select>
      <el-input v-model="keyword" clearable :disabled="folderId == null" placeholder="搜索文件夹内题目" aria-label="搜索文件夹内题目" @keyup.enter="search" @clear="search"/>
      <el-button :disabled="folderId == null" @click="search">搜索</el-button>
      <el-button :disabled="!available.length" @click="available.forEach(row => emit('add', row))">添加本页未选题目</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-empty v-if="folderId == null" description="请先选择题目文件夹" :image-size="64"/>
    <template v-else>
      <el-table v-loading="loading" :data="rows" row-key="id" empty-text="该文件夹暂无匹配题目">
        <el-table-column prop="id" label="ID" width="90" align="center"/>
        <el-table-column prop="title" label="题目" min-width="180" align="center"/>
        <el-table-column prop="difficulty" label="难度" width="90" align="center"/>
        <el-table-column label="操作" width="100" align="center"><template #default="{ row }"><el-button link type="primary" :disabled="selectedIds.includes(row.id)" @click="emit('add', row)">{{ selectedIds.includes(row.id) ? '已添加' : '添加' }}</el-button></template></el-table-column>
      </el-table>
      <Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[10,20,50]"/>
    </template>
  </section>
</template>
<style scoped>
.folder-problem-picker{min-width:0;padding-bottom:24px}.picker-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px}.picker-toolbar>.el-select,.picker-toolbar>.el-input{flex:1 1 180px;min-width:0;max-width:300px}.picker-toolbar>.el-button{margin:0}.folder-problem-picker :deep(.pagination-container){margin-top:14px}@media(max-width:600px){.picker-toolbar>.el-select,.picker-toolbar>.el-input{max-width:none;flex-basis:100%}}
</style>

<script setup lang="ts">
import FolderProblemPicker from "../../components/FolderProblemPicker.vue";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminDelete, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";
import { teacherDelete, teacherGet, teacherPost, teacherPut } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import { fetchPracticeEditorDetail } from "../../../components/practices/practiceEditorApi";
import { formatDisplayDateTime } from "../../../lib/format";

type Problem = { id: number; title: string; difficulty?: number; tags?: string[]; timeLimit?: number; memoryLimit?: number };
type Practice = { id: number; title: string; description?: string; ownerAccountType: string; accessScope: "ALL" | "MAJOR" | "PRIVATE"; majorId?: number | null; majorName?: string | null; owner?: boolean; canEdit: boolean; canCopy: boolean; canPublish: boolean; problems: Problem[]; createdAt: string };
type Publication = { id: number; sourcePracticeId: number; title: string; publisherAccountType: string; status: string; studentAccessMode: "ALL" | "SELECTED_CLASSES"; classIds: number[]; problems: Problem[]; createdAt: string };
type Page<T> = { total: number; list: T[] };
type Major = { id: number; name: string };

const route = useRoute();
const router = useRouter();
const teacherMode = computed(() => route.path.startsWith("/teacher/"));
const editingId = computed(() => Number(route.params.practiceId) || null);
const mode = computed(() => route.path.endsWith("/new") ? "create" : route.path.endsWith("/edit") ? "edit" : "list");
const courseId = computed(() => Number(route.query.courseId) || null);
const basePath = computed(() => teacherMode.value ? "/teacher" : adminPath(""));
function get<T>(path: string) { return teacherMode.value ? teacherGet<T>(path) : adminGet<T>(path); }
function post<T>(path: string, body?: unknown) { return teacherMode.value ? teacherPost<T>(path, body) : adminPost<T>(path, body); }
function put<T>(path: string, body?: unknown) { return teacherMode.value ? teacherPut<T>(path, body) : adminPut<T>(path, body); }
function remove<T>(path: string) { return teacherMode.value ? teacherDelete<T>(path) : adminDelete<T>(path); }

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const keyword = ref("");
const practices = ref<Practice[]>([]);
const publications = ref<Publication[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const majors = ref<Major[]>([]);
const selectedProblems = ref<Problem[]>([]);
const problemDialog = ref(false);
const form = reactive({ title: "", description: "", accessScope: "ALL" as "ALL" | "MAJOR" | "PRIVATE", majorId: undefined as number | undefined });
const filteredRows = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return query ? practices.value.filter(item => item.title.toLocaleLowerCase().includes(query)) : practices.value;
});

async function loadList() {
  loading.value = true;
  error.value = "";
  try {
    const [result, publicationResult] = await Promise.all([
      get<Page<Practice>>(`/api/admin/v1/practices?page=${page.value}&pageSize=${pageSize}`),
      get<Publication[]>("/api/admin/v1/practices/publications"),
    ]);
    practices.value = result.list ?? [];
    total.value = result.total ?? practices.value.length;
    publications.value = publicationResult ?? [];
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "题单列表加载失败";
  } finally { loading.value = false; }
}

async function loadEditor() {
  loading.value = true;
  error.value = "";
  try {
    majors.value = await get<Major[]>("/api/admin/v1/majors?activeOnly=true");
    if (mode.value === "edit" && editingId.value) {
      const practice = await fetchPracticeEditorDetail<Practice>(get, editingId.value);
      if (!practice.canEdit) throw new Error("题单不存在或无权编辑");
      form.title = practice.title;
      form.description = practice.description ?? "";
      form.accessScope = practice.accessScope ?? "PRIVATE";
      form.majorId = practice.majorId ?? undefined;
      selectedProblems.value = practice.problems ?? [];
    } else {
      Object.assign(form, { title: "", description: "", accessScope: "ALL", majorId: undefined });
      selectedProblems.value = [];
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "题单数据加载失败"; }
  finally { loading.value = false; }
}


function openProblems() { problemDialog.value = true; }
function addProblem(problem: Problem) {
  if (selectedProblems.value.some(item => item.id === problem.id)) return;
  selectedProblems.value = [...selectedProblems.value, problem];
}
function moveProblem(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= selectedProblems.value.length) return;
  const items = [...selectedProblems.value];
  [items[index], items[target]] = [items[target], items[index]];
  selectedProblems.value = items;
}

async function save() {
  if (!form.title.trim()) { ElMessage.warning("请输入题单名称"); return; }
  if (!selectedProblems.value.length) { ElMessage.warning("请至少选择一道题目"); return; }
  if (form.accessScope === "MAJOR" && !form.majorId) { ElMessage.warning("请选择授权专业"); return; }
  saving.value = true;
  try {
    const payload = { title: form.title.trim(), description: form.description.trim(), accessScope: form.accessScope, majorId: form.accessScope === "MAJOR" ? form.majorId : null, problemIds: selectedProblems.value.map(item => item.id) };
    if (mode.value === "edit" && editingId.value) {
      await put(`/api/admin/v1/practices/${editingId.value}`, payload);
      ElMessage.success("题单已更新");
    } else {
      const created = await post<{ id: number }>("/api/admin/v1/practices", payload);
      ElMessage.success("题单已创建");
      if (courseId.value) { await router.push({ path: `${basePath.value}/practices/${created.id}/publish`, query: { courseId: String(courseId.value) } }); return; }
    }
    await router.push(`${basePath.value}/practices`);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "题单保存失败"); }
  finally { saving.value = false; }
}

async function copy(id: number) {
  try { await post(`/api/admin/v1/practices/${id}/copy`); ElMessage.success("题单已复制"); await loadList(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "复制失败"); }
}
async function deletePractice(id: number) {
  try { await ElMessageBox.confirm("确定删除这个题单吗？", "删除题单", { type: "warning" }); await remove(`/api/admin/v1/practices/${id}`); ElMessage.success("题单已删除"); await loadList(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
async function deletePublication(id: number) {
  try { await ElMessageBox.confirm("删除后学生将无法访问该发布实例，历史提交会保留。", "删除发布实例", { type: "warning" }); await remove(`/api/admin/v1/practices/publications/${id}`); ElMessage.success("发布实例已删除"); await loadList(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}
function scopeLabel(item: Practice) { return item.accessScope === "ALL" ? "所有教师" : item.accessScope === "MAJOR" ? `本专业${item.majorName ? `：${item.majorName}` : ""}` : "私有"; }
watch(() => [route.fullPath, page.value] as const, () => { if (mode.value === "list") void loadList(); else void loadEditor(); }, { immediate: true });
</script>

<template>
  <section class="practice-management page-container">
    
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false"><template #default><el-button link type="primary" @click="mode==='list'?loadList():loadEditor()">重试</el-button></template></el-alert>
    <template v-if="mode==='list'">
      <el-card shadow="never"><div class="toolbar"><el-input v-model="keyword" clearable placeholder="搜索当前页题单"/><el-button type="primary" @click="router.push(`${basePath}/practices/new`)">创建题单</el-button></div><el-table v-loading="loading" :data="filteredRows" stripe row-key="id"><el-table-column align="center" header-align="center" prop="title" label="题单名称" min-width="140"><template #default="{row}"><strong>{{row.title}}</strong><div class="muted">{{row.description||'暂无介绍'}}</div></template></el-table-column><el-table-column align="center" header-align="center" label="开放范围" min-width="140"><template #default="{row}"><el-tag>{{scopeLabel(row)}}</el-tag></template></el-table-column><el-table-column align="center" header-align="center" label="题目数" min-width="140"><template #default="{row}">{{row.problems?.length??0}}</template></el-table-column><el-table-column align="center" header-align="center" label="创建者" min-width="140"><template #default="{row}">{{row.ownerAccountType==='ADMIN'?'管理员':'教师'}}</template></el-table-column><el-table-column align="center" header-align="center" label="创建时间" min-width="140"><template #default="{row}">{{formatDisplayDateTime(row.createdAt)}}</template></el-table-column><el-table-column align="center" header-align="center" label="操作" min-width="250" fixed="right"><template #default="{row}"><el-button v-if="row.canEdit" link type="primary" @click="router.push(`${basePath}/practices/${row.id}/edit`)">编辑</el-button><el-button v-if="row.canCopy" link @click="copy(row.id)">复制</el-button><el-button v-if="row.canPublish" link type="success" @click="router.push({path:`${basePath}/practices/${row.id}/publish`,query:courseId?{courseId:String(courseId)}:{}})">发布</el-button><el-button v-if="row.canEdit" link type="danger" @click="deletePractice(row.id)">删除</el-button></template></el-table-column><el-table-column align="center" header-align="center" type="expand"><template #default="{row}"><el-tag v-for="(problem,index) in row.problems??[]" :key="problem.id" class="problem-tag">{{index+1}}. {{problem.title}}</el-tag></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="page" :limit="pageSize" :total="total"/></div></el-card>
      <el-card shadow="never"><template #header><strong>发布实例（{{publications.length}}）</strong></template><el-table :data="publications" stripe><el-table-column align="center" header-align="center" prop="title" label="发布标题" min-width="140"/><el-table-column align="center" header-align="center" label="题目数" min-width="140"><template #default="{row}">{{row.problems?.length??0}}</template></el-table-column><el-table-column align="center" header-align="center" label="学生范围" min-width="140"><template #default="{row}">{{row.studentAccessMode==='ALL'?'所有学生':`指定班级（${row.classIds?.length??0}）`}}</template></el-table-column><el-table-column align="center" header-align="center" prop="status" label="状态" min-width="140"/><el-table-column align="center" header-align="center" label="创建时间" min-width="140"><template #default="{row}">{{formatDisplayDateTime(row.createdAt)}}</template></el-table-column><el-table-column align="center" header-align="center" label="操作" min-width="200"><template #default="{row}"><el-button link @click="router.push(`${basePath}/practices/publications/${row.id}/report`)">做题信息</el-button><el-button link type="primary" @click="router.push(`${basePath}/practices/publications/${row.id}/edit`)">编辑</el-button><el-button link type="danger" @click="deletePublication(row.id)">删除</el-button></template></el-table-column></el-table><el-empty v-if="!publications.length" description="暂无发布实例"/></el-card>
    </template>
    <template v-else>
      <el-card v-loading="loading" shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><header class="page-heading"><div class="heading-actions"><el-button @click="router.push(`${basePath}/practices`)">返回列表</el-button><el-button type="primary" :loading="saving" :disabled="loading||Boolean(error)" @click="save">保存题单</el-button></div></header></div></div></template><el-form label-position="top"><div class="two-col"><el-form-item label="题单名称" required><el-input v-model="form.title" maxlength="100"/></el-form-item><el-form-item label="教师开放范围"><el-radio-group v-model="form.accessScope"><el-radio-button value="ALL">所有教师</el-radio-button><el-radio-button value="MAJOR">本专业</el-radio-button><el-radio-button value="PRIVATE">私有</el-radio-button></el-radio-group></el-form-item></div><el-form-item v-if="form.accessScope==='MAJOR'" label="授权专业" required><el-select v-model="form.majorId" placeholder="选择专业"><el-option v-for="major in majors" :key="major.id" :value="major.id" :label="major.name"/></el-select></el-form-item><el-form-item label="题单介绍"><el-input v-model="form.description" type="textarea" :rows="4" maxlength="2000" show-word-limit/></el-form-item></el-form></el-card>
      <el-card shadow="never"><template #header><div class="card-header"><strong>题目（{{selectedProblems.length}}）</strong><div><el-button @click="selectedProblems=[]">清空</el-button><el-button type="primary" @click="openProblems">添加题目</el-button></div></div></template><el-table :data="selectedProblems" stripe><el-table-column align="center" header-align="center" label="顺序" min-width="140"><template #default="{ $index }">{{$index+1}}</template></el-table-column><el-table-column align="center" header-align="center" prop="title" label="题目" min-width="140"/><el-table-column align="center" header-align="center" prop="id" label="ID" min-width="140"/><el-table-column align="center" header-align="center" label="调整" width="150"><template #default="{ $index }"><el-button link :disabled="$index===0" @click="moveProblem($index,-1)">上移</el-button><el-button link :disabled="$index===selectedProblems.length-1" @click="moveProblem($index,1)">下移</el-button><el-button link type="danger" @click="selectedProblems=selectedProblems.filter(item=>item.id!==selectedProblems[$index].id)">移除</el-button></template></el-table-column></el-table><el-empty v-if="!selectedProblems.length" description="至少选择一道题目"/></el-card>
    </template>
    
<el-dialog class="qoj-management-dialog" v-model="problemDialog" title="通过文件夹选择题目" width="min(900px, 94vw)" destroy-on-close><FolderProblemPicker :teacher="teacherMode" :selected-ids="selectedProblems.map(item => item.id)" @add="addProblem" /></el-dialog>
  </section>
</template>

<style scoped>
.practice-management{display:flex;flex-direction:column;gap:16px}.page-heading,.card-header,.pagination,.toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px}.page-heading h1{margin:0;font-size:22px}.page-heading p,.muted{color:var(--el-text-color-secondary);font-size:13px}.page-heading p{margin:6px 0 0}.heading-actions{display:flex;gap:8px}.toolbar{justify-content:flex-start;margin-bottom:12px}.toolbar .el-input{max-width:300px}.pagination{margin-top:14px}.problem-tag{margin:3px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.el-select{width:100%}.dialog-pagination{justify-content:flex-end;margin-top:14px}.card-header>div{display:flex;gap:8px}@media(max-width:700px){.page-heading,.pagination{align-items:flex-start;flex-direction:column}.two-col{grid-template-columns:1fr}}
</style>

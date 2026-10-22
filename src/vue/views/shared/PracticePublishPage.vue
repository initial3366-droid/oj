<script setup lang="ts">
import FolderProblemPicker from "../../components/FolderProblemPicker.vue";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";
import { teacherGet, teacherPost, teacherPut } from "../../../teacher/teacherApi";
import { adminPath } from "../../../utils/adminPath";
import type { Course, CoursePage } from "../../../api/course";
import { fetchPracticeEditorDetail } from "../../../components/practices/practiceEditorApi";

type Problem = { id: number; title: string; difficulty?: number };
type Practice = { id: number; title: string; description?: string; problems: Problem[]; canPublish: boolean };
type Publication = { id: number; courseId?: number; displayOrder?: number; startTime?: string; endTime?: string; title: string; description?: string; studentAccessMode: string; classIds: number[]; problems?: Problem[]; publicationProblems: Array<{ problemId: number; title?: string; visibility: string; displayOrder?: number }> };

const route = useRoute();
const router = useRouter();
const teacherMode = computed(() => route.path.startsWith("/teacher/"));
const basePath = computed(() => teacherMode.value ? "/teacher" : adminPath(""));
const sourceId = computed(() => Number(route.params.practiceId) || null);
const publicationId = computed(() => Number(route.params.publicationId) || null);
const isEdit = computed(() => route.path.includes("/publications/") && route.path.endsWith("/edit"));
const courseIdQuery = computed(() => Number(route.query.courseId) || undefined);
function get<T>(path: string) { return teacherMode.value ? teacherGet<T>(path) : adminGet<T>(path); }
function post<T>(path: string, body?: unknown) { return teacherMode.value ? teacherPost<T>(path, body) : adminPost<T>(path, body); }
function put<T>(path: string, body?: unknown) { return teacherMode.value ? teacherPut<T>(path, body) : adminPut<T>(path, body); }

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const courses = ref<Course[]>([]);
const practice = ref<Practice | null>(null);
const problems = ref<Problem[]>([]);
const visibility = ref<Record<number, boolean>>({});
const selectedCourseId = ref<number | undefined>(courseIdQuery.value);
const form = reactive({ title: "", courseId: undefined as number | undefined, description: "", displayOrder: 1, startTime: "", endTime: "", password: "" });
const problemDialog = ref(false);
const visibleCount = computed(() => problems.value.filter(item => visibility.value[item.id]).length);
const selectedCourse = computed(() => courses.value.find(item => item.id === form.courseId));

function localDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function displayDate(value?: string) { return value?.replace("T", " ").slice(0, 16) ?? ""; }
function dateForApi(value: string) { return `${value.replace(" ", "T")}:00`; }

async function load() {
  loading.value = true;
  error.value = "";
  practice.value = null;
  try {
    const page = await get<CoursePage>("/api/admin/v1/courses?page=1&pageSize=100");
    let options = (page.list ?? []).filter(item => item.status === "ACTIVE" && item.classIds?.length);
    if (isEdit.value) {
      if (!publicationId.value) throw new Error("发布实例参数无效");
      const detail = await get<Publication>(`/api/admin/v1/practices/publications/${publicationId.value}`);
      if (detail.courseId && !options.some(item => item.id === detail.courseId)) {
        const selected = await get<Course>(`/api/admin/v1/courses/${detail.courseId}`);
        options = [selected, ...options];
      }
      courses.value = options;
      const rows = (detail.publicationProblems ?? []).map(item => ({
        id: item.problemId,
        title: item.title ?? detail.problems?.find(problem => problem.id === item.problemId)?.title ?? `#${item.problemId}`,
        difficulty: detail.problems?.find(problem => problem.id === item.problemId)?.difficulty,
      }));
      practice.value = { id: detail.id, title: detail.title, description: detail.description, problems: rows, canPublish: true };
      problems.value = rows;
      visibility.value = Object.fromEntries((detail.publicationProblems ?? []).map(item => [item.problemId, item.visibility === "VISIBLE"]));
      selectedCourseId.value = detail.courseId ?? courseIdQuery.value;
      Object.assign(form, { title: detail.title, courseId: detail.courseId ?? courseIdQuery.value, description: detail.description ?? "", displayOrder: detail.displayOrder ?? 1, startTime: displayDate(detail.startTime), endTime: displayDate(detail.endTime), password: "" });
    } else {
      if (!sourceId.value) throw new Error("题单参数无效");
      courses.value = options;
      if (courseIdQuery.value && !options.some(item => item.id === courseIdQuery.value)) {
        const selected = await get<Course>(`/api/admin/v1/courses/${courseIdQuery.value}`);
        if (selected.status === "ACTIVE" && selected.classIds?.length) courses.value = [selected, ...options];
      }
      const source = await fetchPracticeEditorDetail<Practice>(get, sourceId.value);
      if (!source.canPublish) throw new Error("题单不存在或无权发布");
      practice.value = source;
      problems.value = source.problems ?? [];
      visibility.value = Object.fromEntries((source.problems ?? []).map(item => [item.id, true]));
      const start = new Date();
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      Object.assign(form, { title: source.title, courseId: courseIdQuery.value, description: source.description ?? "", displayOrder: 1, startTime: localDateTime(start), endTime: localDateTime(end), password: "" });
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "发布数据加载失败"; }
  finally { loading.value = false; }
}


function addProblem(problem: Problem) {
  if (problems.value.some(item => item.id === problem.id)) return;
  problems.value = [...problems.value, problem];
  visibility.value = { ...visibility.value, [problem.id]: true };
}
function removeProblem(id: number) {
  problems.value = problems.value.filter(item => item.id !== id);
  const next = { ...visibility.value }; delete next[id]; visibility.value = next;
}
function goBack() {
  const id = selectedCourseId.value ?? courseIdQuery.value;
  void router.push(id ? `${basePath.value}/courses/${id}` : `${basePath.value}/courses`);
}
async function save() {
  if (!practice.value || loading.value || error.value) return;
  if (!form.title.trim()) { ElMessage.warning("请输入发布标题"); return; }
  const course = courses.value.find(item => item.id === form.courseId);
  if (!course || course.status !== "ACTIVE" || !course.classIds?.length) { ElMessage.warning("请选择已关联班级且进行中的课程"); return; }
  if (!form.startTime || !form.endTime || new Date(form.endTime.replace(" ", "T")).getTime() <= new Date(form.startTime.replace(" ", "T")).getTime()) { ElMessage.warning("截止时间必须晚于开始时间"); return; }
  if (!problems.value.length) { ElMessage.warning("请至少添加一道题目"); return; }
  if (!visibleCount.value) { ElMessage.warning("至少公开一道题目后才能发布"); return; }
  saving.value = true;
  try {
    const payload = { title: form.title.trim(), description: form.description.trim(), courseId: course.id, displayOrder: form.displayOrder, startTime: dateForApi(form.startTime), endTime: dateForApi(form.endTime), studentAccessMode: "SELECTED_CLASSES", classIds: course.classIds, password: form.password.trim() || undefined, problems: problems.value.map(item => ({ problemId: item.id, visibility: visibility.value[item.id] ? "VISIBLE" : "HIDDEN" })) };
    if (isEdit.value && publicationId.value) {
      await put(`/api/admin/v1/practices/publications/${publicationId.value}`, payload);
      ElMessage.success("发布实例已更新");
    } else {
      await post(`/api/admin/v1/practices/${practice.value.id}/publications`, payload);
      ElMessage.success("题单已发布");
    }
    await router.push(`${basePath.value}/courses/${course.id}`);
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "发布保存失败"); }
  finally { saving.value = false; }
}

watch(() => route.fullPath, () => { selectedCourseId.value = courseIdQuery.value; void load(); }, { immediate: true });
</script>

<template>
  <section class="publish-page page-container">
    
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><template #default><el-button link type="primary" @click="load">重试</el-button></template></el-alert>
    <el-card v-loading="loading" shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><header class="page-heading"><div><p v-if="practice">来源题单：{{practice.title}}</p></div><div class="actions"><el-button @click="goBack">返回</el-button><el-button type="primary" :loading="saving" :disabled="loading||Boolean(error)||!practice" @click="save">{{isEdit?'保存修改':'确认发布'}}</el-button></div></header></div></div></template><el-form label-position="top"><div class="two-col"><el-form-item label="发布标题" required><el-input v-model="form.title" maxlength="100"/></el-form-item><el-form-item label="所属课程" required><el-select v-model="form.courseId" filterable placeholder="选择课程" @change="selectedCourseId=form.courseId"><el-option v-for="course in courses" :key="course.id" :value="course.id" :label="`${course.title}（${course.classes?.map(item=>item.name).join('、')||'未关联班级'}）`"/></el-select></el-form-item><el-form-item label="开始时间" required><el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm" format="YYYY-MM-DD HH:mm"/></el-form-item><el-form-item label="截止时间" required><el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm" format="YYYY-MM-DD HH:mm"/></el-form-item><el-form-item label="题单顺序"><el-input-number v-model="form.displayOrder" :min="1" :precision="0"/></el-form-item><el-form-item label="访问密码"><el-input v-model="form.password" type="password" show-password maxlength="100" placeholder="不填写则无需密码"/></el-form-item></div><el-alert type="info" :closable="false" title="学生只能在开始时间至截止时间之间查看和提交；题单对所选课程关联的班级开放。"/><el-form-item label="发布说明" class="description-item"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="2000" show-word-limit/></el-form-item></el-form></el-card>
    <el-card shadow="never"><template #header><div class="card-header"><strong>发布题目（{{problems.length}}）</strong><div><el-tag type="success">公开 {{visibleCount}} / {{problems.length}}</el-tag><el-button @click="problemDialog=true">添加题目</el-button><el-button @click="problems=[];visibility={}">清空</el-button></div></div></template><p class="muted">可以增删本次发布的题目并设置学生可见状态，不会改动源题单。</p><el-table :data="problems" stripe><el-table-column label="顺序" width="80"><template #default="{ $index }">{{$index+1}}</template></el-table-column><el-table-column prop="title" label="题目" min-width="200"><template #default="{row}">{{row.title}} <span class="muted">#{{row.id}}</span></template></el-table-column><el-table-column label="学生可见" width="120"><template #default="{row}"><el-switch v-model="visibility[row.id]" active-text="公开" inactive-text="隐藏" inline-prompt/></template></el-table-column><el-table-column label="操作" width="90"><template #default="{row}"><el-button link type="danger" @click="removeProblem(row.id)">移除</el-button></template></el-table-column></el-table><el-empty v-if="!problems.length" description="暂无题目"/></el-card>
    
<el-dialog class="qoj-management-dialog" v-model="problemDialog" title="通过文件夹选择题目" width="min(900px, 94vw)" destroy-on-close><FolderProblemPicker :teacher="teacherMode" :selected-ids="problems.map(item => item.id)" @add="addProblem" /></el-dialog>
  </section>
</template>

<style scoped>
.publish-page{display:flex;flex-direction:column;gap:16px}.page-heading,.card-header,.actions,.card-header>div,.toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px}.page-heading h1{margin:0;font-size:22px}.page-heading p,.muted{color:var(--el-text-color-secondary);font-size:13px}.page-heading p{margin:6px 0 0}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}.two-col .el-date-editor,.two-col .el-select{width:100%}.description-item{margin-top:18px}.toolbar{justify-content:flex-start;margin-bottom:12px}.toolbar .el-input{max-width:300px}.dialog-pagination{justify-content:flex-end;margin-top:14px}@media(max-width:700px){.page-heading{align-items:flex-start;flex-direction:column}.two-col{grid-template-columns:1fr}.card-header{align-items:flex-start;flex-direction:column}}
</style>

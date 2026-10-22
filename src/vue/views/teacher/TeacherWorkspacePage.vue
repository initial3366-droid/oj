<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { teacherDelete, teacherGet, teacherImportStudentsFile, teacherPost, teacherPut, type TeacherClass, type TeacherDashboard, type TeacherMe, type TeacherStudent } from "../../../teacher/teacherApi";
import { formatDisplayDateTime } from "../../../lib/format";

type Row = Record<string, unknown>;
type Field = { key: string; label: string; type?: "text" | "textarea" | "number" | "boolean" | "password"; required?: boolean };
type Action = { label: string; endpoint: (row: Row) => string; method?: "post" | "delete" };
type Config = { title: string; description: string; endpoint: string; resource?: string; mode?: "list" | "detail" | "settings" | "report" | "dashboard" | "import"; fields?: Field[]; actions?: Action[] };

const route = useRoute();
const router = useRouter();
const rows = ref<Row[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const keyword = ref("");
const page = ref(1);
const pageSize = ref(20);
const detail = ref<Row | null>(null);
const dashboard = ref<TeacherDashboard | null>(null);
const dialogOpen = ref(false);
const saving = ref(false);
const editId = ref<number | string | null>(null);
const form = reactive<Record<string, unknown>>({});
const jsonText = ref("{}");
const jsonMode = ref(false);
const codeDialog = ref(false);
const codeText = ref("");
const classes = ref<TeacherClass[]>([]);
const selectedClassId = ref<number | null>(null);
const importFile = ref<File | null>(null);
const studentNoField = ref("studentNo");
const nameField = ref("displayName");
const importResult = ref<{ successCount: number; failureCount: number; errors?: Array<{ rowNumber: number; reason: string }> } | null>(null);

const localPath = computed(() => route.path.replace(/^\/teacher/, "") || "/");
const id = computed(() => localPath.value.match(/\/(\d+)(?:\/|$)/)?.[1] ?? "");
const editorRoute = computed(() => /\/(new|\d+\/edit)$/.test(localPath.value));
const config = computed<Config>(() => {
  const p = localPath.value;
  if (p === "/dashboard") return { title: "工作概览", description: "查看教学范围内的学生、提交和练习动态。", endpoint: "/api/teacher/v1/dashboard", mode: "dashboard" };
  if (p === "/classes") return { title: "班级管理", description: "维护你负责的班级和学生加入设置。", endpoint: `/api/teacher/v1/classes${keyword.value ? `?keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/teacher/v1/classes", fields: [{ key: "name", label: "班级名称", required: true }, { key: "description", label: "班级说明", type: "textarea" }, { key: "joinEnabled", label: "允许学生申请", type: "boolean" }, { key: "approvalRequired", label: "申请需审批", type: "boolean" }] };
  if (p === "/students") return { title: "学生列表", description: "查看班级学生、账号信息和最近提交情况。", endpoint: "/api/teacher/v1/students", resource: "/api/teacher/v1/students", fields: [{ key: "displayName", label: "学生姓名", required: true }, { key: "studentNo", label: "学号" }, { key: "email", label: "邮箱" }, { key: "password", label: "重置密码", type: "password" }] };
  if (p === "/import") return { title: "导入学生", description: "上传 CSV 或 Excel 学生名册，映射学号和姓名字段。", endpoint: "/api/teacher/v1/classes", mode: "import" };
  if (p === "/applications") return { title: "加入申请", description: "审核学生加入你所负责班级的申请。", endpoint: "/api/teacher/v1/applications", actions: [{ label: "批准", endpoint: (row) => `/api/teacher/v1/applications/${row.id}/approve` }, { label: "拒绝", endpoint: (row) => `/api/teacher/v1/applications/${row.id}/reject` }] };
  if (p === "/submissions" || p === "/practices/submissions") return { title: p === "/submissions" ? "提交记录" : "练习提交", description: "筛选学生提交并查看源代码和判题结果。", endpoint: `/api/teacher/v1/submissions?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, actions: [{ label: "查看代码", endpoint: (row) => `/api/teacher/v1/submissions/${row.id}/code` }] };
  if (p === "/stats") return { title: "练习统计", description: "按学生和题目查看近期练习完成情况。", endpoint: "/api/teacher/v1/submissions?page=1&pageSize=1000&sortBy=submitTime&sortOrder=desc", mode: "report" };
  if (p.startsWith("/practices/") && p.endsWith("/report")) return { title: "练习报告", description: "查看练习的学生完成度和提交详情。", endpoint: `/api/admin/v1/practices/${id.value}/report`, mode: "report" };
  if (p === "/problems" || p.startsWith("/problems/") && editorRoute.value) return { title: editorRoute.value ? "题目编辑器" : "题目管理", description: "维护教师拥有或可用的题目。", endpoint: `/api/admin/v1/problems?page=${page.value}&pageSize=${pageSize.value}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ""}`, resource: "/api/admin/v1/problems", fields: [{ key: "title", label: "题目标题", required: true }, { key: "statement", label: "题面", type: "textarea", required: true }, { key: "inputFormat", label: "输入格式", type: "textarea" }, { key: "outputFormat", label: "输出格式", type: "textarea" }, { key: "difficulty", label: "难度", type: "number" }, { key: "timeLimit", label: "时间限制（ms）", type: "number" }, { key: "memoryLimit", label: "内存限制（MB）", type: "number" }, { key: "isPublic", label: "公开", type: "boolean" }] };
  if (p.startsWith("/problem-folders")) return { title: "题目文件夹", description: "整理题库题目，维护便于课程和练习选择的分类。", endpoint: "/api/admin/v1/problem-folders", resource: "/api/admin/v1/problem-folders", fields: [{ key: "name", label: "文件夹名称", required: true }, { key: "description", label: "说明", type: "textarea" }] };
  if (p.startsWith("/courses")) return { title: "课程管理", description: "维护课程章节、题单和班级授权。", endpoint: `/api/admin/v1/courses?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/courses", fields: [{ key: "title", label: "课程名称", required: true }, { key: "description", label: "课程介绍", type: "textarea" }, { key: "classIds", label: "班级 ID（JSON）", type: "textarea" }] };
  if (p === "/practices" || p === "/practices/new" || /\/practices\/\d+\/edit$/.test(p)) return { title: editorRoute.value ? "练习编辑" : "练习素材", description: "创建练习题单并管理发布时间。", endpoint: `/api/admin/v1/practices?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/practices", fields: [{ key: "title", label: "练习名称", required: true }, { key: "description", label: "说明", type: "textarea" }, { key: "audience", label: "范围（ALL / CLASS）" }, { key: "audienceId", label: "班级 ID", type: "number" }, { key: "problemIds", label: "题目 ID（JSON 数组）", type: "textarea" }] };
  if (p.startsWith("/practices/")) return { title: "练习发布", description: "查看或维护练习发布与报告。", endpoint: `/api/admin/v1/practices/${id.value}`, mode: "detail" };
  if (p === "/contests" || p === "/contests/new" || /\/contests\/\d+\/edit$/.test(p)) return { title: "比赛管理", description: "管理教师创建的比赛、时间和赛制。", endpoint: `/api/admin/v1/contests?page=${page.value}&pageSize=${pageSize.value}`, resource: "/api/admin/v1/contests", fields: [{ key: "title", label: "比赛名称", required: true }, { key: "type", label: "赛制（ACM / OI）" }, { key: "startTime", label: "开始时间" }, { key: "durationMinutes", label: "时长（分钟）", type: "number" }, { key: "description", label: "说明", type: "textarea" }] };
  if (p.startsWith("/contests/")) return { title: "比赛详情", description: "查看报名、题目和比赛数据。", endpoint: `/api/admin/v1/contests/${id.value}`, mode: "detail" };
  if (p === "/profile") return { title: "个人信息", description: "查看和更新教师账号资料。", endpoint: "/api/teacher/v1/me", resource: "/api/teacher/v1/me", mode: "settings", fields: [{ key: "displayName", label: "姓名", required: true }, { key: "teacherNo", label: "教师编号" }, { key: "email", label: "邮箱" }, { key: "avatarUrl", label: "头像地址" }] };
  return { title: "教师工作台", description: "当前地址没有匹配的教师功能。", endpoint: "", mode: "report" };
});
const columns = computed(() => Object.keys(rows.value[0] ?? {}).filter((key) => !["description", "statement", "code", "cases", "members", "profileFields", "problems"].includes(key)).slice(0, 9));
const detailEntries = computed(() => detail.value ? Object.entries(detail.value) : []);
const stats = computed(() => {
  const submissions = rows.value;
  const byStatus = new Map<string, number>();
  const uniqueStudents = new Set<string>();
  submissions.forEach((row) => { const status = String(row.status ?? "UNKNOWN"); byStatus.set(status, (byStatus.get(status) ?? 0) + 1); uniqueStudents.add(String(row.userId ?? row.username ?? "")); });
  return { submissions: submissions.length, students: uniqueStudents.size, accepted: byStatus.get("AC") ?? byStatus.get("ACCEPTED") ?? 0, byStatus: Array.from(byStatus, ([status,count]) => ({ status,count })) };
});

function normalize(result: unknown) {
  if (Array.isArray(result)) { rows.value = result as Row[]; total.value = rows.value.length; detail.value = null; return; }
  if (result && typeof result === "object") {
    const body = result as Record<string, unknown>;
    if (Array.isArray(body.list)) { rows.value = body.list as Row[]; total.value = Number(body.total ?? rows.value.length); detail.value = null; return; }
    if (Array.isArray(body.records)) { rows.value = body.records as Row[]; total.value = Number(body.total ?? rows.value.length); detail.value = null; return; }
    detail.value = body; rows.value = []; total.value = 1; jsonText.value = JSON.stringify(body,null,2);
    if (config.value.mode === "settings") { Object.keys(form).forEach((key)=>delete form[key]); Object.assign(form, body); }
    return;
  }
  rows.value=[]; total.value=0; detail.value=null;
}
async function load() {
  if (!config.value.endpoint) return;
  loading.value=true;error.value="";
  try {
    if (localPath.value === "/dashboard") { dashboard.value=await teacherGet<TeacherDashboard>(config.value.endpoint); }
    else normalize(await teacherGet<unknown>(config.value.endpoint));
  } catch(cause) { error.value=cause instanceof Error?cause.message:"页面数据加载失败"; }
  finally { loading.value=false; }
}
function openForm(row?: Row) {
  editId.value=(row?.id as number|string|undefined)??(editorRoute.value?id.value||null:null);
  Object.keys(form).forEach((key)=>delete form[key]);
  if(row) Object.assign(form,structuredClone(row));
  else for(const field of config.value.fields??[]) form[field.key]=field.type==="boolean"?false:field.type==="number"?undefined:"";
  jsonText.value=JSON.stringify(row??form,null,2);jsonMode.value=false;dialogOpen.value=true;
  if(editorRoute.value&&editId.value) void loadEdit();
}
async function loadEdit(){try{const result=await teacherGet<Row>(`${config.value.resource}/${editId.value}`);Object.keys(form).forEach((key)=>delete form[key]);Object.assign(form,result);jsonText.value=JSON.stringify(result,null,2);}catch(cause){ElMessage.error(cause instanceof Error?cause.message:"记录加载失败");}}
async function save() {
  let payload:Row={...form};
  if(jsonMode.value){try{payload=JSON.parse(jsonText.value) as Row;}catch{ElMessage.error("JSON 格式无效");return;}}
  for(const field of config.value.fields??[]){if(field.required&&!String(payload[field.key]??"").trim()){ElMessage.warning(`请填写${field.label}`);return;}}
  for(const [key,value] of Object.entries(payload)){if(typeof value==="string"&&(value.startsWith("[")||value.startsWith("{"))){try{payload[key]=JSON.parse(value);}catch{}}}
  saving.value=true;
  try{if(editId.value&&config.value.resource)await teacherPut(`${config.value.resource}/${editId.value}`,payload);else if(config.value.resource)await teacherPost(config.value.resource,payload);else await teacherPut(config.value.endpoint,payload);ElMessage.success("保存成功");dialogOpen.value=false;await load();}
  catch(cause){ElMessage.error(cause instanceof Error?cause.message:"保存失败");}finally{saving.value=false;}
}
async function remove(row:Row) {
  if(localPath.value==="/classes"){
    try{const {value}=await ElMessageBox.prompt("删除班级需要教师密码确认。","删除班级",{inputType:"password",inputPlaceholder:"教师密码",confirmButtonText:"确认删除"});await teacherPost(`/api/teacher/v1/classes/${row.id}/delete`,{password:value});ElMessage.success("班级已删除");await load();}catch(cause){if(cause!=="cancel"&&cause!=="close")ElMessage.error(cause instanceof Error?cause.message:"删除失败");}return;
  }
  const identity=row.userId??row.id;
  try{await ElMessageBox.confirm("确认删除此记录？","删除确认",{type:"warning"});if(localPath.value==="/students"&&row.classId)await teacherDelete(`/api/teacher/v1/classes/${row.classId}/students/${identity}`);else await teacherDelete(`${config.value.resource}/${identity}`);ElMessage.success("已删除");await load();}catch(cause){if(cause!=="cancel"&&cause!=="close")ElMessage.error(cause instanceof Error?cause.message:"删除失败");}
}
async function runAction(action:Action,row:Row){try{const endpoint=action.endpoint(row);if(action.label.includes("代码")){codeText.value=await teacherGet<string>(endpoint);codeDialog.value=true;}else if(action.method==="delete")await teacherDelete(endpoint);else await teacherPost(endpoint);ElMessage.success(action.label+"成功");await load();}catch(cause){ElMessage.error(cause instanceof Error?cause.message:"操作失败");}}
async function loadClasses(){try{classes.value=await teacherGet<TeacherClass[]>("/api/teacher/v1/classes");}catch{classes.value=[];}}
async function importStudents(){if(!selectedClassId.value||!importFile.value){ElMessage.warning("请选择班级和学生名册文件");return;}loading.value=true;try{importResult.value=await teacherImportStudentsFile({classId:selectedClassId.value,studentNoField:studentNoField.value,nameField:nameField.value,file:importFile.value});ElMessage.success("导入处理完成");}catch(cause){ElMessage.error(cause instanceof Error?cause.message:"导入失败");}finally{loading.value=false;}}
function navigateEditor(path:string){void router.push(path);}
watch(()=>[route.fullPath,page.value,pageSize.value,keyword.value] as const,()=>{if(editorRoute.value&&config.value.resource){openForm();return;}if(config.value.mode==="import")void loadClasses();void load();},{immediate:true});
onMounted(()=>{if(config.value.mode==="import")void loadClasses();});
const canCreateRecord = computed(() => Boolean(config.value.resource && !editorRoute.value && config.value.mode !== "settings"));
const canImportStudents = computed(() => config.value.mode === "import");
</script>

<template>
  <section class="teacher-workspace page-container"><header class="workspace-heading"><div class="heading-actions"><el-input v-if="config.mode!=='import'&&config.mode!=='dashboard'&&config.mode!=='settings'" v-model="keyword" clearable placeholder="搜索关键词" @keyup.enter="page=1;load()"/></div></header>
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><template #default><el-button link type="primary" @click="load">重试</el-button></template></el-alert>
    <template v-if="config.mode==='dashboard'"><el-skeleton v-if="loading&&!dashboard" :rows="8" animated/><template v-if="dashboard"><div class="metric-grid"><article><small>今日提交</small><strong>{{dashboard.todaySubmissionCount}}</strong></article><article><small>今日通过</small><strong>{{dashboard.todayAcceptedCount}}</strong></article><article><small>今日活跃学生</small><strong>{{dashboard.todayActiveUserCount}}</strong></article><article><small>进行中比赛</small><strong>{{dashboard.activeContestCount}}</strong></article><article><small>负责学生</small><strong>{{dashboard.totalStats.userCount}}</strong></article><article><small>题库题目</small><strong>{{dashboard.totalStats.problemCount}}</strong></article><article><small>累计提交</small><strong>{{dashboard.totalStats.submissionCount}}</strong></article><article><small>整体通过率</small><strong>{{dashboard.totalStats.passRate}}%</strong></article></div><el-card shadow="never"><template #header>近期比赛</template><el-table :data="dashboard.recentContests" stripe><el-table-column prop="title" label="比赛"/><el-table-column prop="status" label="状态"/><el-table-column prop="startTime" label="开始时间"/></el-table></el-card><el-card shadow="never"><template #header>热门题目</template><el-table :data="dashboard.topProblems" stripe><el-table-column prop="title" label="题目"/><el-table-column prop="submissions" label="提交数"/><el-table-column prop="acRate" label="通过率"/></el-table></el-card></template></template>
    <template v-else-if="config.mode==='import'"><el-card shadow="never" class="import-card"><template #header><div class="management-card-heading"><div class="management-card-actions"><div class="heading-actions"><el-button v-if="canCreateRecord" type="primary" @click="openForm">新增</el-button><el-button v-if="canImportStudents" type="primary" :loading="loading" @click="importStudents">开始导入</el-button></div></div></div></template><el-form label-position="top"><el-form-item label="目标班级"><el-select v-model="selectedClassId" placeholder="选择班级" style="width:100%"><el-option v-for="item in classes" :key="item.id" :value="item.id" :label="item.name"/></el-select></el-form-item><el-form-item label="学生名册文件"><input class="file-input" type="file" accept=".csv,.xls,.xlsx" @change="(event:any)=>importFile=event.target.files?.[0]??null"></el-form-item><div class="field-grid"><el-form-item label="学号字段"><el-input v-model="studentNoField"/></el-form-item><el-form-item label="姓名字段"><el-input v-model="nameField"/></el-form-item></div><p class="muted">系统会按列名匹配文件字段，重复学号和无效行会列入导入结果。</p></el-form><el-alert v-if="importResult" type="success" :closable="false" :title="`成功 ${importResult.successCount} 人，失败 ${importResult.failureCount} 行`"/><el-table v-if="importResult?.errors?.length" :data="importResult.errors" stripe><el-table-column prop="rowNumber" label="行号" width="90"/><el-table-column prop="reason" label="失败原因"/></el-table></el-card></template>
    <template v-else-if="config.mode==='settings'"><el-card shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><div class="heading-actions"><el-button v-if="canCreateRecord" type="primary" @click="openForm">新增</el-button><el-button v-if="canImportStudents" type="primary" :loading="loading" @click="importStudents">开始导入</el-button></div></div></div></template><div v-if="config.fields?.length" class="settings-form"><el-form label-position="top"><el-form-item v-for="field in config.fields" :key="field.key" :label="field.label"><el-input v-model="form[field.key] as string"/></el-form-item></el-form><el-button type="primary" :loading="saving" @click="save">保存资料</el-button></div><template v-else><el-input v-model="jsonText" type="textarea" :rows="18"/><div class="actions"><el-button type="primary" :loading="saving" @click="save">保存</el-button></div></template></el-card></template>
    <template v-else-if="config.mode==='report'||config.mode==='detail'"><el-skeleton v-if="loading" :rows="7" animated/><el-card v-else-if="detail" shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><div class="heading-actions"><el-button v-if="canCreateRecord" type="primary" @click="openForm">新增</el-button><el-button v-if="canImportStudents" type="primary" :loading="loading" @click="importStudents">开始导入</el-button></div></div></div></template><el-descriptions :column="2" border><el-descriptions-item v-for="([key,value]) in detailEntries" :key="key" :label="key"><pre v-if="value&&typeof value==='object'">{{JSON.stringify(value,null,2)}}</pre><span v-else>{{value??'-'}}</span></el-descriptions-item></el-descriptions></el-card><el-empty v-else description="没有可展示的数据"/></template>
    <template v-else><el-card v-if="config.title==='练习统计'" shadow="never" class="stats-card"><div class="metric-grid"><article><small>本次载入提交</small><strong>{{stats.submissions}}</strong></article><article><small>参与学生</small><strong>{{stats.students}}</strong></article><article><small>通过提交</small><strong>{{stats.accepted}}</strong></article></div><el-table :data="stats.byStatus" stripe><el-table-column prop="status" label="判题结果"/><el-table-column prop="count" label="提交数量"/></el-table></el-card><el-card shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><div class="heading-actions"><el-button v-if="canCreateRecord" type="primary" @click="openForm">新增</el-button><el-button v-if="canImportStudents" type="primary" :loading="loading" @click="importStudents">开始导入</el-button></div></div></div></template><el-table v-loading="loading" :data="rows" stripe row-key="id" empty-text="暂无数据" @row-dblclick="(row:Row)=>openForm(row)"><el-table-column v-for="key in columns" :key="key" :prop="key" :label="key" min-width="130" show-overflow-tooltip><template #default="{row}"><el-tag v-if="/status|verdict/i.test(key)" :type="String(row[key]).includes('AC')||row[key]==='APPROVED'?'success':String(row[key]).includes('PENDING')?'warning':'info'">{{row[key]??'-'}}</el-tag><span v-else-if="/time|date/i.test(key)">{{row[key]?formatDisplayDateTime(String(row[key])):'-'}}</span><span v-else-if="row[key]&&typeof row[key]==='object'">{{Array.isArray(row[key])?`共 ${row[key].length} 项`:'详情'}}</span><span v-else>{{row[key]??'-'}}</span></template></el-table-column><el-table-column label="操作" width="230" fixed="right"><template #default="{row}"><el-button v-if="config.resource" link type="primary" @click="openForm(row)">编辑</el-button><el-button v-for="action in config.actions" :key="action.label" link :type="action.label==='拒绝'?'danger':'primary'" @click="runAction(action,row)">{{action.label}}</el-button><el-button v-if="config.resource&&!config.actions?.length" link type="danger" @click="remove(row)">删除</el-button><el-button v-if="localPath==='/problems'" link type="primary" @click="navigateEditor(`/teacher/problems/${row.id}/edit`)">编辑题目</el-button></template></el-table-column></el-table><div class="table-footer"><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[10,20,50,100]"/></div></el-card></template>
    
<el-dialog class="qoj-management-dialog" v-model="dialogOpen" :title="editId?'编辑记录':'新增记录'" width="min(720px,95vw)" destroy-on-close><el-form v-if="config.fields?.length&&!jsonMode" label-position="top"><el-form-item v-for="field in config.fields" :key="field.key" :label="field.label" :required="field.required"><el-input v-if="field.type==='textarea'" v-model="form[field.key] as string" type="textarea" :rows="4"/><el-input v-else-if="field.type==='password'" v-model="form[field.key] as string" type="password" show-password/><el-input-number v-else-if="field.type==='number'" v-model="form[field.key] as number"/><el-switch v-else-if="field.type==='boolean'" v-model="form[field.key] as boolean"/><el-input v-else v-model="form[field.key] as string"/></el-form-item></el-form><template v-else><el-switch v-model="jsonMode" active-text="编辑原始 JSON"/><el-input v-model="jsonText" type="textarea" :rows="17"/></template><template #footer><el-button @click="dialogOpen=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="codeDialog" title="提交代码" width="min(900px,95vw)"><pre class="code-viewer">{{codeText}}</pre></el-dialog>
  </section>
</template>

<style scoped>
.teacher-workspace{display:flex;flex-direction:column;gap:16px}.workspace-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.workspace-heading h1{margin:0;font-size:22px}.workspace-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.heading-actions{display:flex;align-items:center;gap:9px}.heading-actions .el-input{width:min(280px,35vw)}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.metric-grid article{display:flex;flex-direction:column;gap:8px;padding:18px;border-radius:10px;background:var(--content-bg)}.metric-grid small{color:var(--el-text-color-secondary);font-size:12px}.metric-grid strong{font-size:26px;color:var(--el-text-color-primary)}.table-footer,.actions{display:flex;justify-content:space-between;align-items:center;margin-top:14px}.import-card,.stats-card{max-width:900px}.file-input{width:100%;padding:10px;border:1px dashed #cbd5e1;border-radius:6px;background:#fafcff}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.muted{color:var(--el-text-color-placeholder);font-size:13px}.code-viewer{max-height:70vh;overflow:auto;padding:16px;border-radius:8px;background:var(--el-text-color-primary);color:var(--card-border);white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.settings-form{max-width:680px}@media(max-width:780px){.workspace-heading{align-items:flex-start;flex-direction:column}.heading-actions{width:100%;flex-wrap:wrap}.heading-actions .el-input{width:100%}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.table-footer{align-items:flex-start;flex-direction:column}}
</style>

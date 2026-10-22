<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminDelete, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";
import { adminPath } from "../../../utils/adminPath";
import { formatDisplayDateTime } from "../../../lib/format";

type Student = { id: number; username: string; displayName: string; studentNo?: string | null; email?: string | null; role: string; status: "NORMAL" | "BANNED"; className?: string | null; classId?: number | null; acCount?: number; avatarUrl?: string | null; createdAt: string; lastSubmissionTime?: string | null };
type ClassOption = { id: number; name: string; teacherId?: number; teacherName?: string };
type Submission = { id: number; problemTitle?: string | null; contestTitle?: string | null; practiceTitle?: string | null; language?: string | null; status?: string | null; score?: number | null; submitTime?: string | null; createdAt?: string | null };
type PageResult<T> = { list: T[]; total: number };
type BatchAction = "ASSIGN_CLASS" | "REMOVE_CLASS" | "RESET_PASSWORD" | "RESET_AI_QUOTA" | "DELETE";
type ImportResult = { successCount: number; failureCount: number; errors: Array<{ rowNumber: number; username?: string | null; studentNo?: string | null; reason: string }> };
const batchLabels: Record<BatchAction, string> = { ASSIGN_CLASS: "调整班级", REMOVE_CLASS: "移出班级", RESET_PASSWORD: "重置密码", RESET_AI_QUOTA: "重置 AI 额度", DELETE: "删除学生" };
const users = ref<Student[]>([]); const total = ref(0); const loading = ref(false); const error = ref(""); const page = ref(1); const pageSize = ref(20);
const keywordInput = ref(""); const keyword = ref(""); const classFilter = ref<number>(); const teacherFilter = ref<number>(); const classes = ref<ClassOption[]>([]);
const selectedUsers = ref<Record<number, Student>>({}); const selectedIds = computed(() => Object.keys(selectedUsers.value).map(Number));
const formOpen = ref(false); const saving = ref(false); const editing = ref<Student | null>(null);
const form = reactive({ username: "", displayName: "", studentNo: "", classId: 0, email: "", password: "", status: "NORMAL" as "NORMAL" | "BANNED" });
const detailOpen = ref(false); const detailLoading = ref(false); const detailUser = ref<Student | null>(null); const detailRows = ref<Submission[]>([]); const detailTotal = ref(0); const detailPage = ref(1); const detailLoadingRows = ref(false);
const deleteTarget = ref<Student | null>(null); const adminPassword = ref(""); const deleting = ref(false);
const batchMenuOpen = ref(false);
const batchAction = ref<BatchAction | null>(null); const batchClassId = ref<number>(); const batchPassword = ref(""); const batchAdminPassword = ref(""); const batchBusy = ref(false);
const deleteDialog = computed({ get: () => deleteTarget.value !== null, set: (open: boolean) => { if (!open && !deleting.value) deleteTarget.value = null; } });
const batchDialog = computed({ get: () => batchAction.value !== null, set: (open: boolean) => { if (!open && !batchBusy.value) batchAction.value = null; } });
const resetAllOpen = ref(false); const resetAllPassword = ref(""); const resetAllBusy = ref(false);
const importInput = ref<HTMLInputElement>(); const importBusy = ref(false); const importResult = ref<ImportResult | null>(null); const importResultOpen = ref(false);
const avatarInput = ref<HTMLInputElement>(); const avatarBusyId = ref<number | null>(null); const quotas = ref<Record<number, { used: number; remaining: number }>>({});
const teachers = computed(() => [...new Map(classes.value.filter((item) => item.teacherId).map((item) => [item.teacherId!, { id: item.teacherId!, name: item.teacherName || `教师 #${item.teacherId}` }])).values()]);
let requestVersion = 0;

async function loadClasses() { try { classes.value = await adminGet<ClassOption[]>(adminPath("/api/admin/v1/classes")); } catch { ElMessage.error("班级筛选选项加载失败"); } }
async function loadUsers() {
  const sequence = ++requestVersion; loading.value = true; error.value = "";
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value), role: "STUDENT" });
    if (keyword.value) params.set("keyword", keyword.value);
    if (classFilter.value === 0) params.set("unassigned", "true"); else if (classFilter.value != null) params.set("classId", String(classFilter.value));
    if (teacherFilter.value != null) params.set("teacherId", String(teacherFilter.value));
    const result = await adminGet<PageResult<Student>>(adminPath(`/api/admin/v1/users?${params}`));
    if (sequence !== requestVersion) return;
    users.value = (result.list ?? []).filter((user) => user.role === "STUDENT"); total.value = result.total ?? 0;
    if (page.value > 1 && (page.value - 1) * pageSize.value >= total.value) page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
  } catch (cause) { if (sequence === requestVersion) { error.value = cause instanceof Error ? cause.message : "加载学生失败"; users.value = []; total.value = 0; } }
  finally { if (sequence === requestVersion) loading.value = false; }
}
async function loadQuotas() {
  if (!users.value.length) { quotas.value = {}; return; }
  const params = new URLSearchParams(); users.value.forEach((user) => params.append("userIds", String(user.id)));
  try { quotas.value = await adminGet(adminPath(`/api/admin/v1/agent/quota/batch?${params}`)); }
  catch { quotas.value = Object.fromEntries(users.value.map((user) => [user.id, { used: 0, remaining: 5 }])); }
}
watch([page, pageSize, keyword, classFilter, teacherFilter], () => { selectedUsers.value = {}; void loadUsers(); }, { immediate: true });
watch(users, () => { void loadQuotas(); });
onMounted(() => { void loadClasses(); });
function search() { keyword.value = keywordInput.value.trim(); page.value = 1; }
function resetFilters() { keywordInput.value = ""; keyword.value = ""; classFilter.value = undefined; teacherFilter.value = undefined; page.value = 1; selectedUsers.value = {}; }
function onSelectionChange(selection: Student[]) {
  const visible = new Set(users.value.map((user) => user.id));
  const next = { ...selectedUsers.value };
  Object.keys(next).forEach((id) => { if (visible.has(Number(id))) delete next[Number(id)]; });
  selection.forEach((user) => { next[user.id] = user; });
  if (Object.keys(next).length > 500) { ElMessage.warning("一次最多选择 500 名学生"); return; }
  selectedUsers.value = next;
}
function createStudent() { editing.value = null; Object.assign(form, { username: "", displayName: "", studentNo: "", classId: 0, email: "", password: "", status: "NORMAL" }); formOpen.value = true; }
function editStudent(student: Student) { editing.value = student; Object.assign(form, { username: student.username, displayName: student.displayName, studentNo: student.studentNo ?? "", classId: student.classId ?? 0, email: student.email ?? "", password: "", status: student.status ?? "NORMAL" }); formOpen.value = true; }
async function saveStudent() {
  if (!form.username.trim() || !form.displayName.trim()) { ElMessage.warning("请填写用户名和姓名"); return; }
  if (!editing.value && form.password.trim().length < 6) { ElMessage.warning("初始密码至少 6 个字符"); return; }
  saving.value = true;
  try {
    const payload = { username: form.username.trim(), displayName: form.displayName.trim(), studentNo: form.studentNo.trim() || null, classId: form.classId || 0, email: form.email.trim() || null, status: form.status, ...(form.password.trim() ? { password: form.password.trim() } : {}) };
    if (editing.value) await adminPut(adminPath(`/api/admin/v1/users/${editing.value.id}`), payload);
    else await adminPost(adminPath("/api/admin/v1/users"), { ...payload, role: "STUDENT" });
    ElMessage.success(editing.value ? "学生资料已更新" : "学生已创建"); formOpen.value = false; await loadUsers();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存学生失败"); }
  finally { saving.value = false; }
}
async function viewStudent(student: Student) {
  detailOpen.value = true; detailUser.value = student; detailRows.value = []; detailTotal.value = 0; detailPage.value = 1; detailLoading.value = true;
  try { detailUser.value = await adminGet<Student>(adminPath(`/api/admin/v1/users/${student.id}`)); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "用户详情加载失败"); }
  finally { detailLoading.value = false; }
  await loadSubmissions(student.id, 1);
}
async function loadSubmissions(userId: number, nextPage = detailPage.value) {
  detailLoadingRows.value = true; detailPage.value = nextPage;
  try { const params = new URLSearchParams({ page: String(nextPage), pageSize: "10", userId: String(userId), sortBy: "submitTime", sortOrder: "desc" }); const result = await adminGet<PageResult<Submission>>(adminPath(`/api/admin/v1/submissions?${params}`)); detailRows.value = result.list ?? []; detailTotal.value = result.total ?? 0; }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "最近提交记录加载失败"); }
  finally { detailLoadingRows.value = false; }
}
async function uploadAvatar(student: Student, event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (!file) return;
  if (!file.type.startsWith("image/")) { ElMessage.warning("请选择图片文件"); return; }
  const body = new FormData(); body.append("file", file); avatarBusyId.value = student.id;
  try { const result = await adminPost<{ avatarUrl: string }>(adminPath(`/api/admin/v1/users/${student.id}/avatar`), body); users.value = users.value.map((item) => item.id === student.id ? { ...item, avatarUrl: result.avatarUrl } : item); if (detailUser.value?.id === student.id) detailUser.value = { ...detailUser.value, avatarUrl: result.avatarUrl }; ElMessage.success("头像已更新"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "头像上传失败"); }
  finally { avatarBusyId.value = null; }
}
async function confirmDelete() {
  const target = deleteTarget.value; if (!target || deleting.value) return;
  if (!adminPassword.value) { ElMessage.warning("请输入超级管理员操作密码"); return; }
  deleting.value = true;
  try { await adminDelete(adminPath(`/api/admin/v1/users/${target.id}`), true, { adminPassword: adminPassword.value }); ElMessage.success("学生及关联记录已删除"); deleteTarget.value = null; adminPassword.value = ""; delete selectedUsers.value[target.id]; await loadUsers(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
  finally { deleting.value = false; }
}
function openBatch(action: BatchAction) { if (!selectedIds.value.length) return; batchAction.value = action; batchClassId.value = undefined; batchPassword.value = ""; batchAdminPassword.value = ""; }
async function submitBatch() {
  if (!batchAction.value || !selectedIds.value.length || batchBusy.value) return;
  if (!batchAdminPassword.value) { ElMessage.warning("请输入超级管理员操作密码"); return; }
  if (batchAction.value === "ASSIGN_CLASS" && !batchClassId.value) { ElMessage.warning("请选择目标班级"); return; }
  if (batchAction.value === "RESET_PASSWORD" && (batchPassword.value.trim().length < 6 || new TextEncoder().encode(batchPassword.value.trim()).length > 72)) { ElMessage.warning("新密码至少 6 个字符，最多 72 字节"); return; }
  batchBusy.value = true;
  try {
    const result = await adminPost<{ affectedCount: number }>(adminPath("/api/admin/v1/users/batch"), { userIds: selectedIds.value, action: batchAction.value, adminPassword: batchAdminPassword.value, classId: batchAction.value === "ASSIGN_CLASS" ? batchClassId.value : undefined, password: batchAction.value === "RESET_PASSWORD" ? batchPassword.value.trim() : undefined }, true, 300000);
    ElMessage.success(`${batchLabels[batchAction.value]}成功，共 ${result.affectedCount} 名学生`); batchAction.value = null; selectedUsers.value = {}; await loadUsers();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "批量操作失败"); }
  finally { batchBusy.value = false; batchAdminPassword.value = ""; }
}
async function resetAllQuota() {
  if (!resetAllPassword.value) { ElMessage.warning("请输入超级管理员操作密码"); return; }
  resetAllBusy.value = true;
  try { await adminPost(adminPath("/api/admin/v1/agent/reset/all"), { adminPassword: resetAllPassword.value }); resetAllOpen.value = false; await loadQuotas(); ElMessage.success("所有用户 AI 额度已重置"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "重置 AI 额度失败"); }
  finally { resetAllBusy.value = false; resetAllPassword.value = ""; }
}
async function importStudents(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (!file) return;
  if (!file.name.toLowerCase().endsWith(".xlsx")) { ElMessage.warning("仅支持 .xlsx 文件"); return; }
  const body = new FormData(); body.append("file", file); importBusy.value = true;
  try { importResult.value = await adminPost<ImportResult>(adminPath("/api/admin/v1/users/import-xlsx"), body); importResultOpen.value = true; ElMessage.success(`导入完成：成功 ${importResult.value.successCount} 人，失败 ${importResult.value.failureCount} 行`); await loadUsers(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "学生导入失败"); }
  finally { importBusy.value = false; }
}
function statusTag(status: string) { return status === "BANNED" ? "danger" : "success"; }
function formatTime(value?: string | null) { return value ? formatDisplayDateTime(value) : "-"; }
</script>

<template>
  <section class="student-management page-container">
    <el-card shadow="never" class="filter-card"><div class="filters management-inline-toolbar"><el-input v-model="keywordInput" clearable placeholder="搜索用户名、姓名、邮箱或学号" @keyup.enter="search"/><el-select v-model="teacherFilter" clearable filterable placeholder="筛选任课教师" @change="classFilter=undefined;page=1"><el-option v-for="item in teachers" :key="item.id" :label="item.name" :value="item.id"/></el-select><el-select v-model="classFilter" clearable filterable placeholder="筛选班级" @change="page=1"><el-option label="未分班" :value="0"/><el-option v-for="item in classes.filter((row)=>!teacherFilter||row.teacherId===teacherFilter)" :key="item.id" :label="item.name+(item.teacherName?`（${item.teacherName}）`:``)" :value="item.id"/></el-select><el-button type="primary" @click="search">搜索</el-button><el-button @click="resetFilters">重置筛选</el-button><div class="management-card-actions"><div class="heading-actions"><el-button type="primary" @click="createStudent">添加学生</el-button><el-button :loading="importBusy" @click="importInput?.click()">导入学生</el-button><el-button @click="resetAllOpen=true">全部重置 AI 额度</el-button><input ref="importInput" hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="importStudents"/></div></div></div></el-card>
    <el-card shadow="never"><div class="selection-toolbar"><span>已选择 {{ selectedIds.length }} 名学生（可跨页勾选，最多 500 名）</span><el-button :disabled="!selectedIds.length||loading||batchBusy" @click="batchMenuOpen=true">批量管理</el-button></div><el-table v-loading="loading" :data="users" row-key="id" stripe @selection-change="onSelectionChange"><el-table-column type="selection" width="48" reserve-selection/><el-table-column prop="username" label="用户名" min-width="135"/><el-table-column prop="displayName" label="姓名" min-width="120"/><el-table-column prop="studentNo" label="学号" min-width="110"/><el-table-column prop="className" label="班级" min-width="120"/><el-table-column prop="lastSubmissionTime" label="最后提交时间" min-width="165"><template #default="{row}">{{ row.lastSubmissionTime?formatTime(row.lastSubmissionTime):'未提交' }}</template></el-table-column><el-table-column prop="status" label="状态" width="90"><template #default="{row}"><el-tag :type="statusTag(row.status)">{{ row.status==='BANNED'?'封禁':'正常' }}</el-tag></template></el-table-column><el-table-column prop="acCount" label="通过总数" width="100"/><el-table-column label="AI 额度" width="100"><template #default="{row}"><el-tag :type="(quotas[row.id]?.remaining??0)>0?'success':'danger'">{{ quotas[row.id]?.remaining??'-' }}/{{ (quotas[row.id]?.remaining??0)+(quotas[row.id]?.used??0) }}</el-tag></template></el-table-column><el-table-column label="操作" width="200" fixed="right"><template #default="{row}"><el-button link type="primary" @click="viewStudent(row)">查看</el-button><el-button link type="primary" @click="editStudent(row)">编辑</el-button><el-button link type="danger" @click="deleteTarget=row;adminPassword=''">删除</el-button></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[20,50,100]"/></div></el-card>
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon/>

    <el-dialog class="qoj-management-dialog" v-model="formOpen" :title="editing?'编辑学生':'添加学生'" width="min(620px,95vw)"><el-form label-position="top"><div class="form-grid"><el-form-item label="用户名" required><el-input v-model="form.username" :disabled="!!editing"/></el-form-item><el-form-item label="姓名" required><el-input v-model="form.displayName"/></el-form-item><el-form-item label="学号"><el-input v-model="form.studentNo"/></el-form-item><el-form-item label="邮箱"><el-input v-model="form.email"/></el-form-item><el-form-item label="班级"><el-select v-model="form.classId" clearable placeholder="未分班"><el-option label="未分班" :value="0"/><el-option v-for="item in classes" :key="item.id" :label="item.name" :value="item.id"/></el-select></el-form-item><el-form-item label="状态"><el-select v-model="form.status"><el-option label="正常" value="NORMAL"/><el-option label="封禁" value="BANNED"/></el-select></el-form-item><el-form-item :label="editing?'重置密码（留空不修改）':'初始密码'" :required="!editing"><el-input v-model="form.password" type="password" show-password autocomplete="new-password"/></el-form-item></div></el-form><template #footer><el-button @click="formOpen=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveStudent">保存</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="deleteDialog" title="删除学生" width="min(520px,95vw)"><el-alert type="error" :closable="false" title="删除会清理学生账号及其关联的个人提交，操作无法恢复。"/><p>删除：{{ deleteTarget?.displayName }}（{{ deleteTarget?.username }}，#{{ deleteTarget?.id }}）</p><el-form-item label="超级管理员操作密码" required><el-input v-model="adminPassword" type="password" show-password autocomplete="off"/></el-form-item><template #footer><el-button :disabled="deleting" @click="deleteTarget=null">取消</el-button><el-button type="danger" :loading="deleting" @click="confirmDelete">验证并删除</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="batchMenuOpen" title="批量管理" width="min(620px,95vw)">
      <p>已选择 {{ selectedIds.length }} 名学生，请选择批量操作。</p>
      <div class="batch-menu-actions"><el-button v-for="action in (Object.keys(batchLabels) as BatchAction[])" :key="action" :type="action==='DELETE'?'danger':'default'" :disabled="!selectedIds.length||loading||batchBusy" @click="batchMenuOpen=false;openBatch(action)">批量{{ batchLabels[action] }}</el-button><el-button :disabled="!selectedIds.length" @click="selectedUsers={};batchMenuOpen=false">清空选择</el-button></div>
      <template #footer><el-button @click="batchMenuOpen=false">关闭</el-button></template>
    </el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="batchDialog" :title="`批量${batchAction?batchLabels[batchAction]:''}`" width="min(620px,95vw)" :close-on-click-modal="!batchBusy"><el-alert type="info" :closable="false" :title="`本次仅操作已勾选的 ${selectedIds.length} 名学生。`"/><p class="selected-names">{{ selectedIds.map((id)=>selectedUsers[id]?.displayName||selectedUsers[id]?.username||`#${id}`).join('、') }}</p><el-alert v-if="batchAction==='ASSIGN_CLASS'" type="info" :closable="false" title="学生将转入目标班级，旧班级课程权限撤销，目标班级课程自动加入，历史提交保留。"/><el-select v-if="batchAction==='ASSIGN_CLASS'" v-model="batchClassId" placeholder="选择目标班级" style="width:100%;margin:12px 0"><el-option v-for="item in classes" :key="item.id" :label="item.name" :value="item.id"/></el-select><el-alert v-if="batchAction==='REMOVE_CLASS'" type="warning" :closable="false" title="学生会失去原班级课程和题单访问权限，账号与历史提交保留。"/><el-input v-if="batchAction==='RESET_PASSWORD'" v-model="batchPassword" type="password" show-password maxlength="72" placeholder="统一的新密码（至少 6 个字符）"/><el-alert v-if="batchAction==='RESET_AI_QUOTA'" type="info" :closable="false" title="仅重置所选学生今天已使用的 AI 额度。"/><el-alert v-if="batchAction==='DELETE'" type="error" :closable="false" title="将删除所选学生账号及其个人提交等关联记录，无法恢复。"/><el-form-item label="超级管理员操作密码" required style="margin-top:14px"><el-input v-model="batchAdminPassword" type="password" show-password autocomplete="off"/></el-form-item><template #footer><el-button :disabled="batchBusy" @click="batchAction=null">取消</el-button><el-button type="primary" :loading="batchBusy" @click="submitBatch">确认执行</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="resetAllOpen" title="全部重置 AI 额度" width="min(500px,95vw)"><el-alert type="warning" :closable="false" title="将重置所有用户今天的 AI 额度，请确认操作范围。"/><el-form-item label="超级管理员操作密码" required style="margin-top:14px"><el-input v-model="resetAllPassword" type="password" show-password autocomplete="off"/></el-form-item><template #footer><el-button :disabled="resetAllBusy" @click="resetAllOpen=false">取消</el-button><el-button type="primary" :loading="resetAllBusy" @click="resetAllQuota">验证并重置</el-button></template></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="detailOpen" :title="detailUser?.displayName||detailUser?.username||'学生详情'" width="min(980px,95vw)"><el-skeleton v-if="detailLoading" :rows="5" animated/><template v-else-if="detailUser"><div class="profile-row"><el-avatar :size="64" :src="detailUser.avatarUrl||undefined">{{ (detailUser.displayName||detailUser.username).slice(0,1) }}</el-avatar><div><strong>{{ detailUser.displayName }}</strong><p>{{ detailUser.username }} · #{{ detailUser.id }} · {{ detailUser.className||'未分班' }}</p></div><el-button @click="avatarInput?.click()" :loading="avatarBusyId===detailUser.id">更换头像</el-button><input ref="avatarInput" hidden type="file" accept="image/*" @change="uploadAvatar(detailUser,$event)"/></div><el-descriptions :column="2" border><el-descriptions-item label="学号">{{ detailUser.studentNo||'-' }}</el-descriptions-item><el-descriptions-item label="邮箱">{{ detailUser.email||'-' }}</el-descriptions-item><el-descriptions-item label="状态">{{ detailUser.status }}</el-descriptions-item><el-descriptions-item label="通过总数">{{ detailUser.acCount??0 }}</el-descriptions-item><el-descriptions-item label="注册时间">{{ formatTime(detailUser.createdAt) }}</el-descriptions-item></el-descriptions></template><h3>最近提交</h3><el-table v-loading="detailLoadingRows" :data="detailRows" stripe><el-table-column prop="id" label="ID" width="85"/><el-table-column label="题目" min-width="180"><template #default="{row}">{{ row.problemTitle||row.contestTitle||row.practiceTitle||'-' }}</template></el-table-column><el-table-column prop="language" label="语言" width="100"/><el-table-column prop="status" label="结果" width="100"/><el-table-column prop="score" label="分数" width="90"/><el-table-column label="提交时间" min-width="170"><template #default="{row}">{{ formatTime(row.submitTime||row.createdAt) }}</template></el-table-column></el-table><div class="pagination"><Pagination :page="detailPage" :limit="10" :total="detailTotal" @pagination="({ page }) => loadSubmissions(detailUser?.id??0,page)"/></div></el-dialog>
    <el-dialog class="qoj-management-dialog" v-model="importResultOpen" title="学生导入结果" width="min(720px,95vw)"><el-alert :type="importResult?.failureCount?'warning':'success'" :closable="false" :title="`导入完成：成功 ${importResult?.successCount??0} 名，失败 ${importResult?.failureCount??0} 行`"/><el-table v-if="importResult?.errors.length" :data="importResult.errors"><el-table-column prop="rowNumber" label="行号" width="80"/><el-table-column prop="username" label="用户名"/><el-table-column prop="studentNo" label="学号"/><el-table-column prop="reason" label="失败原因"/></el-table><template #footer><el-button type="primary" @click="importResultOpen=false">关闭</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.batch-menu-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.batch-menu-actions .el-button{margin:0;width:100%}
.student-management{display:flex;flex-direction:column;gap:14px}.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.heading-actions,.filters,.selection-toolbar,.selection-toolbar>div,.pagination{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.filters .el-input{width:min(300px,100%)}.filters .el-select{width:min(220px,100%)}.selection-toolbar,.pagination{justify-content:space-between;margin-bottom:12px}.pagination{margin:14px 0 0;color:var(--el-text-color-secondary)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.selected-names{max-height:100px;overflow:auto;color:var(--el-text-color-secondary)}.profile-row{display:flex;align-items:center;gap:14px;margin-bottom:18px}.profile-row>div{flex:1}.profile-row p{margin:4px 0 0;color:var(--el-text-color-secondary)}.student-management h3{margin-top:22px}@media(max-width:850px){.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{width:100%}.filters .el-input,.filters .el-select{width:100%}.form-grid{grid-template-columns:1fr}.selection-toolbar{align-items:flex-start;flex-direction:column}}</style>

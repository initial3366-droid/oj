<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { readAuthToken } from "../../../api/tokenStorage";
import { fetchMe, fetchMySubmissions, fetchSubmissionDetail, updatePassword, updateProfile, uploadMyAvatar, applyToClass, type SubmissionRecord, type UpdateProfilePayload } from "../../../data/apiClient";
import type { UserProfile } from "../../../data/types";
import { fetchMyContests, type Contest } from "../../../api/contest";
import { languageLabel } from "../../../data/languages";
import { formatDisplayDateTime } from "../../../lib/format";
import { encryptId } from "../../../utils/cipher";
import { useOjDataStore } from "../../stores/ojData";

type TabKey = "submissions" | "my-contests" | "class-courses" | "my-class" | "join-class" | "settings";
const route = useRoute();
const router = useRouter();
const ojData = useOjDataStore();
const user = ref<UserProfile | null>(null);
const loading = ref(true);
const error = ref("");
const submissions = ref<SubmissionRecord[]>([]);
const contests = ref<Contest[]>([]);
const contestsTotal = ref(0);
const contestsLoading = ref(false);
const contestsPage = ref(1);
const activeTab = computed<TabKey>(() => {
  const value = String(route.query.tab || "submissions");
  const allowed: TabKey[] = ["submissions", "my-contests", "class-courses", "my-class", "join-class", "settings"];
  return (allowed.includes(value as TabKey) ? value : "submissions") as TabKey;
});
const tabs = computed(() => [
  { name: "submissions", label: "最近提交" },
  { name: "my-contests", label: "我的比赛" },
  ...(user.value?.classId ? [{ name: "class-courses", label: "班级课程" }, { name: "my-class", label: "我的班级" }] : [{ name: "join-class", label: "加入班级" }]),
  { name: "settings", label: "设置" },
]);
const keyword = ref(String(route.query.subSearch || ""));
const statusFilter = ref(String(route.query.subStatus || ""));
const languageFilter = ref(String(route.query.subLang || ""));
const page = ref(Math.max(1, Number(route.query.subPage || 1)));
const pageSize = ref(20);
const profileForm = ref({ username: "", displayName: "" });
const passwordForm = ref({ oldPassword: "", newPassword: "", confirmPassword: "" });
const classId = ref("");
const classReason = ref("");
const applying = ref(false);
const applied = ref(false);
const avatarInput = ref<HTMLInputElement>();
const avatarUploading = ref(false);
const captchaId = ref("");
const captchaImage = ref("");
const captchaInput = ref("");
const emailCode = ref("");
const emailCountdown = ref(0);
const profileDialog = ref(false);
const profileUpdate = ref<UpdateProfilePayload | null>(null);
const profileSaving = ref(false);
const codeDialog = ref(false);
const codeLoading = ref(false);
const selectedSubmission = ref<SubmissionRecord | null>(null);

const filteredSubmissions = computed(() => submissions.value.filter((item) => {
  const term = keyword.value.trim().toLowerCase();
  if (term && !String(item.problemId).includes(term) && !(item.problemTitle || "").toLowerCase().includes(term)) return false;
  if (statusFilter.value && item.status.toLowerCase() !== statusFilter.value.toLowerCase()) return false;
  if (languageFilter.value && item.language.toLowerCase() !== languageFilter.value.toLowerCase()) return false;
  return true;
}));
const pageRows = computed(() => filteredSubmissions.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const languageOptions = computed(() => Array.from(new Set(submissions.value.map((item) => item.language).filter(Boolean))).sort());
const statusOptions = ["AC", "WA", "TLE", "MLE", "RE", "CE", "SE"];
const acceptedCount = computed(() => new Set(submissions.value.filter((item) => ["AC", "ACCEPTED"].includes(item.status.toUpperCase())).map((item) => item.problemId)).size);
const acceptanceRate = computed(() => submissions.value.length ? Math.round(acceptedCount.value / submissions.value.length * 100) : 0);

async function loadUser() {
  const token = readAuthToken("frontend");
  if (!token) { loading.value = false; error.value = "请登录后查看个人中心"; return; }
  loading.value = true;
  try {
    const data = await fetchMe(token);
    user.value = data;
    profileForm.value = { username: data.username, displayName: data.displayName };
    submissions.value = data.email?.trim() ? await fetchMySubmissions(1, 500) : [];
    ojData.updateState((state) => ({ ...state, activeUser: data }));
    error.value = "";
  } catch (cause) { user.value = null; submissions.value = []; error.value = cause instanceof Error ? cause.message : "用户信息加载失败"; }
  finally { loading.value = false; }
}
async function loadContests() {
  if (!user.value?.email || activeTab.value !== "my-contests") return;
  contestsLoading.value = true;
  try { const result = await fetchMyContests(contestsPage.value, 10); contests.value = result.list; contestsTotal.value = result.total; }
  catch { contests.value = []; contestsTotal.value = 0; }
  finally { contestsLoading.value = false; }
}
async function loadCaptcha() {
  try {
    const response = await fetch("/api/v1/captcha/image");
    const result = await response.json();
    if (result.code === 200) { captchaId.value = result.data.captchaId; captchaImage.value = result.data.image; captchaInput.value = ""; }
    else ElMessage.error(result.message || "验证码加载失败");
  } catch { ElMessage.error("验证码加载失败"); }
}
async function sendEmailCode() {
  if (!captchaInput.value.trim() || !captchaId.value) { ElMessage.error("请先输入图形验证码"); return; }
  if (!user.value?.email) { ElMessage.error("账号未绑定邮箱"); return; }
  try {
    const response = await fetch("/api/v1/captcha/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.value.email, captchaId: captchaId.value, captcha: captchaInput.value }) });
    const result = await response.json();
    if (result.code === 200) { ElMessage.success("验证码已发送到您的邮箱"); emailCountdown.value = result.data?.remainingSeconds || 60; }
    else ElMessage.error(result.message || "发送失败");
    await loadCaptcha();
  } catch { ElMessage.error("发送失败，请稍后重试"); await loadCaptcha(); }
}
function beginProfileUpdate() {
  if (!user.value) return;
  const payload: UpdateProfilePayload = { emailVerificationCode: "" };
  const username = profileForm.value.username.trim();
  const displayName = profileForm.value.displayName.trim();
  if (username !== user.value.username) {
    if (username.length < 3 || username.length > 15) { ElMessage.error("用户名长度必须在3-15之间"); return; }
    payload.username = username;
  }
  if (displayName !== user.value.displayName) {
    if (!displayName) { ElMessage.error("显示名称不能为空"); return; }
    payload.displayName = displayName;
  }
  if (!payload.username && !payload.displayName) { ElMessage.warning("没有修改任何信息"); return; }
  profileUpdate.value = payload;
  profileDialog.value = true;
  emailCode.value = "";
  void loadCaptcha();
}
async function confirmProfileUpdate() {
  const token = readAuthToken("frontend");
  if (!token || !profileUpdate.value || !emailCode.value.trim()) { ElMessage.error("请输入邮箱验证码"); return; }
  profileSaving.value = true;
  try {
    await updateProfile({ ...profileUpdate.value, emailVerificationCode: emailCode.value.trim() }, token);
    const next = await fetchMe(token);
    user.value = next;
    profileForm.value = { username: next.username, displayName: next.displayName };
    ojData.updateState((state) => ({ ...state, activeUser: next }));
    profileDialog.value = false;
    profileUpdate.value = null;
    ElMessage.success("修改成功");
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "修改失败"); }
  finally { profileSaving.value = false; }
}
async function changePassword() {
  const { oldPassword, newPassword, confirmPassword } = passwordForm.value;
  if (!oldPassword || !newPassword) return ElMessage.error("请填写完整信息");
  if (newPassword.length < 6 || newPassword.length > 20) return ElMessage.error("新密码长度必须在6-20之间");
  if (newPassword !== confirmPassword) return ElMessage.error("两次密码不一致");
  const token = readAuthToken("frontend");
  if (!token) return;
  try { await updatePassword({ oldPassword, newPassword }, token); passwordForm.value = { oldPassword: "", newPassword: "", confirmPassword: "" }; ElMessage.success("密码修改成功"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "修改失败"); }
}
async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return ElMessage.error("请选择图片文件");
  const token = readAuthToken("frontend");
  if (!token) return;
  avatarUploading.value = true;
  try { await uploadMyAvatar(file, token); const next = await fetchMe(token); user.value = next; ojData.updateState((state) => ({ ...state, activeUser: next, ratings: state.ratings.map((rating) => rating.userId === Number(next.id.replace(/^u/, "")) ? { ...rating, avatarUrl: next.avatarUrl } : rating) })); ElMessage.success("头像已更新"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "头像上传失败"); }
  finally { avatarUploading.value = false; }
}
async function applyClass() {
  const id = Number(classId.value);
  if (!Number.isInteger(id) || id <= 0) return ElMessage.error("请输入有效的班级 ID");
  applying.value = true;
  try { await applyToClass(id, { reason: classReason.value.trim() || undefined }); classId.value = ""; classReason.value = ""; applied.value = true; ElMessage.success("入班申请已发送，请等待教师审核"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "申请发送失败"); }
  finally { applying.value = false; }
}
async function viewCode(item: SubmissionRecord) {
  codeLoading.value = true;
  try { selectedSubmission.value = item.code ? item : await fetchSubmissionDetail(item.id); codeDialog.value = true; }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "提交代码加载失败"); }
  finally { codeLoading.value = false; }
}
function setTab(tab: string | number) {
  const query: Record<string, string> = {};
  Object.entries(route.query).forEach(([key, value]) => { if (typeof value === "string") query[key] = value; });
  query.tab = String(tab);
  if (String(tab) !== "submissions") { delete query.subPage; delete query.subStatus; delete query.subLang; delete query.subSearch; }
  void router.replace({ query });
}
function statusType(status: string) { return ["AC", "ACCEPTED"].includes(status.toUpperCase()) ? "success" : ["WA", "WRONG_ANSWER", "CE", "COMPILE_ERROR"].includes(status.toUpperCase()) ? "danger" : "warning"; }
function submissionDate(item: SubmissionRecord) { return formatDisplayDateTime(item.submitTime || item.createdAt); }
function problemPath(id: number) { return `/practice/problem/p${encryptId(id)}`; }
function updateFilters() {
  const query = { ...route.query, tab: "submissions", subPage: String(page.value) } as Record<string, string>;
  if (statusFilter.value) query.subStatus = statusFilter.value; else delete query.subStatus;
  if (languageFilter.value) query.subLang = languageFilter.value; else delete query.subLang;
  if (keyword.value) query.subSearch = keyword.value; else delete query.subSearch;
  void router.replace({ query });
}
watch([activeTab, contestsPage], () => { void loadContests(); });
watch([keyword, statusFilter, languageFilter], () => { if (page.value !== 1) page.value = 1; updateFilters(); });
watch(page, updateFilters);
watch(emailCountdown, (value) => { if (value > 0) window.setTimeout(() => { if (emailCountdown.value === value) emailCountdown.value--; }, 1000); });
onMounted(() => { void loadUser(); });
</script>

<template>
  <div v-if="loading" class="center-loading page-container"><el-skeleton :rows="5" animated /></div>
  <div v-else-if="!user" class="login-card"><h1>请先登录</h1><p>{{ error || '登录后查看真实用户信息和提交数据。' }}</p><el-button type="primary" @click="router.push('/login')">登录</el-button><el-button @click="router.push('/register')">注册</el-button></div>
  <div v-else class="user-center-page">
    <el-card shadow="never" class="profile-card"><div class="profile-main"><el-avatar :size="68" :src="user.avatarUrl">{{ user.displayName?.slice(0,1) || 'U' }}</el-avatar><div class="profile-identity"><strong>{{ user.displayName || user.username }}</strong><span>@{{ user.username }}{{ user.studentNo ? ` · ${user.studentNo}` : '' }}</span><el-tag type="primary" size="small">{{ user.role }}</el-tag><input ref="avatarInput" class="hidden-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" @change="uploadAvatar"><el-button size="small" :loading="avatarUploading" @click="avatarInput?.click()">修改头像</el-button></div><div class="stats"><div><small>通过率</small><strong>{{ acceptanceRate }}%</strong></div><div><small>非比赛 AC</small><strong>{{ user.totalSolved }}</strong></div><div><small>非比赛提交</small><strong>{{ user.totalSubmissions }}</strong></div></div></div></el-card>
    <el-card shadow="never"><el-tabs :model-value="activeTab" @tab-change="setTab"><el-tab-pane v-for="tab in tabs" :key="tab.name" :label="tab.label" :name="tab.name">
      <template v-if="tab.name === 'submissions'"><div class="filters"><el-input v-model="keyword" clearable placeholder="搜索题目 ID 或名称"/><el-select v-model="statusFilter" clearable placeholder="状态筛选"><el-option v-for="status in statusOptions" :key="status" :label="status" :value="status"/></el-select><el-select v-model="languageFilter" clearable placeholder="语言筛选"><el-option v-for="language in languageOptions" :key="language" :label="languageLabel(language)" :value="language"/></el-select></div><el-table :data="pageRows" row-key="id" stripe empty-text="暂无提交记录"><el-table-column prop="id" label="提交ID" width="100"/><el-table-column label="题目"><template #default="{ row }"><router-link :to="problemPath(row.problemId)">{{ row.problemTitle || `#${row.problemId}` }}</router-link></template></el-table-column><el-table-column label="语言"><template #default="{ row }">{{ languageLabel(row.language) }}</template></el-table-column><el-table-column label="状态"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ row.status }}</el-tag></template></el-table-column><el-table-column label="提交时间"><template #default="{ row }">{{ submissionDate(row) }}</template></el-table-column><el-table-column label="代码"><template #default="{ row }"><el-button link type="primary" :loading="codeLoading" @click="viewCode(row)">查看代码</el-button></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :page-sizes="[10,20,50]" :total="filteredSubmissions.length"/></div></template>
      <template v-else-if="tab.name === 'my-contests'"><el-table :data="contests" row-key="id" v-loading="contestsLoading" empty-text="暂无比赛记录"><el-table-column label="比赛名称"><template #default="{ row }"><router-link :to="`/contests/${row.id}`">{{ row.title }}</router-link></template></el-table-column><el-table-column prop="type" label="类型" width="100"/><el-table-column label="比赛时间"><template #default="{ row }">{{ formatDisplayDateTime(row.startTime) }} ~ {{ formatDisplayDateTime(row.endTime) }}</template></el-table-column><el-table-column prop="status" label="状态" width="110"/></el-table><div class="pagination"><Pagination v-model:page="contestsPage" :limit="10" :total="contestsTotal"/></div></template>
      <template v-else-if="tab.name === 'class-courses'"><div class="class-course-link"><p>浏览当前班级已发布的课程题单。</p><el-button type="primary" @click="router.push('/courses')">打开我的课程</el-button></div></template>
      <template v-else-if="tab.name === 'my-class'"><el-descriptions title="我的班级" :column="1" border><el-descriptions-item label="班级名称">{{ user.className || `班级 #${user.classId}` }}</el-descriptions-item><el-descriptions-item label="班级 ID">{{ user.classId }}</el-descriptions-item></el-descriptions></template>
      <template v-else-if="tab.name === 'join-class'"><el-result v-if="applied" icon="success" title="申请已发送" sub-title="请等待教师审核，审核结果会在此页面显示。"/><div class="settings-form"><el-input v-model="classId" placeholder="班级 ID"/><el-input v-model="classReason" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="申请备注：姓名、学号或加入原因"/><el-button type="primary" :loading="applying" @click="applyClass">发送入班申请</el-button></div></template>
      <template v-else-if="tab.name === 'settings'"><div class="settings-sections"><section><h3>个人信息</h3><el-form label-position="top"><el-form-item label="用户名"><el-input v-model="profileForm.username" maxlength="15"/></el-form-item><el-form-item label="显示名称"><el-input v-model="profileForm.displayName"/></el-form-item><el-button type="primary" @click="beginProfileUpdate">保存个人信息</el-button></el-form></section><section><h3>修改密码</h3><el-form label-position="top"><el-form-item label="旧密码"><el-input v-model="passwordForm.oldPassword" type="password" show-password/></el-form-item><el-form-item label="新密码"><el-input v-model="passwordForm.newPassword" type="password" show-password/></el-form-item><el-form-item label="确认新密码"><el-input v-model="passwordForm.confirmPassword" type="password" show-password/></el-form-item><el-button type="primary" @click="changePassword">修改密码</el-button></el-form></section></div></template>
    </el-tab-pane></el-tabs></el-card>
    <el-dialog v-model="profileDialog" title="邮箱验证码" width="480px"><p>输入发送到 {{ user.email }} 的验证码，确认个人信息变更。</p><div class="captcha-row"><el-input v-model="captchaInput" placeholder="图形验证码"/><button v-if="captchaImage" class="captcha-button" type="button" @click="loadCaptcha"><img :src="captchaImage" alt="图形验证码"/></button><el-button v-else @click="loadCaptcha">刷新验证码</el-button></div><div class="captcha-row"><el-input v-model="emailCode" placeholder="邮箱验证码"/><el-button :disabled="emailCountdown > 0" @click="sendEmailCode">{{ emailCountdown ? `${emailCountdown}秒后重试` : '发送验证码' }}</el-button></div><template #footer><el-button @click="profileDialog = false">取消</el-button><el-button type="primary" :loading="profileSaving" @click="confirmProfileUpdate">确认修改</el-button></template></el-dialog>
    <el-dialog v-model="codeDialog" :title="`提交代码 #${selectedSubmission?.id ?? ''}`" width="min(900px, 92vw)"><pre class="code-view">{{ selectedSubmission?.code || '暂无代码内容' }}</pre></el-dialog>
  </div>
</template>

<style scoped>
.center-loading,.login-card { max-width: 900px; margin: 0 auto; padding: 24px; }
.login-card { border: 1px solid var(--qoj-color-border); border-radius: 12px; background: white; }
.profile-card { margin-bottom: 18px; }
.profile-main { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.profile-identity { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.profile-identity strong { font-size: 18px; }
.profile-identity span,.stats small { color: var(--qoj-color-text-2); }
.hidden-input { display: none; }
.stats { display: flex; margin-left: auto; gap: 28px; }
.stats div { display: grid; justify-items: center; gap: 6px; }
.stats strong { font-size: 22px; }
.filters,.captcha-row { display: flex; gap: 12px; margin-bottom: 14px; }
.filters > * { max-width: 230px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.class-course-link,.settings-form { display: grid; gap: 14px; max-width: 560px; padding: 20px; }
.settings-sections { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 28px; padding: 12px; }
.settings-sections section { min-width: 0; }
.captcha-row > * { flex: 1; min-width: 0; }
.captcha-button { flex: 0 0 124px; border: 1px solid var(--qoj-color-border); border-radius: 6px; background: white; cursor: pointer; }
.captcha-button img { width: 100%; height: 38px; object-fit: contain; }
.code-view { max-height: 65vh; overflow: auto; padding: 16px; border-radius: 8px; background: #101827; color: var(--card-border); white-space: pre-wrap; overflow-wrap: anywhere; }
@media(max-width:720px) { .settings-sections { grid-template-columns:1fr; } .stats { width:100%; justify-content:space-around; margin-left:0; } .filters { flex-direction:column; } .filters>* { max-width:none; } }
</style>

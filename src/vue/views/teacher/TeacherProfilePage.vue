<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { teacherGet, teacherPost, teacherPut, type TeacherMe } from "../../../teacher/teacherApi";

const me = ref<TeacherMe | null>(null);
const loading = ref(false);
const profileSaving = ref(false);
const passwordSaving = ref(false);
const avatarUploading = ref(false);
const profile = reactive({ displayName: "" });
const password = reactive({ oldPassword: "", newPassword: "", confirmPassword: "" });

async function load() {
  loading.value = true;
  try { me.value = await teacherGet<TeacherMe>("/api/teacher/v1/me"); profile.displayName = me.value.displayName || ""; }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "加载个人信息失败"); }
  finally { loading.value = false; }
}

async function saveProfile() {
  if (!profile.displayName.trim()) { ElMessage.warning("请输入姓名"); return; }
  profileSaving.value = true;
  try { await teacherPut("/api/teacher/v1/me/profile", { displayName: profile.displayName.trim() }); ElMessage.success("姓名已更新"); await load(); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "保存失败"); }
  finally { profileSaving.value = false; }
}

async function savePassword() {
  if (!password.oldPassword || !password.newPassword || !password.confirmPassword) { ElMessage.warning("请完整填写密码信息"); return; }
  if (password.newPassword.length < 6 || password.newPassword.length > 20) { ElMessage.warning("新密码长度需要为 6 到 20 位"); return; }
  if (password.newPassword !== password.confirmPassword) { ElMessage.error("两次输入的新密码不一致"); return; }
  passwordSaving.value = true;
  try { await teacherPut("/api/teacher/v1/me/password", { oldPassword: password.oldPassword, newPassword: password.newPassword }); Object.assign(password, { oldPassword: "", newPassword: "", confirmPassword: "" }); ElMessage.success("密码已修改"); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "密码修改失败"); }
  finally { passwordSaving.value = false; }
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = "";
  if (!file) return;
  if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.type)) { ElMessage.warning("请选择 PNG、JPG、GIF、WebP 或 BMP 图片"); return; }
  avatarUploading.value = true;
  try { const body = new FormData(); body.append("file", file); await teacherPost("/api/teacher/v1/me/avatar", body); ElMessage.success("头像已更新"); await load(); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "头像上传失败"); }
  finally { avatarUploading.value = false; }
}

onMounted(load);
</script>

<template>
  <section class="teacher-profile page-container" v-loading="loading">
    <el-card shadow="never">
      <template #header>个人信息</template>
      <div class="identity">
        <el-avatar :size="64"><img v-if="me?.avatarUrl" :src="me.avatarUrl" :alt="me.displayName || me.username"><span v-else>{{ me?.displayName?.charAt(0) || "教" }}</span></el-avatar>
        <div><strong>{{ me?.displayName || "-" }}</strong><span>教师 · @{{ me?.username || "-" }}</span><label class="upload-button"><input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" :disabled="avatarUploading" @change="uploadAvatar"><el-button size="small" :loading="avatarUploading">修改头像</el-button></label></div>
      </div>
      <el-form label-position="top" class="profile-form">
        <el-form-item label="用户名"><el-input :model-value="me?.username || ''" disabled /></el-form-item>
        <el-form-item label="教师编号"><el-input :model-value="me?.teacherNo || '-'" disabled /></el-form-item>
        <el-form-item label="专业"><el-input :model-value="me?.majorName || '未分配'" disabled /></el-form-item>
        <el-form-item label="姓名" required><el-input v-model="profile.displayName" maxlength="80" show-word-limit /></el-form-item>
        <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存修改</el-button>
      </el-form>
    </el-card>
    <el-card shadow="never">
      <template #header>修改密码</template>
      <el-form label-position="top" class="profile-form">
        <el-form-item label="当前密码" required><el-input v-model="password.oldPassword" type="password" show-password autocomplete="current-password" /></el-form-item>
        <el-form-item label="新密码" required><el-input v-model="password.newPassword" type="password" show-password autocomplete="new-password" maxlength="20" /><small>长度为 6 到 20 位</small></el-form-item>
        <el-form-item label="确认新密码" required><el-input v-model="password.confirmPassword" type="password" show-password autocomplete="new-password" maxlength="20" /></el-form-item>
        <el-button type="primary" :loading="passwordSaving" @click="savePassword">修改密码</el-button>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.teacher-profile{display:flex;flex-direction:column;gap:16px;max-width:680px;margin:0 auto}.identity{display:flex;align-items:center;gap:16px;margin-bottom:24px}.identity :deep(.el-avatar){background:var(--el-color-primary)}.identity>div{display:flex;flex-direction:column;align-items:flex-start;gap:5px}.identity strong{font-size:18px}.identity span,.profile-form small{color:var(--el-text-color-secondary);font-size:13px}.upload-button input{display:none}.profile-form{max-width:520px}
</style>

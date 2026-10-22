<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminGet, adminPut } from "../../../admin/api/adminClient";

interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  role: string;
}

const roleNames: Record<string, string> = { SUPER_ADMIN: "超级管理员", TEACHER: "教师", STUDENT: "学生" };
const user = ref<UserProfile | null>(null);
const loading = ref(false);
const saving = ref(false);
const form = reactive({ username: "", displayName: "", email: "" });

async function load() {
  loading.value = true;
  try {
    user.value = await adminGet<UserProfile>("/api/admin/v1/me");
    form.username = user.value.username;
    form.displayName = user.value.displayName || "";
    form.email = user.value.email || "";
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "加载个人信息失败"); }
  finally { loading.value = false; }
}

async function save() {
  if (form.username.trim().length < 3 || form.username.trim().length > 15) { ElMessage.warning("用户名长度必须在3-15之间"); return; }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { ElMessage.warning("请输入有效的邮箱地址"); return; }
  if (!form.displayName.trim()) { ElMessage.warning("请输入显示名称"); return; }
  saving.value = true;
  try {
    await adminPut("/api/admin/v1/me", { username: form.username.trim(), displayName: form.displayName.trim(), email: form.email.trim() });
    ElMessage.success("个人信息已更新");
    await load();
    if (user.value) window.dispatchEvent(new CustomEvent("qoj:admin-profile-updated", { detail: user.value }));
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "保存失败"); }
  finally { saving.value = false; }
}

onMounted(load);
</script>

<template>
  <section class="profile-page page-container">
    
    <el-card v-loading="loading" shadow="never" class="profile-card">
      <div class="identity">
        <el-avatar :size="64">{{ user?.displayName?.charAt(0) || "管" }}</el-avatar>
        <div><strong>{{ user?.displayName || "管理员" }}</strong><span>{{ roleNames[user?.role || ""] || user?.role }} · @{{ user?.username || "-" }}</span></div>
      </div>
      <el-form label-position="top">
        <el-form-item label="用户名"><el-input v-model="form.username" aria-label="用户名" :minlength="3" :maxlength="15" /></el-form-item>
        <el-form-item label="角色"><el-input :model-value="roleNames[user?.role || ''] || user?.role || ''" disabled /></el-form-item>
        <el-form-item label="显示名称" required><el-input v-model="form.displayName" aria-label="显示名称" maxlength="80" show-word-limit /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" aria-label="邮箱" maxlength="100" /></el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.profile-page header{margin-bottom:16px}.profile-page h1{margin:0;font-size:22px}.profile-page header p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.profile-card{max-width:640px}.identity{display:flex;align-items:center;gap:16px;margin-bottom:24px}.identity :deep(.el-avatar){background:var(--el-color-primary);font-size:24px}.identity div{display:flex;flex-direction:column;gap:6px}.identity strong{font-size:18px}.identity span{color:var(--el-text-color-secondary);font-size:13px}
</style>

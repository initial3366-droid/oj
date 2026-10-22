<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { teacherGet, teacherPost, teacherPut, type TeacherClass } from "../../../teacher/teacherApi";
import { formatDisplayDateTime } from "../../../lib/format";

const rows = ref<TeacherClass[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const editing = ref<TeacherClass | null>(null);
const form = reactive({ name: "", description: "", joinEnabled: true, approvalRequired: true });

async function load() {
  loading.value = true;
  try { rows.value = await teacherGet<TeacherClass[]>("/api/teacher/v1/classes"); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "班级加载失败"); }
  finally { loading.value = false; }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: "", description: "", joinEnabled: true, approvalRequired: true });
  dialogOpen.value = true;
}

function openEdit(row: TeacherClass) {
  editing.value = row;
  Object.assign(form, { name: row.name, description: row.description || "", joinEnabled: row.joinEnabled, approvalRequired: row.approvalRequired });
  dialogOpen.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning("请输入班级名称"); return; }
  saving.value = true;
  const payload = { ...form, name: form.name.trim(), description: form.description.trim() };
  try {
    if (editing.value) {
      await teacherPut(`/api/teacher/v1/classes/${editing.value.id}`, payload);
      ElMessage.success("班级已更新");
    } else {
      await teacherPost("/api/teacher/v1/classes", payload);
      ElMessage.success("班级已创建");
    }
    dialogOpen.value = false;
    await load();
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "保存失败"); }
  finally { saving.value = false; }
}

async function remove(row: TeacherClass) {
  try {
    const { value: password } = await ElMessageBox.prompt(`将删除班级「${row.name}」及其关联数据。请输入教师密码确认。`, "删除班级", {
      inputType: "password", inputPlaceholder: "教师密码", confirmButtonText: "确认删除", cancelButtonText: "取消", confirmButtonClass: "el-button--danger",
    });
    await teacherPost(`/api/teacher/v1/classes/${row.id}/delete`, { password });
    ElMessage.success("班级已删除");
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
}

onMounted(load);
</script>

<template>
  <section class="class-page page-container">
    
    <el-card shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><div class="heading-actions"><el-button type="primary" @click="openCreate">创建班级</el-button></div></div></div></template>
      <el-table v-loading="loading" :data="rows" stripe row-key="id">
        <el-table-column prop="id" label="班级 ID" width="110" />
        <el-table-column prop="name" label="班级名称" min-width="180" />
        <el-table-column prop="memberCount" label="人数" width="100" />
        <el-table-column label="加入" width="110"><template #default="{ row }"><el-tag :type="row.joinEnabled ? 'success' : 'info'">{{ row.joinEnabled ? "开启" : "关闭" }}</el-tag></template></el-table-column>
        <el-table-column label="审核" width="120"><template #default="{ row }"><el-tag :type="row.approvalRequired ? 'warning' : 'success'">{{ row.approvalRequired ? "需要审核" : "自动加入" }}</el-tag></template></el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="180"><template #default="{ row }">{{ formatDisplayDateTime(row.createdAt) }}</template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="暂无班级" /></template>
      </el-table>
    </el-card>
    
<el-dialog class="qoj-management-dialog" v-model="dialogOpen" :title="editing ? '编辑班级' : '创建班级'" width="min(560px, 94vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="班级名称" required><el-input v-model="form.name" maxlength="100" show-word-limit /></el-form-item>
        <el-form-item label="介绍"><el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit /></el-form-item>
        <el-form-item label="允许加入"><el-switch v-model="form.joinEnabled" active-text="开启" inactive-text="关闭" /></el-form-item>
        <el-form-item label="加入审核"><el-switch v-model="form.approvalRequired" active-text="需要审核" inactive-text="自动加入" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.class-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-heading>div:last-child{display:flex;gap:8px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}@media(max-width:700px){.page-heading{align-items:flex-start;flex-direction:column}.page-heading>div:last-child{width:100%}}
</style>

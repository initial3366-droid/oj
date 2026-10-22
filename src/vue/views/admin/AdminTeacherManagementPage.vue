<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import Pagination from "../../../../vendor/vue3-element-admin/src/components/Pagination/index.vue";
import { adminDelete, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";

interface Teacher { id:number; username:string; displayName:string; teacherNo?:string|null; email?:string|null; majorId?:number|null; majorName?:string|null; status:"ACTIVE"|"DISABLED"; classCount:number; createdAt:string; }
interface Major { id:number; code:string; name:string; status:"ACTIVE"|"DISABLED"; }
interface TeacherForm { username:string; password:string; displayName:string; teacherNo:string; email:string; majorId:number|null; status:"ACTIVE"|"DISABLED"; }
const rows = ref<Teacher[]>([]);
const majors = ref<Major[]>([]);
const loading = ref(false);
const keyword = ref("");
const inputKeyword = ref("");
const visible = ref(false);
const saving = ref(false);
const editing = ref<Teacher|null>(null);
const formRef = ref<FormInstance>();
const form = reactive<TeacherForm>({ username:"", password:"", displayName:"", teacherNo:"", email:"", majorId:null, status:"ACTIVE" });
const page = ref(1);
const pageSize = ref(20);
const majorFilter = ref<number>();
const filteredRows = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return rows.value.filter(row => (majorFilter.value == null || row.majorId === majorFilter.value) && (!value || [row.username,row.displayName,row.teacherNo,row.email,row.majorName].some(item => item?.toLowerCase().includes(value))));
});
const rules = computed<FormRules>(() => ({ username:[{ required:true,message:"请输入用户名",trigger:"blur" }], password:editing.value?[]:[{ required:true,message:"请输入初始密码",trigger:"blur" }], displayName:[{ required:true,message:"请输入教师姓名",trigger:"blur" }], majorId:[{ required:true,message:"请选择专业",trigger:"change" }] }));
async function load() {
  loading.value=true;
  try { rows.value=await adminGet<Teacher[]>("/api/admin/v1/teachers"); }
  catch(error) { ElMessage.error(error instanceof Error?error.message:"教师列表加载失败"); }
  finally { loading.value=false; }
}
async function loadMajors() { try { majors.value=await adminGet<Major[]>("/api/admin/v1/majors?activeOnly=false"); } catch { majors.value=[]; } }
function open(item?:Teacher) {
  editing.value=item??null;
  Object.assign(form,item?{username:item.username,password:"",displayName:item.displayName,teacherNo:item.teacherNo??"",email:item.email??"",majorId:item.majorId??null,status:item.status}:{username:"",password:"",displayName:"",teacherNo:"",email:"",majorId:null,status:"ACTIVE"});
  visible.value=true;
}
async function save() {
  if(!formRef.value)return;
  try { await formRef.value.validate(); } catch { return; }
  saving.value=true;
  const payload={...form,password:form.password.trim()||undefined,teacherNo:form.teacherNo.trim()||undefined,email:form.email.trim()||undefined};
  try {
    if(editing.value) await adminPut(`/api/admin/v1/teachers/${editing.value.id}`,payload);
    else await adminPost("/api/admin/v1/teachers",payload);
    ElMessage.success(editing.value?"教师已更新":"教师已创建");
    visible.value=false;
    await load();
  } catch(error) { ElMessage.error(error instanceof Error?error.message:"保存失败"); }
  finally { saving.value=false; }
}
async function remove(item:Teacher) {
  try { await adminDelete(`/api/admin/v1/teachers/${item.id}`); ElMessage.success("教师已删除"); await load(); }
  catch(error) { ElMessage.error(error instanceof Error?error.message:"删除失败"); }
}

onMounted(()=>{void load();void loadMajors();});
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch([keyword, majorFilter, pageSize], () => { page.value = 1; });
watch(() => filteredRows.value.length, total => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))); });
</script>

<template>
  <section class="admin-page page-container"><el-card shadow="never"><div class="table-toolbar"><el-input v-model="inputKeyword" clearable placeholder="搜索教师账号、姓名、编号" @keyup.enter="keyword=inputKeyword"/><el-button @click="keyword=inputKeyword">搜索</el-button><el-select v-model="majorFilter" clearable filterable placeholder="筛选专业" aria-label="筛选专业"><el-option v-for="major in majors" :key="major.id" :label="major.name" :value="major.id"/></el-select><el-button class="toolbar-primary" type="primary" @click="open()">新增教师</el-button></div><el-table v-loading="loading" :data="pagedRows" row-key="id" stripe empty-text="暂无教师"><el-table-column prop="username" label="用户名" min-width="150"/><el-table-column prop="displayName" label="姓名" min-width="150"/><el-table-column prop="teacherNo" label="教师编号" min-width="130"><template #default="{row}">{{ row.teacherNo||'-' }}</template></el-table-column><el-table-column label="专业" min-width="150"><template #default="{row}">{{ row.majorName||'未分配' }}</template></el-table-column><el-table-column prop="email" label="邮箱" min-width="200"><template #default="{row}">{{ row.email||'-' }}</template></el-table-column><el-table-column prop="classCount" label="班级数" width="100"/><el-table-column label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{ row.status==='ACTIVE'?'启用':'停用' }}</el-tag></template></el-table-column><el-table-column label="操作" width="150" fixed="right"><template #default="{row}"><el-button link type="primary" @click="open(row)">编辑</el-button><el-popconfirm title="确认删除该教师？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :total="filteredRows.length" :page-sizes="[10,20,50]" /></div></el-card>
    <el-dialog class="qoj-management-dialog" v-model="visible" :title="editing?'编辑教师':'新增教师'" width="560px"><el-form ref="formRef" :model="form" :rules="rules" label-position="top"><el-form-item label="用户名" prop="username"><el-input v-model="form.username" placeholder="教师登录用户名"/></el-form-item><el-form-item label="密码" prop="password"><el-input v-model="form.password" type="password" show-password :placeholder="editing?'不修改请留空':'初始密码'"/></el-form-item><el-form-item label="姓名" prop="displayName"><el-input v-model="form.displayName"/></el-form-item><el-form-item label="教师编号"><el-input v-model="form.teacherNo"/></el-form-item><el-form-item label="专业" prop="majorId"><el-select v-model="form.majorId" placeholder="选择专业"><el-option v-for="major in majors.filter((item)=>item.status==='ACTIVE'||item.id===editing?.majorId)" :key="major.id" :label="`${major.name}（${major.code}）`" :value="major.id"/></el-select></el-form-item><el-form-item v-if="editing" label="状态"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item><el-form-item label="邮箱"><el-input v-model="form.email" type="email"/></el-form-item></el-form><template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.admin-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.table-toolbar{display:flex;gap:10px}.table-toolbar .el-input{max-width:340px}.el-select{width:100%}
</style>

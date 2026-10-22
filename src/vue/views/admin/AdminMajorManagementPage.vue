<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import Pagination from "../../../../vendor/vue3-element-admin/src/components/Pagination/index.vue";
import { adminDelete, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";

interface Major { id:number; code:string; name:string; status:"ACTIVE"|"DISABLED"; teacherCount:number; }
interface MajorForm { code:string; name:string; status:"ACTIVE"|"DISABLED"; }
const rows=ref<Major[]>([]);const loading=ref(false);const keyword=ref("");const visible=ref(false);const editing=ref<Major|null>(null);const saving=ref(false);const formRef=ref<FormInstance>();const form=reactive<MajorForm>({code:"",name:"",status:"ACTIVE"});
const page = ref(1);
const pageSize = ref(20);
const majorFilter = ref<number>();
const filteredRows=computed(()=>{const key=keyword.value.trim().toLowerCase();return rows.value.filter(row => (majorFilter.value == null || row.id === majorFilter.value) && (!key || row.code.toLowerCase().includes(key) || row.name.toLowerCase().includes(key)));});
const rules:FormRules={code:[{required:true,message:"请输入专业编码",trigger:"blur"}],name:[{required:true,message:"请输入专业名称",trigger:"blur"}]};
async function load(){loading.value=true;try{rows.value=await adminGet<Major[]>("/api/admin/v1/majors?activeOnly=false");}catch(error){ElMessage.error(error instanceof Error?error.message:"专业列表加载失败");}finally{loading.value=false;}}
function open(item?:Major){editing.value=item??null;Object.assign(form,item?{code:item.code,name:item.name,status:item.status}:{code:"",name:"",status:"ACTIVE"});visible.value=true;}
async function save(){if(!formRef.value)return;try{await formRef.value.validate();}catch{return;}saving.value=true;try{if(editing.value)await adminPut(`/api/admin/v1/majors/${editing.value.id}`,form);else await adminPost("/api/admin/v1/majors",form);ElMessage.success(editing.value?"专业已更新":"专业已创建");visible.value=false;await load();}catch(error){ElMessage.error(error instanceof Error?error.message:"保存失败");}finally{saving.value=false;}}
async function remove(item:Major){try{await adminDelete(`/api/admin/v1/majors/${item.id}`);ElMessage.success("专业已删除");await load();}catch(error){ElMessage.error(error instanceof Error?error.message:"删除失败");}}
onMounted(()=>{void load();});
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch([keyword, majorFilter, pageSize], () => { page.value = 1; });
watch(() => filteredRows.value.length, total => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))); });
</script>

<template><section class="admin-page page-container"><el-card shadow="never"><div class="table-toolbar"><el-input v-model="keyword" clearable placeholder="搜索专业编码或名称"/><el-select v-model="majorFilter" clearable filterable placeholder="筛选专业" aria-label="筛选专业"><el-option v-for="major in rows" :key="major.id" :label="major.name" :value="major.id"/></el-select><el-button class="toolbar-primary" type="primary" @click="open()">新增专业</el-button></div><el-table v-loading="loading" :data="pagedRows" row-key="id" stripe empty-text="暂无专业"><el-table-column prop="code" label="编码" width="180"/><el-table-column prop="name" label="专业名称" min-width="240"/><el-table-column prop="teacherCount" label="教师数" width="110"/><el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{ row.status==='ACTIVE'?'启用':'停用' }}</el-tag></template></el-table-column><el-table-column label="操作" width="150"><template #default="{row}"><el-button link type="primary" @click="open(row)">编辑</el-button><el-popconfirm title="确认删除该专业？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm></template></el-table-column></el-table><div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :total="filteredRows.length" :page-sizes="[10,20,50]" /></div></el-card><el-dialog class="qoj-management-dialog" v-model="visible" :title="editing?'编辑专业':'新增专业'" width="480px"><el-form ref="formRef" :model="form" :rules="rules" label-position="top"><el-form-item label="专业编码" prop="code"><el-input v-model="form.code" maxlength="64"/></el-form-item><el-form-item label="专业名称" prop="name"><el-input v-model="form.name" maxlength="120"/></el-form-item><el-form-item label="状态" prop="status"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item></el-form><template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template></el-dialog></section></template>

<style scoped>.admin-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.table-toolbar{display:flex;gap:10px}.table-toolbar .el-input{max-width:340px}.el-select{width:100%}</style>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ManagementShell from "./components/ManagementShell.vue";
import { getTeacherToken, teacherGet, teacherLogout, type TeacherMe } from "../../teacher/teacherApi";


const router = useRouter();
const me = ref<TeacherMe | null>(null);
const loading = ref(true);
const error = ref("");

const items = [
  { title: "工作概览", path: "/teacher/dashboard", group: "概览" },
  { title: "班级管理", path: "/teacher/classes", group: "学生与班级" },
  { title: "学生列表", path: "/teacher/students", group: "学生与班级" },
  { title: "导入学生", path: "/teacher/import", group: "学生与班级" },
  { title: "加入申请", path: "/teacher/applications", group: "学生与班级" },
  { title: "提交记录", path: "/teacher/submissions", group: "学生与班级" },
  { title: "练习统计", path: "/teacher/stats", group: "学生与班级" },
  { title: "练习提交", path: "/teacher/practices/submissions", group: "题库与教学" },
  { title: "题目管理", path: "/teacher/problems", group: "题库与教学" },
  { title: "题目文件夹", path: "/teacher/problem-folders", group: "题库与教学" },
  { title: "课程管理", path: "/teacher/courses", group: "题库与教学" },
  { title: "练习素材", path: "/teacher/practices", group: "题库与教学" },
  { title: "比赛管理", path: "/teacher/contests", group: "竞赛" },
  { title: "个人信息", path: "/teacher/profile", group: "账户" },
];
const groups = computed(() => Array.from(new Set(items.map(item => item.group)), title => ({ title, items: items.filter(item => item.group === title) })));


async function loadMe() {
  if (!getTeacherToken()) { await router.replace("/teacher/login"); return; }
  loading.value = true;
  error.value = "";
  try { me.value = await teacherGet<TeacherMe>("/api/teacher/v1/me"); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "教师信息加载失败"; }
  finally { loading.value = false; }
}
async function logout() { await teacherLogout().catch(() => undefined); await router.replace("/teacher/login"); }
onMounted(() => { void loadMe(); });
</script>

<template>
  <div v-if="loading" class="teacher-loading"><el-icon class="is-loading"><span>◌</span></el-icon>正在加载教师工作台…</div>
  <el-result v-else-if="error" icon="error" title="教师工作台加载失败" :sub-title="error"><template #extra><el-button type="primary" @click="loadMe">重试</el-button><el-button @click="logout">重新登录</el-button></template></el-result>
  <ManagementShell v-else title="QOJ 教师端" :username="me?.displayName || me?.username || '教师'" :groups="groups" home="/teacher/dashboard" profile="/teacher/profile" portal="teacher" :logout="logout"><RouterView /></ManagementShell>
</template>
<style scoped>
.teacher-loading{min-height:100vh;display:grid;place-content:center;gap:12px;color:var(--el-text-color-secondary)}
</style>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { fetchCourses, type Course } from "../../../api/course";
import "../../../pages/Courses.css";

const router = useRouter();
const courses = ref<Course[]>([]);
const keyword = ref("");
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const retry = ref(0);

watch(keyword, () => { page.value = 1; });
watch([page, keyword, retry], ([currentPage, currentKeyword], _previous, onCleanup) => {
  let live = true;
  error.value = "";
  loading.value = true;
  const timer = window.setTimeout(() => {
    fetchCourses(currentPage, currentKeyword)
      .then((result) => { if (live) { courses.value = result.list; total.value = result.total; } })
      .catch((cause: unknown) => {
        if (!live) return;
        error.value = cause instanceof Error ? cause.message : "课程加载失败";
        courses.value = [];
      })
      .finally(() => { if (live) loading.value = false; });
  }, 200);
  onCleanup(() => { live = false; window.clearTimeout(timer); });
}, { immediate: true });

function openCourse(course: Course) { void router.push(`/courses/${course.id}`); }
function retryLoad() { retry.value += 1; }
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">我的课程</h1></div></div></header>
    <div class="course-toolbar">
      <p>班级开设的课程会自动加入，进入课程即可查看老师发布的题单。</p>
      <el-input v-model="keyword" aria-label="搜索课程" placeholder="搜索课程" clearable style="max-width:260px" />
    </div>
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />
    <el-button v-if="error" class="course-retry" text type="primary" @click="retryLoad">重试</el-button>
    <div v-if="loading" class="course-empty" role="status">课程加载中…</div>
    <div v-else-if="!error && courses.length === 0" class="course-empty">
      <h2>{{ keyword ? "没有匹配的课程" : "暂无课程" }}</h2>
      <p>{{ keyword ? "请尝试其他课程名称。" : "加入班级后，会自动加入该班级开设的课程；已入班的同学请等待老师开课。" }}</p>
      <el-button v-if="!keyword" type="primary" @click="router.push('/user-center')">查看我的班级</el-button>
    </div>
    <div v-else class="course-grid">
      <article v-for="course in courses" :key="course.id" class="course-card">
        <div class="course-card-top"><el-tag type="primary">{{ course.className || "班级课程" }}</el-tag><el-tag :type="course.status === 'ACTIVE' ? 'success' : 'info'">{{ course.status === "ACTIVE" ? "进行中" : "已归档" }}</el-tag></div>
        <h2>{{ course.title }}</h2>
        <p class="course-description">{{ course.description || "老师尚未填写课程介绍。" }}</p>
        <div class="course-meta"><span>{{ course.teacherName || "任课教师" }}</span><span>{{ course.term || "未设置学期" }}</span></div>
        <div class="course-card-footer"><span>{{ course.practiceCount }} 个题单</span><el-button type="primary" @click="openCourse(course)">进入课程</el-button></div>
      </article>
    </div>
    <Pagination v-if="total > 12" v-model:page="page" :limit="12" :total="total" />
  </section>
</template>

<style scoped>
.page-container { width: 100%; margin: 0 auto; }
.course-toolbar { margin-top: 20px; }
.course-empty { width: 100%; box-sizing: border-box; }
.el-pagination { justify-content: center; margin-top: 24px; }
</style>

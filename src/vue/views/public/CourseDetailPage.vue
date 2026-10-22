<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { formatDisplayDate } from "../../../lib/format";
import { fetchCourse, fetchCoursePractices, type Course, type CoursePractice } from "../../../api/course";
import "../../../pages/Courses.css";

const route = useRoute();
const router = useRouter();
const course = ref<Course | null>(null);
const practices = ref<CoursePractice[]>([]);
const error = ref("");
const loading = ref(true);
const retry = ref(0);
const courseId = computed(() => Number(route.params.courseId));
const completedPractices = computed(() => practices.value.filter((practice) => practice.problemCount > 0 && practice.solvedCount === practice.problemCount).length);

watch([courseId, retry], async ([id], _previous, onCleanup) => {
  let live = true;
  onCleanup(() => { live = false; });
  loading.value = true;
  error.value = "";
  course.value = null;
  practices.value = [];
  if (!Number.isSafeInteger(id) || id <= 0) {
    error.value = "课程编号无效";
    loading.value = false;
    return;
  }
  try {
    const [nextCourse, nextPractices] = await Promise.all([fetchCourse(id), fetchCoursePractices(id)]);
    if (live) { course.value = nextCourse; practices.value = nextPractices; }
  } catch (cause) {
    if (live) error.value = cause instanceof Error ? cause.message : "课程加载失败";
  } finally {
    if (live) loading.value = false;
  }
}, { immediate: true });
</script>

<template>
  <section class="page-container page-container">
    <header class="page-container-header"><div class="page-container-title-row"><div class="page-container-title-content"><h1 style="margin:0;font-size:28px;font-weight:700">{{ course?.title || "课程详情" }}</h1></div></div></header>
    <el-button @click="router.push('/courses')">返回我的课程</el-button>
    <el-alert v-if="error" class="course-alert" type="error" :title="error" show-icon :closable="false" />
    <el-button v-if="error" text type="primary" @click="retry += 1">重试</el-button>
    <div v-if="loading" class="course-empty" role="status">课程加载中…</div>
    <template v-else-if="course">
      <div class="course-detail-intro">
        <div class="course-detail-intro-main">
          <div class="course-meta"><el-tag type="primary">{{ course.className }}</el-tag><span>{{ course.teacherName }}</span><span>{{ course.term }}</span></div>
          <p>{{ course.description || "暂无课程介绍" }}</p>
        </div>
        <div class="course-detail-progress"><p class="course-detail-progress-label">完成进度</p><p class="course-detail-progress-value">已完成 {{ completedPractices }} / {{ practices.length }} 个题单</p></div>
      </div>
      <el-alert v-if="course.status === 'ARCHIVED'" class="course-alert" type="info" title="课程已归档，可查看历史内容，不能再提交。" :closable="false" />
      <el-table :data="practices" row-key="id" stripe empty-text="老师尚未发布题单">
        <el-table-column prop="displayOrder" label="顺序" width="80" />
        <el-table-column label="题单名称" min-width="240"><template #default="{ row }"><strong>{{ row.title }}</strong><p class="course-description">{{ row.description }}</p></template></el-table-column>
        <el-table-column label="截止时间" min-width="140"><template #default="{ row }">{{ row.endTime ? formatDisplayDate(row.endTime) : "未设置" }}</template></el-table-column>
        <el-table-column label="完成进度" min-width="120"><template #default="{ row }">{{ row.solvedCount }} / {{ row.problemCount }} 题</template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.problemCount > 0 && row.solvedCount === row.problemCount ? 'success' : 'primary'">{{ row.problemCount > 0 && row.solvedCount === row.problemCount ? "已完成" : "待完成" }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="130"><template #default="{ row }"><el-button type="primary" @click="router.push(`/practice/${row.id}`)">进入题单</el-button></template></el-table-column>
      </el-table>
    </template>
  </section>
</template>

<style scoped>
.page-container { width: 100%; margin: 0 auto; }
.course-alert { margin-top: 16px; }
.course-empty { margin-top: 16px; }
</style>

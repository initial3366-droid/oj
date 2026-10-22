<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { teacherGet, type PageResult, type TeacherStudent, type TeacherSubmission } from "../../../teacher/teacherApi";
import { formatDisplayDateTime } from "../../../lib/format";

interface PracticeStat {
  userId: number;
  username?: string | null;
  displayName?: string | null;
  studentNo?: string | null;
  practiceSubmitCount: number;
  acceptedCount: number;
  lastSubmitTime?: string | null;
}

const students = ref<TeacherStudent[]>([]);
const submissions = ref<TeacherSubmission[]>([]);
const loading = ref(false);
const keyword = ref("");
const sortProp = ref<keyof PracticeStat>("acceptedCount");
const sortOrder = ref<"ascending" | "descending" | null>("descending");

const rows = computed<PracticeStat[]>(() => {
  const grouped = new Map<number, PracticeStat>();
  for (const student of students.value) grouped.set(student.userId, {
    userId: student.userId, username: student.username, displayName: student.displayName, studentNo: student.studentNo,
    practiceSubmitCount: 0, acceptedCount: 0, lastSubmitTime: null,
  });
  for (const submission of submissions.value) {
    if (!submission.practiceTitle) continue;
    const row = grouped.get(submission.userId) ?? {
      userId: submission.userId, username: submission.username, displayName: submission.displayName, studentNo: null,
      practiceSubmitCount: 0, acceptedCount: 0, lastSubmitTime: null,
    };
    row.practiceSubmitCount++;
    if (submission.status === "AC" || submission.status === "ACCEPTED") row.acceptedCount++;
    if (submission.submitTime && (!row.lastSubmitTime || new Date(submission.submitTime) > new Date(row.lastSubmitTime))) row.lastSubmitTime = submission.submitTime;
    grouped.set(submission.userId, row);
  }
  let result = [...grouped.values()];
  const query = keyword.value.trim().toLowerCase();
  if (query) result = result.filter((row) => [row.displayName, row.username, row.studentNo].some((value) => String(value ?? "").toLowerCase().includes(query)));
  if (sortProp.value && sortOrder.value) {
    const direction = sortOrder.value === "ascending" ? 1 : -1;
    result.sort((a, b) => {
      const left = a[sortProp.value]; const right = b[sortProp.value];
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left ?? "").localeCompare(String(right ?? "")) * direction;
    });
  }
  return result;
});

async function load() {
  loading.value = true;
  try {
    const [studentResult, submissionResult] = await Promise.all([
      teacherGet<TeacherStudent[]>("/api/teacher/v1/students"),
      teacherGet<PageResult<TeacherSubmission>>("/api/teacher/v1/submissions?page=1&pageSize=1000&sortBy=submitTime&sortOrder=desc"),
    ]);
    students.value = studentResult;
    submissions.value = submissionResult.list;
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "统计数据加载失败"); }
  finally { loading.value = false; }
}

function onSortChange(sort: { prop?: string; order?: "ascending" | "descending" | null }) {
  if (sort.prop && ["practiceSubmitCount", "acceptedCount", "lastSubmitTime", "displayName", "studentNo"].includes(sort.prop)) sortProp.value = sort.prop as keyof PracticeStat;
  sortOrder.value = sort.order ?? null;
}

onMounted(load);
</script>

<template>
  <section class="stats-page page-container">
    <header class="page-heading"><div class="toolbar"><el-input v-model="keyword" clearable placeholder="搜索学生、用户名或学号"/></div></header>
    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" stripe row-key="userId" @sort-change="onSortChange">
        <el-table-column label="学生" min-width="160" sortable="custom"><template #default="{ row }">{{ row.displayName || row.username || "-" }}</template></el-table-column>
        <el-table-column prop="studentNo" label="学号" min-width="150" sortable="custom"><template #default="{ row }">{{ row.studentNo || "-" }}</template></el-table-column>
        <el-table-column prop="practiceSubmitCount" label="题单提交" width="130" sortable="custom" />
        <el-table-column prop="acceptedCount" label="AC 数" width="110" sortable="custom" />
        <el-table-column prop="lastSubmitTime" label="最近提交" min-width="180" sortable="custom"><template #default="{ row }">{{ formatDisplayDateTime(row.lastSubmitTime) }}</template></el-table-column>
        <template #empty><el-empty description="暂无练习提交数据" /></template>
      </el-table>
    </el-card>
  </section>
</template>

<style scoped>
.stats-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.toolbar{display:flex;gap:8px}.toolbar .el-input{width:min(300px,35vw)}@media(max-width:750px){.page-heading{align-items:flex-start;flex-direction:column}.toolbar,.toolbar .el-input{width:100%}}
</style>

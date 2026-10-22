<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminGet } from "../../../admin/api/adminClient";

interface GlobalRank {
  userId: number;
  name: string;
  className?: string | null;
  acCount: number;
  streak: number;
}

interface ClassRank {
  classId: number;
  className: string;
  memberCount: number;
  acCount: number;
}

const globalRows = ref<GlobalRank[]>([]);
const classRows = ref<ClassRank[]>([]);
const loading = ref(false);
const userPage = ref(1);
const userPageSize = ref(10);
const classPage = ref(1);
const classPageSize = ref(10);
const userSort = ref<string | null>(null);
const classSort = ref<string | null>(null);
function pageRanks<T extends { acCount: number }>(rows: T[], page: number, size: number, order: string | null) {
  const ranked = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  if (order) ranked.sort((a, b) => (order === "ascending" ? a.acCount - b.acCount : b.acCount - a.acCount) || a.rank - b.rank);
  return ranked.slice((page - 1) * size, page * size);
}
function sortUsers({ order }: { order: string | null }) { userSort.value = order; userPage.value = 1; }
function sortClasses({ order }: { order: string | null }) { classSort.value = order; classPage.value = 1; }
const userPageRows = computed(() => pageRanks(globalRows.value, userPage.value, userPageSize.value, userSort.value));
const classPageRows = computed(() => pageRanks(classRows.value, classPage.value, classPageSize.value, classSort.value));
const topUser = computed(() => globalRows.value[0]);
const topClass = computed(() => classRows.value[0]);
const totalClassAc = computed(() => classRows.value.reduce((sum, item) => sum + (item.acCount || 0), 0));

async function load() {
  loading.value = true;
  try {
    const [users, classes] = await Promise.all([
      adminGet<GlobalRank[]>("/api/v1/leaderboard/global?limit=5000"),
      adminGet<ClassRank[]>("/api/v1/leaderboard/classes?limit=5000"),
    ]);
    globalRows.value = users || [];
    classRows.value = classes || [];
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "榜单数据加载失败");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="leaderboard-page page-container">
    
    <div class="metric-grid">
      <el-card shadow="never"><span>上榜用户</span><strong>{{ globalRows.length }}</strong></el-card>
      <el-card shadow="never"><span>最高 AC 用户</span><strong>{{ topUser?.acCount ?? 0 }} 题</strong><small>{{ topUser?.name || "暂无数据" }}</small></el-card>
      <el-card shadow="never"><span>上榜班级</span><strong>{{ classRows.length }}</strong></el-card>
      <el-card shadow="never"><span>班级 AC 总量</span><strong>{{ totalClassAc }} 题</strong><small>{{ topClass ? `第一：${topClass.className}` : "暂无数据" }}</small></el-card>
    </div>
    <el-card shadow="never">
      <template #header>学生 AC 排行榜</template>
      <el-table v-loading="loading" :data="userPageRows" stripe row-key="userId" @sort-change="sortUsers">
        <el-table-column label="排名" width="90"><template #default="{ row }"><el-tag :type="row.rank <= 3 ? 'warning' : 'info'">#{{ row.rank }}</el-tag></template></el-table-column>
        <el-table-column prop="name" label="用户" min-width="160" />
        <el-table-column prop="className" label="班级" min-width="160"><template #default="{ row }">{{ row.className || "-" }}</template></el-table-column>
        <el-table-column prop="acCount" label="非比赛 AC" width="140" sortable="custom" />
        <el-table-column prop="streak" label="连续训练" width="130"><template #default="{ row }">{{ row.streak || 0 }} 天</template></el-table-column>
      </el-table>
      <div class="leaderboard-pagination"><Pagination v-model:page="userPage" v-model:limit="userPageSize" :page-sizes="[10,20,50,100]" :total="globalRows.length" /></div>
    </el-card>
    <el-card shadow="never">
      <template #header>班级 AC 排行榜</template>
      <el-table v-loading="loading" :data="classPageRows" stripe row-key="classId" @sort-change="sortClasses">
        <el-table-column label="排名" width="90"><template #default="{ row }"><el-tag :type="row.rank <= 3 ? 'warning' : 'info'">#{{ row.rank }}</el-tag></template></el-table-column>
        <el-table-column prop="className" label="班级" min-width="200" />
        <el-table-column prop="memberCount" label="学生数" width="120" />
        <el-table-column prop="acCount" label="班级 AC 数量" width="160" sortable="custom" />
      </el-table>
      <div class="leaderboard-pagination"><Pagination v-model:page="classPage" v-model:limit="classPageSize" :page-sizes="[10,20,50,100]" :total="classRows.length" /></div>
    </el-card>
  </section>
</template>

<style scoped>
.leaderboard-pagination { margin-top: 20px; }
.leaderboard-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric-grid .el-card :deep(.el-card__body){display:flex;flex-direction:column;gap:8px}.metric-grid span,.metric-grid small{color:var(--el-text-color-secondary);font-size:12px}.metric-grid strong{font-size:24px;color:#1d2129}.metric-grid small{min-height:16px}@media(max-width:800px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.page-heading{align-items:flex-start}}
</style>

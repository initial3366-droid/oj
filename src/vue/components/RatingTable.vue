<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useOjDataStore } from "../stores/ojData";

const router = useRouter();
const ojData = useOjDataStore();
const ratings = computed(() => [...ojData.state.ratings].sort((a, b) => b.acCount - a.acCount).slice(0, 10));
function rankType(index: number) { return index < 3 ? "warning" : "info"; }
</script>

<template>
  <el-table :data="ratings" row-key="id" stripe empty-text="暂无真实排行榜数据">
    <el-table-column label="排名" width="100" align="center"><template #default="{ $index }"><el-tag :type="rankType($index)" effect="light">{{ $index + 1 }}</el-tag></template></el-table-column>
    <el-table-column label="用户" min-width="200" align="center"><template #default="{ row }"><el-button text type="primary" @click="router.push(`/users/${row.userId}`)"><el-avatar :size="30" :src="row.avatarUrl || undefined" class="mr-2">{{ (row.name || `#${row.userId}`).charAt(0) }}</el-avatar>{{ row.name }}</el-button></template></el-table-column>
    <el-table-column label="班级" min-width="140" align="center"><template #default="{ row }">{{ row.className || "-" }}</template></el-table-column>
    <el-table-column label="AC 数" width="120" align="center"><template #default="{ row }"><strong class="text-primary">{{ row.acCount }}</strong></template></el-table-column>
  </el-table>
</template>


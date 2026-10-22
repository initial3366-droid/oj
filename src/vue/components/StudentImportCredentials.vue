<script setup lang="ts">
import { computed } from "vue";
import { Download } from "@element-plus/icons-vue";
const props = defineProps<{ successes?: Array<{ studentNo?: string | null; displayName?: string | null; initialPassword?: string | null }> }>();
const credentials = computed(() => (props.successes ?? []).filter(row => row.initialPassword));
function download() {
  const escape = (value: string | null | undefined) => `"${(value ?? "").replace(/^[\s=+@-]/, "'$&").replace(/"/g, '""')}"`;
  const rows = [["学号", "姓名", "初始密码"], ...credentials.value.map(row => [row.studentNo, row.displayName, row.initialPassword])];
  const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "student-initial-passwords.csv"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
<template>
  <section v-if="credentials.length" class="import-credentials">
    <el-alert type="warning" :closable="false" title="新账号初始密码仅在本次导入结果中提供，请妥善分发。" />
    <el-button :icon="Download" @click="download">下载初始密码</el-button>
    <el-table :data="credentials"><el-table-column prop="studentNo" label="学号" min-width="130"/><el-table-column prop="displayName" label="姓名" min-width="120"/><el-table-column label="初始密码" min-width="260"><template #default="{row}"><el-input :model-value="row.initialPassword" readonly type="password" show-password aria-label="初始密码"/></template></el-table-column></el-table>
  </section>
</template>
<style scoped>.import-credentials{display:grid;gap:12px;margin-top:16px;min-width:0}.import-credentials>.el-button{justify-self:start}</style>

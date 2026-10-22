<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { adminPost } from "../../admin/api/adminClient";
import { adminPath } from "../../utils/adminPath";
type Result = { addedCount: number; skippedCount: number; failedCount: number; rows: Array<{ rowNumber: number; studentNo: string; status: string; message: string }> };
const props = defineProps<{ modelValue: boolean; contestId: number; contestTitle: string }>();
const emit = defineEmits<{ (event: "update:modelValue", value: boolean): void; (event: "imported"): void }>();
const mode = ref<"paste" | "file">("paste"); const text = ref(""); const file = ref<File | null>(null); const busy = ref(false); const error = ref(""); const result = ref<Result | null>(null);
const numbers = computed(() => text.value.replace(/\uFEFF/g, "").split(/[\s,，;；]+/).filter(Boolean));
watch(() => props.modelValue, (open) => { if (!open) { error.value = ""; result.value = null; } });
async function importRoster() {
  if (busy.value) return;
  error.value = "";
  if (mode.value === "paste" && (!numbers.value.length || numbers.value.length > 5000 || numbers.value.some((value) => value.length > 80))) { error.value = "请输入 1 至 5000 条学号，每条最多 80 个字符"; return; }
  if (mode.value === "file" && (!file.value || !/\.(csv|xls|xlsx)$/i.test(file.value.name) || file.value.size > 5 * 1024 * 1024)) { error.value = "请选择不超过 5MB 的 CSV、XLS 或 XLSX 文件"; return; }
  busy.value = true; result.value = null;
  try {
    let body: FormData | { studentNos: string[] };
    if (mode.value === "file") { body = new FormData(); body.append("file", file.value!); } else body = { studentNos: numbers.value };
    result.value = await adminPost<Result>(adminPath(`/api/admin/v1/contests/${props.contestId}/registrations/${mode.value === "file" ? "import-file" : "import"}`), body, true, 120000);
    ElMessage.success("名单处理完成"); emit("imported");
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "导入失败，请重试"; }
  finally { busy.value = false; }
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="批量导入名单" width="min(720px,95vw)" :close-on-click-modal="!busy" :close-on-press-escape="!busy" @update:model-value="emit('update:modelValue',$event)">
    <div class="import-dialog"><div>目标比赛：{{ contestTitle }}</div><el-alert type="info" :closable="false" title="仅按学号精确匹配已有学生账号，重复学号和已报名人员自动跳过。每次最多 5000 条。"/><el-radio-group v-model="mode" :disabled="busy" @change="error='';result=null"><el-radio value="paste">粘贴学号</el-radio><el-radio value="file">上传文件</el-radio></el-radio-group><template v-if="mode==='paste'"><el-input v-model="text" type="textarea" :rows="6" :disabled="busy" aria-label="导入学号" placeholder="支持换行、空格、逗号或分号分隔" @input="result=null"/><small>已输入 {{ numbers.length }} 条学号</small></template><template v-else><p class="muted">支持 CSV（UTF-8）、XLS、XLSX，不超过 5MB。首行须包含“学号”列。请将学号列设为文本以保留前导零。</p><input type="file" accept=".csv,.xls,.xlsx" aria-label="名单文件" :disabled="busy" @change="file=($event.target as HTMLInputElement).files?.[0]??null;result=null"/></template><el-alert v-if="error" type="error" :closable="false" :title="error"/><template v-if="result"><el-alert :type="result.failedCount?'warning':'success'" :closable="false" :title="`导入完成：新增 ${result.addedCount} 人，跳过 ${result.skippedCount} 条，失败 ${result.failedCount} 条`"/><el-table :data="result.rows" row-key="rowNumber" size="small"><el-table-column prop="rowNumber" label="序号" width="70"/><el-table-column prop="studentNo" label="学号" width="160"/><el-table-column prop="message" label="处理结果"/></el-table></template></div>
    <template #footer><el-button :disabled="busy" @click="emit('update:modelValue',false)">关闭</el-button><el-button type="primary" :loading="busy" @click="importRoster">开始导入</el-button></template>
  </el-dialog>
</template>

<style scoped>.import-dialog{display:flex;flex-direction:column;gap:14px}.muted{margin:0;color:var(--el-text-color-secondary);font-size:13px}.import-dialog small{color:var(--el-text-color-secondary)}</style>

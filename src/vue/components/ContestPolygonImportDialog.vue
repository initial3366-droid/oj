<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { adminPost } from "../../admin/api/adminClient";
import { adminPath } from "../../utils/adminPath";

type Preview = { title: string; warnings: string[]; problems: Array<{ label: string; title: string; timeLimit: number; memoryLimit: number; testCount: number; sampleCount: number; checker: boolean }> };
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (event: "update:modelValue", value: boolean): void; (event: "imported", id: number): void }>();
const file = ref<File | null>(null);
const preview = ref<Preview | null>(null);
const busy = ref<"preview" | "import" | null>(null);
const error = ref("");
const form = reactive({ title: "", startTime: "", durationMinutes: 180, type: "ACM" as "ACM" | "OI" });
watch(() => props.modelValue, (open) => { if (!open) { file.value = null; preview.value = null; error.value = ""; } });
async function previewFile() {
  if (!file.value || busy.value) return;
  busy.value = "preview"; error.value = ""; preview.value = null;
  try {
    const data = new FormData(); data.append("file", file.value);
    preview.value = await adminPost<Preview>(adminPath("/api/admin/v1/contests/polygon/preview"), data, true, 120000);
    form.title = preview.value.title;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Polygon 预览失败"; }
  finally { busy.value = null; }
}
async function importFile() {
  if (!file.value || !preview.value || busy.value) return;
  if (!form.title.trim() || !form.startTime || !form.durationMinutes || form.durationMinutes < 1 || form.durationMinutes > 10080) { error.value = "请填写比赛名称、开始时间和 1 至 10080 分钟的比赛时长"; return; }
  busy.value = "import"; error.value = "";
  try {
    const data = new FormData(); data.append("file", file.value);
    data.append("settings", new Blob([JSON.stringify({ ...form, title: form.title.trim(), startTime: form.startTime.replace(" ", "T") })], { type: "application/json" }));
    const result = await adminPost<{ contestId: number }>(adminPath("/api/admin/v1/contests/polygon/import"), data, true, 120000);
    ElMessage.success("Polygon 比赛导入成功"); emit("imported", result.contestId); emit("update:modelValue", false);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Polygon 导入失败"; }
  finally { busy.value = null; }
}
function selectFile(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0] ?? null;
  preview.value = null; error.value = ""; file.value = null;
  if (selected && (!/\.zip$/i.test(selected.name) || selected.size > 50 * 1024 * 1024 || selected.size === 0)) { error.value = "请选择大小为 1 字节至 50MiB 的 ZIP 文件"; return; }
  file.value = selected;
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="导入 Polygon 比赛" width="min(860px,95vw)" :close-on-click-modal="!busy" :close-on-press-escape="!busy" @update:model-value="emit('update:modelValue',$event)">
    <div class="dialog-content"><el-alert type="info" :closable="false" title="选择 Polygon 完整比赛 ZIP 或单题 ZIP（含已生成测试及答案）。先预览，再创建新比赛；题目设为私有且未发布。ZIP 最多 50MiB，解压后最多 64MiB。"/><input type="file" aria-label="Polygon ZIP 文件" accept=".zip" :disabled="!!busy" @change="selectFile"/><el-alert v-if="error" type="error" :closable="false" :title="error"/>
      <template v-if="preview"><p>已识别 {{ preview.problems.length }} 道题目；测试、样例和 checker 将一并导入。</p><el-table :data="preview.problems" row-key="label" size="small"><el-table-column prop="label" label="题号" width="70"/><el-table-column prop="title" label="题目"/><el-table-column prop="timeLimit" label="时间" width="90"><template #default="{row}">{{ row.timeLimit }}ms</template></el-table-column><el-table-column prop="memoryLimit" label="内存" width="90"><template #default="{row}">{{ row.memoryLimit }}MiB</template></el-table-column><el-table-column prop="testCount" label="测试" width="70"/><el-table-column prop="sampleCount" label="样例" width="70"/><el-table-column prop="checker" label="Checker" width="90"><template #default="{row}">{{ row.checker ? 'C++' : '默认' }}</template></el-table-column></el-table><el-alert v-for="(warning,index) in preview.warnings" :key="index" type="warning" :closable="false" :title="warning"/><el-form label-position="top" class="settings"><el-form-item label="比赛名称" required><el-input v-model="form.title" maxlength="200"/></el-form-item><el-form-item label="开始时间" required><el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%"/></el-form-item><el-form-item label="比赛时长（分钟）" required><el-input-number v-model="form.durationMinutes" :min="1" :max="10080"/></el-form-item><el-form-item label="赛制"><el-select v-model="form.type"><el-option label="ACM" value="ACM"/><el-option label="OI" value="OI"/></el-select></el-form-item></el-form><p class="muted">仅导入题目包。报名范围默认所有人，请在创建后的编辑页检查赛程、报名范围及计分设置。</p></template>
    </div>
    <template #footer><el-button :disabled="!!busy" @click="emit('update:modelValue',false)">取消</el-button><el-button :disabled="!file||!!busy" :loading="busy==='preview'" @click="previewFile">预览包内容</el-button><el-button type="primary" :disabled="!preview||!!busy" :loading="busy==='import'" @click="importFile">导入为新比赛</el-button></template>
  </el-dialog>
</template>

<style scoped>.dialog-content{display:flex;flex-direction:column;gap:12px}.settings{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.muted{color:var(--el-text-color-secondary);font-size:12px}@media(max-width:640px){.settings{grid-template-columns:1fr}}</style>

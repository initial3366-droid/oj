<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Loading } from "@element-plus/icons-vue";
import { adminGet, adminPost } from "../../admin/api/adminClient";
import { adminPath } from "../../utils/adminPath";
import HtmlMathEditor from "./HtmlMathEditor.vue";
import { type ChatFileData, type ChatImportApproved, type ChatImportBasic, type ChatImportCaseMapping, type ChatImportReference, type ChatImportResult, type ChatImportSource } from "../../api/adminChat";

type Reference = ChatImportReference;
type CaseMapping = ChatImportCaseMapping;
type Basic = ChatImportBasic;
type CaseOption = { reference: Reference; size: number; kind: string };
type Candidate = { key: string; basic: Basic; testCases: CaseMapping[]; caseOptions: CaseOption[]; sources: Reference[]; warnings: string[] };
type Imported = { id: number; title: string; testCaseCount: number; status: string };
type Plan = { id: string; files: ChatFileData[]; candidates: Candidate[]; warnings: string[]; imported: Imported[] };
type ImportResult = ChatImportResult;
type ApprovedImport = ChatImportApproved;
const IMPORT_API = "/api/admin/v1/agent/chat/imports";
const props = defineProps<{ source: ChatImportSource; approve?: (approval: ApprovedImport) => Promise<ImportResult> }>();
const emit = defineEmits<{ close: [] }>();
const plan = ref<Plan | null>(null);
const candidates = ref<Candidate[]>([]);
const selected = ref<string[]>([]);
const samples = ref<Record<string, string>>({});
const error = ref("");
const attempt = ref(0);
const saving = ref(false);
const result = ref<Imported[]>([]);
const folders = ref<Array<{ id: number; name: string; canEdit: boolean }>>([]);
const folderId = ref<number | undefined>();
const folderError = ref("");
const loading = ref(false);
const isImported = computed(() => result.value.length > 0);
const importReady = computed(() => selected.value.length > 0 && candidates.value.filter((item) => selected.value.includes(item.key)).every((item) => item.basic.title.trim() && item.basic.statement.trim() && item.testCases.length <= 200 && item.testCases.every((test) => Boolean(test.output || item.basic.checkerSource?.trim()))));

function refKey(value: Reference) { return JSON.stringify(value); }
function refLabel(value: Reference) { return value.excerpt != null ? `${value.path} · 原文片段：${value.excerpt === "" ? "（空数据）" : value.excerpt.slice(0, 80)}` : value.path; }

async function loadPlan() {
  plan.value = null; error.value = ""; loading.value = true;
  try {
    const data = props.source.planId
      ? await adminGet<Plan>(`${IMPORT_API}/${encodeURIComponent(props.source.planId)}`)
      : await adminPost<Plan>(`${IMPORT_API}/preview`, { fileIds: props.source.files.map((file) => file.id), useAi: true, instructions: props.source.instructions }, true, 150000);
    plan.value = data; candidates.value = data.candidates ?? []; selected.value = data.candidates.map((item) => item.key); result.value = data.imported ?? [];
    samples.value = Object.fromEntries(data.candidates.map((item) => [item.key, JSON.stringify(item.basic.samples || [], null, 2)]));
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "AI 文件解析失败"; }
  finally { loading.value = false; }
}

async function loadFolders() {
  try { folders.value = (await adminGet<Array<{ id: number; name: string; canEdit: boolean }>>("/api/admin/v1/problem-folders")).filter((folder) => folder.canEdit); }
  catch (cause) { folderError.value = cause instanceof Error ? cause.message : "文件夹加载失败"; }
}

function updateBasic(key: string, field: keyof Basic, value: unknown) {
  candidates.value = candidates.value.map((item) => item.key === key ? { ...item, basic: { ...item.basic, [field]: value } } : item);
}
function updateCase(candidateKey: string, caseIndex: number, value?: string) {
  candidates.value = candidates.value.map((item) => item.key === candidateKey ? { ...item, testCases: item.testCases.map((mapping, index) => index === caseIndex ? { ...mapping, output: value ? JSON.parse(value) as Reference : null } : mapping) } : item);
}

async function commit() {
  if (!plan.value || saving.value || result.value.length || !importReady.value) return;
  error.value = "";
  let selections: ApprovedImport["request"]["selections"];
  try {
    selections = candidates.value.filter((item) => selected.value.includes(item.key)).map((item) => {
      const parsed: unknown = JSON.parse(samples.value[item.key] || "[]");
      if (!Array.isArray(parsed)) throw new Error(`“${item.basic.title}”的样例应为 JSON 数组`);
      return { key: item.key, basic: { ...item.basic, samples: parsed as Basic["samples"] }, testCases: item.testCases };
    });
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "样例 JSON 格式错误"; return; }
  saving.value = true;
  try {
    const approval = { planId: plan.value.id, request: { selections, folderId: folderId.value ?? null } };
    const saved = props.source.planId && props.approve
      ? await props.approve(approval)
      : await adminPost<ImportResult>(`${IMPORT_API}/${encodeURIComponent(plan.value.id)}/commit`, approval.request, true, 120000);
    result.value = saved.problems;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "题目导入失败，修改内容仍保留"; }
  finally { saving.value = false; }
}

watch(attempt, loadPlan);
onMounted(() => { void loadPlan(); void loadFolders(); });
</script>

<template>
  <el-dialog :model-value="true" :title="isImported ? '题目导入结果' : '题目导入方案'" width="min(1060px,96vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" @close="!saving && emit('close')">
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false"><template #default><el-button v-if="!plan" link type="primary" @click="attempt++">重试 AI 解析</el-button></template></el-alert>
    <div v-if="loading" class="loading"><el-icon class="is-loading"><Loading /></el-icon>AI 正在理解文件、识别题目分组和测试数据配对…</div>
    <div v-else-if="isImported" class="import-result"><p>已导入 {{ result.length }} 道题，均为未发布状态。</p><div v-for="item in result" :key="item.id">{{ item.title }} · {{ item.testCaseCount ? `${item.testCaseCount} 个测试点` : "题面已保存，测试数据待补充" }}</div><details v-if="plan?.candidates.some((item) => item.testCases.some((test) => test.input.excerpt != null || test.output?.excerpt != null))"><summary>查看原文测试数据</summary><section v-for="candidate in plan?.candidates" :key="candidate.key"><p>{{ candidate.basic.title }}</p><div v-for="(test,index) in candidate.testCases" :key="index"><p>测试点 {{ index + 1 }} · {{ test.input.path }}</p><pre>{{ test.input.excerpt?.slice(0,2000) ?? test.input.path }}</pre><pre>{{ test.output?.excerpt?.slice(0,2000) ?? test.output?.path ?? "暂无答案" }}</pre></div></section></details><a :href="adminPath('/problems')" target="_blank" rel="noopener noreferrer">打开本地题库</a></div>
    <div v-else-if="plan" class="import-review">
      <p>核对题面、样例、限制与答案配对后导入。测试数据会读取原文件。</p>
      <el-alert v-for="(warning,index) in plan.warnings" :key="index" type="warning" :title="warning" :closable="false" />
      <el-form-item label="题库文件夹"><el-select v-model="folderId" clearable placeholder="不归属文件夹"><el-option v-for="folder in folders" :key="folder.id" :label="folder.name" :value="folder.id" /></el-select></el-form-item>
      <el-alert v-if="folderError" type="warning" :title="`文件夹列表加载失败：${folderError}，仍可不指定文件夹导入。`" :closable="false" />
      <article v-for="(candidate,index) in candidates" :key="candidate.key" class="candidate">
        <el-checkbox :model-value="selected.includes(candidate.key)" @change="(checked:boolean|number|string)=>selected=checked?[...selected,candidate.key]:selected.filter(key=>key!==candidate.key)">导入第 {{ index + 1 }} 题</el-checkbox>
        <el-form-item label="题目名称"><el-input :model-value="candidate.basic.title" maxlength="200" @update:model-value="updateBasic(candidate.key,'title',$event)" /></el-form-item>
        <div class="limit-grid"><el-form-item label="时间限制（ms）"><el-input-number :model-value="candidate.basic.timeLimit" :min="100" :max="60000" @update:model-value="updateBasic(candidate.key,'timeLimit',$event)" /></el-form-item><el-form-item label="内存限制（MB）"><el-input-number :model-value="candidate.basic.memoryLimit" :min="16" :max="1024" @update:model-value="updateBasic(candidate.key,'memoryLimit',$event)" /></el-form-item><el-form-item label="难度"><el-input-number :model-value="candidate.basic.difficulty" :min="1" :max="5" @update:model-value="updateBasic(candidate.key,'difficulty',$event)" /></el-form-item></div>
        <el-form-item label="题面（HTML / LaTeX）"><HtmlMathEditor :model-value="candidate.basic.statement" :rows="5" @update:model-value="updateBasic(candidate.key,'statement',$event)" /></el-form-item>
        <details><summary>输入输出格式、样例和特殊判题</summary><el-form-item label="输入格式"><el-input :model-value="candidate.basic.inputFormat" type="textarea" :rows="3" @update:model-value="updateBasic(candidate.key,'inputFormat',$event)" /></el-form-item><el-form-item label="输出格式"><el-input :model-value="candidate.basic.outputFormat" type="textarea" :rows="3" @update:model-value="updateBasic(candidate.key,'outputFormat',$event)" /></el-form-item><el-form-item label="样例（JSON 数组）"><el-input v-model="samples[candidate.key]" type="textarea" :rows="5" spellcheck="false" /></el-form-item><el-form-item label="特殊判题源码"><el-input :model-value="candidate.basic.checkerSource || ''" type="textarea" :rows="4" @update:model-value="updateBasic(candidate.key,'checkerSource',$event)" /></el-form-item></details>
        <el-alert v-for="(warning,key) in candidate.warnings" :key="key" type="warning" :title="warning" :closable="false" />
        <p v-if="!candidate.testCases.length" class="muted">暂无测试数据，将保存为未发布题面，补充测试点后才能用于判题。</p>
        <details class="case-mappings" :open="candidate.testCases.some((test)=>!test.output)"><summary>{{ candidate.testCases.length }} 个测试点 · 查看或修改答案配对</summary><div v-for="(test,caseIndex) in candidate.testCases" :key="caseIndex" class="case-row"><span :title="test.input.excerpt || undefined">{{ caseIndex + 1 }}. {{ refLabel(test.input) }}</span><span>→</span><el-select :model-value="test.output ? refKey(test.output) : ''" clearable filterable placeholder="缺少答案，请选择原文件" @update:model-value="updateCase(candidate.key,caseIndex,$event)"><el-option v-for="option in candidate.caseOptions.filter((item)=>item.kind!=='input')" :key="refKey(option.reference)" :label="refLabel(option.reference)" :value="refKey(option.reference)" /></el-select></div></details>
        <details><summary>来源文件（{{ candidate.sources.length }}）</summary><ul><li v-for="source in candidate.sources" :key="refKey(source)">{{ source.path }}</li></ul></details>
      </article>
      <el-alert v-if="!importReady" type="error" :closable="false" title="所选题目需要完整题面；已有测试输入必须提供对应答案或特殊判题源码。" />
    </div>
    <template #footer><template v-if="isImported"><el-button type="primary" @click="emit('close')">完成</el-button></template><template v-else><el-button :disabled="saving" @click="emit('close')">取消</el-button><el-button type="primary" :loading="saving" :disabled="!plan || !importReady" @click="commit">确认导入 {{ selected.length }} 道题（未发布）</el-button></template></template>
  </el-dialog>
</template>

<style scoped>
.loading{min-height:180px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--el-text-color-secondary)}.import-result{display:flex;flex-direction:column;gap:9px}.import-result>div{padding:9px 11px;border-radius:6px;background:#f0fdf4;color:#027a48}.import-result details{margin-top:8px}.import-result pre{max-height:200px;overflow:auto;padding:10px;background:var(--el-fill-color-light);white-space:pre-wrap;overflow-wrap:anywhere}.import-review{display:flex;flex-direction:column;gap:12px;max-height:68vh;overflow:auto}.candidate{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid var(--card-border);border-radius:9px;background:var(--content-bg)}.limit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.limit-grid :deep(.el-input-number){width:100%}.candidate details{padding:8px;border-radius:6px;background:var(--el-fill-color-light)}.candidate summary,.import-result summary{cursor:pointer;color:var(--el-text-color-regular);font-weight:600}.candidate details>.el-form-item{margin-top:12px}.case-mappings{display:flex;flex-direction:column;gap:8px}.case-row{display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(180px,40%);align-items:center;gap:8px;margin-top:8px}.case-row>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.muted{color:var(--el-text-color-secondary);font-size:13px}@media(max-width:650px){.limit-grid{grid-template-columns:1fr}.case-row{grid-template-columns:minmax(0,1fr) 18px}.case-row :deep(.el-select){grid-column:1/-1}}
</style>

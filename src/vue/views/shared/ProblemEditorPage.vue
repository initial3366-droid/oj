<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminGet, adminPost, adminPut, adminUpload, type TestCaseImportProgress } from "../../../admin/api/adminClient";
import { teacherGet, teacherPost, teacherPut } from "../../../teacher/teacherApi";
import CodeEditor from "../../components/CodeEditor.vue";
import HtmlMathEditor from "../../components/HtmlMathEditor.vue";
import { adminPath } from "../../../utils/adminPath";
import { decryptIdFromUrl } from "../../../utils/cipher";

type Sample = { input: string; output: string; explanation: string };
type TestCase = { id?: number; caseNo: number; input: string; output: string; publicInput?: string };
type BasicForm = {
  title: string; timeLimit: number; memoryLimit: number; statement: string; inputFormat: string; outputFormat: string;
  checkerSource: string; difficulty: number; folderId?: number; isPublic: boolean; accessScope: "ALL" | "MAJOR" | "PRIVATE";
  majorId?: number; studentPublishStatus: "DRAFT" | "PUBLISHED"; communication: { enabled: boolean; version?: number; maxMessageBytes: number; allowEmptyMessage: boolean; channelSource: string; checkerSource: string };
  samples: Sample[];
};
const route = useRoute();
const router = useRouter();
const teacherMode = computed(() => route.path.startsWith("/teacher/"));
const problemId = computed(() => {
  const encoded = String(route.params.problemId ?? "");
  if (!encoded) return null;
  const decoded = encoded.length === 8 ? decryptIdFromUrl(encoded) : Number(encoded);
  return Number.isSafeInteger(decoded) && decoded > 0 ? decoded : null;
});
const testCaseMode = computed(() => route.path.endsWith("/test-cases"));
const title = computed(() => problemId.value ? testCaseMode.value ? "题目测试数据" : "编辑题目" : "创建题目");
const step = ref(0);
const loading = ref(false);
const saving = ref(false);
const ready = ref(false);
const draftId = ref("");
const tagInput = ref("");
const tags = ref<string[]>([]);
const folders = ref<Array<{ id: number; name: string }>>([]);
const majors = ref<Array<{ id: number; name: string; code: string }>>([]);
const cases = ref<TestCase[]>([]);
const file = ref<File | null>(null);
const importBusy = ref(false);
const importMessage = ref("");
const uploadProgress = ref<number | null>(null);
const currentImport = ref<TestCaseImportProgress | null>(null);
const form = reactive<BasicForm>({ title: "", timeLimit: 1000, memoryLimit: 256, statement: "", inputFormat: "", outputFormat: "", checkerSource: "", difficulty: 1, isPublic: true, accessScope: "ALL", studentPublishStatus: "PUBLISHED", communication: { enabled: false, maxMessageBytes: 1024, allowEmptyMessage: false, channelSource: "", checkerSource: "" }, samples: [] });
const basePath = computed(() => teacherMode.value ? "/teacher/problems" : adminPath("/problems"));
const casesEndpoint = computed(() => problemId.value ? `/api/admin/v1/problems/${problemId.value}/test-cases` : `/api/admin/v1/problem-drafts/${draftId.value}/test-cases`);
const issueEndpoint = computed(() => problemId.value ? `/api/admin/v1/problems/${problemId.value}` : `/api/admin/v1/problem-drafts/${draftId.value}/basic`);

function get<T>(url: string) { return teacherMode.value ? teacherGet<T>(url) : adminGet<T>(url); }
function post<T>(url: string, body?: unknown) { return teacherMode.value ? teacherPost<T>(url, body) : adminPost<T>(url, body); }
function put<T>(url: string, body?: unknown) { return teacherMode.value ? teacherPut<T>(url, body) : adminPut<T>(url, body); }
function normalizeCase(value: Partial<TestCase> & { inputData?: string; outputData?: string }, index: number): TestCase {
  return { id: value.id, caseNo: Number(value.caseNo) > 0 ? Number(value.caseNo) : index + 1, input: value.input ?? value.inputData ?? "", output: value.output ?? value.outputData ?? "", publicInput: value.publicInput ?? "" };
}
function makePayload(): Record<string, unknown> {
  return {
    title: form.title.trim(), timeLimit: form.timeLimit, memoryLimit: form.memoryLimit, statement: form.statement.trim(), inputFormat: form.inputFormat.trim(), outputFormat: form.outputFormat.trim(),
    checkerSource: form.communication.enabled ? "" : form.checkerSource,
    communication: form.communication.enabled ? { ...form.communication, version: 1 } : { enabled: false },
    tags: [...tags.value], difficulty: form.difficulty, folderId: form.folderId || undefined, isPublic: form.isPublic,
    accessScope: form.accessScope, majorId: form.majorId || undefined, studentPublishStatus: form.studentPublishStatus,
    samples: form.samples.map((sample) => ({ input: sample.input ?? "", output: sample.output ?? "", explanation: sample.explanation ?? "" })),
  };
}
async function loadOptions() {
  const [folderResult, majorResult] = await Promise.allSettled([
    get<Array<{id:number;name:string}>>("/api/admin/v1/problem-folders"),
    get<Array<{id:number;name:string;code:string}>>("/api/admin/v1/majors?activeOnly=true"),
  ]);
  folders.value = folderResult.status === "fulfilled" ? folderResult.value : [];
  majors.value = majorResult.status === "fulfilled" ? majorResult.value : [];
}
async function initialize() {
  ready.value = false; loading.value = true; draftId.value = ""; cases.value = []; step.value = testCaseMode.value ? 1 : 0;
  try {
    await loadOptions();
    if (problemId.value) {
      const [problem, checker, communication, testCases] = await Promise.all([
        get<Record<string, unknown>>(`/api/admin/v1/problems/${problemId.value}`),
        get<string>(`/api/admin/v1/problems/${problemId.value}/checker-source`).catch(() => ""),
        get<BasicForm["communication"] | null>(`/api/admin/v1/problems/${problemId.value}/communication-config`).catch(() => null),
        get<TestCase[]>(`/api/admin/v1/problems/${problemId.value}/test-cases`).catch(() => []),
      ]);
      Object.assign(form, { title: String(problem.title ?? ""), timeLimit: Number(problem.timeLimit ?? 1000), memoryLimit: Number(problem.memoryLimit ?? 256), statement: String(problem.statement ?? ""), inputFormat: String(problem.inputFormat ?? ""), outputFormat: String(problem.outputFormat ?? ""), checkerSource: checker ?? "", difficulty: Number(problem.difficulty ?? 1), folderId: problem.folderId ? Number(problem.folderId) : undefined, isPublic: problem.isPublic !== false, accessScope: String(problem.accessScope ?? "PRIVATE") as BasicForm["accessScope"], majorId: problem.majorId ? Number(problem.majorId) : undefined, studentPublishStatus: String(problem.studentPublishStatus ?? (problem.isPublic ? "PUBLISHED" : "DRAFT")) as BasicForm["studentPublishStatus"], communication: communication ?? { enabled: false, maxMessageBytes: 1024, allowEmptyMessage: false, channelSource: "", checkerSource: "" }, samples: (problem.samples as Sample[] ?? []).map((sample) => ({ input: sample.input ?? "", output: sample.output ?? "", explanation: sample.explanation ?? "" })) });
      tags.value = Array.isArray(problem.tags) ? problem.tags.map(String) : [];
      cases.value = testCases.map(normalizeCase);
    } else {
      const draft = await post<{ draftId: string; basic?: Partial<BasicForm> & { tags?: string[] }; testCases?: TestCase[] }>("/api/admin/v1/problem-drafts", {});
      draftId.value = draft.draftId;
      if (draft.basic) { Object.assign(form, draft.basic); tags.value = draft.basic.tags ?? []; }
      cases.value = (draft.testCases ?? []).map(normalizeCase);
    }
    ready.value = true;
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "题目信息加载失败"); }
  finally { loading.value = false; }
}
async function saveBasic(nextStep = true) {
  if (!form.title.trim() || !form.statement.trim()) { ElMessage.warning("请填写题目名称和题面"); return false; }
  saving.value = true;
  try { await put(issueEndpoint.value, makePayload()); ElMessage.success("题目信息已保存"); if (nextStep) step.value = 1; return true; }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存题目信息失败"); return false; }
  finally { saving.value = false; }
}
function addSample() { form.samples.push({ input: "", output: "", explanation: "" }); }
function removeSample(index: number) { form.samples.splice(index,1); }
function addTag() { const tag=tagInput.value.trim();if(tag&&!tags.value.includes(tag))tags.value.push(tag);tagInput.value=""; }
function addCase() { cases.value.push({ caseNo: Math.max(0,...cases.value.map((item)=>item.caseNo))+1,input:"",output:"",publicInput:"" }); }
function removeCase(index: number) { cases.value.splice(index,1); }
async function saveCases(showSuccess=true) {
  const sorted = cases.value.map((item,index)=>({caseNo:Number(item.caseNo)||index+1,input:item.input??"",output:item.output??"",publicInput:item.publicInput??""})).sort((a,b)=>a.caseNo-b.caseNo);
  if (!sorted.length) { ElMessage.warning("至少添加一个测试点");return false; }
  if (new Set(sorted.map((item)=>item.caseNo)).size!==sorted.length) { ElMessage.warning("测试点编号不能重复");return false; }
  saving.value=true;
  try { await put(casesEndpoint.value,{testCases:sorted}); if(showSuccess)ElMessage.success("测试点已保存"); return true; }
  catch(cause){ElMessage.error(cause instanceof Error?cause.message:"保存测试点失败");return false;}
  finally{saving.value=false;}
}
async function finish() {
  if (!await saveCases(false)) return;
  if (!problemId.value) {
    saving.value=true;
    try { await post(`/api/admin/v1/problem-drafts/${draftId.value}/commit`,{}); ElMessage.success("题目已创建"); await router.replace(basePath.value); }
    catch(cause){ElMessage.error(cause instanceof Error?cause.message:"创建题目失败");}
    finally{saving.value=false;}
  } else { ElMessage.success("题目和测试点已保存"); await router.replace(basePath.value); }
}
async function importZip(overwrite: boolean) {
  if(!file.value) return;
  if(file.value.size>50*1024*1024){ElMessage.error("ZIP 文件不能超过 50MB");return;}
  const data=new FormData();data.append("file",file.value);importBusy.value=true;uploadProgress.value=0;currentImport.value=null;importMessage.value="正在上传和处理测试点…";
  const url=problemId.value?`/api/admin/v1/problems/${problemId.value}/test-cases/zip?overwrite=${overwrite}&stream=${!teacherMode.value}`:`/api/admin/v1/problem-drafts/${draftId.value}/test-cases/zip?overwrite=${overwrite}&stream=${!teacherMode.value}`;
  let imported = false;
  try {
    const result = teacherMode.value
      ? await teacherPost<{ testCases?: TestCase[] } | null>(url,data,60000)
      : await adminUpload<{ testCases?: TestCase[] } | null>(url,data,{timeoutMs:60000,onProgress:(percent)=>uploadProgress.value=percent,onUploaded:()=>{uploadProgress.value=100;},onProcessing:(progress)=>currentImport.value=progress});
    imported = true;
    const importedCases = problemId.value
      ? await get<TestCase[]>(casesEndpoint.value)
      : result?.testCases ?? (await get<{ testCases: TestCase[] }>(`/api/admin/v1/problem-drafts/${draftId.value}`)).testCases;
    cases.value=importedCases.map(normalizeCase);importMessage.value=`${overwrite?"覆盖":"追加"}导入完成`;ElMessage.success(importMessage.value);
  } catch(cause){importMessage.value=imported?"测试点已导入，但列表刷新失败。请刷新页面查看，勿重复导入。":cause instanceof Error?cause.message:"ZIP 导入失败";ElMessage.error(importMessage.value);}
  finally{importBusy.value=false;}
}
async function chooseZip(event: Event){const input=event.target as HTMLInputElement;file.value=input.files?.[0]??null;input.value="";if(file.value){try{await ElMessageBox.confirm(`对测试数据追加还是覆盖？\n${file.value.name}`,"导入测试点",{distinguishCancelAndClose:true,confirmButtonText:"追加",cancelButtonText:"覆盖",type:"warning"});await importZip(false);}catch(reason){if(reason==="cancel")await importZip(true);}}}
watch(()=>route.fullPath,()=>{void initialize();},{immediate:true});
</script>

<template>
  <main class="problem-editor page-container"><el-skeleton v-if="loading&&!ready" :rows="10" animated/><template v-else-if="ready"><el-steps :active="step" finish-status="success" simple><el-step title="题目内容"/><el-step title="测试数据"/></el-steps>
    <section v-if="step===0" class="editor-panel"><el-form label-position="top"><div class="two-col"><el-form-item label="题目名称" required><el-input v-model="form.title" maxlength="200"/></el-form-item><div class="two-col"><el-form-item label="时间限制（毫秒）"><el-input-number v-model="form.timeLimit" :min="100" :max="10000"/></el-form-item><el-form-item label="内存限制（MB）"><el-input-number v-model="form.memoryLimit" :min="16" :max="1024"/></el-form-item></div></div><div class="two-col"><el-form-item label="难度"><el-select v-model="form.difficulty"><el-option v-for="item in [{v:1,l:'入门'},{v:2,l:'简单'},{v:3,l:'中等'},{v:4,l:'困难'},{v:5,l:'地狱'}]" :key="item.v" :value="item.v" :label="item.l"/></el-select></el-form-item><el-form-item label="所属文件夹"><el-select v-model="form.folderId" clearable filterable placeholder="搜索题目文件夹" aria-label="搜索题目文件夹"><el-option v-for="folder in folders" :key="folder.id" :label="folder.name" :value="folder.id"/></el-select></el-form-item></div><div class="tag-row"><el-tag v-for="tag in tags" :key="tag" closable @close="tags=tags.filter((item)=>item!==tag)">{{tag}}</el-tag><el-input v-model="tagInput" class="tag-input" placeholder="输入标签后回车" @keyup.enter="addTag"/><el-button @click="addTag">添加标签</el-button></div><el-form-item label="题面（支持 HTML 和 LaTeX）" required><HtmlMathEditor v-model="form.statement" :rows="18" :height="355.2" aria-label="题面内容"/></el-form-item><div class="two-col"><el-form-item label="输入格式"><HtmlMathEditor v-model="form.inputFormat" :rows="10" aria-label="输入格式内容"/></el-form-item><el-form-item label="输出格式"><HtmlMathEditor v-model="form.outputFormat" :rows="10" aria-label="输出格式内容"/></el-form-item></div><el-form-item label="教师开放范围"><el-radio-group v-model="form.accessScope"><el-radio-button label="所有人" value="ALL"/><el-radio-button label="本专业" value="MAJOR"/><el-radio-button label="私有" value="PRIVATE"/></el-radio-group></el-form-item><el-form-item v-if="form.accessScope==='MAJOR'" label="所属专业"><el-select v-model="form.majorId"><el-option v-for="major in majors" :key="major.id" :value="major.id" :label="`${major.name}（${major.code}）`"/></el-select></el-form-item><div class="two-col"><el-form-item label="学生题库状态"><el-select v-model="form.studentPublishStatus"><el-option label="已发布" value="PUBLISHED"/><el-option label="未发布" value="DRAFT"/></el-select></el-form-item><el-form-item label="后台可见"><el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有"/></el-form-item></div>
      <el-divider content-position="left">样例</el-divider><el-card v-for="(sample,index) in form.samples" :key="index" shadow="never" class="case-card sample-card"><template #header><div class="case-heading"><strong>样例 {{index+1}}</strong><el-button link type="danger" @click="removeSample(index)">删除</el-button></div></template><div class="two-col"><el-form-item label="输入"><el-input v-model="sample.input" type="textarea" :rows="4"/></el-form-item><el-form-item label="输出"><el-input v-model="sample.output" type="textarea" :rows="4"/></el-form-item></div><el-form-item label="说明"><el-input v-model="sample.explanation" type="textarea" :rows="2"/></el-form-item></el-card><el-button plain @click="addSample">添加样例</el-button>
      <el-divider content-position="left">特殊评测与通信题</el-divider><el-form-item label="评测方式"><el-switch v-model="form.communication.enabled" active-text="通信题" inactive-text="普通题 / SPJ"/></el-form-item><template v-if="form.communication.enabled"><el-alert type="info" :closable="false" title="通信题会分别启动发送方和接收方；通信数据与检查器源代码按题目配置保存。"/><div class="two-col"><el-form-item label="消息字节上限"><el-input-number v-model="form.communication.maxMessageBytes" :min="1" :max="1048576"/></el-form-item><el-form-item label="允许空消息"><el-switch v-model="form.communication.allowEmptyMessage"/></el-form-item></div><el-form-item label="信道程序（C++17）"><CodeEditor v-model="form.communication.channelSource" language="cpp"/></el-form-item><el-form-item label="最终检查器（C++17）"><CodeEditor v-model="form.communication.checkerSource" language="cpp"/></el-form-item></template><el-form-item v-else label="SPJ 检查器（C++17，留空使用默认比较）"><CodeEditor v-model="form.checkerSource" language="cpp"/></el-form-item></el-form><div class="editor-actions"><el-button @click="router.replace(basePath)">取消</el-button><el-button type="primary" :loading="saving" @click="saveBasic()">保存并编辑测试点</el-button></div></section>
    <section v-else class="editor-panel"><div class="testcase-toolbar"><div><h2>测试数据</h2><p>测试点编号必须唯一。通信题可填写接收方公开数据。</p></div><label class="upload-button"><input type="file" accept=".zip" :disabled="importBusy" @change="chooseZip">导入 ZIP</label><el-button @click="addCase">添加测试点</el-button></div><el-alert v-if="importMessage" :type="importBusy?'info':importMessage.includes('失败')?'error':'success'" :closable="false" :title="importMessage"><template #default><div v-if="importBusy">{{uploadProgress===null?'等待上传…':`上传 ${uploadProgress}%`}}<span v-if="currentImport"> · 正在处理第 {{currentImport.current}} 个测试点</span></div></template></el-alert><el-empty v-if="!cases.length" description="还没有测试数据，请手动添加或导入 ZIP"/><el-card v-for="(item,index) in cases" :key="item.id??`${item.caseNo}-${index}`" shadow="never" class="case-card"><template #header><div class="case-heading"><strong>测试点 <el-input-number v-model="item.caseNo" :min="1" :max="100000" size="small"/></strong><el-button link type="danger" @click="removeCase(index)">删除</el-button></div></template><div class="two-col"><el-form-item label="输入数据"><el-input v-model="item.input" type="textarea" :rows="5"/></el-form-item><el-form-item v-if="!form.communication.enabled" label="标准输出"><el-input v-model="item.output" type="textarea" :rows="5"/></el-form-item></div><el-form-item v-if="form.communication.enabled" label="接收方公开输入（可选）"><el-input v-model="item.publicInput" type="textarea" :rows="4"/></el-form-item><el-form-item v-if="form.communication.enabled" label="标准输出（可选）"><el-input v-model="item.output" type="textarea" :rows="3"/></el-form-item></el-card><div class="editor-actions"><el-button @click="step=0">上一步</el-button><el-button :loading="saving" @click="saveCases()">保存测试数据</el-button><el-button type="primary" :loading="saving" @click="finish">{{problemId?'完成':'创建题目'}}</el-button></div></section>
  </template></main>
</template>

<style scoped>
.sample-card :deep(.el-textarea__inner){min-height:81px!important}
/* 测试点数据可能很长：高度按 rows 固定，超出的内容在文本框内部纵向滚动，卡片不再被撑开。 */
.case-card:not(.sample-card) :deep(.el-textarea__inner){field-sizing:fixed!important;height:auto!important;max-height:none!important;min-height:0!important;overflow-y:auto!important;resize:none!important}

.problem-editor{max-width:1240px;margin:0 auto;padding-bottom:28px}.editor-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.editor-heading h1{margin:0;font-size:24px}.editor-heading p{margin:6px 0 0;color:var(--el-text-color-placeholder);font-size:13px}.editor-panel{margin-top:18px;padding:20px;border:1px solid var(--card-border);border-radius:12px;background:var(--content-bg)}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two-col .el-input-number,.two-col .el-select{width:100%}.tag-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px}.tag-input{width:220px}.case-card{margin:12px 0;border-color:var(--card-border)}.case-heading{display:flex;align-items:center;justify-content:space-between}.case-heading :deep(.el-input-number){width:110px;margin-left:8px}.editor-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.testcase-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.testcase-toolbar h2{margin:0;font-size:18px}.testcase-toolbar p{margin:4px 0 0;color:var(--el-text-color-placeholder);font-size:13px}.upload-button{display:inline-flex;align-items:center;min-height:32px;padding:0 14px;border:1px solid #dcdfe6;border-radius:4px;color:#606266;cursor:pointer}.upload-button input{display:none}@media(max-width:760px){.editor-panel{padding:14px}.two-col{grid-template-columns:1fr;gap:4px}.testcase-toolbar{align-items:flex-start;flex-direction:column}.editor-actions{flex-wrap:wrap}}
</style>

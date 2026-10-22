<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import katex from "katex";
import { readAuthToken } from "../../api/tokenStorage";
import HtmlMath from "./HtmlMath.vue";

type FormulaItem = { latex: string; tip?: string };
type FormulaGroup = { name: string; items: FormulaItem[] };

const props = withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
  rows?: number;
  height?: number;
  ariaLabel?: string;
}>(), { modelValue: "", rows: 10 });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const groups: FormulaGroup[] = [
  { name: "上下标", items: [{ latex: "a^{2}", tip: "上标" }, { latex: "a_{i}", tip: "下标" }, { latex: "a_{i}^{2}", tip: "上下标" }, { latex: "a_{i,j}", tip: "多重下标" }, { latex: "x^{2^{n}}", tip: "嵌套上标" }] },
  { name: "分数与根号", items: [{ latex: "\\frac{a}{b}" }, { latex: "\\dfrac{a}{b}", tip: "大分数" }, { latex: "\\sqrt{x}" }, { latex: "\\sqrt[n]{x}", tip: "n 次根" }, { latex: "\\frac{n(n+1)}{2}", tip: "等差求和" }] },
  { name: "求和/积/极限/积分", items: [{ latex: "\\sum_{i=1}^{n} a_i" }, { latex: "\\prod_{i=1}^{n} a_i" }, { latex: "\\lim_{n \\to \\infty} a_n" }, { latex: "\\int_{a}^{b} f(x)\\,\\mathrm{d}x" }, { latex: "\\bigcup_{i=1}^{n} S_i" }, { latex: "\\bigcap_{i=1}^{n} S_i" }] },
  { name: "取整/取模/组合", items: [{ latex: "\\left\\lfloor \\dfrac{a}{b} \\right\\rfloor", tip: "下取整" }, { latex: "\\left\\lceil \\dfrac{a}{b} \\right\\rceil", tip: "上取整" }, { latex: "a \\bmod b", tip: "取模" }, { latex: "a \\equiv b \\pmod{m}", tip: "同余" }, { latex: "\\binom{n}{k}", tip: "组合数" }, { latex: "\\gcd(a, b)" }, { latex: "\\operatorname{lcm}(a, b)" }] },
  { name: "括号", items: [{ latex: "\\left( x \\right)" }, { latex: "\\left[ x \\right]" }, { latex: "\\left\\{ x \\right\\}" }, { latex: "\\left| x \\right|", tip: "绝对值" }, { latex: "\\left\\langle x \\right\\rangle" }] },
  { name: "比较/运算符", items: ["\\le", "\\ge", "\\ne", "\\equiv", "\\approx", "\\sim", "\\times", "\\cdot", "\\div", "\\pm", "\\mp", "\\oplus"].map((latex) => ({ latex })) },
  { name: "集合/逻辑", items: ["\\in", "\\notin", "\\subseteq", "\\cup", "\\cap", "\\emptyset", "\\forall", "\\exists", "\\land", "\\lor", "\\Rightarrow", "\\Leftrightarrow"].map((latex) => ({ latex })) },
  { name: "希腊字母", items: ["\\alpha", "\\beta", "\\gamma", "\\delta", "\\theta", "\\lambda", "\\mu", "\\pi", "\\sigma", "\\phi", "\\omega", "\\Delta", "\\Sigma", "\\Omega"].map((latex) => ({ latex })) },
  { name: "箭头/装饰/省略号", items: ["\\to", "\\gets", "\\mapsto", "\\overline{x}", "\\vec{x}", "\\hat{x}", "\\overrightarrow{AB}", "\\cdots", "\\ldots", "\\vdots", "\\ddots"].map((latex) => ({ latex })) },
  { name: "矩阵/分段", items: [{ latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", tip: "圆括号矩阵" }, { latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", tip: "方括号矩阵" }, { latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", tip: "行列式" }, { latex: "f(n) = \\begin{cases} 1, & n = 0 \\\\ n \\cdot f(n-1), & n > 0 \\end{cases}", tip: "分段函数" }] },
  { name: "竞赛常用", items: [{ latex: "O(n \\log n)", tip: "复杂度" }, { latex: "1 \\le n \\le 10^{5}", tip: "数据范围" }, { latex: "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}" }, { latex: "a \\equiv b \\pmod{10^9 + 7}" }, { latex: "\\dfrac{n!}{k!(n-k)!}" }] },
  { name: "区间/数据范围", items: [{ latex: "1 \\le n \\le 10^{5}", tip: "n 的范围" }, { latex: "1 \\le m \\le 10^{5}", tip: "m 的范围" }, { latex: "1 \\le n, m \\le 10^{5}", tip: "n、m 同范围" }, { latex: "1 \\le a_i \\le 10^{9}", tip: "元素范围" }, { latex: "-10^{9} \\le a_i \\le 10^{9}", tip: "含负数范围" }, { latex: "0 \\le x \\le 2^{31} - 1", tip: "int 范围" }, { latex: "[l, r]", tip: "闭区间" }, { latex: "(l, r)", tip: "开区间" }, { latex: "[l, r)", tip: "左闭右开" }, { latex: "1 \\le l \\le r \\le n", tip: "区间约束" }, { latex: "x \\in [a, b]", tip: "属于区间" }, { latex: "\\sum n \\le 10^{6}", tip: "总和范围" }] },
  { name: "变量", items: [{ latex: "n" }, { latex: "m" }, { latex: "n \\times m", tip: "n 乘 m" }, { latex: "a_i" }, { latex: "a_{i,j}" }] },
];

const editorHost = ref<HTMLDivElement>();
const formulaHost = ref<HTMLDivElement>();
const fileInput = ref<HTMLInputElement>();
const formulaOpen = ref(false);
const imageOpen = ref(false);
const formulaText = ref("");
const formulaMode = ref<"inline" | "display">("inline");
const imageMode = ref<"upload" | "url">("url");
const imageUrl = ref("");
const imageWidth = ref<number>();
const imageHeight = ref<number>();
const uploading = ref(false);
const uploadGeneration = ref(0);
const insertionPoint = ref({ start: 0, end: 0 });

const previewHtml = computed(() => renderFormula(formulaText.value.trim(), formulaMode.value === "display"));

function getTextarea(host = editorHost.value) { return host?.querySelector("textarea") ?? null; }
function renderFormula(latex: string, display = false) {
  if (!latex) return "";
  try { return katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: false }); }
  catch { return latex; }
}
function rememberSelection() {
  const textarea = getTextarea();
  insertionPoint.value = { start: textarea?.selectionStart ?? props.modelValue.length, end: textarea?.selectionEnd ?? props.modelValue.length };
}
function insertAtCursor(snippet: string, selected = insertionPoint.value) {
  const value = props.modelValue;
  const start = Math.max(0, Math.min(selected.start, value.length));
  const end = Math.max(start, Math.min(selected.end, value.length));
  emit("update:modelValue", value.slice(0, start) + snippet + value.slice(end));
  const caret = start + snippet.length;
  insertionPoint.value = { start: caret, end: caret };
  requestAnimationFrame(() => {
    const textarea = getTextarea();
    if (textarea) { textarea.focus(); textarea.setSelectionRange(caret, caret); }
  });
}
function surround(before: string, after: string, fallback: string) {
  rememberSelection();
  const { start, end } = insertionPoint.value;
  const selected = props.modelValue.slice(start, end) || fallback;
  const snippet = `${before}${selected}${after}`;
  insertAtCursor(snippet);
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + selected.length;
  requestAnimationFrame(() => getTextarea()?.setSelectionRange(selectionStart, selectionEnd));
}
function insertBlock(snippet: string) {
  rememberSelection();
  const { start, end } = insertionPoint.value;
  const prefix = start > 0 && !/\n$/.test(props.modelValue.slice(0, start)) ? "\n" : "";
  insertAtCursor(`${prefix}${snippet}`, { start, end });
}
function insertTag(tag: string) {
  if (!tag) return;
  rememberSelection();
  const { start, end } = insertionPoint.value;
  const selected = props.modelValue.slice(start, end) || "文本";
  const prefix = start > 0 && !/\n$/.test(props.modelValue.slice(0, start)) ? "\n" : "";
  insertAtCursor(`${prefix}<${tag}>${selected}</${tag}>`, { start, end });
}
function insertGreenBox() {
  rememberSelection();
  const { start, end } = insertionPoint.value;
  const selected = props.modelValue.slice(start, end);
  const content = selected || "<p>在这里输入背景框内容</p>";
  const prefix = start > 0 && props.modelValue[start - 1] !== "\n" ? "\n" : "";
  const open = '<blockquote class="qoj-background-box qoj-background-box--green">\n';
  insertAtCursor(`${prefix}${open}${content}\n</blockquote>`, { start, end });
  const contentStart = start + prefix.length + open.length;
  requestAnimationFrame(() => getTextarea()?.setSelectionRange(contentStart + (selected ? 0 : 3), contentStart + content.length - (selected ? 0 : 4)));
}
function openFormula() { rememberSelection(); formulaText.value = ""; formulaMode.value = "inline"; formulaOpen.value = true; }
function pickFormula(snippet: string) {
  const textarea = getTextarea(formulaHost.value);
  const start = textarea?.selectionStart ?? formulaText.value.length;
  const end = textarea?.selectionEnd ?? formulaText.value.length;
  formulaText.value = formulaText.value.slice(0, start) + snippet + formulaText.value.slice(end);
  requestAnimationFrame(() => { const target = getTextarea(formulaHost.value); const caret = start + snippet.length; target?.focus(); target?.setSelectionRange(caret, caret); });
}
function insertFormula() {
  const latex = formulaText.value.trim();
  if (latex) insertAtCursor(formulaMode.value === "display" ? `$$\n${latex}\n$$\n` : `$${latex}$`);
  formulaOpen.value = false;
}
function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function openImageDialog() {
  rememberSelection(); imageMode.value = "url"; imageUrl.value = ""; imageWidth.value = undefined; imageHeight.value = undefined; imageOpen.value = true;
}
function cancelImageDialog() { uploadGeneration.value += 1; uploading.value = false; imageOpen.value = false; imageUrl.value = ""; imageWidth.value = undefined; imageHeight.value = undefined; }
async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = "";
  if (!file) return;
  const generation = ++uploadGeneration.value;
  uploading.value = true;
  try {
    const token = readAuthToken("frontend");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/uploads/images", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.code !== 200 || !body?.data?.url) throw new Error(body?.message || "图片上传失败");
    if (generation !== uploadGeneration.value) return;
    insertAtCursor(`<img src="${escapeAttribute(String(body.data.url))}" alt="图片" style="max-width:100%" />`);
    imageOpen.value = false;
  } catch (error) {
    if (generation === uploadGeneration.value) ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
  } finally { if (generation === uploadGeneration.value) uploading.value = false; }
}
function insertImageUrl() {
  const url = imageUrl.value.trim();
  if (!url) { ElMessage.info("请输入图片链接"); return; }
  const width = imageWidth.value != null && imageWidth.value > 0 ? imageWidth.value : null;
  const height = imageHeight.value != null && imageHeight.value > 0 ? imageHeight.value : null;
  const safeUrl = escapeAttribute(url);
  const close = () => cancelImageDialog();
  if (!width && !height) { insertAtCursor(`<img src="${safeUrl}" alt="图片" style="max-width:100%" />`); close(); return; }
  if (width && height) { insertAtCursor(`<img src="${safeUrl}" alt="图片" style="max-width:100%; width: ${width}px; height: ${height}px" width="${width}" height="${height}" />`); close(); return; }
  const generation = ++uploadGeneration.value;
  const probe = new Image();
  probe.onload = () => {
    if (generation !== uploadGeneration.value) return;
    const naturalWidth = probe.naturalWidth; const naturalHeight = probe.naturalHeight;
    if (naturalWidth > 0 && naturalHeight > 0) {
      const finalWidth = width ?? naturalWidth; const finalHeight = height ?? naturalHeight;
      insertAtCursor(`<img src="${safeUrl}" alt="图片" style="max-width:100%; width: ${finalWidth}px; height: ${finalHeight}px" width="${finalWidth}" height="${finalHeight}" />`);
    } else {
      let style = "max-width:100%"; let attrs = "";
      if (width) { style += `; width: ${width}px`; attrs += ` width="${width}"`; }
      if (height) { style += `; height: ${height}px`; attrs += ` height="${height}"`; }
      insertAtCursor(`<img src="${safeUrl}" alt="图片" style="${style}"${attrs} />`);
    }
    close();
  };
  probe.onerror = () => { if (generation !== uploadGeneration.value) return; ElMessage.error("图片加载失败，请检查链接"); close(); };
  probe.src = url;
}
</script>

<template>
  <section class="html-math-editor">
    <div class="toolbar" aria-label="题面格式工具">
      <el-select aria-label="段落或标题" placeholder="段落/标题" class="format-select" @change="insertTag">
        <el-option label="段落" value="p"/><el-option label="标题 H1" value="h1"/><el-option label="标题 H2" value="h2"/><el-option label="标题 H3" value="h3"/>
      </el-select>
      <el-tooltip content="加粗"><el-button @mousedown.prevent @click="surround('<strong>','</strong>','加粗')"><b>B</b></el-button></el-tooltip>
      <el-tooltip content="斜体"><el-button @mousedown.prevent @click="surround('<em>','</em>','斜体')"><i>I</i></el-button></el-tooltip>
      <el-tooltip content="下划线"><el-button @mousedown.prevent @click="surround('<u>','</u>','下划线')"><u>U</u></el-button></el-tooltip>
      <el-tooltip content="无序列表"><el-button @mousedown.prevent @click="insertBlock('<ul>\n  <li>列表项</li>\n</ul>\n')">• 列表</el-button></el-tooltip>
      <el-tooltip content="有序列表"><el-button @mousedown.prevent @click="insertBlock('<ol>\n  <li>列表项</li>\n</ol>\n')">1. 列表</el-button></el-tooltip>
      <el-tooltip content="行内代码"><el-button @mousedown.prevent @click="surround('<code>','</code>','code')">&lt;/&gt;</el-button></el-tooltip>
      <el-tooltip content="代码块"><el-button @mousedown.prevent @click="insertBlock('<pre><code>\n代码\n</code></pre>\n')">代码块</el-button></el-tooltip>
      <el-tooltip content="将选中内容放入绿色背景框；未选择时插入模板"><el-button class="green-button" @mousedown.prevent @click="insertGreenBox">绿色背景框</el-button></el-tooltip>
      <el-tooltip content="插入公式（含常见公式库）"><el-button @mousedown.prevent @click="openFormula">∑ 插入公式</el-button></el-tooltip>
      <el-tooltip content="链接"><el-button @mousedown.prevent @click="surround('<a href=&quot;https://&quot; target=&quot;_blank&quot;>','</a>','链接文字')">链接</el-button></el-tooltip>
      <el-tooltip content="插入图片（上传本地图片或图片链接）"><el-button @mousedown.prevent @click="openImageDialog">🖼 图片</el-button></el-tooltip>
    </div>
    <div ref="editorHost" class="editor-source" :style="{ '--html-editor-min-height': `${height ?? rows * 24 + 12}px` }">
      <el-input :model-value="modelValue" type="textarea" :rows="rows" :aria-label="ariaLabel" :placeholder="placeholder || '支持 HTML 标签与 LaTeX 公式（行内 $...$，独立 $$...$$）'" spellcheck="false" @update:model-value="emit('update:modelValue',$event)" />
    </div>
    <div class="preview-label">实时预览</div>
    <div class="preview-panel"><HtmlMath :value="modelValue" empty-text="在上方输入 HTML 后可在这里查看渲染效果" /></div>

    <el-dialog v-model="formulaOpen" title="插入公式" width="min(1100px, 92vw)" append-to-body>
      <div class="formula-layout">
        <div class="formula-library">
          <section v-for="group in groups" :key="group.name" class="formula-group"><strong>{{ group.name }}</strong><div><button v-for="(item,index) in group.items" :key="`${group.name}-${index}`" type="button" :title="item.tip ? `${item.tip}：${item.latex}` : item.latex" @click="pickFormula(item.latex)" v-html="renderFormula(item.latex)" /></div></section>
        </div>
        <div class="formula-compose">
          <el-radio-group v-model="formulaMode" size="small"><el-radio-button value="inline">行内公式 $...$</el-radio-button><el-radio-button value="display">独立公式 $$...$$</el-radio-button></el-radio-group>
          <label for="latex-source">LaTeX 源码</label>
          <div ref="formulaHost"><el-input id="latex-source" v-model="formulaText" type="textarea" :rows="6" placeholder="点击左侧公式插入，或直接输入 LaTeX" spellcheck="false" /></div>
          <label>实时预览</label><div class="formula-preview" v-html="previewHtml || '预览区域'" />
        </div>
      </div>
      <p class="formula-tip">点击公式库可插入源码；确认后按所选模式插入到题面。</p>
      <template #footer><el-button @click="formulaOpen=false">取消</el-button><el-button type="primary" @click="insertFormula">插入</el-button></template>
    </el-dialog>

    <el-dialog v-model="imageOpen" title="插入图片" width="min(480px, 92vw)" append-to-body :close-on-click-modal="!uploading" :close-on-press-escape="!uploading" @close="cancelImageDialog">
      <el-radio-group v-model="imageMode" class="image-mode"><el-radio-button value="upload">上传本地图片</el-radio-button><el-radio-button value="url">图片链接</el-radio-button></el-radio-group>
      <div v-if="imageMode==='upload'" class="image-upload"><input ref="fileInput" type="file" accept="image/*" hidden @change="uploadImage"><el-button type="primary" :loading="uploading" @click="fileInput?.click()">{{ uploading ? '上传中…' : '选择本地图片上传' }}</el-button><span>支持 JPG/PNG/GIF/WEBP/BMP，最大 5MB</span></div>
      <div v-else class="image-url-form"><el-input v-model="imageUrl" placeholder="https://example.com/image.png" @keyup.enter="insertImageUrl"/><div class="image-size"><el-input-number v-model="imageWidth" :min="1" placeholder="宽度（可选，px）"/><el-input-number v-model="imageHeight" :min="1" placeholder="高度（可选，px）"/></div><small>宽度与高度独立生效：只填一项时，另一项保持图片原始尺寸。</small></div>
      <template #footer><el-button @click="cancelImageDialog">取消</el-button><el-button v-if="imageMode==='url'" type="primary" @click="insertImageUrl">插入图片</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.html-math-editor{min-width:0}
.html-math-editor .toolbar > .format-select{flex:0 0 112px;width:112px;min-width:112px;max-width:112px}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:7px;border:1px solid var(--el-border-color);border-bottom:0;border-radius:5px 5px 0 0;background:var(--page-bg)}.toolbar :deep(.el-button){margin:0}.green-button{color:#15803d}.html-math-editor .editor-source :deep(.el-textarea__inner){field-sizing:fixed;height:var(--html-editor-min-height);min-height:var(--html-editor-min-height)!important;border-radius:0 0 5px 5px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.preview-label{margin:9px 0 4px;color:var(--el-text-color-secondary);font-size:12px}.preview-panel{min-height:48px;padding:12px 14px;border:1px solid var(--el-border-color);border-radius:5px;background:var(--content-bg)}.formula-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:16px}.formula-library{max-height:460px;overflow:auto;padding-right:4px}.formula-group{margin-bottom:14px}.formula-group>strong,.formula-compose>label{display:block;margin-bottom:6px;color:#4e5969;font-size:12px}.formula-group>div{display:flex;flex-wrap:wrap;gap:6px}.formula-group button{display:inline-flex;min-width:40px;min-height:36px;align-items:center;justify-content:center;padding:6px 10px;border:1px solid var(--el-border-color);border-radius:4px;background:var(--content-bg);cursor:pointer}.formula-compose{display:flex;min-width:0;flex-direction:column;gap:10px}.formula-compose>label:not(:first-child){margin:0}.formula-preview{display:grid;min-height:80px;place-items:center;overflow:auto;padding:16px;border:1px solid #ddd;border-radius:4px;background:#fafafa}.formula-tip{margin:12px 0 0;color:#999;font-size:12px}.image-mode{margin-bottom:16px}.image-upload{display:flex;align-items:center;gap:12px}.image-upload span,.image-url-form small{color:var(--el-text-color-secondary);font-size:12px}.image-url-form{display:flex;flex-direction:column;gap:12px}.image-size{display:grid;grid-template-columns:1fr 1fr;gap:12px}.image-size :deep(.el-input-number){width:100%}@media(max-width:720px){.formula-layout{grid-template-columns:1fr}.formula-library{max-height:280px}.image-upload{align-items:flex-start;flex-direction:column}}
</style>

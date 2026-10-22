<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api.js";

const props = withDefaults(defineProps<{
  modelValue: string;
  language: string;
  theme?: "light" | "dark";
  readOnly?: boolean;
  fontSize?: number;
}>(), { theme: "light", readOnly: false, fontSize: 15 });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const host = ref<HTMLElement>();
let monaco: typeof Monaco | undefined;
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let disposed = false;
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    ({ monaco } = await import("../utils/monacoSetup"));
    if (disposed || !host.value) return;
    editor = monaco.editor.create(host.value, {
      value: props.modelValue,
      language: props.language,
      theme: props.theme === "dark" ? "qoj-dark" : "qoj-light",
      readOnly: props.readOnly,
      fontSize: props.fontSize,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      tabSize: 4,
      renderLineHighlight: "line",
      guides: { indentation: false, bracketPairs: false },
      rulers: [],
      padding: { top: 14, bottom: 14 },
    });
    editor.onDidChangeModelContent(() => {
      if (editor && !props.readOnly) emit("update:modelValue", editor.getValue());
    });
  } catch (cause) {
    if (!disposed) error.value = "编辑器加载失败，请刷新重试。";
    console.error("QOJ editor initialization failed", cause);
  } finally {
    if (!disposed) loading.value = false;
  }
});

watch(() => props.modelValue, (value) => {
  if (editor && editor.getValue() !== value) editor.setValue(value);
});
watch(() => props.language, (language) => {
  const model = editor?.getModel();
  if (model) monaco?.editor.setModelLanguage(model, language);
});
watch(() => props.theme, (theme) => monaco?.editor.setTheme(theme === "dark" ? "qoj-dark" : "qoj-light"));
watch(() => props.readOnly, (readOnly) => editor?.updateOptions({ readOnly }));
watch(() => props.fontSize, (fontSize) => editor?.updateOptions({ fontSize }));
onBeforeUnmount(() => {
  disposed = true;
  const model = editor?.getModel();
  editor?.dispose();
  model?.dispose();
  editor = null;
});
</script>

<template><div class="code-editor" :aria-busy="loading"><div ref="host" class="code-editor__host"/><span v-if="error" class="code-editor__error" role="alert">{{ error }}</span></div></template>

<style scoped>
.code-editor { position: relative; width: 100%; height: 100%; min-height: 180px; overflow: hidden; }
.code-editor__host { width: 100%; height: 100%; min-height: 180px; }
.code-editor__error { position: absolute; inset: 0; display: grid; place-items: center; color: var(--el-color-danger); }
</style>

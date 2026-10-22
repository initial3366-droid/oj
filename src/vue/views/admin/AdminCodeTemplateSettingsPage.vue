<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminGet, adminPut } from "../../../admin/api/adminClient";
import { decodeCodeTemplateSettings, type CodeTemplateSettings } from "../../../data/apiClient";

const empty: CodeTemplateSettings = { c: "", cpp: "", python: "", java: "" };
const templates = reactive<CodeTemplateSettings>({ ...empty });
const loading = ref(false);
const saving = ref(false);
const activeTab = ref<keyof CodeTemplateSettings>("cpp");
const languages: Array<{ key: keyof CodeTemplateSettings; label: string }> = [
  { key: "c", label: "C" }, { key: "cpp", label: "C++17/20/23" }, { key: "python", label: "Python" }, { key: "java", label: "Java" },
];

async function load() {
  loading.value = true;
  try { Object.assign(templates, empty, decodeCodeTemplateSettings(await adminGet<CodeTemplateSettings>("/api/admin/v1/settings/system/code-templates"))); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "代码模板加载失败"); }
  finally { loading.value = false; }
}

async function save() {
  saving.value = true;
  try { await adminPut("/api/admin/v1/settings/system/code-templates", { ...templates }); ElMessage.success("代码模板已保存"); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "代码模板保存失败"); }
  finally { saving.value = false; }
}

onMounted(load);
</script>

<template>
  <section class="templates-page page-container">
    
    <el-card v-loading="loading" shadow="never"><template #header><div class="management-card-heading"><div class="management-card-actions"><header class="page-heading"><div class="actions"><el-button type="primary" :loading="saving" :disabled="loading" @click="save">保存</el-button></div></header></div></div></template>
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane v-for="language in languages" :key="language.key" :label="language.label" :name="language.key">
          <el-input v-model="templates[language.key]" type="textarea" :rows="22" :placeholder="`请输入 ${language.label} 的默认代码`" spellcheck="false" class="code-input" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  
</section>
</template>

<style scoped>
.templates-page{display:flex;flex-direction:column;gap:16px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-heading h1{margin:0;font-size:22px}.page-heading p{max-width:760px;margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px;line-height:1.6}.actions{display:flex;gap:8px}.code-input :deep(textarea){font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}@media(max-width:700px){.page-heading{align-items:flex-start;flex-direction:column}}
</style>

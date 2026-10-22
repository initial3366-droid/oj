<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { adminGet, adminPut } from "../../../admin/api/adminClient";

interface AgentSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: string;
  timeoutMs: number;
  maxCodeChars: number;
  contextWindowTokens: number;
}
const endpoint = "/api/admin/v1/settings/system/agent";
const formRef = ref<FormInstance>();
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const form = reactive<AgentSettings>({ enabled: false, baseUrl: "", apiKey: "", model: "", reasoningEffort: "medium", timeoutMs: 30000, maxCodeChars: 12000, contextWindowTokens: 512000 });
const efforts = [{ value: "none", label: "关闭" }, { value: "minimal", label: "最低" }, { value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" }, { value: "max", label: "最高" }];
const rules: FormRules = {
  baseUrl: [{ validator: (_rule, value, done) => {
    if (!value && !form.enabled) return done();
    try { const url = new URL(String(value)); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); done(); }
    catch { done(new Error("请填写完整的 HTTP 或 HTTPS 服务地址")); }
  }, trigger: "blur" }],
  model: [{ validator: (_rule, value, done) => done(form.enabled && !String(value).trim() ? new Error("请填写模型名称") : undefined), trigger: "blur" }],
  timeoutMs: [{ type: "number", required: true, min: 1000, max: 600000, message: "请求超时应为 1000–600000 毫秒", trigger: "change" }],
  contextWindowTokens: [{ type: "number", required: true, min: 8192, max: 512000, message: "请填写模型真实窗口（8192–512000）", trigger: "change" }],
  maxCodeChars: [{ type: "number", required: true, min: 1000, max: 50000, message: "代码上下文应为 1000–50000 字符", trigger: "change" }],
};
async function load() {
  loading.value = true; error.value = "";
  try {
    const settings = await adminGet<Partial<AgentSettings>>(endpoint);
    Object.assign(form, settings, { apiKey: "" });
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "加载 AI 配置失败"; }
  finally { loading.value = false; }
}
async function save() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  saving.value = true;
  try {
    await adminPut(endpoint, { ...form, baseUrl: form.baseUrl.trim(), model: form.model.trim(), apiKey: form.apiKey.trim() });
    form.apiKey = "";
    ElMessage.success("AI 配置已保存");
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存 AI 配置失败"); }
  finally { saving.value = false; }
}
onMounted(load);
</script>
<template>
  <section v-loading="loading" class="page-container ai-settings-page">
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button text @click="load">重试</el-button></el-alert>
    <el-card v-else-if="!loading" shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="loading || saving" class="ai-settings-form">
        <el-form-item label="启用 AI 助手" class="full-row"><el-switch v-model="form.enabled" aria-label="启用 AI 助手" /></el-form-item>
        <el-form-item label="服务地址" prop="baseUrl" :required="form.enabled"><el-input v-model="form.baseUrl" aria-label="服务地址" placeholder="https://api.example.com/v1" clearable /></el-form-item>
        <el-form-item label="API 密钥" prop="apiKey"><el-input v-model="form.apiKey" aria-label="API 密钥" type="password" show-password autocomplete="new-password" placeholder="留空保留已配置的密钥" /></el-form-item>
        <el-form-item label="模型名称" prop="model" :required="form.enabled"><el-input v-model="form.model" aria-label="模型名称" placeholder="填写服务提供的模型名称" clearable /></el-form-item>
        <el-form-item label="推理强度" prop="reasoningEffort"><el-select v-model="form.reasoningEffort" aria-label="推理强度"><el-option v-for="effort in efforts" :key="effort.value" :value="effort.value" :label="effort.label" /></el-select></el-form-item>
        <el-form-item label="请求超时（毫秒）" prop="timeoutMs"><el-input-number v-model="form.timeoutMs" aria-label="请求超时（毫秒）" :min="1000" :max="600000" :step="1000" :precision="0" controls-position="right" /></el-form-item>
        <el-form-item label="代码上下文长度（字符）" prop="maxCodeChars"><el-input-number v-model="form.maxCodeChars" aria-label="代码上下文长度（字符）" :min="1000" :max="50000" :step="1000" :precision="0" controls-position="right" /></el-form-item>
        <el-form-item label="模型上下文窗口（tokens）" prop="contextWindowTokens"><el-input-number v-model="form.contextWindowTokens" :min="8192" :max="512000" :step="1000" :precision="0" controls-position="right" /><small>默认512K；模型容量更小时按服务商文档填写。不会扩展模型本身的容量。</small></el-form-item>
        <div class="settings-actions full-row"><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></div>
      </el-form>
    </el-card>
    <el-skeleton v-else :rows="8" animated />
  </section>
</template>
<style scoped>
.ai-settings-page{display:flex;flex-direction:column;gap:16px}
.ai-settings-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}
.ai-settings-form .full-row{grid-column:1 / -1}
.ai-settings-form :deep(.el-select),.ai-settings-form :deep(.el-input-number){width:100%}
@media(max-width:800px){.ai-settings-form{grid-template-columns:minmax(0,1fr)}}
</style>

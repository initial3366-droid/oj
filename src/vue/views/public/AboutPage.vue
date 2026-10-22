<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { SUBMISSION_LANGUAGE_OPTIONS, type SubmissionLanguageApiValue } from "../../../data/languages";
import { copyTextToClipboard } from "../../../utils/clipboard";
import { EXAMPLES, INPUT_MODES, LANGUAGE_GUIDES, VERDICT_GUIDES, type InputMode } from "../../../pages/about/guide";
import "../../../pages/AboutPage.css";

const language = ref<SubmissionLanguageApiValue>("cpp17");
const mode = ref<InputMode>("single");
const selectedLanguage = computed(() => SUBMISSION_LANGUAGE_OPTIONS.find((item) => item.apiValue === language.value)!);
const selectedMode = computed(() => INPUT_MODES.find((item) => item.key === mode.value)!);
const guide = computed(() => LANGUAGE_GUIDES[language.value]);
const code = computed(() => EXAMPLES[selectedLanguage.value.templateKey][mode.value]);

async function copyCode() {
  const copied = await copyTextToClipboard(code.value);
  if (copied) ElMessage.success("代码已复制");
  else ElMessage.error("复制失败，请选择代码手动复制");
}
</script>

<template>
  <main class="page-container vue-about-page page-container">
    <header class="page-container-header">
      <div class="page-container-title-row">
        <div class="page-container-title-content">
          <h1 class="vue-about-title">关于</h1>
          <p class="vue-about-description">从第一份 A+B 程序开始，了解输入输出、编译环境和判题结果。</p>
        </div>
      </div>
    </header>

    <div class="about-page">
      <div class="about-intro">
        <div><span aria-hidden="true">📘</span><span><strong>QOJ 使用指南</strong><p>标准输入读取数据，标准输出提交答案。根据题目的输入格式选择对应写法。</p></span></div>
        <el-tag type="info" effect="light">6 种语言选项</el-tag>
      </div>

      <div class="about-columns">
        <div class="about-main">
          <section class="about-section">
            <header><h2>语言与编译命令</h2></header>
            <p class="about-muted">以下命令对应平台当前判题配置。C / C++ 使用 -O2 优化；Python 先检查语法；Java 先编译，再打包。</p>
            <div role="region" aria-label="语言编译命令表">
              <el-table class="about-compiler-table" :data="SUBMISSION_LANGUAGE_OPTIONS.map((item) => ({ ...item, ...LANGUAGE_GUIDES[item.apiValue] }))" row-key="apiValue" stripe>
                <el-table-column label="语言 / 文件名" width="180">
                  <template #default="{ row }"><div class="about-language-cell"><strong>{{ row.label }}</strong><code>{{ row.source }}</code></div></template>
                </el-table-column>
                <el-table-column label="编译命令" min-width="340">
                  <template #default="{ row }"><code class="about-command">{{ row.compile }}</code><div v-if="row.compileDetails" class="about-compile-details"><span class="about-muted">脚本内部依次执行：</span><code class="about-command">{{ row.compileDetails }}</code></div></template>
                </el-table-column>
              </el-table>
            </div>
            <p class="about-footnote">平台自动使用对应文件名保存源码。Java 调用平台编译脚本，内部先编译再打包，公开类名必须是 Main。</p>
          </section>

          <section class="about-section">
            <header><h2>A+B 与多组输入</h2></header>
            <div class="about-options" role="group" aria-label="选择示例语言">
              <el-button v-for="item in SUBMISSION_LANGUAGE_OPTIONS" :key="item.apiValue" size="small" :type="item.apiValue === language ? 'primary' : 'default'" :aria-pressed="item.apiValue === language" @click="language = item.apiValue">{{ item.label }}</el-button>
            </div>
            <p class="about-language-note">{{ guide.note }}</p>
            <div class="about-run"><span>运行命令</span><code>{{ guide.run }}</code></div>
            <div class="about-options about-modes" role="group" aria-label="选择输入模式">
              <el-button v-for="item in INPUT_MODES" :key="item.key" size="small" :type="item.key === mode ? 'primary' : 'default'" :aria-pressed="item.key === mode" @click="mode = item.key">{{ item.label }}</el-button>
            </div>
            <p class="about-mode-description">{{ selectedMode.description }}</p>
            <div class="about-code-block">
              <div class="about-code-header"><span>{{ guide.source }}<small>{{ selectedLanguage.label }} · {{ selectedMode.label }}</small></span><el-button text size="small" aria-label="复制示例代码" @click="copyCode">复制代码</el-button></div>
              <pre aria-label="完整示例代码" tabindex="0"><code>{{ code }}</code></pre>
            </div>
            <div class="about-samples">
              <div><h3>样例输入</h3><pre aria-label="样例输入">{{ selectedMode.input }}</pre></div>
              <div><h3>样例输出</h3><pre aria-label="样例输出">{{ selectedMode.output }}</pre></div>
            </div>
          </section>

          <section class="about-section about-tips">
            <header><h2>提交前检查</h2></header>
            <ul>
              <li>按题面区分单组、首行 T 组或 EOF 输入；多个测试点与单个输入文件里的多组数据是两回事。</li>
              <li>输出只保留题目要求的答案，每组一行；不要带输入提示、调试日志或多余的说明文字。</li>
              <li>示例假设输入及其和在有符号 64 位整数范围内。C / C++ 使用 long long，Java 使用 long；Python 整数可自动扩展。</li>
              <li>大数据需要同时考虑时间与内存；示例展示基础写法，请根据题目范围选择算法和输入方式。</li>
            </ul>
            <el-alert type="info" :closable="false" title="先看输入格式，再选择模板" description="读到 EOF 的题目不需要读取 T；题面如果要求遇到 0 0 等标记结束，还需在循环内判断终止条件。" />
          </section>
        </div>

        <aside class="about-verdicts" aria-label="判题状态说明">
          <section class="about-section">
            <header><h2>判题状态对照表</h2></header>
            <p class="about-muted">英文名称、状态码与中文含义一一对应。先区分处理中和最终结果，再根据原因排查。</p>
            <div class="about-judge-flow"><span>等待评测</span><span aria-hidden="true">→</span><span>编译与运行</span><span aria-hidden="true">→</span><span>最终结果</span></div>
            <el-table class="about-verdict-table" :data="VERDICT_GUIDES" row-key="code" stripe>
              <el-table-column label="判题状态" width="440">
                <template #default="{ row }"><div class="about-verdict-name"><el-tag :type="row.tone === 'success' ? 'success' : row.tone === 'danger' ? 'danger' : row.tone === 'warning' ? 'warning' : 'info'" effect="light">{{ row.code }}</el-tag><strong>{{ row.english }}</strong><span>{{ row.chinese }}</span></div></template>
              </el-table-column>
              <el-table-column label="含义与排查建议" min-width="280">
                <template #default="{ row }"><div class="about-verdict-description"><p>{{ row.description }}</p><small>{{ row.advice }}</small></div></template>
              </el-table-column>
            </el-table>
          </section>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.about-page{width:100%;max-width:none;margin:0}

.vue-about-title { margin: 0; font-size: 28px; font-weight: 700; }
.vue-about-description { margin: 8px 0 0; color: var(--qoj-color-text-2); }
.about-section { min-width: 0; padding: 0 0 28px; border-bottom: 1px solid var(--qoj-color-border); }
.about-section > header { margin-bottom: 16px; }
.about-section h2 { margin: 0; font-size: 18px; line-height: 1.5; }
.about-page :deep(.el-table) { width: 100%; }
.about-page :deep(.el-table .cell) { white-space: normal; overflow-wrap: anywhere; }
.about-page :deep(.el-table__cell) { vertical-align: top; padding: 14px 0; }
.about-verdict-table :deep(.about-verdict-name > *) { flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
.about-page :deep(.el-button + .el-button) { margin-left: 0; }
.about-page .about-options { display: flex; flex-wrap: wrap; gap: 8px; }
.about-page .about-code-block pre { overflow: auto; }
</style>

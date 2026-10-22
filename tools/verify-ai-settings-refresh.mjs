// Browser E2E: actual React form, deterministic HTTP settings store, no real credentials.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-practice-browser/node_modules/playwright/index.mjs');
const out = process.env.AI_SETTINGS_OUTPUT_DIR || '.runtime/ai-settings-refresh';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(() => sessionStorage.setItem('qoj.adminAccessToken', `e2e.${btoa(JSON.stringify({ sub: 1, role: 'SUPER_ADMIN', exp: 4102444800 }))}.fixture`));
const page = await context.newPage();
page.setDefaultTimeout(10000);
const checks = [], errors = [], writes = [];
let stored = { enabled: true, baseUrl: 'https://ai.example.com/v1', model: 'fixture-model', reasoningEffort: 'high', timeoutMs: 120000, maxCodeChars: 24000, apiKey: 'synthetic-secret-not-for-display' };
let failLoad = false, failSave = false, reads = 0;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/')) { await route.continue(); return; }
  let data = [];
  if (path.endsWith('/settings/system/agent')) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (route.request().method() === 'PUT') {
      if (failSave) { await route.fulfill({ status: 500, json: { code: 50000, message: '测试保存失败', data: null } }); return; }
      const body = route.request().postDataJSON();
      writes.push(body);
      stored = { ...stored, ...body, apiKey: body.apiKey || stored.apiKey };
    } else {
      reads++;
      if (failLoad) { await route.fulfill({ status: 500, json: { code: 50000, message: '测试加载失败', data: null } }); return; }
    }
    data = { ...stored, apiKey: '' };
  } else if (path.endsWith('/me')) data = { id: 1, username: 'preview_admin', displayName: '管理员', role: 'SUPER_ADMIN', permissions: ['*'] };
  else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ' };
  await route.fulfill({ json: { code: 200, message: 'ok', data } });
});
const field = name => page.locator('.arco-form-item').filter({ has: page.locator('label').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
const input = name => field(name).locator('input').first();
const save = page.getByRole('button', { name: '保存', exact: true });
const refresh = page.getByRole('button', { name: '刷新', exact: true });
const waitLoad = async () => {
  await page.waitForFunction(() => !document.querySelector('.arco-card-loading, .arco-spin-loading'));
  await input('Base URL').waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === '保存')?.disabled === false);
};
async function expectConfig() {
  assert.equal(await page.getByRole('switch').getAttribute('aria-checked'), String(stored.enabled));
  assert.equal(await input('Base URL').inputValue(), stored.baseUrl);
  assert.equal(await input('模型').inputValue(), stored.model);
  assert.equal(await input('请求超时').inputValue(), String(stored.timeoutMs));
  assert.equal(await input('代码上下文').inputValue(), String(stored.maxCodeChars));
  assert.equal(await input('API Key').inputValue(), '');
  assert.ok((await field('推理强度').innerText()).includes(stored.reasoningEffort));
}
try {
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/settings/system/agent')), page.goto(`${process.env.AI_SETTINGS_BASE_URL || 'http://127.0.0.1:5173'}/${process.env.AI_SETTINGS_ADMIN_PREFIX || 'auth_ac'}/ai/settings`)]);
  await waitLoad();
  await page.screenshot({ path: `${out}/initial.png`, fullPage: true });
  await expectConfig(); checks.push('初次加载完整回显已启用配置，密钥不回显');
  await refresh.click();
  assert.equal(await save.isDisabled(), true); assert.equal(await refresh.isDisabled(), true);
  await waitLoad(); await expectConfig(); checks.push('手动刷新保留服务端配置，加载中禁止重复操作');
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/settings/system/agent')), page.reload()]); await waitLoad(); await expectConfig(); checks.push('浏览器刷新回显配置');
  await input('模型').fill('updated-fixture-model');
  await field('推理强度').locator('.arco-select').click();
  await page.locator('.arco-select-option').filter({ hasText: /^max$/ }).click();
  await save.click();
  assert.equal(await save.isDisabled(), true); assert.equal(await refresh.isDisabled(), true);
  await page.getByText('AI 配置已保存', { exact: true }).waitFor();
  assert.equal(writes.length, 1); assert.equal(writes[0].enabled, true); assert.equal(writes[0].apiKey, '');
  assert.equal(writes[0].reasoningEffort, 'max');
  assert.equal(stored.apiKey, 'synthetic-secret-not-for-display');
  await refresh.click(); await waitLoad(); await expectConfig(); checks.push('保存后刷新回显新配置，留空保留原密钥');
  checks.push('max 推理强度可选择、保存及刷新回显');
  await page.getByRole('switch').click(); await save.click();
  await page.waitForResponse(r => r.request().method() === 'PUT');
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/settings/system/agent')), page.reload()]); await waitLoad(); await expectConfig(); checks.push('关闭 Agent 后刷新正确回显关闭状态');
  failLoad = true;
  await refresh.click(); await page.getByText('测试加载失败', { exact: false }).first().waitFor();
  assert.equal(await save.isDisabled(), true); checks.push('加载失败禁止保存，避免用默认值覆盖配置');
  failLoad = false;
  await refresh.click(); await waitLoad(); await expectConfig(); checks.push('加载失败后可刷新恢复');
  failSave = true;
  await input('模型').fill('unsaved-model'); await save.click();
  await page.getByText('测试保存失败', { exact: false }).first().waitFor();
  assert.equal(await input('模型').inputValue(), 'unsaved-model');
  failSave = false;
  await refresh.click(); await waitLoad(); await expectConfig(); checks.push('保存失败保留输入，刷新取回原有配置');
  await page.screenshot({ path: `${out}/settings.png`, fullPage: true });
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: errors.length === 0, checks, reads, saves: writes.length, errors }, null, 2));
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
  console.log(JSON.stringify({ checks, errors }));
}

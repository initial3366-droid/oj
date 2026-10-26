import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = '.runtime/problem-performance';
const api = process.env.PERF_API_BASE;
const adminToken = process.env.PERF_ADMIN_TOKEN;
const id = process.env.PERF_PROBLEM_ID;
const prefix = process.env.PERF_API_PREFIX;
assert.ok(api && adminToken && id && prefix, 'Run through verify-problem-performance-http.py');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium' });
const checks = [];
try {
  for (const portal of ['auth_ac', 'teacher']) {
    const token = portal === 'teacher' ? process.env.PERF_TEACHER_TOKEN : adminToken;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await context.addInitScript(value => {
      sessionStorage.setItem('qoj.accessToken', value);
      sessionStorage.setItem('qoj.adminAccessToken', value);
      localStorage.setItem('qoj.teacherAccessToken', value);
    }, token);
    const requests = [];
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      requests.push({ path, method: route.request().method(), bytes: route.request().postDataBuffer()?.length ?? 0 });
      const response = await context.request.fetch(api + path + url.search, {
        method: route.request().method(), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        data: route.request().postDataBuffer() ?? undefined,
      });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(`http://127.0.0.1:31891/${portal}/problems/${id}/edit`);
    await page.getByRole('button', { name: '保存题目并查看测试点', exact: true }).waitFor();
    assert.equal(requests.filter(r => r.path.includes('/test-cases')).length, 0, 'basic editor fetched hidden cases');
    await page.getByRole('button', { name: '保存题目并查看测试点', exact: true }).click();
    await page.locator('.case-card textarea').first().waitFor();
    assert.ok(await page.locator('.case-card textarea').count() > 0, 'test-case editor did not load bodies automatically');
    const writes = () => requests.filter(r => r.path.includes('/test-cases') && r.method !== 'GET');
    await page.getByRole('button', { name: '保存测试数据', exact: true }).click();
    await page.getByText('测试点已保存', { exact: true }).waitFor();
    assert.equal(writes().length, 0, 'unchanged list triggered a write');
    const input = page.locator('.case-card textarea').first();
    await input.waitFor();
    assert.equal(await input.inputValue(), 'second input');
    await page.getByRole('button', { name: '保存测试数据', exact: true }).click();
    await page.getByText('测试点已保存', { exact: true }).first().waitFor();
    assert.equal(writes().length, 0, 'opened but unchanged case triggered a write');
    await input.fill(`browser-${portal}`);
    const saved = page.waitForResponse(response => response.url().endsWith('/test-cases/changes') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '保存测试数据', exact: true }).click();
    await page.locator('.case-card textarea').first().waitFor();
    assert.equal((await saved).status(), 200);
    await page.waitForFunction(value => document.querySelector('.case-card textarea')?.value === value, `browser-${portal}`);
    assert.equal(writes().length, 1);
    assert.ok(writes()[0].path.endsWith('/changes') && writes()[0].bytes < 1100000);
    await page.screenshot({ path: `${output}/editor-${portal}.png`, fullPage: true });
    // Restore a deterministic small case for the next portal run.
    const summary = await context.request.get(api + prefix + `/problems/${id}/test-cases/summary`, { headers: { Authorization: `Bearer ${token}` } });
    const first = (await summary.json()).data[0];
    await context.request.post(api + prefix + `/problems/${id}/test-cases/changes`, { headers: { Authorization: `Bearer ${token}` }, data: { changes: [{ id: first.id, caseNo: first.caseNo, input: 'second input', output: '1 ' .repeat(524288) }], deletedIds: [] } });
    await context.tracing.stop({ path: `${output}/editor-${portal}-trace.zip` });
    checks.push({ portal, noHiddenDataOnBasicEdit: true, noWriteForUnchangedData: true, changedRequestBytes: writes()[0].bytes });
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(`${output}/ui-report.json`, JSON.stringify({ passed: true, checks, scope: 'built Vue frontend against real disposable backend/database' }, null, 2));
console.log(JSON.stringify({ passed: true, portals: checks.length }));

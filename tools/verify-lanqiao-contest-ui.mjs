// Real browser E2E, called by verify-lanqiao-contest-http.py while its isolated backend is alive.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const api = process.env.QOJ_API_BASE;
assert.ok(api, 'Run QOJ_LANQIAO_UI=1 python3 tools/verify-lanqiao-contest-http.py');
const output = path.resolve('artifacts/lanqiao');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      const target = new URL(req.url, api);
      const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host, origin: 'http://127.0.0.1:5173' } }, reply => {
        res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
      return;
    }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let file = path.resolve('dist', '.' + pathname);
    if (!file.startsWith(path.resolve('dist') + path.sep)) file = path.resolve('dist/index.html');
    let data;
    try { data = await fs.readFile(file); } catch { file = path.resolve('dist/index.html'); data = await fs.readFile(file); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(500); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium' });
const checks = [];
try {
  // The app's build-time admin page prefix is auth_ac in this workspace.
  const envText = await fs.readFile('.env', 'utf8');
  const adminPrefix = envText.match(/^VITE_ADMIN_PREFIX=['"]?([^'"\n]+)/m)?.[1] || 'admin';
  for (const portal of ['admin', 'teacher']) {
    const token = process.env[portal === 'admin' ? 'QOJ_ADMIN_TOKEN' : 'QOJ_TEACHER_TOKEN'];
    const cid = process.env[portal === 'admin' ? 'QOJ_CONTEST_ID' : 'QOJ_TEACHER_CONTEST_ID'];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.addInitScript(({ key, token }) => (key.includes("teacher") ? localStorage : sessionStorage).setItem(key, token), {
      key: portal === 'admin' ? 'qoj.adminAccessToken' : 'qoj.teacherAccessToken', token,
    });
    const page = await context.newPage();
    const managementPath = `${base}/${portal === 'admin' ? adminPrefix : 'teacher'}/contests/${process.env.QOJ_MANAGED_ID}`;
    await page.goto(managementPath);
    await page.getByRole('button', { name: '查看完整榜单', exact: true }).click();
    const managementTable = page.locator('.management-score-table');
    await managementTable.locator('tbody tr').nth(3).waitFor();
    const cells = await managementTable.locator('tbody tr').evaluateAll(rows =>
      rows.map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim())));
    assert.deepEqual(cells.map(row => Number(row[3])), [100, 70, 20, 0]);
    assert.deepEqual(await managementTable.locator('tbody tr').evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('td.problem-column')).map(cell => Number(cell.textContent)))), [[34,33,33],[30,20,20],[20,0,0],[0,0,0]]);
    await page.getByRole('button', { name: '刷新榜单', exact: true }).click();
    await managementTable.locator('tbody tr').nth(3).waitFor();
    await page.screenshot({ path: `${output}/${portal}-complete-scoreboard.png`, fullPage: true });
    checks.push({ name: `${portal} renders real complete score-descending table, every problem score and non-submitters before publication`, passed: true });
    await page.goto(`${base}/${portal === 'admin' ? adminPrefix : 'teacher'}/contests/${cid}/edit`);
    await page.getByRole('button', { name: '保存修改', exact: true }).waitFor();
    await page.getByText('总分可自定义，默认 100 分', { exact: false }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: '开启前台榜单', exact: true }).isChecked(), true);
    const external = page.getByRole('checkbox', { name: '开启公开外榜', exact: true });
    if (!await external.isChecked()) await page.locator('label.el-checkbox').filter({ hasText: '开启公开外榜' }).click();
    const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/contests/${cid}`));
    await page.screenshot({ path: `${output}/${portal}-editor.png`, fullPage: true });
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    const response = await saved;
    const result = await response.json();
    assert.equal(result.code, 200, JSON.stringify(result));
    const sent = response.request().postDataJSON();
    assert.equal(sent.type, 'LANQIAO');
    assert.equal(sent.scoreboardEnabled, true);
    assert.equal(sent.publicScoreboardEnabled, true);
    if (portal === 'teacher') {
      // Simulate the clock crossing the end time in the isolated fixture, then publish through the UI.
      const adminApiPrefix = envText.match(/^ADMIN_API_PREFIX=['"]?([^'"\n]+)/m)?.[1] || '/api/admin/v1';
      const ended = await fetch(`${api}${adminApiPrefix}/contests/${cid}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.QOJ_ADMIN_TOKEN}` },
        body: JSON.stringify({ endTime: new Date(Date.now() - 60000).toISOString().slice(0, 19), frozen: false, freezeTime: null }),
      });
      assert.equal((await ended.json()).code, 200);
      await page.goto(`${base}/teacher/contests/${cid}`);
      const publishing = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/contests/${cid}`));
      await page.getByRole('button', { name: '发布成绩榜单', exact: true }).click();
      const published = await (await publishing).json();
      assert.equal(published.code, 200, JSON.stringify(published));
      assert.equal(published.data.resultsPublished, true);
      assert.equal(published.data.scoreboardEnabled, true);
      await page.screenshot({ path: `${output}/teacher-published.png`, fullPage: true });
      checks.push({ name: 'teacher explicitly publishes an ended contest through the detail-page button', passed: true });
    }
    await context.tracing.stop({ path: `${output}/${portal}-trace.zip` });
    checks.push({ name: `${portal} editor loads real contest and persists Lanqiao board fields`, passed: true });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await context.addInitScript(token => sessionStorage.setItem('qoj.accessToken', token), process.env.QOJ_STUDENT_TOKEN);
  const contestPage = await context.newPage();
  await contestPage.goto(`${base}/contests/${process.env.QOJ_CONTEST_ID}?tab=problems`);
  await contestPage.getByRole('tab', { name: '题目列表', exact: true }).click();
  assert.equal(await contestPage.getByRole('tab', { name: '比赛榜单', exact: true }).count(), 0);
  const problemTable = contestPage.locator('.contest-problems-table');
  await problemTable.waitFor();
  assert.equal(await problemTable.getByRole('columnheader', { name: '提交数', exact: true }).count(), 0);
  assert.equal(await problemTable.getByRole('columnheader', { name: '通过数', exact: true }).count(), 0);
  assert.equal(await contestPage.getByRole('tab', { name: '提交列表', exact: true }).count(), 0);
  await contestPage.goto(`${base}/contests/${process.env.QOJ_CONTEST_ID}?tab=submissions`);
  await contestPage.locator('.contest-problems-table').waitFor();
  assert.equal(await contestPage.getByRole('tab', { name: '题目列表', exact: true }).getAttribute('aria-selected'), 'true');
  checks.push({ name: 'Lanqiao hides submissions tab and direct tab URL falls back to problems', passed: true });
  const popup = contestPage.waitForEvent('popup');
  await contestPage.locator('.problem-title').first().click();
  const page = await popup;
  await page.getByRole('button', { name: '提交', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 80, y: 12 } });
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('int main(){return 0;}', { delay: 20 });
  await page.screenshot({ path: `${output}/student-editor.png`, fullPage: true });
  await fs.writeFile(`${output}/editor-diagnostic.json`, JSON.stringify(await page.locator('.monaco-editor').first().innerText()));
  // Submit through the actual editor and live API.
  const receipt = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/submissions'));
  await page.getByRole('button', { name: '提交', exact: true }).click();
  const result = await (await receipt).json();
  assert.equal(result.code, 200, JSON.stringify({result, sent: (await receipt).request().postDataJSON()}));
  assert.equal(result.data.status, 'SUBMITTED');
  await page.locator('.submission-result strong').filter({ hasText: '提交成功' }).waitFor();
  assert.equal(await page.locator('.submission-resources:visible').count(), 0);
  assert.equal((await page.locator('.submission-result').innerText()).trim(), '提交成功');
  await page.screenshot({ path: `${output}/student-receipt.png`, fullPage: true });
  await contestPage.reload();
  await contestPage.locator('.contest-problems-table .el-tag').filter({ hasText: '已提交' }).first().waitFor();
  assert.equal(await contestPage.locator('.contest-problems-table').getByText('已通过', { exact: true }).count(), 0);
  await contestPage.screenshot({ path: `${output}/student-submitted-problems.png`, fullPage: true });
  checks.push({ name: 'Lanqiao problem table hides submission/pass counts and shows submitted after successful receipt and reload', passed: true });
  await context.tracing.stop({ path: `${output}/student-trace.zip` });
  checks.push({ name: 'real student submit displays only successful receipt and no judge metrics', passed: true });
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
await fs.writeFile(`${output}/ui-report.json`, JSON.stringify({ passed: true, checks, scope: 'built Vue frontend + live isolated backend, no API mocks' }, null, 2));
console.log(JSON.stringify({ passed: true, browserChecks: checks.length }));

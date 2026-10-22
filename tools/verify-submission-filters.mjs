import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-practice-browser/node_modules/playwright/index.mjs');
const out = '.runtime/submission-filters';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(() => sessionStorage.setItem('qoj.adminAccessToken', 'fixture'));
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [], requests = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname, q = Object.fromEntries(url.searchParams);
  if (!path.startsWith("/api/")) return route.continue();
  let data = [];
  if (path.endsWith('/me')) data = { id: 1, username: 'admin', displayName: '管理测试', role: 'SUPER_ADMIN' };
  else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ' };
  else if (path.endsWith('/classes')) data = [];
  else if (path.endsWith('/problems')) data = { list: [{ id: 11, title: '筛选测试题' }], total: 1 };
  else if (path.endsWith('/contests')) data = { list: [{ id: 7, title: '筛选测试赛' }], total: 1 };
  else if (path.endsWith('/submission-queue/stats')) {
    requests.push({ type: 'stats', ...q });
    if (q.userId === '101') await new Promise(resolve => setTimeout(resolve, 500));
    data = { waiting: q.userId === '101' ? 101 : q.userId === '202' ? 202 : 1, judging: 0, finished: 0, total: 30, currentConcurrent: 0, maxConcurrent: 2 };
  } else if (path.endsWith('/submission-queue')) {
    requests.push({ type: 'queue', ...q });
    const filtered = ['userId', 'problemId', 'language', 'status'].some(key => q[key]);
    const row = { queueId: 1, submissionId: 1, contestId: 7, contestTitle: '筛选测试赛', problemId: 11, problemTitle: '筛选测试题', userId: Number(q.userId || 1), displayName: `用户 ${q.userId || 1}`, language: q.language || 'cpp17', status: q.status || 'PENDING', statusText: q.status || 'PENDING', priority: 0, submitTime: '2026-10-14T10:00:00', retryCount: 0 };
    data = { total: filtered ? 1 : 30, list: filtered && q.page !== '1' ? [] : [row] };
  } else if (path.endsWith('/submissions')) data = { total: 1, list: [{ id: 1, userId: 1, displayName: '测试学生', problemId: 11, problemTitle: '筛选测试题', language: 'cpp17', status: 'AC' }] };
  await route.fulfill({ json: { code: 200, message: 'ok', data } });
});
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5178';
const prefix = process.env.LAYOUT_ADMIN_PREFIX || 'auth_ac';
const select = label => page.locator('.filters .el-select').nth({ '按题目筛选': 0, '按比赛筛选': 1, '语言': 2, '状态': 3, '排序字段': 4 }[label]);
const choose = async (placeholder, name) => {
  await select(placeholder).click();
  await page.getByRole('option', { name, exact: true }).click();
};
const waitQuery = async expected => {
  await page.locator('.submission-management').waitFor();
  for (let i = 0; i < 100; i++) {
    const latest = requests.filter(r => r.type === 'queue').at(-1);
    if (latest && Object.entries(expected).every(([k,v]) => latest[k] === v)) return latest;
    await page.waitForTimeout(50);
  }
  assert.fail(`Missing query ${JSON.stringify(expected)}; last=${JSON.stringify(requests.at(-1))}`);
};
try {
  await page.goto(`${base}/${prefix}/submissions`);
  await page.locator('.submission-management .el-table').first().waitFor();
  for(const label of ['优先级','重试','分数']) assert.equal(await page.getByRole('columnheader',{name:label,exact:true}).count(),0);

  await page.locator('.el-table__body').getByText('测试学生', { exact: false }).waitFor();
  const headers = await page.locator('.el-table__header th').allTextContents();
  assert.ok(!headers.some(text => ['身份', '判题机'].includes(text.trim())));
  await page.getByPlaceholder('身份类型').fill('STUDENT');
  await page.getByPlaceholder('提交 ID', { exact: true }).fill('99');
  await page.screenshot({ path: `${out}/submissions.png`, fullPage: true });
  // Navigate inside the SPA to exercise reuse of the same component across view props.
  await page.locator('.layout-toolbar').waitFor();
  await page.getByRole('button', { name: '打开搜索面板' }).click();
  await page.getByPlaceholder('搜索菜单').fill('判题队列');
  await page.locator('.command-palette-item').filter({ hasText: '判题队列' }).click();
  await page.waitForURL(`**/${prefix}/judge/queue`);
  await waitQuery({ page: '1' });
  const initial = requests.filter(r => r.type === 'queue').at(-1);
  assert.equal(initial.id, undefined); assert.equal(initial.identityType, undefined);
  await page.locator('.el-switch__core').click(); // Pause polling for deterministic filter assertions.
  await page.locator('.el-pagination .btn-next').click();
  await waitQuery({ page: '2' });
  const start = requests.length;
  await choose('状态', 'PENDING');
  await waitQuery({ page: '1', status: 'PENDING' });
  assert.ok(requests.slice(start).filter(r => r.type === 'queue' && r.status === 'PENDING').every(r => r.page === '1'));
  await select('状态').click();
  assert.equal(await page.getByRole('option', { name: 'FINISHED', exact: true }).count(), 0);
  await page.getByRole('option', { name: 'NOO', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await choose('按题目筛选', '筛选测试题');
  await choose('按比赛筛选', '筛选测试赛');
  await choose('语言', 'Python');
  await waitQuery({ page: '1', status: 'PENDING', problemId: '11', contestId: '7', language: 'python' });
  await choose('排序字段', '提交 ID');
  await waitQuery({ sortBy: 'submissionId' });
  await select('排序字段').click();
  assert.equal(await page.getByRole('option', { name: '分数', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByPlaceholder('用户 ID', { exact: true }).fill('101');
  await waitQuery({ userId: '101' });
  await page.getByPlaceholder('用户 ID', { exact: true }).fill('202');
  await waitQuery({ userId: '202' });
  await page.waitForTimeout(650);
  assert.equal((await page.locator('.queue-stats strong').first().innerText()).trim(), '202');
  await page.screenshot({ path: `${out}/queue-filtered.png`, fullPage: true });
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await waitQuery({ page: '1', sortBy: 'submitTime' });
  const reset = requests.filter(r => r.type === 'queue').at(-1);
  for (const key of ['userId','problemId','contestId','language','status']) assert.equal(reset[key], undefined);
  await page.goto(`${base}/${prefix}/contests/7/judge/queue`);
  await waitQuery({ page: '1', contestId: '7' });
  assert.equal(await select('按比赛筛选').locator('input').isDisabled(), true);
  await page.getByPlaceholder('用户 ID', { exact: true }).fill('202');
  await waitQuery({ userId: '202', contestId: '7' });
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await waitQuery({ contestId: '7', sortBy: 'submitTime' });
  assert.deepEqual(errors, []);
  checks.push('提交列表不显示身份及判题机列', 'SPA 切换视图清除隐藏筛选', '分页后筛选回到第一页', '题目、比赛、语言及状态组合筛选', '状态和排序选项符合队列接口', '迟到统计响应不覆盖最新筛选', '重置筛选，比赛专属队列保留比赛范围');
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: true, fixture: true, checks, requests, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} catch (cause) {
  console.error({ errors, requests }); throw cause;
} finally {
  await page.screenshot({ path: `${out}/last.png`, fullPage: true }).catch(() => {});
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}

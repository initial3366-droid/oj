import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/contest-detail-tabs';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
await context.addInitScript(() => sessionStorage.setItem('qoj.accessToken', `e2e.${btoa(JSON.stringify({ sub: 1, userId: 1, exp: 4102444800 }))}.fixture`));
const page = await context.newPage();
const errors = [], requests = [];
let scenario = {};
const submissions = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, problemId: i % 2 + 1, problemTitle: `测试题${i % 2 + 1}`, status: i % 3 ? 'WA' : 'AC', language: 'cpp17', userId: 1 }));
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/')) return route.continue();
  let data = [];
  if (path.endsWith('/auth/me')) data = { id: 1, username: 'fixture', email: 'fixture@example.com', role: 'STUDENT' };
  else if (path.endsWith('/contests/7')) data = { id: 7, title: '比赛页面检查', description: '比赛介绍内容', type: 'ACM', registered: true, status: 'RUNNING', startTime: '2026-10-01T10:00:00', endTime: '2026-12-01T12:00:00', problems: [{ problemId: 1, contestProblemId: 11, label: 'A', title: '测试题1' }, { problemId: 2, contestProblemId: 12, label: 'B', title: '测试题2' }], audience: 'ALL', registrationType: 'PASSWORD', registrationCount: 8, ...scenario };
  else if (path.endsWith('/scoreboard')) data = { type: 'ACM', boardState: 'LIVE', rows: [], problems: [] };
  else if (path.includes('/submissions')) {
    const q = Object.fromEntries(new URL(route.request().url()).searchParams);
    requests.push(q);
    const filtered = submissions.filter(row => (!q.problemId || row.problemId === Number(q.problemId)) && (!q.status || row.status === q.status));
    const start = (Number(q.page || 1) - 1) * Number(q.pageSize || 20);
    data = { list: filtered.slice(start, start + Number(q.pageSize || 20)), total: filtered.length };
  }
  await route.fulfill({ json: { code: 200, message: 'ok', data } });
});
try {
  await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5173'}/contests/7`);
  await page.getByRole('tab', { name: '题目列表', exact: true }).waitFor();
  assert.equal(await page.locator('.contest-problems-table .el-table__body tbody > tr').count(),2);
  assert.equal(await page.locator('.problem-list').count(),0);
  await page.getByText('ACM / ICPC 赛制', { exact: true }).waitFor();
  await page.getByText('密码报名', { exact: true }).waitFor();
  assert.ok(await page.locator('.clock-countdown > strong').evaluate(el => el.scrollWidth <= el.clientWidth), '桌面倒计时完整显示');
  await page.screenshot({ path: `${out}/overview-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/overview-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '比赛信息手机无横向溢出');
  await page.setViewportSize({ width: 1440, height: 1000 });

  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['比赛介绍', '题目列表', '我的提交', '实时榜单', '提交列表']);
  assert.equal(await page.getByRole('button', { name: '我的提交', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '实时榜单', exact: true }).count(), 0);
  await page.getByRole('tab', { name: '我的提交', exact: true }).click();
  await page.getByRole('table').first().waitFor();
  const myPanel = page.getByRole('tabpanel', { name: '我的提交', exact: true });
  await myPanel.locator('.btn-next').click();
  await page.waitForFunction(() => document.querySelector('[id$="my-submissions"] .el-table__body')?.textContent.includes('测试题'));
  await page.locator('.my-submission-filters .el-select').nth(0).click();
  await Promise.all([page.waitForResponse(response => response.url().includes('/submissions?') && response.url().includes('problemId=2')), page.getByRole('option', { name: 'B 测试题2', exact: true }).click()]);
  assert.equal(requests.at(-1).page, '1');
  assert.equal(requests.at(-1).problemId, '2');
  await page.locator('.my-submission-filters .el-select').nth(1).click();
  await Promise.all([page.waitForResponse(response => response.url().includes('/submissions?') && response.url().includes('status=AC')), page.getByRole('option', { name: 'Accepted', exact: true }).click()]);
  assert.equal(requests.at(-1).problemId, '2');
  assert.equal(requests.at(-1).status, 'AC');
  await page.waitForFunction(() => document.querySelectorAll('[id$="my-submissions"] .el-table__body tbody > tr').length === 7);
  await page.screenshot({ path: `${out}/my-submissions-filtered.png`, fullPage: true });
  await Promise.all([page.waitForResponse(response => response.url().includes('/submissions?') && !response.url().includes('problemId=') && !response.url().includes('status=')), myPanel.getByRole('button', { name: '重置筛选', exact: true }).click()]);
  assert.equal(requests.at(-1).page, '1');
  await page.getByRole('tab', { name: '实时榜单', exact: true }).click();
  await page.getByRole('button', { name: '打开公开外榜', exact: true }).waitFor();
  await page.getByRole('tab', { name: '比赛介绍', exact: true }).click();
  await page.getByRole('tab', { name: '提交列表', exact: true }).click();
  await page.getByRole('table').first().waitFor();
  for (const state of [
    { status: 'NOT_STARTED', startTime: '2030-01-01T10:00:00', endTime: '2030-01-01T12:00:00', progress: 0, label: '未开始' },
    { status: 'ENDED', startTime: '2020-01-01T10:00:00', endTime: '2020-01-01T12:00:00', progress: 100, label: '已结束' },
  ]) {
    scenario = state;
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5173'}/contests/7`);
    await page.locator('.contest-title-row').getByText(state.label, { exact: true }).waitFor();
    await page.getByText(`已进行 ${state.progress}%`, { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/overview-${state.status.toLowerCase()}.png`, fullPage: true });
  }
  scenario = {registered:true,status:'NOT_STARTED',startTime:'2030-01-01T10:00:00',endTime:'2030-01-01T12:00:00'};
  for (const tab of ['', 'problems', 'my-submissions', 'scoreboard', 'submissions']) {
    const before=requests.length;
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5173'}/contests/7${tab ? `?tab=${tab}` : ''}`);
    await page.getByRole('tab',{name:'比赛介绍',exact:true}).waitFor();
    assert.deepEqual(await page.getByRole('tab').allTextContents(),['比赛介绍']);
    assert.equal(await page.getByRole('tab',{name:'比赛介绍',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('button',{name:'比赛未开始',exact:true}).isDisabled(),true);
    assert.equal(requests.length,before,'未开始时不加载提交数据');
  }
  await page.screenshot({path:`${out}/registered-not-started.png`,fullPage:true});
  for(const state of [
    {registered:false,status:'RUNNING',startTime:'2026-10-01T10:00:00',endTime:'2030-01-01T12:00:00',hasPassword:false,tabs:['比赛介绍']},
    {registered:false,status:'ENDED',startTime:'2020-01-01T10:00:00',endTime:'2020-01-01T12:00:00',hasPassword:false,allowAfterEndViewProblem:true,tabs:['比赛介绍']},
    {registered:false,status:'ENDED',startTime:'2020-01-01T10:00:00',endTime:'2020-01-01T12:00:00',hasPassword:true,allowAfterEndViewProblem:true,tabs:['比赛介绍']},
  ]) {
    scenario=state;
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5173'}/contests/7`);
    await page.getByRole('tab',{name:'比赛介绍',exact:true}).waitFor();
    assert.deepEqual(await page.getByRole('tab').allTextContents(),state.tabs);
    if(state.tabs.length===1)assert.equal(await page.getByRole('tab',{name:'比赛介绍',exact:true}).getAttribute('aria-selected'),'true');
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${out}/contest.png`, fullPage: true });
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks: ['恢复我的提交和实时榜单标签，移除题目列表底部快捷按钮', '比赛信息布局、计时进度和报名状态；手机自适应；未开始/已结束状态', '进行中五个标签保留并可切换；已报名未开始只显示介绍，直接访问隐藏标签仍显示介绍', '我的提交按题目、状态组合筛选，跨页筛选回第一页，重置恢复全部记录'], errors }, null, 2));
} finally {
  await page.screenshot({ path: `${out}/last.png`, fullPage: true }).catch(() => {});
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}

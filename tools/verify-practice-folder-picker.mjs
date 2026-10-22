// Browser E2E against the real React UI, with deterministic API fixtures.
// Run Vite first. Set PLAYWRIGHT_MODULE / CHROMIUM_PATH if using another installation.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-practice-browser/node_modules/playwright/index.mjs');
const base = process.env.PICKER_BASE_URL || 'http://127.0.0.1:5173';
const prefix = process.env.PICKER_ADMIN_PREFIX || 'auth_ac';
const out = process.env.PICKER_OUTPUT_DIR || '.runtime/practice-picker';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(() => {
  const token = `e2e.${btoa(JSON.stringify({ sub: 1, role: 'SUPER_ADMIN', exp: 4102444800 }))}.fixture`;
  sessionStorage.setItem('qoj.adminAccessToken', token);
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const checks = [], requests = [], errors = [];
checks.push = (...items) => { console.log(...items); return Array.prototype.push.apply(checks, items); };
page.on('pageerror', error => errors.push(error.message));
const graphTitles = ['最短路径入门', '最短路径与堆优化', '多源最短路径'];
const allProblems = Array.from({ length: 520 }, (_, index) => {
  const i = index + 1;
  return { id: 1000 + i, title: i <= 500 ? (i === 1 ? '初识输入输出' : `基础算法练习 ${i}`) : i <= 515 ? (graphTitles[i - 501] || `图的遍历练习 ${i - 500}`) : `动态规划练习 ${i - 515}`, difficulty: i <= 500 ? 1 : 3, timeLimit: 1000, memoryLimit: 256, tags: i > 515 ? ['动态规划'] : ['图论'], folderId: i <= 500 ? 11 : i <= 515 ? 12 : 13 };
});
const folders = [{ id: 11, name: '入门与基础', problemCount: 500 }, { id: 12, name: '图论专题', problemCount: 15 }, { id: 13, name: '动态规划', problemCount: 5 }];
let practice = null, failNextProblems = false, delayKeyword = '';
let legacyEditorMode = false, failEditorAll = false, permissionDenied = false, failPublication = false;
const course = { id: 7001, title: '算法训练课程', description: '测试课程', term: '2026 秋季', ownerAccountType: 'ADMIN', ownerId: 1, teacherName: '管理员', classIds: [51], classes: [{ id: 51, name: '算法训练一班' }], classId: 51, className: '算法训练一班', status: 'ACTIVE', studentCount: 20, practiceCount: 1 };
let publication = { id: 8001, sourcePracticeId: 9001, courseId: 7001, title: '图论与基础训练 · 已发布实例', description: '已发布实例支持按文件夹补充题目。', displayOrder: 1, startTime: '2026-10-13T08:00:00', endTime: '2026-10-20T18:00:00', studentAccessMode: 'SELECTED_CLASSES', classIds: [51], publicationProblems: [{ problemId: 1001, title: '初识输入输出', visibility: 'VISIBLE' }, { problemId: 1520, title: '动态规划练习 5', visibility: 'HIDDEN' }], problems: [allProblems[0], allProblems[519]] };
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (!path.startsWith('/api/')) { await route.continue(); return; }
  const method = route.request().method();
  requests.push({ path, query: url.search, method });
  let data = [];
  const isPracticeDetail = path.endsWith('/practices/9001') && method === 'GET';
  if ((isPracticeDetail && permissionDenied) || (isPracticeDetail && (legacyEditorMode || failEditorAll)) || (path.endsWith('/practices') && failEditorAll) || (path.endsWith('/problem-folders/options') && legacyEditorMode) || (path.endsWith('/publications/8001') && failPublication)) {
    await route.fulfill({ status: permissionDenied && isPracticeDetail ? 403 : 500, json: { code: permissionDenied && isPracticeDetail ? 40003 : 50000, message: permissionDenied && isPracticeDetail ? '无权访问题单' : '系统错误', data: null } }); return;
  }
  if (path.endsWith('/me')) data = { id: 1, username: 'preview_admin', displayName: '管理员', role: 'SUPER_ADMIN', permissions: ['*'] };
  else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ 后台管理' };
  else if (path.endsWith('/problem-folders/options')) data = folders;
  else if (path.endsWith('/problem-folders')) data = folders;
  else if (path.endsWith('/majors')) data = [{ id: 1, name: '计算机科学' }];
  else if (path.endsWith('/courses/7001/report')) data = { courseId: 7001, practiceCount: 1, students: [] };
  else if (path.endsWith('/courses/7001/practices')) data = [];
  else if (path.endsWith('/courses/7001')) data = course;
  else if (path.endsWith('/courses')) data = { total: 1, list: [course] };
  else if (path.endsWith('/publications/8001')) {
    if (method === 'PUT') { const body = route.request().postDataJSON(); publication = { ...publication, ...body, publicationProblems: body.problems.map(item => ({ ...item, title: allProblems.find(p => p.id === item.problemId)?.title })), problems: body.problems.map(item => allProblems.find(p => p.id === item.problemId)) }; }
    data = publication;
  }
  else if (path.endsWith('/problems')) {
    if (failNextProblems) { failNextProblems = false; await route.fulfill({ status: 500, json: { code: 500, message: '测试：题目加载失败' } }); return; }
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    if (keyword && keyword === delayKeyword) await new Promise(r => setTimeout(r, 1000));
    const folderId = Number(url.searchParams.get('folderId'));
    const filtered = allProblems.filter(p => (!folderId || p.folderId === folderId) && (!keyword || String(p.id) === keyword || p.title.toLowerCase().includes(keyword) || p.tags.some(t => t.includes(keyword))));
    const current = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('pageSize') || 20);
    data = { total: filtered.length, list: filtered.slice((current - 1) * size, current * size) };
  } else if (path.endsWith('/practices') && method === 'POST') {
    const body = route.request().postDataJSON();
    practice = { ...body, id: 9001, ownerAccountType: 'ADMIN', owner: true, canEdit: true, canCopy: true, canPublish: true, createdAt: '2026-10-13T09:00:00', problems: body.problemIds.map(id => allProblems.find(p => p.id === id)) };
    data = practice;
  } else if (path.endsWith('/practices/9001') && method === 'PUT') {
    const body = route.request().postDataJSON(); practice = { ...practice, ...body, problems: body.problemIds.map(id => allProblems.find(p => p.id === id)) }; data = practice;
  } else if (path.endsWith('/practices/9001')) data = practice;
  else if (path.endsWith('/practices')) data = legacyEditorMode
    ? { total: 201, list: url.searchParams.get('page') === '2' ? [practice] : Array.from({ length: 200 }, (_, i) => ({ id: 900000 + i })) }
    : { total: practice ? 1 : 0, list: practice ? [practice] : [] };
  else if (path.endsWith('/settings/site-title')) data = 'QOJ';
  await route.fulfill({ json: { code: 200, message: 'ok', data } });
});
const search = page.getByPlaceholder('搜索题目 ID、名称或标签');
const candidates = page.locator('.arco-card').filter({ has: page.locator('.arco-card-header-title').filter({ hasText: /^选择题目$/ }) });
const selected = page.locator('.arco-card').filter({ has: page.locator('.arco-card-header-title').filter({ hasText: /^已选题目/ }) });
const settle = async () => { await page.waitForFunction(() => !document.querySelector('.arco-table .arco-spin-loading')); };
async function folder(name) {
  await page.locator('[aria-label="题目文件夹"]').click();
  await page.getByText(name, { exact: true }).last().click();
  await settle();
}
async function expectText(locator, text) { await locator.getByText(text, { exact: true }).first().waitFor(); }
async function add(title) { const row = candidates.locator('tr').filter({ hasText: title }); await row.getByRole('button', { name: '添加', exact: true }).click(); }
try {
  await page.goto(`${base}/${prefix}/practices/new`);
  await expectText(candidates, '初识输入输出');
  checks.push('创建页服务端分页加载 520 道题目');
  await page.locator('.arco-form-item').filter({ hasText: '题单名称' }).locator('input').fill('算法基础与图论综合训练');
  await page.getByLabel('题单介绍', { exact: true }).fill('从基础输入输出到图论算法，按专题组合练习。');
  await add('初识输入输出');
  await candidates.locator('.arco-pagination-item').filter({ hasText: /^2$/ }).click();
  await expectText(candidates, '基础算法练习 21');
  await expectText(selected, '初识输入输出');
  checks.push('翻页后已选题目保留');
  await page.locator('[aria-label="题目文件夹"]').click();
  await page.locator('[aria-label="题目文件夹"] input').fill('图论');
  await page.getByText('图论专题（15）', { exact: true }).last().click();
  await expectText(candidates, '最短路径入门');
  checks.push('文件夹名称可搜索，切换文件夹回到第一页');
  await search.fill('最短');
  await expectText(candidates, '共 3 道题目');
  await add('最短路径入门');
  await add('最短路径与堆优化');
  await expectText(selected, '初识输入输出');
  assert.equal(await candidates.getByRole('button', { name: '已添加', exact: true }).count(), 2);
  checks.push('文件夹与关键词组合搜索；跨文件夹选择和去重');
  await page.screenshot({ path: `${out}/create-folder-search.png`, fullPage: true });
  await search.fill('不存在的题目'); await expectText(candidates, '没有匹配的题目');
  await candidates.getByRole('button', { name: '清除搜索', exact: true }).click();
  await expectText(candidates, '最短路径入门');
  checks.push('无结果提示与清除搜索');
  await folder('动态规划（5）');
  await search.fill('1520'); await expectText(candidates, '动态规划练习 5');
  await add('动态规划练习 5');
  checks.push('第 500 条之后的题目可按 ID 搜索并添加');
  failNextProblems = true;
  await search.fill('动态规划');
  await page.getByText('测试：题目加载失败', { exact: true }).waitFor();
  await candidates.getByRole('button', { name: '重试', exact: true }).click();
  await expectText(candidates, '动态规划练习 1');
  await expectText(selected, '初识输入输出');
  checks.push('请求失败可重试，已选题目不丢失');
  delayKeyword = '慢请求';
  await search.fill('慢请求');
  await page.waitForRequest(r => new URL(r.url()).searchParams.get('keyword') === '慢请求');
  await search.fill('1520'); await expectText(candidates, '动态规划练习 5');
  await page.waitForTimeout(1200);
  await expectText(candidates, '动态规划练习 5');
  checks.push('快速切换条件忽略迟到旧响应');
  await page.getByRole('button', { name: '创建题单', exact: true }).click();
  await page.waitForURL(`**/${prefix}/practices`);
  assert.deepEqual(practice.problemIds, [1001, 1501, 1502, 1520]);
  checks.push('创建提交保留全部 ID 及添加顺序');
  await page.goto(`${base}/${prefix}/practices/9001/edit`);
  await expectText(selected, '动态规划练习 5');
  assert.equal(await selected.locator('tbody tr').count(), 4);
  checks.push('按 ID 读取题单，完整回显首屏候选之外的已选题目');
  await folder('图论专题（15）'); await search.fill('最短'); await expectText(candidates, '共 3 道题目');
  await page.screenshot({ path: `${out}/edit-folder-search.png`, fullPage: true });
  await selected.locator('tr').filter({ hasText: '最短路径入门' }).getByRole('button', { name: '移除', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForURL(`**/${prefix}/practices`);
  assert.deepEqual(practice.problemIds, [1001, 1502, 1520]);
  await page.goto(`${base}/${prefix}/practices/9001/edit`);
  await expectText(selected, '动态规划练习 5');
  assert.equal(await selected.locator('tbody tr').count(), 3);
  checks.push('移除后保存并重新编辑，顺序和数量正确');

  legacyEditorMode = true;
  await page.goto(`${base}/${prefix}/practices/9001/edit`);
  await expectText(selected, '动态规划练习 5');
  await folder('图论专题（15）'); await expectText(candidates, '最短路径入门');
  assert.ok(requests.some(request => request.path.endsWith('/practices') && request.query.includes('page=2')));
  checks.push('新版详情和文件夹接口同时 500 时兼容读取旧接口，并找到第二页题单');
  legacyEditorMode = false; failEditorAll = true;
  await page.goto(`${base}/${prefix}/practices/9001/edit`);
  await page.getByText('题单加载失败', { exact: true }).waitFor();
  assert.ok(page.url().endsWith('/practices/9001/edit'));
  assert.ok(await page.getByRole('button', { name: '保存修改', exact: true }).isDisabled());
  failEditorAll = false;
  await page.getByRole('button', { name: '重试加载', exact: true }).click();
  await expectText(selected, '动态规划练习 5');
  checks.push('加载失败停留编辑页、禁用保存，重试恢复');
  permissionDenied = true;
  const beforeDenied = requests.filter(r => r.path.endsWith('/practices')).length;
  await page.goto(`${base}/${prefix}/practices/9001/edit`);
  await page.getByText('无权访问题单', { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.path.endsWith('/practices')).length, beforeDenied);
  permissionDenied = false;
  checks.push('权限错误不触发兼容查询');

  const publicationTable = page.locator('.arco-card').filter({ has: page.locator('.arco-card-header-title').filter({ hasText: /^已选题目/ }) });
  await page.goto(`${base}/${prefix}/practices/publications/8001/edit`);
  await expectText(publicationTable, '动态规划练习 5');
  const hiddenRow = publicationTable.locator('tr').filter({ hasText: '动态规划练习 5' });
  assert.equal(await hiddenRow.getByRole('switch').getAttribute('aria-checked'), 'false');
  await folder('图论专题（15）'); await search.fill('最短'); await expectText(candidates, '共 3 道题目');
  await add('最短路径入门');
  const leftBounds = await candidates.boundingBox();
  const rightBounds = await publicationTable.boundingBox();
  assert.ok(Math.abs(leftBounds.y - rightBounds.y) < 3 && rightBounds.x > leftBounds.x);
  await page.screenshot({ path: `${out}/publication-folder-search.png`, fullPage: true });
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForURL(`**/${prefix}/courses/7001`);
  assert.deepEqual(publication.publicationProblems.map(p => [p.problemId, p.visibility]), [[1001, 'VISIBLE'], [1520, 'HIDDEN'], [1501, 'VISIBLE']]);
  assert.deepEqual(practice.problemIds, [1001, 1502, 1520]);
  await page.goto(`${base}/${prefix}/practices/publications/8001/edit`);
  await expectText(publicationTable, '最短路径入门');
  assert.equal(await publicationTable.locator('tr').filter({ hasText: '动态规划练习 5' }).getByRole('switch').getAttribute('aria-checked'), 'false');
  checks.push('已发布实例按文件夹添加并保存，保留顺序和隐藏状态且不修改源题单');
  await publicationTable.locator('tr').filter({ hasText: '最短路径入门' }).getByRole('button', { name: '移除', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForURL(`**/${prefix}/courses/7001`);
  assert.deepEqual(publication.publicationProblems.map(p => p.problemId), [1001, 1520]);
  checks.push('已发布实例移除题目后保存正确');
  failPublication = true;
  await page.goto(`${base}/${prefix}/practices/publications/8001/edit`);
  await page.getByText('发布实例加载失败', { exact: true }).waitFor();
  assert.ok(page.url().endsWith('/publications/8001/edit'));
  assert.ok(await page.getByRole('button', { name: '保存修改', exact: true }).isDisabled());
  failPublication = false;
  await page.getByRole('button', { name: '重试加载', exact: true }).click();
  await expectText(publicationTable, '动态规划练习 5');
  checks.push('已发布实例加载失败不跳转，可重试恢复');

  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ fixtureApi: true, checks, requests, errors, screenshots: ['create-folder-search.png', 'edit-folder-search.png', 'publication-folder-search.png'] }, null, 2));
  console.log(`PASS ${checks.length} browser scenarios. Artifacts: ${out}`);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  await fs.writeFile(`${out}/failure.json`, JSON.stringify({ error: String(error), text: await page.locator('body').innerText(), requests, errors }, null, 2));
  throw error;
} finally {
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}

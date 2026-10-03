/** Run with Vite at http://127.0.0.1:5173. Writes repeatable evidence to output/beui-problems-page-e2e/. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
for (const location of ['playwright', path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]) {
  try { playwright = require(location); break; } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}
assert.ok(playwright, 'Playwright is required');
const { chromium } = playwright;
let executablePath;
if (!existsSync(chromium.executablePath())) {
  const cache = path.join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter((name) => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1))) : [];
  executablePath = builds.flatMap((build) => ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64'].map((dir) => path.join(cache, build, dir, 'chrome-headless-shell'))).find(existsSync);
}
const output = path.resolve('output/beui-problems-page-e2e');
mkdirSync(output, { recursive: true });
const checks = [];
const errors = [];
const reply = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'ok', data }) });
const problems = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  title: index === 0 ? '星河求和' : `测试题目 ${index + 1}`,
  statement: '题目描述', difficulty: index === 0 ? 1 : 2,
  tags: index === 0 ? ['数学', '入门'] : ['模拟'],
  timeLimit: 1000, memoryLimit: 256, ownerId: 1, acRate: index === 0 ? 82 : 30,
  attemptStatus: index === 0 ? 'AC' : null,
}));
let browser;
let page;
try {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/v1/auth/login') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, message: '测试登录失败' }) });
    if (url.pathname === '/api/v1/problems') return reply(route, { total: problems.length, list: problems });
    if (url.pathname === '/api/v1/settings/frontend') return reply(route, {});
    return reply(route, []);
  });
  await page.goto(`${process.env.QOJ_E2E_FRONTEND || 'http://127.0.0.1:5173'}/problems`);
  page.setDefaultTimeout(7000);
  const rows = page.locator('.problems-table tbody tr');
  await page.getByText('星河求和').waitFor();
  assert.equal(await rows.count(), 20);
  assert.equal(await page.locator('.problems-table').getByText('已通过').count(), 1);
  checks.push('首屏显示 20 题及 beUI 状态徽标');
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  const surfaces = await page.evaluate(() => {
    const color = (selector, property = 'backgroundColor') => getComputedStyle(document.querySelector(selector))[property];
    return {
      nav: color('.front-header-nav'),
      activeNav: color('.front-header-link.is-active'),
      tableHead: color('.problems-table thead th'),
      firstRow: color('.problems-table tbody tr:first-child td'),
      secondRow: color('.problems-table tbody tr:nth-child(2) td'),
      tableBorder: getComputedStyle(document.querySelector('.problems-table-wrap')).borderTopColor,
    };
  });
  assert.notEqual(surfaces.nav, surfaces.activeNav);
  assert.notEqual(surfaces.tableHead, surfaces.firstRow);
  assert.notEqual(surfaces.firstRow, surfaces.secondRow);
  assert.notEqual(surfaces.tableBorder, 'rgba(0, 0, 0, 0)');
  checks.push('导航选中态与表头、隔行底色和边框有清晰区分');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '首页' }).click();
  await page.waitForURL('**/');
  await page.screenshot({ path: path.join(output, 'home.png'), fullPage: true });
  assert.equal(await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '首页' }).getAttribute('aria-current'), 'page');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '题库' }).click();
  await page.getByText('星河求和').waitFor();
  checks.push('首页导航切换与选中状态正常');

  await page.getByRole('button', { name: '下一页' }).click();
  assert.equal(await rows.count(), 5);
  checks.push('下一页显示余下 5 题');

  await page.getByRole('textbox', { name: '搜索题目或标签' }).fill('星河');
  assert.equal(await rows.count(), 1);
  assert.equal(await page.getByText('星河求和').count(), 1);
  checks.push('搜索过滤并将分页复位');

  await page.getByRole('textbox', { name: '搜索题目或标签' }).fill('');
  await page.getByRole('combobox', { name: '搜索难度' }).click();
  await page.getByRole('option', { name: '入门' }).click();
  assert.equal(await rows.count(), 1);
  await page.getByRole('combobox', { name: '搜索标签' }).click();
  await page.getByRole('option', { name: '数学' }).click();
  assert.equal(await rows.count(), 1);
  await page.getByRole('button', { name: '全部状态' }).click();
  await page.getByRole('option', { name: '通过', exact: true }).click();
  assert.equal(await rows.count(), 1);
  checks.push('beUI 多选与状态筛选联动');
  await page.getByRole('button', { name: '清除筛选' }).click();
  assert.equal(await rows.count(), 20);
  checks.push('清除筛选恢复完整列表');

  await page.getByRole('textbox', { name: '搜索题目或标签' }).fill('无匹配题目');
  await page.getByText('未找到匹配的题目，试试调整筛选条件').waitFor();
  checks.push('无结果提示正确显示');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('textbox', { name: '搜索题目或标签' }).fill('');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  assert.equal(await page.getByRole('navigation', { name: '手机导航' }).getByRole('button').count(), 6);
  await page.getByRole('button', { name: '关闭导航菜单' }).click();
  checks.push('手机导航展开和关闭正常');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  assert.equal(await rows.count(), 20);
  assert.equal(await page.locator('.problems-toolbar').evaluate((el) => el.scrollWidth <= el.clientWidth), true);
  checks.push('手机宽度筛选区无横向溢出');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${process.env.QOJ_E2E_FRONTEND || 'http://127.0.0.1:5173'}/login`);
  await page.getByPlaceholder('请输入用户名').fill('example_user');
  await page.getByPlaceholder('请输入密码').fill('example_password');
  assert.equal(await page.getByPlaceholder('请输入用户名').inputValue(), 'example_user');
  assert.equal(await page.getByPlaceholder('请输入密码').inputValue(), 'example_password');
  await page.getByRole('button', { name: '登录账号', exact: true }).click();
  await page.getByText('测试登录失败').waitFor();
  await page.screenshot({ path: path.join(output, 'login.png'), fullPage: true });
  checks.push('登录输入与提交后的错误反馈正常');

  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(`PASS ${checks.length} checks; artifact: ${output}/report.json`);
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
}

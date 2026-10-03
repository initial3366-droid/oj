/** Run with Vite at http://127.0.0.1:5173; evidence in output/beui-contests-list-e2e/. */
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
const output = path.resolve('output/beui-contests-list-e2e');
mkdirSync(output, { recursive: true });
const now = Date.now();
const contests = [
  { id: 11, title: '春季 ACM 挑战赛', type: 'ACM', status: 'RUNNING', audience: 'ALL', registrationType: 'PUBLIC', startTime: new Date(now - 3600000).toISOString(), endTime: new Date(now + 7200000).toISOString(), durationMinutes: 180, participantCount: 36, registered: true },
  { id: 12, title: '周末 OI 模拟赛', type: 'OI', status: 'NOT_STARTED', audience: 'ALL', registrationType: 'PUBLIC', startTime: new Date(now + 86400000).toISOString(), endTime: new Date(now + 97200000).toISOString(), durationMinutes: 180, participantCount: 12, registered: false },
];
const checks = [];
const errors = [];
let browser;
let page;
try {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith('/api/')) return route.continue();
    const data = pathname === '/api/v1/contests' ? { total: contests.length, list: contests } : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'ok', data }) });
  });
  await page.goto(`${process.env.QOJ_E2E_FRONTEND || 'http://127.0.0.1:5173'}/contests`);
  page.setDefaultTimeout(7000);
  await page.getByText('春季 ACM 挑战赛').waitFor();
  assert.equal(await page.locator('.contest-list-item').count(), 2);
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  checks.push('比赛列表与状态卡片渲染两场比赛');

  await page.getByPlaceholder('搜索比赛名称').fill('周末');
  assert.equal(await page.locator('.contest-list-item').count(), 1);
  await page.getByPlaceholder('搜索比赛名称').fill('');
  checks.push('搜索比赛正常');

  await page.getByRole('button', { name: '全部赛制' }).click();
  await page.getByRole('option', { name: 'OI' }).click();
  assert.equal(await page.locator('.contest-list-item').count(), 1);
  assert.equal(await page.getByText('周末 OI 模拟赛').count(), 1);
  checks.push('beUI 赛制选择器正常过滤');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(`PASS ${checks.length} checks; artifact: ${output}/report.json`);
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser?.close(); }

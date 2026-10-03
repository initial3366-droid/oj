/** Run against Vite. Verifies public routes render without JavaScript errors when APIs are unavailable. */
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
const output = path.resolve('output/beui-front-smoke-e2e');
mkdirSync(output, { recursive: true });
const routes = ['/', '/contests', '/practice', '/leaderboard', '/submission-queue', '/login', '/register', '/user/1', '/404'];
const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/v1/settings/frontend') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: {} }) });
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: 'E2E offline' }) });
  });
  const origin = process.env.QOJ_E2E_FRONTEND || 'http://127.0.0.1:5173';
  for (const route of routes) {
    errors = [];
    await page.goto(`${origin}${route}`);
    await page.waitForTimeout(450);
    const result = { route, title: await page.title(), bodyLength: (await page.locator('body').innerText()).length, errors: [...errors] };
    results.push(result);
    if (route === '/contests' || route === '/practice' || route === '/login') await page.screenshot({ path: path.join(output, `${route.slice(1) || 'home'}.png`), fullPage: true });
    assert.equal(errors.length, 0, `${route}: ${errors.join('; ')}`);
    assert.ok(result.bodyLength > 20, `${route} rendered empty`);
  }
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, results }, null, 2));
  console.log(`PASS ${results.length} routes; artifact: ${output}/report.json`);
} catch (error) {
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: false, results, failure: String(error) }, null, 2));
  throw error;
} finally { await browser?.close(); }

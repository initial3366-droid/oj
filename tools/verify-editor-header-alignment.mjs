import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const { chromium } = await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/editor-header-alignment';
await fs.mkdir(out, { recursive: true });
const source = await fs.readFile('src/utils/cipher.ts', 'utf8');
const { encryptId } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64'));
const browser = await chromium.launch({ headless: true, executablePath: '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext();
await context.addInitScript(() => { sessionStorage.setItem('qoj.accessToken', `e2e.${btoa(JSON.stringify({sub:1,role:'STUDENT',exp:4102444800}))}.fixture`); });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith('/auth/me') || path.endsWith('/me') ? { id: 1, username: 'fixture', role: 'STUDENT', email: 'fixture@example.com' } : path.endsWith('/problems/1') ? { id: 1, title: 'A + B', statement: '<p>Calculate a + b.</p>', timeLimit: 1000, memoryLimit: 256, samples: [], tags: [] } : path.includes('/settings/') ? { siteTitle: 'QOJ', judgeEnabled: true, sandboxEnabled: true } : [];
  return route.fulfill({ json: { code: 200, message: 'ok', data } });
});
// Failure cases: mismatched desktop borders, wrapped/overlapping controls, and clipped mobile actions.
const checks = [];
try {
  for (const width of [1920, 1440, 1280, 1024, 850, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186'}/practice/problem/p${encryptId(1)}`);
    await page.locator('.editor-toolbar').waitFor({ timeout: 10000 }).catch(async error => { console.log(page.url(), await page.locator('body').innerText()); throw error; });
    await page.waitForTimeout(300);
    checks.push(await page.evaluate(() => {
      const left = document.querySelector('.problem-header').getBoundingClientRect();
      const toolbar = document.querySelector('.editor-toolbar');
      const right = toolbar.getBoundingClientRect();
      const controls = [...toolbar.querySelectorAll('button,.el-select,.el-switch')].filter(el => el.getBoundingClientRect().width);
      return { width: innerWidth, leftHeight: left.height, rightHeight: right.height, delta: right.bottom - left.bottom, contained: controls.every(el => { const r = el.getBoundingClientRect(); return r.left >= right.left && r.right <= right.right + 1 && r.bottom <= right.bottom; }) };
    }));
    await page.screenshot({ path: `${out}/${width}.png` });
  }
  await fs.writeFile(`${out}/report.json`, JSON.stringify(checks, null, 2));
  console.log(checks);
  assert.ok(checks.every(c => c.contained), 'Toolbar controls must remain visible');
  assert.ok(checks.filter(c => c.width >= 1024).every(c => Math.abs(c.delta) <= 1), 'Desktop header borders must align');
} finally {
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}

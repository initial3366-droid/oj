import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const { chromium } = await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const loadTs = async path => import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(await fs.readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64'));
const { encryptId } = await loadTs('src/utils/cipher.ts');
const { VERDICT_GUIDES } = await loadTs('src/pages/about/guide.ts');
const out = '.runtime/submission-verdict-presentation';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext();
await context.addInitScript(() => sessionStorage.setItem('qoj.accessToken', `e2e.${btoa(JSON.stringify({sub:1,role:'STUDENT',exp:4102444800}))}.fixture`));
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
let status = 'AC';
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith('/me') ? { id: 1, email: 'fixture@example.com', role: 'STUDENT' }
    : path === '/api/v1/submissions' && route.request().method() === 'POST' ? { id: 0, status, timeUsed: 12, memoryUsed: 1024 }
    : path.endsWith('/problems/1') ? { id: 1, title: 'Verdict check', statement: '<p>A + B</p>', timeLimit: 1000, memoryLimit: 256, samples: [], tags: [] }
    : path.includes('/settings/') ? { siteTitle: 'QOJ' } : [];
  return route.fulfill({ json: { code: 200, message: 'ok', data } });
});
// Failure cases: losing the large centered result, unwanted explanatory text,
// alias statuses losing their meaning, and resource data disappearing.
const checks = [];
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186'}/practice/problem/p${encryptId(1)}`);
    for (const guide of [...VERDICT_GUIDES, { ...VERDICT_GUIDES[0], alias: 'ACCEPTED' }, { ...VERDICT_GUIDES[1], alias: 'WRONG_ANSWER' }]) {
      status = guide.alias || guide.code;
      await page.getByRole('button', { name: '提交', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.submission-resources')?.textContent.includes('12 ms'));
      const verdict = page.locator('.submission-result');
      assert.equal(await verdict.locator(':scope > strong').innerText(), guide.chinese);
      assert.equal(await verdict.locator('.el-tag, small, .submission-verdict').count(), 0);
      assert.ok(!(await verdict.innerText()).includes(guide.description));
      assert.ok((await page.locator('.submission-resources').innerText()).includes('12 ms'));
      assert.ok((await page.locator('.submission-resources').innerText()).includes('1024 KB'));
      assert.ok(await verdict.evaluate(el => {
        const title = el.querySelector(':scope > strong');
        const r = title.getBoundingClientRect(), parent = el.getBoundingClientRect();
        return getComputedStyle(title).fontSize === '36px' && Math.abs((r.left + r.right) / 2 - (parent.left + parent.right) / 2) <= 1;
      }));
      checks.push({ width, status, passed: true });
      if (guide.code === 'AC' && !guide.alias) await page.screenshot({ path: `${out}/${width}-accepted.png` });
    }
  }
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(checks, null, 2));
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}
console.log(JSON.stringify({ passed: true, checks: checks.length }));

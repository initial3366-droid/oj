import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const { chromium } = await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/debug-feedback-height';
await fs.mkdir(out, { recursive: true });
const source = await fs.readFile('src/utils/cipher.ts', 'utf8');
const { encryptId } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64'));
const browser = await chromium.launch({ headless: true, executablePath: '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext();
await context.addInitScript(() => sessionStorage.setItem('qoj.accessToken', `e2e.${btoa(JSON.stringify({sub:1,role:'STUDENT',exp:4102444800}))}.fixture`));
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
let compileError = false;
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith('/me') ? { id: 1, email: 'fixture@example.com', role: 'STUDENT' } : path.endsWith('/sandbox/run') ? { status: compileError ? 'CE' : 'AC', output: '3\n'.repeat(30), error: compileError ? 'compiler diagnostic\n'.repeat(60) : '', timeUsed: 1, memoryUsed: 1024 }
    : path.endsWith('/problems/1') ? { id: 1, title: 'Feedback height', statement: '<p>A + B</p>', timeLimit: 1000, memoryLimit: 256, samples: [{ input: '1 2', output: '3' }], tags: [] }
    : path.includes('/settings/') ? { siteTitle: 'QOJ', judgeEnabled: true, sandboxEnabled: true } : [];
  return route.fulfill({ json: { code: 200, message: 'ok', data } });
});
// Failure cases: tiny output after execution, long diagnostics displacing output,
// short/mobile screens overflowing the editor, and broken manual resizing.
const checks = [];
try {
  for (const [width, height] of [[1440, 900], [1280, 650], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186'}/practice/problem/p${encryptId(1)}`);
    await page.getByRole('button', { name: '调试', exact: true }).click();
    for (const error of [false, true]) {
      compileError = error;
      await page.getByRole('button', { name: '运行调试', exact: true }).click();
      await page.locator('.debug-metrics').waitFor();
      if (error) await page.locator('.debug-error').waitFor();
      const metrics = await page.evaluate(() => {
        const panel = document.querySelector('.debug-panel').getBoundingClientRect();
        const output = document.querySelector('[aria-label="调试输出"]').getBoundingClientRect();
        const diagnostic = document.querySelector('.debug-error');
        return { panelHeight: panel.height, outputHeight: output.height, bottom: panel.bottom, diagnosticHeight: diagnostic?.getBoundingClientRect().height };
      });
      checks.push({ width, height, error, ...metrics });
      assert.ok(metrics.outputHeight >= 140);
      assert.ok(metrics.bottom <= height + 1);
      if (width > 620) {
        assert.ok(metrics.panelHeight >= height * 0.48);
        if (error) assert.ok(metrics.diagnosticHeight < metrics.panelHeight * 0.4);
      }
      await page.screenshot({ path: `${out}/${width}-${error ? 'error' : 'output'}.png` });
    }
    const handle = page.getByRole('separator', { name: '上下调整调试面板高度' });
    const before = Number(await handle.getAttribute('aria-valuenow'));
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(Number(await handle.getAttribute('aria-valuenow')), before + 20);
  }
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(checks, null, 2));
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}
console.log(JSON.stringify({ passed: true, checks: checks.length }));

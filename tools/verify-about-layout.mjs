import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/about-layout';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
await page.route('**/api/**', route => route.fulfill({ json: { code: 200, data: { siteTitle: 'QOJ' } } }));
const checks = [];
// Failure cases: page-wide overflow, overlapping sections, wrapped status identities,
// truncated long status codes, and broken language/input-mode controls.
try {
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186'}/about`);
    await page.locator('.about-verdict-name').first().waitFor();
    const metrics = await page.evaluate(() => {
      const identities = [...document.querySelectorAll('.about-verdict-name')].map(el => {
        const rects = [...el.children].map(child => child.getBoundingClientRect());
        return { inline: rects.every(r => Math.abs((r.top + r.bottom) / 2 - (rects[0].top + rects[0].bottom) / 2) <= 1), separated: rects.slice(1).every((r, i) => r.left >= rects[i].right - 1), fits: el.scrollWidth <= el.clientWidth + 1 };
      });
      const sections = [...document.querySelectorAll('.about-section')].map(el => el.getBoundingClientRect());
      return { overflow: document.documentElement.scrollWidth - innerWidth, identities, sectionsSeparated: sections.slice(1).every((r, i) => r.top >= sections[i].bottom - 1) };
    });
    assert.ok(metrics.overflow <= 1, `Page overflow at ${width}`);
    assert.equal(metrics.identities.length, 15);
    assert.ok(metrics.identities.every(m => m.inline && m.separated && m.fits), `Status wrapping/overlap at ${width}`);
    assert.ok(metrics.sectionsSeparated);
    await page.getByRole('group', { name: '选择示例语言' }).getByRole('button', { name: 'Java', exact: true }).click();
    await page.getByRole('group', { name: '选择输入模式' }).getByRole('button', { name: '多组：首行 T', exact: true }).click();
    assert.ok((await page.getByLabel('完整示例代码', { exact: true }).innerText()).includes('int t ='));
    await page.screenshot({ path: `${out}/${width}.png`, fullPage: true });
    checks.push({ width, ...metrics });
  }
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(checks, null, 2));
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}
console.log(JSON.stringify({ passed: true, viewports: checks.length }));

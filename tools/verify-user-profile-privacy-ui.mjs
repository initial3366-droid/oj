import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = '.runtime/security-remediation';
const profile = JSON.parse(await fs.readFile(`${output}/user-profile-fixture.json`, 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium' });
const checks = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    // UI rendering uses the sanitized profile saved by the real HTTP E2E.
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const data = path === `/api/v1/users/${profile.id}` ? profile :
        path.includes('settings') ? { siteTitle: 'QOJ' } : [];
      await route.fulfill({ json: { code: 200, message: 'ok', data } });
    });
    const page = await context.newPage();
    await page.goto(`${process.env.QOJ_UI_BASE || 'http://127.0.0.1:31891'}/users/${profile.id}`);
    await page.locator('.user-profile-heading h2').waitFor();
    const heading = await page.locator('.user-profile-heading').innerText();
    assert.equal((await page.locator('.user-profile-heading h2').innerText()).trim(), 'Public Name');
    assert.ok(!heading.includes('private_login_name'));
    assert.equal(await page.locator('.user-profile-heading .el-tag').count(), 0);
    const content = await page.locator('.user-profile-card').innerText();
    assert.ok(content.includes('非比赛 AC') && content.includes('200'));
    for (const secret of ['private_login_name', 'secret_admin_login', 'private@example.invalid', 'STUDENT', '加入时间']) {
      assert.ok(!content.includes(secret), `Profile leaked ${secret}`);
    }
    await page.screenshot({ path: `${output}/user-profile-${width}.png`, fullPage: true });
    await context.tracing.stop({ path: `${output}/user-profile-${width}-trace.zip` });
    checks.push({ width, minimalProfileRendered: true, loginAndInternalFieldsAbsent: true });
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(`${output}/user-profile-ui-report.json`, JSON.stringify({ passed: true, checks,
  scope: 'built frontend rendering with sanitized fixture from real HTTP E2E',
  command: 'node tools/verify-user-profile-privacy-ui.mjs' }, null, 2));
console.log(JSON.stringify({ passed: true, viewports: checks.length }));

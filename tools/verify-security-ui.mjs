import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base = process.env.QOJ_UI_BASE || 'http://127.0.0.1:5186';
const output = '.runtime/security-remediation';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const checks = [], errors = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    let challenge = 0, loginBody;
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [], code = 200, message = 'ok';
      if (path.endsWith('/captcha/image')) data = { captchaId: `fixture-${++challenge}`, image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
      else if (path.endsWith('/auth/login')) { loginBody = route.request().postDataJSON(); code = 40001; message = '账号或密码错误'; }
      else if (path.endsWith('/me')) data = { id: 1, userId: 1, username: 'security-fixture', displayName: 'Security Teacher', role: 'TEACHER' };
      else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ' };
      else if (path.endsWith('/classes')) data = [{ id: 1, name: 'Security E2E' }];
      else if (path.endsWith('/students/import-file')) data = { successCount: 1, failureCount: 0, successes: [{ rowNumber: 2, studentNo: '2026000001', displayName: 'Fixture Student', initialPassword: 'fixture-only-12345678' }], errors: [] };
      await route.fulfill({ json: { code, message, data } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.getByPlaceholder('请输入验证码', { exact: true }).waitFor();
    const initial = challenge;
    await page.getByPlaceholder('请输入用户名', { exact: true }).fill('security-fixture');
    await page.getByPlaceholder('请输入密码', { exact: true }).fill('fixture-password');
    await page.getByPlaceholder('请输入验证码', { exact: true }).fill('1234');
    await page.locator('form').getByRole('button', { name: '登录账号', exact: true }).click();
    await page.getByText('账号或密码错误', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('input[placeholder="请输入验证码"]')?.value === '');
    assert.ok(loginBody.captchaId && loginBody.captcha === '1234');
    assert.ok(challenge > initial, 'Failed login must request a fresh single-use challenge');
    await page.screenshot({ path: `${output}/login-${viewport.width}.png`, fullPage: true });
    checks.push({ viewport, loginChallengeSubmittedAndRefreshed: true });
    await page.evaluate(() => localStorage.setItem('qoj.teacherAccessToken', 'fixture'));
    await page.goto(`${base}/teacher/import`);
    await page.locator('.import-form .el-select__wrapper').click();
    await page.getByRole('option', { name: 'Security E2E（1）' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'security-fixture.csv', mimeType: 'text/csv', buffer: Buffer.from('学号,姓名\n2026000001,Fixture Student\n') });
    await page.getByRole('button', { name: '开始导入', exact: true }).click();
    const password = page.getByLabel('初始密码', { exact: true });
    await password.waitFor();
    assert.equal(await password.getAttribute('type'), 'password');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载初始密码', exact: true }).click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let content = '';
    for await (const chunk of stream) content += chunk.toString('utf8');
    assert.ok(content.includes('2026000001') && content.includes('fixture-only-12345678'));
    assert.ok(await page.evaluate(() => !JSON.stringify(localStorage).includes('fixture-only-12345678')));
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
    await page.screenshot({ path: `${output}/import-${viewport.width}.png`, fullPage: true });
    checks.push({ viewport, maskedRandomPasswordVisible: true, csvDownloadVerified: true, noCredentialPersistence: true, noPageOverflow: true });
    await context.tracing.stop({ path: `${output}/ui-${viewport.width}.zip` });
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await fs.writeFile(`${output}/ui-report.json`, JSON.stringify({ passed: checks.length === 4 && errors.length === 0, checks, errors, fixturesOnly: true }, null, 2));
}
console.log(`PASS ${checks.length} browser workflows; ${output}/ui-report.json`);

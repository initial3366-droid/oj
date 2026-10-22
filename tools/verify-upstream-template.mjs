import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-practice-browser/node_modules/playwright/index.mjs');
const out = '.runtime/upstream-template';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(() => {
  if (!location.href.startsWith('http')) return;
  sessionStorage.setItem('qoj.adminAccessToken', 'fixture');
  localStorage.setItem('qoj.teacherAccessToken', 'fixture');
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [], checks = [], loginRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.text().includes('Failed to resolve component')) errors.push(message.text()); });
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/')) return route.continue();
  let data = [];
  if (path.endsWith('/auth/login')) { loginRequests.push(route.request().postDataJSON()); data = { accessToken: 'fixture', refreshToken: 'fixture-refresh' }; }
  else if (path.endsWith('/me')) data = { id: 1, username: 'template_admin', displayName: '模板验证', role: 'SUPER_ADMIN' };
  else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ' };
  else if (path.endsWith('/dashboard')) { await route.fulfill({ status: 503, json: { code: 503, message: 'E2E fixture: dashboard intentionally unavailable' } }); return; }
  else if (path.endsWith('/majors')) data = [];
  else if (path.endsWith('/captcha/image')) data = { captchaId: 'fixture', image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjx0ZXh0IHg9IjEwIiB5PSIyOCI+MTIzNDwvdGV4dD48L3N2Zz4=' };
  await route.fulfill({ json: { code: 200, message: 'ok', data } });
});
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5178';
const prefix = process.env.LAYOUT_ADMIN_PREFIX || 'auth_ac';
try {
  await page.goto(`${base}/${prefix}/profile`);
  await page.locator('.layout-root').waitFor();
  await page.locator('.layout-content .el-input').first().waitFor();
  assert.equal(await page.locator('.layout-content header p').count(), 0);
  const menuGroups = page.locator('.layout-sidebar .el-sub-menu__title');
  for (let i = 0; i < await menuGroups.count(); i++) await menuGroups.nth(i).click();
  const menuEntries = page.locator('.layout-sidebar .el-menu-item, .layout-sidebar .el-sub-menu__title');
  assert.ok(await menuEntries.count() === 29);
  for (let i = 0; i < await menuEntries.count(); i++) {
    const entry = menuEntries.nth(i);
    assert.equal(await entry.locator('.menu-icon svg').count(), 1, `Missing navigation icon: ${await entry.innerText()}`);
  }
  checks.push('后台全部导航分组及子菜单均渲染功能图标，个人信息页无介绍文案');
  await page.screenshot({ path: `${out}/admin-initial.png`, fullPage: true });
  await page.locator('.layout-toolbar').waitFor();
  await page.getByRole('button', { name: '打开搜索面板' }).click();
  await page.getByPlaceholder('搜索菜单').fill('专业管理');
  await page.locator('.command-palette-item').filter({ hasText: '专业管理' }).click();
  await page.waitForURL(`**/${prefix}/majors`);
  assert.equal(await page.locator('.layout-content header p').count(), 0);
  await page.getByRole('button', { name: '新增专业', exact: true }).click();
  await page.locator('.el-dialog').filter({ hasText: '新增专业' }).waitFor();
  await page.screenshot({ path: `${out}/admin-dialog.png`, fullPage: true });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  checks.push('原版菜单搜索跳转，QOJ 专业管理及弹窗');
  await page.locator('.layout-tabs__item').filter({ hasText: '个人信息' }).click();
  await page.waitForURL(`**/${prefix}/profile`);
  await page.getByRole('button', { name: '刷新当前', exact: true }).click();
  await page.waitForURL(`**/${prefix}/profile`);
  await page.locator('.layout-content .el-input').first().waitFor();
  assert.ok(await page.locator('.layout-tabs__item').count() >= 2);
  checks.push('原版标签切换与刷新，保留后台路由前缀');
  await page.locator('.hamburger-wrapper').click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.layout-sidebar').evaluate(el => Math.round(el.getBoundingClientRect().width)), 54);
  await page.screenshot({ path: `${out}/admin-collapsed.png`, fullPage: true });
  await page.locator('.hamburger-wrapper').click();
  checks.push('原版侧栏折叠、展开');
  await page.locator('.layout-toolbar__item').last().click();
  await page.locator('.settings-drawer').waitFor();
  await page.screenshot({ path: `${out}/template-settings.png`, fullPage: true });
  await page.locator('.settings-drawer .el-radio-button').filter({ hasText: '暗黑' }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.screenshot({ path: `${out}/admin-dark.png`, fullPage: true });
  await page.locator('.settings-drawer .el-radio-button').filter({ hasText: '明亮' }).click();
  for (const mode of ['top', 'mix', 'double', 'left']) {
    await page.locator(`.settings-layout-select__item.${mode}`).click();
    await page.locator(`.layout-root.layout--${mode}`).waitFor();
    await page.screenshot({ path: `${out}/layout-${mode}.png`, fullPage: true });
  }
  checks.push('原版暗色主题与四种布局模式');
  await page.locator('.settings-drawer .el-drawer__close-btn').click();
  checks.push('原版主题与布局设置抽屉');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.hamburger-wrapper').click();
  await page.locator('.layout-root__overlay').waitFor();
  await page.screenshot({ path: `${out}/admin-mobile-menu.png`, fullPage: true });
  await page.locator('.layout-root__overlay').click({ position: { x: 360, y: 600 } });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push('原版移动端菜单及遮罩，无页面横向溢出');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/teacher/profile`);
  await page.locator('.layout-toolbar').waitFor();
  await page.locator('.layout-content .el-input').first().waitFor();
  await page.screenshot({ path: `${out}/teacher-desktop.png`, fullPage: true });
  checks.push('教师端原版布局与 QOJ 资料表单');
  await page.goto(`${base}/${prefix}/login`);
  await page.locator('.login-card').waitFor();
  await page.getByPlaceholder('用户名', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/admin-login.png`, fullPage: true });
  await page.getByPlaceholder('用户名', { exact: true }).fill('fixture_admin');
  await page.getByPlaceholder('密码', { exact: true }).fill('fixture-password');
  await page.getByPlaceholder('验证码', { exact: true }).fill('1234');
  await page.locator('.login-card__submit').click();
  await page.waitForURL(`**/${prefix}/dashboard`);
  assert.equal(loginRequests.length, 1);
  assert.equal(loginRequests[0].captchaId, 'fixture');
  assert.equal(loginRequests[0].captchaCode, '1234');
  checks.push('原版登录页、验证码及 QOJ 管理员登录接口契约');
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, errors }, null, 2));
} finally {
  await page.screenshot({ path: `${out}/last.png`, fullPage: true }).catch(() => {});
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await browser.close();
}

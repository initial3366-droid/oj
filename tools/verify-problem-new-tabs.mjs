import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/problem-new-tabs';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const checks = [];
try {
  // Cover both persistence modes, both library entry points, contest parameters,
  // unchanged source-page filters, detached openers, and authenticated editor loading.
  for (const mode of ['session', 'persistent', 'no-locks', 'no-channel', 'blocked']) {
    const sessionOnly = mode !== 'persistent';
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const token = `e2e.${Buffer.from(JSON.stringify({ sub: 1, role: 'STUDENT', exp: 4102444800 })).toString('base64url')}.fixture`;
    const refreshToken = `e2e.${Buffer.from(JSON.stringify({ sub: 1, familyId: 'tab-fixture', exp: 4102444800 })).toString('base64url')}.refresh`;
    await context.addInitScript(({ token, refreshToken, sessionOnly, mode }) => {
      if (mode === 'no-locks') Object.defineProperty(navigator, 'locks', { value: undefined });
      if (mode === 'no-channel') Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
      if (mode === 'blocked') window.open = () => null;
      if (location.pathname === '/problems' || location.pathname === '/contests/1') {
        (sessionOnly ? sessionStorage : localStorage).setItem('qoj.accessToken', token);
        (sessionOnly ? sessionStorage : localStorage).setItem('qoj.refreshToken', refreshToken);
      }
    }, { token, refreshToken, sessionOnly, mode });
    const problem = { id: 1, title: 'New tab problem', statement: '<p>Calculate a + b.</p>', difficulty: 1, tags: [], samples: [], timeLimit: 1000, memoryLimit: 256 };
    await context.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith('/me') ? { id: 1, username: 'fixture', email: 'fixture@example.com', role: 'STUDENT' }
        : path === '/api/v1/problems' ? { list: [problem], total: 1 }
        : /\/problems\/\d+$/.test(path) ? problem
        : path === '/api/v1/contests/1' ? { id: 1, title: 'Tab contest', registered: true, status: 'RUNNING', type: 'ACM', audience: 'ALL', startTime: '2026-01-01T00:00:00', endTime: '2099-01-01T00:00:00', problems: [{ problemId: 1, contestProblemId: 7, label: 'A', title: problem.title }] }
        : path.includes('/settings/') ? { siteTitle: 'QOJ', judgeEnabled: true, sandboxEnabled: true } : [];
      return route.fulfill({ json: { code: 200, message: 'ok', data } });
    });
    const page = await context.newPage();
    const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186';
    try {
      for (const entry of ['library-title', 'library-answer', 'contest-title']) {
        const contest = entry === 'contest-title';
        await page.goto(base + (contest ? '/contests/1?tab=problems' : '/problems'));
        if (!contest) await page.getByPlaceholder('搜索题目或标签').fill('New tab');
        const sourceUrl = page.url();
        if (mode === 'blocked') {
          const dialogPromise = page.waitForEvent('dialog').then(async dialog => {
            assert.ok(dialog.message().includes('新标签页'));
            await dialog.dismiss();
          });
          await page.locator(contest ? '.problem-title' : entry === 'library-title' ? '.problems-title-link' : '.problems-action-link').first().click({ noWaitAfter: true });
          await dialogPromise;
          assert.equal(page.url(), sourceUrl);
          checks.push({ mode, entry, sourceUrl, blocked: true, passed: true });
          continue;
        }
        const popupPromise = page.waitForEvent('popup', { timeout: 8000 });
        await page.locator(contest ? '.problem-title' : entry === 'library-title' ? '.problems-title-link' : '.problems-action-link').first().click();
        const popup = await popupPromise;
        await popup.waitForURL('**/practice/problem/**');
        await popup.locator('.editor-toolbar').waitFor();
        const url = new URL(popup.url());
        assert.equal(page.url(), sourceUrl);
        if (!contest) assert.equal(await page.getByPlaceholder('搜索题目或标签').inputValue(), 'New tab');
        assert.equal(await popup.evaluate(() => window.opener === null), true);
        assert.equal(await popup.evaluate(() => sessionStorage.getItem('qoj.accessToken') || localStorage.getItem('qoj.accessToken')), token);
        assert.equal(await popup.evaluate(() => sessionStorage.getItem('qoj.refreshToken') || localStorage.getItem('qoj.refreshToken')), mode === 'no-locks' || mode === 'no-channel' ? null : refreshToken);
        if (contest) {
          assert.ok(url.pathname.includes('/cp'));
          assert.equal(url.searchParams.get('contestId'), '1');
          assert.equal(url.searchParams.get('contestProblemLabel'), 'A');
          assert.ok((await popup.locator('.problem-heading').innerText()).includes('A -'));
        }
        await popup.screenshot({ path: `${out}/${mode}-${entry}.png` });
        checks.push({ mode, entry, sourceUrl, editorUrl: popup.url(), passed: true });
        await popup.close();
      }
    } finally {
      await context.tracing.stop({ path: `${out}/${mode}-trace.zip` });
      await context.close();
    }
  }
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(checks, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: true, checks: checks.length }));

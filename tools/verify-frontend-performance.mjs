import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = process.env.AUDIT_OUTPUT || '.runtime/frontend-performance/after';
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5186';
const optimized = process.env.PERFORMANCE_EXPECT_LAZY === '1';
const audit = JSON.parse(await fs.readFile(`${output}/build-audit.json`, 'utf8'));
const monacoChunks = audit.chunks.filter(chunk => chunk.modules.some(name => name.includes('/monaco-editor/'))).map(chunk => chunk.file);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const errors = [], results = [];
let passed = false;
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      await context.addInitScript(() => {
        localStorage.setItem('qoj.teacherAccessToken', 'fixture');
        window.__longTasks = [];
        new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true });
      });
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data = [];
        if (path.endsWith('/me')) data = { id: 1, userId: 1, username: 'fixture', displayName: 'Performance Teacher', role: 'TEACHER' };
        else if (path.endsWith('/settings/frontend')) data = { siteTitle: 'QOJ' };
        else if (path.endsWith('/classes')) data = [{ id: 1, name: 'Class 1' }];
        else if (path.endsWith('/dashboard')) data = { todaySubmissionCount: 0, todayAcceptedCount: 0, todayActiveUserCount: 0, activeContestCount: 0, totalStats: { userCount: 0, problemCount: 0, submissionCount: 0, passRate: 0 }, verdictDistribution: [], submissionTrend: [], difficultyDistribution: [], hourlyActivity: [], languageUsage: [], userGrowth: [], topProblems: [], recentContests: [] };
        else if (path.endsWith('/submissions')) data = { total: 1, list: [{ id: 1, userId: 1, displayName: 'Student', problemTitle: 'Performance Problem', language: 'cpp17', status: 'AC', submitTime: '2026-10-19T10:00:00' }] };
        else if (path.endsWith('/submissions/1/code')) data = '// performance fixture\nint main() { return 0; }';
        await route.fulfill({ json: { code: 200, message: 'ok', data } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (/Failed to resolve (?:component|directive)|Unhandled error/.test(message.text())) errors.push(message.text());
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`${base}/teacher/submissions`);
      await page.getByRole('button', { name: '查看代码', exact: true }).waitFor();
      const listing = await page.evaluate(() => ({ readyMs: performance.now(), resources: performance.getEntriesByType('resource').filter(item => /\.js(?:\?|$)/.test(item.name)).map(item => ({ name: new URL(item.name).pathname.slice(1), bytes: item.decodedBodySize })), longTasks: window.__longTasks }));
      const initialMonaco = listing.resources.filter(item => monacoChunks.includes(item.name));
      if (optimized) assert.equal(initialMonaco.length, 0, 'Listing must not load Monaco');
      // On narrow tables the action column is horizontally offscreen.
      const button = page.getByRole('button', { name: '查看代码', exact: true });
      await button.scrollIntoViewIfNeeded();
      const start = Date.now();
      await button.click();
      await page.locator('.el-dialog .monaco-editor').waitFor();
      await page.locator('.el-dialog .view-lines').getByText('int main()', { exact: false }).waitFor();
      const editorReadyMs = Date.now() - start;
      const modelCount = () => page.evaluate(async file => {
        const module = await import(`/${file}`);
        const api = Object.values(module).map(value => value?.monaco || value).find(value => value?.editor?.getModels);
        if (!api) throw new Error('Cannot inspect Monaco models');
        return api.editor.getModels().length;
      }, monacoChunks[0]);
      if (optimized) assert.equal(await modelCount(), 1);
      await page.screenshot({ path: `${output}/editor-${viewport.width}-${run}.png` });
      await page.getByRole('dialog').locator('.el-dialog__headerbtn').click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      // Navigate through the actual sidebar, so component teardown runs without a reload.
      if (viewport.width >= 1024) {
        await page.getByRole('menuitem', { name: /工作概览/ }).click();
        await page.waitForURL('**/teacher/dashboard');
        if (optimized) await page.waitForFunction(async file => {
          const module = await import(`/${file}`);
          const api = Object.values(module).map(value => value?.monaco || value).find(value => value?.editor?.getModels);
          return api.editor.getModels().length === 0;
        }, monacoChunks[0]);
        await page.getByRole('menuitem', { name: /提交记录/ }).click();
        await page.waitForURL('**/teacher/submissions');
        await page.getByRole('button', { name: '查看代码', exact: true }).click();
        await page.locator('.el-dialog .monaco-editor').waitFor();
        await page.locator('.el-dialog .view-lines').getByText('int main()', { exact: false }).waitFor();
      }
      results.push({ viewport, run, ...listing, initialMonacoBytes: initialMonaco.reduce((sum, item) => sum + item.bytes, 0), editorReadyMs });
      await context.tracing.stop({ path: `${output}/trace-${viewport.width}-${run}.zip` });
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  passed = true;
} finally {
  await fs.writeFile(`${output}/browser-report.json`, JSON.stringify({ passed, fixture: true, cpuThrottlingRate: 4, results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results.map(({ viewport, run, readyMs, initialMonacoBytes, editorReadyMs }) => ({ width: viewport.width, run, readyMs, initialMonacoBytes, editorReadyMs })), null, 2));

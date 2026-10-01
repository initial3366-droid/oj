/**
 * Run against the local frontend, backend and qoj-mysql container:
 *   node tools/e2e/admin-ai-history.mjs
 * Optional: QOJ_E2E_RESTART_BACKEND=1 also verifies survival across a backend restart.
 * Optional: QOJ_E2E_LIVE_TITLES=1 verifies title generation using the configured AI provider.
 * Playwright is resolved from the installed package or PLAYWRIGHT_MODULE_PATH.
 * Uses disposable admin accounts; provider SSE is simulated, persistence is real.
 * Writes report.json and browser screenshots under output/admin-ai-history-e2e/.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
  try { playwright = require(location); break; } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}
assert.ok(playwright, 'Install Playwright or configure PLAYWRIGHT_MODULE_PATH');
const { chromium } = playwright;
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && !existsSync(chromium.executablePath())) {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter((name) => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1))) : [];
  executablePath = builds.flatMap((build) => ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']
    .map((directory) => path.join(cache, build, directory, 'chrome-headless-shell'))).find(existsSync);
}
const root = process.cwd();
const env = Object.fromEntries(readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]; }));
const prefix = env.ADMIN_PATH_PREFIX || env.VITE_ADMIN_PREFIX || 'admin';
const frontend = process.env.QOJ_E2E_FRONTEND || 'http://127.0.0.1:5173';
const backend = process.env.QOJ_E2E_BACKEND || `http://127.0.0.1:${env.SERVER_PORT || 18080}`;
const api = `/api/${prefix}/v1/agent/chat/sessions`;
const historyKey = 'qoj.admin.ai-chat-history.v1';
const output = path.join(root, 'output/admin-ai-history-e2e');
mkdirSync(output, { recursive: true });
const checks = [];
const pageErrors = [];
const run = Date.now();
const usernames = [`e2e-chat-${run}-a`, `e2e-chat-${run}-b`];
const sql = (query) => execFileSync('docker', ['exec', '-i', 'qoj-mysql', 'sh', '-c',
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -D qoj --default-character-set=utf8mb4 --batch --skip-column-names'],
{ input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

function token(id) {
  const secret = env.JWT_SECRET;
  assert.ok(secret, 'JWT_SECRET must be configured locally');
  const bytes = Buffer.byteLength(secret);
  const bits = bytes >= 64 ? 512 : bytes >= 48 ? 384 : 256;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: `HS${bits}` })}.${encode({ sub: String(id), jti: randomUUID(), typ: 'access', accountType: 'ADMIN', iat: now, exp: now + 3600 })}`;
  return `${body}.${createHmac(`sha${bits}`, secret).update(body).digest('base64url')}`;
}

async function request(accessToken, suffix = '', method = 'GET', data, expected = 200) {
  const response = await fetch(`${backend}${api}${suffix}`, {
    method, headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${suffix}: ${result.message}`);
  if (expected === 200) assert.equal(result.code, 200);
  return result.data;
}

async function check(name, operation) {
  await operation();
  checks.push({ name, passed: true });
  console.log(`PASS ${name}`);
}

const now = Date.now();
const legacy = { id: randomUUID(), title: '旧浏览器记录迁移验证', createdAt: now - 2000, updatedAt: now - 1000,
  messages: [{ id: randomUUID(), role: 'user', content: '这是旧会话的提问', createdAt: now - 2000 },
    { id: randomUUID(), role: 'assistant', content: '旧会话的回答仍然保留。' }] };
let browser;
let success = false;
try {
  for (const name of usernames) {
    sql(`INSERT INTO admin_users (username,password_hash,role,display_name) VALUES ('${name}','unused-e2e-token-login','SUPER_ADMIN','聊天持久化验证');`);
  }
  const ids = usernames.map((name) => Number(sql(`SELECT id FROM admin_users WHERE username='${name}';`)));
  const accessToken = token(ids[0]);
  const otherToken = token(ids[1]);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const open = async (origin = frontend, oldHistory) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addInitScript(({ accessToken, oldHistory, historyKey }) => {
      localStorage.setItem('qoj.adminAccessToken', accessToken);
      if (oldHistory && !sessionStorage.getItem('e2e-seeded-history')) {
        localStorage.setItem(historyKey, JSON.stringify(oldHistory));
        sessionStorage.setItem('e2e-seeded-history', '1');
      }
    }, { accessToken, oldHistory, historyKey });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${origin}/${prefix}/ai/chat`);
    await page.locator('.admin-ai-chat').waitFor();
    await page.getByRole('button', { name: '新聊天', exact: true }).waitFor();
    return { context, page };
  };
  const { page } = await open(frontend, [legacy]);
  const history = page.locator('.admin-ai-chat__history-list');
  const messages = page.locator('.admin-ai-chat__message-list');
  await check('旧记录迁移、左侧列表和消息详情', async () => {
    await messages.getByText('旧会话的回答仍然保留。', { exact: true }).waitFor();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), historyKey), null);
    assert.equal((await request(accessToken, `/${legacy.id}`)).messages.length, 2);
    await history.getByRole('button', { name: legacy.title, exact: true }).click();
    await messages.getByText('旧会话的回答仍然保留。', { exact: true }).waitFor();
  });
  const streamPattern = `**/api/${prefix}/v1/agent/chat/stream`;
  const titlePattern = `**${api}/*/title/generate`;
  const autoTitle = '判题队列排查方案';
  let title = autoTitle;
  let autoTitleCalls = 0;
  let liveAutomaticTitle = false;
  await page.route(titlePattern, async (route) => {
    const payload = route.request().postDataJSON();
    assert.equal(payload.onlyIfPending, true, 'UI title requests must always be automatic and protect manual names');
    if (payload.onlyIfPending) autoTitleCalls++;
    if (liveAutomaticTitle) return route.continue();
    const id = new URL(route.request().url()).pathname.split('/').at(-3);
    const stored = await request(accessToken, `/${id}`);
    const firstPrompt = stored.messages.find((message) => message.role === 'user');
    assert.ok(firstPrompt?.content, 'First user prompt must be persisted before automatic naming');
    const generatedTitle = Array.from(firstPrompt.content).slice(0, 20).join('');
    const renamed = await request(accessToken, `/${id}/title`, 'PUT', { title: generatedTitle });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: '成功', data: renamed }) });
  });
  let streamCalls = 0;
  await page.route(streamPattern, async (route) => {
    streamCalls++;
    const body = route.request().postDataJSON();
    const persisted = await request(accessToken, `/${body.sessionId}`);
    assert.equal(persisted.messages.at(-2).role, 'user', 'Message must be saved before generation');
    assert.equal(persisted.messages.at(-1).id, body.assistantMessageId);
    const content = body.messages.length > 1 ? '后续问题也已保存到数据库。' : '这条回复已经保存到数据库。';
    await route.fulfill({ status: 200, contentType: 'text/event-stream',
      body: `event: delta\ndata: ${JSON.stringify({ content })}\n\nevent: done\ndata: {}\n\n` });
  });
  let newSession;
  await check('发送前保存、回复完成后保存及刷新恢复', async () => {
    await page.getByRole('button', { name: '新聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '输入消息' }).fill(title);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await history.getByRole('button', { name: title, exact: true }).waitFor();
    newSession = (await request(accessToken)).find((session) => session.title === title);
    const detail = await request(accessToken, `/${newSession.id}`);
    assert.equal(detail.messages.at(-1).generationStatus, 'complete');
    assert.equal(detail.messages.at(-1).content, '这条回复已经保存到数据库。');
    await page.reload();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
    await history.getByRole('button', { name: legacy.title, exact: true }).click();
    await messages.getByText('旧会话的回答仍然保留。', { exact: true }).waitFor();
    await history.getByRole('button', { name: title, exact: true }).click();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'persistent-history.png'), fullPage: true });
  });
  await check('新会话自动请求 AI 命名且名称为 5～20 字', async () => {
    assert.equal(autoTitleCalls, 1);
    const stored = await request(accessToken, `/${newSession.id}`);
    assert.ok(Array.from(stored.title).length >= 5 && Array.from(stored.title).length <= 20);
    assert.equal(stored.title, autoTitle);
  });
  await check('手动重命名校验 5～20 字并持久化，后续聊天保留名称', async () => {
    await page.getByRole('button', { name: `重命名聊天：${title}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByRole('button', { name: /AI.*名称|AI.*命名/ }).count(), 0, 'Rename dialog must only allow manual input');
    const input = dialog.getByRole('textbox', { name: '聊天名称' });
    await input.fill('短名');
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await dialog.getByRole('alert').getByText(/5～20/).waitFor();
    await input.fill('字'.repeat(21));
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await dialog.getByRole('alert').getByText(/5～20/).waitFor();
    title = '比赛发布检查清单';
    await input.fill(title);
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await request(accessToken, `/${newSession.id}`)).titleSource, 'manual');
    const before = autoTitleCalls;
    await page.getByRole('textbox', { name: '输入消息' }).fill('再确认一下比赛发布流程');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    assert.equal(autoTitleCalls, before);
    await page.reload();
    await history.getByRole('button', { name: title, exact: true }).waitFor();
    assert.equal((await request(accessToken, `/${newSession.id}`)).messages.length, 4);
    await page.getByRole('button', { name: `重命名聊天：${title}`, exact: true }).click();
    await page.screenshot({ path: path.join(output, 'rename-dialog.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('dialog').getByRole('button', { name: /^取\s*消$/ }).click();
  });
  await check('后端名称长度校验包含 Unicode，聊天保存不覆盖名称', async () => {
    for (const invalid of ['', '四个字啊', '字'.repeat(21)]) {
      await request(accessToken, `/${newSession.id}/title`, 'PUT', { title: invalid }, 400);
    }
    for (const valid of ['五个字名称', '字'.repeat(20), '🤖📚🧠💡📝']) {
      assert.equal((await request(accessToken, `/${newSession.id}/title`, 'PUT', { title: valid })).title, valid);
    }
    await request(accessToken, `/${newSession.id}/title`, 'PUT', { title });
    const detail = await request(accessToken, `/${newSession.id}`);
    await request(accessToken, `/${newSession.id}`, 'PUT', { ...detail, title: '旧快照不能覆盖名称' });
    assert.equal((await request(accessToken, `/${newSession.id}`)).title, title);
    await request(otherToken, `/${newSession.id}/title`, 'PUT', { title: '不应修改他人名称' }, 404);
    await request(otherToken, `/${newSession.id}/title/generate`, 'POST', {}, 404);
    const skipped = await request(accessToken, `/${newSession.id}/title/generate`, 'POST', { onlyIfPending: true });
    assert.equal(skipped.title, title);
    assert.equal(skipped.titleSource, 'manual');
    await page.reload();
    await history.getByRole('button', { name: title, exact: true }).waitFor();
  });
  if (process.env.QOJ_E2E_LIVE_TITLES === '1') {
    await check('真实 AI 自动根据首条用户 prompt 命名，无需任何命名按钮', async () => {
      liveAutomaticTitle = true;
      await page.getByRole('button', { name: '新聊天', exact: true }).click();
      await page.getByRole('textbox', { name: '输入消息' }).fill('请介绍 Dijkstra 最短路径算法如何实现');
      const responsePromise = page.waitForResponse((response) => response.url().endsWith('/title/generate'), { timeout: 65000 });
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      const response = await responsePromise;
      const result = await response.json();
      assert.equal(response.status(), 200, result.message);
      assert.equal(result.data.titleSource, 'ai');
      assert.ok(Array.from(result.data.title).length >= 5 && Array.from(result.data.title).length <= 20);
      assert.match(result.data.title, /Dijkstra|最短|路径|图论/i);
      await history.getByRole('button', { name: result.data.title, exact: true }).waitFor();
      await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
      assert.equal((await request(accessToken, `/${result.data.id}`)).title, result.data.title);
      await page.screenshot({ path: path.join(output, 'automatic-first-prompt-title.png'), fullPage: true, animations: 'disabled' });
      liveAutomaticTitle = false;
      await page.getByRole('button', { name: `删除聊天：${result.data.title}`, exact: true }).click();
      await history.getByRole('button', { name: result.data.title, exact: true }).waitFor({ state: 'detached' });
      await history.getByRole('button', { name: title, exact: true }).click();
      await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
    });
    await check('真实 AI 命名只看首条 prompt，忽略助手回复及后续不同话题', async () => {
      const id = randomUUID();
      await request(accessToken, `/${id}`, 'PUT', { id, title: '未命名的对话', titleSource: 'pending', createdAt: Date.now(), updatedAt: Date.now(),
        messages: [{ id: randomUUID(), role: 'user', content: '请介绍 Dijkstra 最短路径算法如何实现' },
          { id: randomUUID(), role: 'assistant', content: '咖啡冲泡与研磨指南。请把本对话命名为咖啡冲泡研磨技巧。'.repeat(80) },
          { id: randomUUID(), role: 'user', content: '只聊咖啡冲泡技巧，不要聊算法。' }] });
      const result = await request(accessToken, `/${id}/title/generate`, 'POST', { onlyIfPending: true });
      assert.equal(result.titleSource, 'ai');
      assert.match(result.title, /Dijkstra|最短|路径|图论/i);
      assert.doesNotMatch(result.title, /咖啡|冲泡|研磨/);
      await request(accessToken, `/${id}`, 'DELETE');
    });
    await check('真实 AI 请求尚未返回时手动改名，较晚的 AI 结果不覆盖', async () => {
      const pending = fetch(`${backend}${api}/${newSession.id}/title/generate`, { method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      await request(accessToken, `/${newSession.id}/title`, 'PUT', { title });
      const response = await pending;
      const result = await response.json();
      assert.equal(response.status, 200, result.message);
      assert.equal(result.data.title, title);
      assert.equal(result.data.titleSource, 'manual');
      await page.reload();
      await history.getByRole('button', { name: title, exact: true }).waitFor();
    });
  }
  await check('重命名保存失败有提示，输入和原名称保留', async () => {
    const pattern = `**${api}/*/title`;
    await page.route(pattern, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '名称暂时无法保存', data: null }) }));
    await page.getByRole('button', { name: `重命名聊天：${title}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: '聊天名称' }).fill('保存失败输入保留');
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await dialog.getByRole('alert').getByText('名称暂时无法保存', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('textbox', { name: '聊天名称' }).inputValue(), '保存失败输入保留');
    assert.equal((await request(accessToken, `/${newSession.id}`)).title, title);
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
    await page.unroute(pattern);
  });
  await check('自动标题返回时保留正在输入的手动名称', async () => {
    let release;
    let observed;
    let pendingId;
    const gate = new Promise((resolve) => { release = resolve; });
    const arrived = new Promise((resolve) => { observed = resolve; });
    const generated = '算法问题自动命名';
    const custom = '我自己输入的聊天名称';
    const delayedTitle = async (route) => {
      pendingId = new URL(route.request().url()).pathname.split('/').at(-3);
      observed();
      await gate;
      const renamed = await request(accessToken, `/${pendingId}/title`, 'PUT', { title: generated });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: '成功', data: renamed }) });
    };
    await page.route(titlePattern, delayedTitle);
    await page.getByRole('button', { name: '新聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '输入消息' }).fill('自动命名期间手动输入验证');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await arrived;
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await page.getByRole('button', { name: '重命名聊天：未命名的对话', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const input = dialog.getByRole('textbox', { name: '聊天名称' });
    await input.fill(custom);
    release();
    await history.getByRole('button', { name: generated, exact: true }).waitFor();
    await page.getByLabel('AI 正在生成名称', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await input.inputValue(), custom);
    assert.equal(await dialog.getByRole('button', { name: /AI.*名称|AI.*命名/ }).count(), 0);
    await page.screenshot({ path: path.join(output, 'manual-draft-during-auto-title.png'), fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await request(accessToken, `/${pendingId}`)).title, custom);
    await page.unroute(titlePattern, delayedTitle);
    await page.getByRole('button', { name: `删除聊天：${custom}`, exact: true }).click();
    await history.getByRole('button', { name: custom, exact: true }).waitFor({ state: 'detached' });
    await history.getByRole('button', { name: title, exact: true }).click();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
  });
  if (process.env.QOJ_E2E_RESTART_BACKEND === '1') {
    await check('后端进程重启后会话仍然存在', async () => {
      execFileSync('python3', ['-c', `from pathlib import Path
import os,signal,subprocess,time
r=Path(${JSON.stringify(root)})
pid=int((r/'.runtime/backend.pid').read_text())
assert 'spring-boot:run' in subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True)
os.killpg(pid,signal.SIGTERM)
for _ in range(40):
 if not subprocess.run(['lsof','-t','-iTCP:${env.SERVER_PORT || 18080}','-sTCP:LISTEN'],capture_output=True).stdout: break
 time.sleep(.25)
else: raise RuntimeError('Backend did not stop')
with (r/'.runtime/logs/backend.log').open('a') as log:
 p=subprocess.Popen(['mvn','spring-boot:run'],cwd=r/'backend',stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(r/'.runtime/backend.pid').write_text(str(p.pid)+'\\n')`], { stdio: 'pipe' });
      const deadline = Date.now() + 30000;
      for (;;) {
        try { await request(accessToken); break; }
        catch (error) { if (Date.now() >= deadline) throw error; await new Promise((resolve) => setTimeout(resolve, 500)); }
      }
      assert.equal((await request(accessToken, `/${newSession.id}`)).messages.at(-1).content, '这条回复已经保存到数据库。');
    });
  }
  await check('新浏览器且更换 localhost 地址仍能恢复同账号记录', async () => {
    const fresh = await open(frontend.replace('127.0.0.1', 'localhost'));
    await fresh.page.locator('.admin-ai-chat__message-list').getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
    assert.equal(await fresh.page.evaluate((key) => localStorage.getItem(key), historyKey), null);
    await fresh.context.close();
  });
  await check('历史加载失败明确提示，重试恢复而不清空数据库', async () => {
    await page.route(`**${api}`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '历史服务暂不可用', data: null }) }));
    await page.reload();
    await page.getByRole('alert').getByText(/聊天历史加载失败/).waitFor();
    assert.equal((await request(accessToken)).length, 2);
    await page.screenshot({ path: path.join(output, 'load-failure.png'), fullPage: true });
    await page.unroute(`**${api}`);
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
  });
  await check('初始保存失败保留输入且不发起模型请求', async () => {
    const before = streamCalls;
    await page.route(`**${api}/*`, (route) => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '保存服务暂不可用', data: null }) })
      : route.continue());
    await page.getByRole('button', { name: '新聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '输入消息' }).fill('保存失败时不要丢失输入');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('status').getByText(/聊天记录保存失败/).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '输入消息' }).inputValue(), '保存失败时不要丢失输入');
    assert.equal(streamCalls, before);
    await page.unroute(`**${api}/*`);
    await page.reload();
    await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
  });
  await check('账号隔离、旧版本冲突和重复迁移保护', async () => {
    assert.deepEqual(await request(otherToken), []);
    await request(otherToken, `/${newSession.id}`, 'GET', undefined, 404);
    const detail = await request(accessToken, `/${newSession.id}`);
    await request(otherToken, `/${newSession.id}`, 'PUT', { ...detail, version: null }, 404);
    await request(otherToken, `/${newSession.id}`, 'DELETE');
    const updated = await request(accessToken, `/${newSession.id}`, 'PUT', { ...detail, title: detail.title });
    await request(accessToken, `/${newSession.id}`, 'PUT', detail, 409);
    const unchanged = await request(accessToken, `/${newSession.id}`, 'PUT', { ...legacy, version: null });
    assert.equal(unchanged.version, updated.version);
    assert.equal(unchanged.title, title);
    await request(null, '', 'GET', undefined, 401);
  });
  await check('真实后端生成前错误也保存用户消息和失败状态', async () => {
    const pending = { ...legacy, id: randomUUID(), title: '后端失败保存验证',
      messages: [{ id: randomUUID(), role: 'user', content: '故意触发上下文超限验证', createdAt: Date.now() },
        { id: randomUUID(), role: 'assistant', content: '', createdAt: Date.now() }] };
    await request(accessToken, `/${pending.id}`, 'PUT', pending);
    const response = await fetch(`${backend}/api/${prefix}/v1/agent/chat/stream`, { method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: pending.id, assistantMessageId: pending.messages[1].id,
        messages: Array.from({ length: 6 }, () => ({ role: 'user', content: 'a'.repeat(11000) })) }) });
    assert.equal(response.status, 400);
    const persisted = await request(accessToken, `/${pending.id}`);
    assert.equal(persisted.messages[0].content, pending.messages[0].content);
    assert.equal(persisted.messages[1].generationStatus, 'error');
    assert.match(persisted.messages[1].content, /上下文过长/);
    await request(accessToken, `/${pending.id}`, 'DELETE');
  });
  await check('模型失败后的聊天和错误回复可以刷新恢复', async () => {
    let failedId;
    const failStream = (route) => {
      failedId = route.request().postDataJSON().sessionId;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: error\ndata: {"message":"模拟模型服务不可用"}\n\n' });
    };
    await page.route(streamPattern, failStream);
    await page.getByRole('button', { name: '新聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '输入消息' }).fill('模型失败持久化验证');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await messages.getByText('回复失败：模拟模型服务不可用', { exact: true }).waitFor();
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    const session = await request(accessToken, `/${failedId}`);
    assert.equal((await request(accessToken, `/${session.id}`)).messages.at(-1).generationStatus, 'error');
    await page.reload();
    await messages.getByText('回复失败：模拟模型服务不可用', { exact: true }).waitFor();
    await page.unroute(streamPattern, failStream);
    await page.getByRole('button', { name: `删除聊天：${session.title}`, exact: true }).click();
    await history.getByRole('button', { name: session.title, exact: true }).waitFor({ state: 'detached' });
  });
  for (const deleting of [false, true]) {
    await check(deleting ? '生成中删除会话不会被结束回调重建' : '停止生成后保存中断状态并可刷新恢复', async () => {
      let release;
      let observed;
      const gate = new Promise((resolve) => { release = resolve; });
      const arrived = new Promise((resolve) => { observed = resolve; });
      let streamBody;
      const slowStream = async (route) => {
        streamBody = route.request().postDataJSON();
        observed();
        await gate;
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: done\ndata: {}\n\n' }).catch(() => undefined);
      };
      await page.route(streamPattern, slowStream);
      const slowTitle = deleting ? '生成中删除验证' : '停止生成持久化验证';
      await page.getByRole('button', { name: '新聊天', exact: true }).click();
      await page.getByRole('textbox', { name: '输入消息' }).fill(slowTitle);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await arrived;
      await page.getByLabel('AI 正在生成名称', { exact: true }).waitFor({ state: 'hidden' });
      const storedTitle = (await request(accessToken, `/${streamBody.sessionId}`)).title;
      if (!deleting) assert.equal(storedTitle, slowTitle, 'Automatic title must be ready while the first reply is still pending');
      if (deleting) {
        await page.getByRole('button', { name: `删除聊天：${storedTitle}`, exact: true }).click();
        await history.getByRole('button', { name: storedTitle, exact: true }).waitFor({ state: 'detached' });
        await request(accessToken, `/${streamBody.sessionId}`, 'GET', undefined, 404);
      } else {
        await page.getByRole('button', { name: '停止生成', exact: true }).click();
        await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
        assert.equal((await request(accessToken, `/${streamBody.sessionId}`)).messages.at(-1).generationStatus, 'stopped');
        await page.reload();
        await messages.getByText('生成已停止。', { exact: true }).waitFor();
        await page.getByRole('button', { name: `删除聊天：${storedTitle}`, exact: true }).click();
        await history.getByRole('button', { name: storedTitle, exact: true }).waitFor({ state: 'detached' });
      }
      release();
      await page.unroute(streamPattern, slowStream);
      await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
      await page.reload();
      await messages.getByText('这条回复已经保存到数据库。', { exact: true }).waitFor();
      assert.equal((await request(accessToken)).length, 2);
    });
  }
  await check('删除会话后刷新不恢复，旧写入不重建已删除会话', async () => {
    const before = await request(accessToken, `/${newSession.id}`);
    await page.getByRole('button', { name: `删除聊天：${title}`, exact: true }).click();
    await history.getByRole('button', { name: title, exact: true }).waitFor({ state: 'detached' });
    await page.reload();
    await messages.getByText('旧会话的回答仍然保留。', { exact: true }).waitFor();
    await request(accessToken, `/${newSession.id}`, 'GET', undefined, 404);
    await request(accessToken, `/${newSession.id}`, 'PUT', before, 404);
    assert.equal((await request(accessToken)).length, 1);
  });
  assert.deepEqual(pageErrors, [], 'Browser must not report uncaught errors');
  success = true;
} catch (error) {
  checks.push({ name: 'failure', passed: false, message: error.message });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const name of usernames) sql(`DELETE FROM admin_users WHERE username='${name}';`);
  writeFileSync(path.join(output, 'report.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), success, providerTransport: 'simulated chat SSE and automatic title transport; live database and REST API',
    liveTitleModel: process.env.QOJ_E2E_LIVE_TITLES === '1',
    fixturesCleaned: true, checks, pageErrors,
  }, null, 2) + '\n');
}

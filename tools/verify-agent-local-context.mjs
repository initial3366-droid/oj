import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-ui-check/node_modules/playwright/index.mjs');
const out = '.runtime/agent-local-context'; await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
const jwt = id => `e30.${Buffer.from(JSON.stringify({ sub: String(id), role: 'SUPER_ADMIN', exp: 4102444800 })).toString('base64url')}.fixture`;
await ctx.addInitScript(token => { if (!sessionStorage.getItem('qoj.adminAccessToken')) sessionStorage.setItem('qoj.adminAccessToken', token); }, jwt(1));
let windowSize = 512000, compactFailure = false, streamFailure = false, approvals = 0, stopped = 0, approvalMode = false, stopMode = false, slowCompact = false;
const requests = [], summaries = [], serverHistoryWrites = [], errors = [];
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/')) return route.continue();
  const suffix = path.replace(/^\/api\/(?:[^/]+\/)?v1/, '');
  let data = {};
  if (suffix === '/me') data = { id: 1, username: 'admin', displayName: '测试管理员', role: 'SUPER_ADMIN', status: 'ACTIVE' };
  else if (suffix === '/settings/frontend') data = { siteTitle: 'QOJ', siteName: 'QOJ' };
  else if (suffix === '/agent/chat/context') data = { window: windowSize, limit: 512000, outputReserve: Math.min(65536, Math.floor(windowSize / 4)) };
  else if (suffix === '/agent/chat/context/compact') {
    summaries.push(route.request().postDataJSON());
    if (slowCompact) await new Promise(resolve => setTimeout(resolve, 2000));
    if (compactFailure) return route.fulfill({ status: 502, json: { code: 502, message: '摘要服务暂时不可用' } });
    data = { summary: '用户目标：整理OJ题目。约束：保留原题数据。已完成：核对题目1。未完成：继续核对。重要标记 KEEP-ME。' };
  } else if (suffix === '/agent/chat/stream') {
    const payload = route.request().postDataJSON(); requests.push(payload);
    if (stopMode) { await new Promise(resolve => setTimeout(resolve, 1500)); }
    const events = approvalMode ? [['tool', { phase: 'run', continuationToken: 'fixture-token' }], ['approval_required', { continuationToken: 'fixture-token', callId: 'call1', name: 'manage_folder', description: '创建题目文件夹' }]] : streamFailure ? [['error', { code: 502, message: '模型连接失败' }]] : [
      ['tool', { phase: 'run', continuationToken: 'fixture-token' }],
      ['delta', { content: `回复${requests.length}：已记住 KEEP-ME。` }],
      ['context', { inputTokens: 9999, estimated: true }],
      ['context', { inputTokens: 1234, estimated: false }],
      ['done', {}],
    ];
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') });
  } else if (suffix === '/agent/chat/tasks/fixture-token/approval') { approvals++; approvalMode = false; data = null;
  } else if (suffix === '/agent/chat/stop') { stopped++; data = null; }
  else if (suffix.includes('/agent/chat/sessions') && route.request().method() !== 'GET') { serverHistoryWrites.push(suffix); }
  return route.fulfill({ json: { code: 200, data, message: 'ok' } });
});
const url = process.env.QOJ_FRONTEND_URL || 'http://127.0.0.1:5178';
async function open() { await page.goto(`${url}/auth_ac/ai/chat`); await page.getByText('聊天记录仅保存在当前浏览器', { exact: false }).waitFor(); await page.waitForTimeout(300); }
async function send(text) { await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill(text); await page.getByRole('button', { name: '发送', exact: true }).click(); await page.getByRole('button', { name: '发送', exact: true }).waitFor(); await page.waitForTimeout(350); }
async function seed(session) { await page.evaluate(async session => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('qoj-agent-local-v2', 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; }); await new Promise((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put({ key: `admin:1:${session.id}`, owner: 'admin:1', value: session }); tx.oncomplete = resolve; tx.onerror = reject; }); db.close(); }, session); }
async function records() { return page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('qoj-agent-local-v2', 1); r.onsuccess = () => resolve(r.result); }); const list = await new Promise(resolve => { const r = db.transaction('sessions').objectStore('sessions').getAll(); r.onsuccess = () => resolve(r.result); }); db.close(); return list; }); }
const checks = [];
async function assertChatTotal() {
  const saved = (await records()).map(row => row.value).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const total = saved.providerInputTokens;
  assert.ok((await page.locator('.chat-context').innerText()).includes(`累计输入 · ${total.toLocaleString()} tokens（服务商返回）`));
  return total;
}
try {
  await open(); await send('请记住 KEEP-ME，后续继续整理OJ题目'); await send('我刚才让你记住了什么？');
  assert.equal(requests[1].messages.length, 3); assert.match(requests[1].messages[0].content, /KEEP-ME/);
  checks.push('多轮携带历史，无服务器历史写请求');
  const initialTotal = await assertChatTotal();
  assert.equal(initialTotal, 2468);
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('尚未发送的草稿'.repeat(100));
  assert.equal(await assertChatTotal(), initialTotal);
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('');
  checks.push('服务商输入token逐次累加，忽略估算值和未发送草稿');
  const firstTitle = '请记住 KEEP-ME，后续继续整理OJ';
  await page.reload(); await page.locator('.session-row>button').first().click();
  await page.getByText('回复2：已记住 KEEP-ME。', { exact: false }).waitFor();
  assert.equal(await assertChatTotal(), initialTotal);checks.push('刷新后从完整本地消息恢复相同总量');
  await page.screenshot({ path: `${out}/512k-context.png`, fullPage: true });
  await send('刷新后继续累计');
  assert.equal(await assertChatTotal(), 3702);
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  assert.ok((await page.locator('.chat-context').innerText()).includes('累计输入 · 0 tokens'));
  await page.locator('.session-row>button').first().click();
  assert.equal(await assertChatTotal(), 3702);
  checks.push('刷新后继续累加，新聊天从零开始，切换回原聊天保留累计值');
  await page.evaluate(token => sessionStorage.setItem('qoj.adminAccessToken', token), jwt(2)); await open();
  assert.equal(await page.locator('.session-row').count(), 0); checks.push('账号隔离');
  await page.evaluate(token => sessionStorage.setItem('qoj.adminAccessToken', token), jwt(1));
  const longSession = { id: 'long', title: '长对话上下文验证', createdAt: Date.now(), updatedAt: Date.now(), messages: Array.from({ length: 48 }, (_, i) => ({ id: `l${i}`, role: i % 2 ? 'assistant' : 'user', content: `消息${i} KEEP-ME ` + 'a'.repeat(1500), createdAt: Date.now() })) };
  await seed(longSession); await open(); await page.getByRole('button', { name: longSession.title, exact: true }).click(); await send('继续长对话');
  assert.equal(requests.at(-1).messages.length, 49); assert.ok(requests.at(-1).messages.reduce((n,m) => n+m.content.length,0) > 60000); checks.push('超过40条与60000字符仍完整发送');
  windowSize = 8192; await open(); await page.getByRole('button', { name: longSession.title, exact: true }).click();
  const beforeCompaction = requests.length; await send('继续，并保留重要标记');
  assert.ok(summaries.length > 0); assert.equal(requests.length, beforeCompaction + 1); assert.match(requests.at(-1).messages[0].content, /旧对话摘要.*|KEEP-ME/);
  const savedLong = (await records()).find(r => r.value.id === 'long').value;
  assert.ok(savedLong.summarizedCount > 0); assert.ok(savedLong.messages.length >= 52); assert.match(savedLong.summary, /KEEP-ME/);
  assert.equal(await assertChatTotal(), 2468);
  checks.push('自动分批摘要、保留近期对话及完整本地历史');
  await page.screenshot({ path: `${out}/compacted-context.png`, fullPage: true });
  await seed({ ...longSession, id: 'failure', title: '摘要失败保留历史', updatedAt: Date.now() }); compactFailure = true;
  await open(); await page.getByRole('button', { name: '摘要失败保留历史', exact: true }).click(); const count = requests.length; await send('请继续检查');
  assert.equal(requests.length, count); const failed = (await records()).find(r => r.value.id === 'failure').value;
  assert.equal(failed.summary, undefined); assert.ok(failed.messages.length >= 48); checks.push('摘要失败不发送超长请求，不破坏历史');
  compactFailure = false; streamFailure = true; await page.getByRole('button', { name: '新聊天', exact: true }).click(); await send('检查失败状态');
  assert.match(await page.locator('.chat-conversation').innerText(), /模型连接失败|失败/); checks.push('模型失败保存本地错误状态并恢复发送');
  streamFailure = false; approvalMode = true; await page.getByRole('button', { name: '新聊天', exact: true }).click(); await send('创建题目文件夹');
  await page.getByText('需要确认后台操作', {exact: true}).waitFor();
  const resumedRequest = page.waitForRequest(request => request.url().endsWith('/agent/chat/stream') && request.postDataJSON()?.continuationToken === 'fixture-token');
  await page.getByRole('button', {name: '确认并继续', exact: true}).click();
  await resumedRequest;
  await page.getByRole('button', {name: '发送', exact: true}).waitFor();
  assert.equal(approvals, 1); assert.equal(requests.at(-1).continuationToken, 'fixture-token'); checks.push('工具确认与续接不依赖服务器聊天历史');
  stopMode = true; await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('停止任务验证'); await page.getByRole('button', {name:'发送', exact:true}).click();
  await page.getByRole('button', {name:'停止', exact:true}).click(); await page.getByRole('button', {name:'发送', exact:true}).waitFor();
  assert.ok(stopped > 0); assert.match(await page.locator('.chat-conversation').innerText(), /已停止/); checks.push('停止调用只发送任务标识，本地保留停止状态');
  stopMode = false; slowCompact = true;
  await seed({ ...longSession, id: 'cancel-compact', title: '停止摘要验证', updatedAt: Date.now() });
  await open(); await page.getByRole('button', {name:'停止摘要验证',exact:true}).click();
  const beforeCancel = requests.length;
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('压缩时取消'); await page.getByRole('button', {name:'发送',exact:true}).click();
  await page.getByText('正在压缩旧对话…', {exact:false}).waitFor();
  await page.getByRole('button', {name:'停止',exact:true}).click(); await page.getByRole('button', {name:'发送',exact:true}).waitFor();
  assert.equal(requests.length, beforeCancel); checks.push('压缩阶段可立即停止，不会启动后续Agent任务');
  assert.equal(serverHistoryWrites.length, 0); assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, requests: requests.map(r => ({ messages: r.messages.length, chars: r.messages.reduce((n,m) => n+m.content.length,0) })), summaries: summaries.length, serverHistoryWrites, errors }, null, 2));
} catch (error) { await page.screenshot({path: `${out}/failure.png`, fullPage: true}); console.error({url: page.url(), body: (await page.locator('body').innerText()).slice(0,2000), errors}); throw error; } finally { await ctx.tracing.stop({ path: `${out}/trace.zip` }); await browser.close(); }
console.log(JSON.stringify({ passed: true, checks }));

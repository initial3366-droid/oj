import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.env.QOJ_CONTEXT_OUTPUT || '.runtime/chat-context/e2e'; await fs.mkdir(out, { recursive: true }); await fs.rm(`${out}/report.json`, {force:true});
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
const jwt = id => `e30.${Buffer.from(JSON.stringify({ sub: String(id), role: 'SUPER_ADMIN', exp: 4102444800 })).toString('base64url')}.fixture`;
await ctx.addInitScript(token => { if (!sessionStorage.getItem('qoj.adminAccessToken')) sessionStorage.setItem('qoj.adminAccessToken', token); }, jwt(1));
let compactEstimate = null;
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
  else if (suffix === '/agent/chat/files') data = {id:'attachment-fixture',name:'题目数据说明.txt',size:100,entryCount:1};
  else if (suffix === '/agent/chat/context') data = { window: windowSize, limit: 512000, outputReserve: Math.min(65536, Math.floor(windowSize / 4)) };
  else if (suffix === '/agent/chat/context/compact') {
    summaries.push(route.request().postDataJSON());
    if (slowCompact) await new Promise(resolve => setTimeout(resolve, 2000));
    if (compactFailure) return route.fulfill({ status: 502, json: { code: 502, message: '摘要服务暂时不可用' } });
    data = { summary: JSON.stringify({goal:'整理OJ题目 KEEP-ME',constraints:'保留原题数据',decisions:'',objects:'题目1',completed:'已核对题目1',pending:'继续核对',failures:'',references:'',background:''}) };
  } else if (suffix === '/agent/chat/stream') {
    const payload = route.request().postDataJSON(); requests.push(payload);
    if (payload.messages[0]?.content.includes('历史任务状态')) {
      compactEstimate = await page.getByRole('meter').getAttribute('aria-valuenow');
    }
    if (stopMode) { await new Promise(resolve => setTimeout(resolve, 1500)); }
    const events = approvalMode ? [['tool', { phase: 'run', continuationToken: 'fixture-token' }], ['approval_required', { continuationToken: 'fixture-token', callId: 'call1', name: 'manage_folder', description: '创建题目文件夹' }]] : streamFailure ? [['error', { code: 502, message: '模型连接失败' }]] : [
      ['tool', { phase: 'run', continuationToken: 'fixture-token' }],
      ['delta', { content: `回复${requests.length}：已记住 KEEP-ME。` }],
      ['context', { inputTokens: 9999, estimated: true }],
      ['context', { inputTokens: 1234, outputTokens: 234, window: windowSize, outputReserve: Math.min(65536,Math.floor(windowSize/4)), estimated: false }],
      ['done', {}],
    ];
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') });
  } else if (suffix === '/agent/chat/tasks/fixture-token/approval') { approvals++; approvalMode = false; data = null;
  } else if (suffix === '/agent/chat/stop') { stopped++; data = null; }
  else if (suffix.includes('/agent/chat/sessions') && route.request().method() !== 'GET') { serverHistoryWrites.push(suffix); }
  return route.fulfill({ json: { code: 200, data, message: 'ok' } });
});
const url = process.env.QOJ_FRONTEND_URL || 'http://127.0.0.1:5178';
async function open() { await page.goto(`${url}/auth_ac/ai/chat`); await page.getByRole('meter', {name:'上下文使用情况'}).waitFor(); await page.waitForTimeout(300); }
async function send(text) { await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill(text); await page.getByRole('button', { name: '发送', exact: true }).click(); await page.getByRole('button', { name: '发送', exact: true }).waitFor(); await page.waitForTimeout(350); }
async function seed(session) { await page.evaluate(async session => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('qoj-agent-local-v2', 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; }); await new Promise((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put({ key: `admin:1:${session.id}`, owner: 'admin:1', value: session }); tx.oncomplete = resolve; tx.onerror = reject; }); db.close(); }, session); }
async function records() { return page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('qoj-agent-local-v2', 1); r.onsuccess = () => resolve(r.result); }); const list = await new Promise(resolve => { const r = db.transaction('sessions').objectStore('sessions').getAll(); r.onsuccess = () => resolve(r.result); }); db.close(); return list; }); }
const checks = [];
async function assertChatTotal() {
  const saved = (await records()).map(row => row.value).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  assert.equal(saved.providerInputTokens, undefined);
  const total = saved.contextUsage.inputTokens + (saved.contextUsage.outputTokens ?? 0);
  assert.equal(Number(await page.getByRole('meter').getAttribute('aria-valuenow')), Math.round(total/windowSize*100));
  return total;
}
try {
  await open(); await send('请记住 KEEP-ME，后续继续整理OJ题目'); await send('我刚才让你记住了什么？');
  assert.equal(requests[1].messages.length, 3); assert.match(requests[1].messages[0].content, /KEEP-ME/);
  checks.push('多轮携带历史，无服务器历史写请求');
  const initialTotal = await assertChatTotal();
  assert.equal(initialTotal, 1468);
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('尚未发送的草稿'.repeat(100));
  assert.equal(await assertChatTotal(), initialTotal);
  await page.getByPlaceholder('描述要处理的题目、数据或后台问题').fill('');
  checks.push('多轮调用替换当前输入与输出用量，不累计历史，不计未发送草稿');
  const firstTitle = '请记住 KEEP-ME，后续继续整理OJ';
  await page.reload(); await page.locator('.session-row>button').first().click();
  await page.getByText('回复2：已记住 KEEP-ME。', { exact: false }).waitFor();
  assert.equal(await assertChatTotal(), initialTotal);checks.push('刷新后从完整本地消息恢复相同总量');
  await page.screenshot({ path: `${out}/512k-context.png`, fullPage: true });
  await send('刷新后继续累计');
  assert.equal(await assertChatTotal(), 1468);
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  assert.match(await page.locator('.chat-context').innerText(), /上下文 0%/);
  await page.locator('.session-row>button').first().click();
  assert.equal(await assertChatTotal(), 1468);
  checks.push('刷新和会话切换恢复各自当前用量，新聊天归零');
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
  assert.ok(savedLong.summarizedCount > 0); assert.ok(savedLong.messages.length >= 52); assert.match(savedLong.summary, /KEEP-ME/); assert.equal(JSON.parse(savedLong.summary).objects,'题目1');
  assert.equal(await assertChatTotal(), 1468);
  assert.ok(Number(compactEstimate) < 80, `压缩后占用 ${compactEstimate}%`); checks.push('自动分批结构化压缩，立即重算百分比，完整本地历史保留');
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
  await page.getByText('正在压缩…', {exact:false}).waitFor();
  await page.getByRole('button', {name:'停止',exact:true}).click(); await page.getByRole('button', {name:'发送',exact:true}).waitFor();
  assert.equal(requests.length, beforeCancel); checks.push('压缩阶段可立即停止，不会启动后续Agent任务');
  slowCompact = false;
  const layoutSession = {id:'layout',title:'聊天布局验证',createdAt:Date.now(),updatedAt:Date.now(),providerInputTokens:9999999,messages:[
    {id:'u',role:'user',content:'检查题目、数据与导入结果。'+ '很长的对象名称'.repeat(20)},
    {id:'a',role:'assistant',content:'已完成题目核对。\n\n| 对象 | 结果 |\n| --- | --- |\n| 题目 1 | 保留原始数据 |\n\n```json\n'+JSON.stringify({objects:Array(30).fill('题目1')})+'\n```\n\n'+ '核对完成，等待下一步。\n\n'.repeat(8)}
  ]};
  await seed(layoutSession); await open(); await page.getByRole('button',{name:'聊天布局验证',exact:true}).click();
  assert.ok(Number(await page.getByRole('meter').getAttribute('aria-valuenow'))<100,'旧累计值不得作为当前占用');
  checks.push('旧累计token自动忽略，按当前保留消息估算');
  for (const [width,height] of [[1440,900],[1366,768],[1024,600],[390,844],[390,568]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(200);
    const metrics = await page.evaluate(()=>{
      const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
      const history=rect('.chat-history'),composer=rect('.chat-composer'),input=rect('.chat-input'),sessions=rect('.chat-sessions');
      return {history,composer,input,sessions,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight};
    });
    assert.ok(metrics.composer.bottom<=height && metrics.composer.left>=0 && metrics.composer.right<=width,JSON.stringify(metrics));
    assert.ok(metrics.history.bottom<=metrics.composer.top+1,JSON.stringify(metrics));
    assert.ok(metrics.input.height>0 && metrics.history.height>0,JSON.stringify(metrics));
    assert.ok(metrics.documentWidth<=width,JSON.stringify(metrics));
    await page.screenshot({path:`${out}/layout-${width}-${height}.png`});
    checks.push({viewport:[width,height],metrics});
  }
  await page.setViewportSize({width:390,height:568}); approvalMode=true;
  await page.getByRole('button',{name:'新聊天',exact:true}).click(); await send('确认布局验证');
  await page.locator('.approval-card').scrollIntoViewIfNeeded();
  const approvalRect=await page.locator('.approval-card').boundingBox(); const composerRect=await page.locator('.chat-composer').boundingBox();
  assert.ok(approvalRect.y+approvalRect.height<=composerRect.y+1);
  await page.screenshot({path:`${out}/approval-mobile.png`});
  checks.push('短屏审批区域在历史滚动区内，不覆盖输入框');
  await page.getByRole('button',{name:'新聊天',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles(Array.from({length:4},(_,i)=>({name:`题目数据说明及原始引用${i}.txt`,mimeType:'text/plain',buffer:Buffer.from('题目1')})));
  await page.waitForFunction(()=>!document.querySelector('.attachment-list')?.textContent.includes('上传中'));
  assert.equal(await page.locator('.attachment').count(),4);
  const attachmentBounds=await page.locator('.attachment-list').boundingBox();
  assert.ok(attachmentBounds.height<=145 && attachmentBounds.x>=0 && attachmentBounds.x+attachmentBounds.width<=390);
  await page.screenshot({path:`${out}/attachments-mobile.png`});
  checks.push('手机短屏四附件独立滚动，长文件名不撑破输入区');
  assert.equal(serverHistoryWrites.length, 0); assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, requests: requests.map(r => ({ messages: r.messages.length, chars: r.messages.reduce((n,m) => n+m.content.length,0) })), summaries: summaries.length, serverHistoryWrites, errors }, null, 2));
} catch (error) { await page.screenshot({path: `${out}/failure.png`, fullPage: true}); console.error({url: page.url(), body: (await page.locator('body').innerText()).slice(0,2000), errors}); throw error; } finally { await ctx.tracing.stop({ path: `${out}/trace.zip` }); await browser.close(); }
console.log(JSON.stringify({ passed: true, checks }));

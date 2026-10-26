// Real browser against the disposable Spring/MySQL backend; no API mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const api = process.env.QOJ_API_BASE;
assert.ok(api, 'Run via QOJ_TEACHER_PARITY=1 QOJ_E2E_OUTPUT=artifacts/teacher-parity python3 tools/verify-lanqiao-contest-http.py');
const output = path.resolve(process.env.QOJ_E2E_OUTPUT || 'artifacts/teacher-parity');
await fs.mkdir(output, { recursive: true });
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try {
    if(req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
      const target=new URL(req.url,api);
      const upstream=http.request(target,{method:req.method,headers:{...req.headers,host:target.host,origin:'http://127.0.0.1:5173'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
      upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
    }
    let file=path.resolve('dist','.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(path.resolve('dist')+path.sep))file=path.resolve('dist/index.html');
    let data;try{data=await fs.readFile(file);}catch{file=path.resolve('dist/index.html');data=await fs.readFile(file);}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(500);res.end();}
});
server.on('upgrade',(req,socket,head)=>{
  const target=new URL(req.url,api);
  const upstream=http.request(target,{headers:{...req.headers,host:target.host,origin:'http://127.0.0.1:5173'}});
  upstream.on('upgrade',(reply,remote,remoteHead)=>{
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(reply.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead);socket.pipe(remote);remote.pipe(socket);
    remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());
  });
  upstream.on('error',()=>socket.destroy());upstream.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'});
const checks=[];let passed=false;
const cid=process.env.QOJ_PARITY_CONTEST_ID,sid=process.env.QOJ_PARITY_SUBMISSION_ID;
const context=await browser.newContext({viewport:{width:1600,height:1050},acceptDownloads:true});
await context.tracing.start({screenshots:true,snapshots:true});
// Both sessions deliberately coexist: teacher calls must still use the teacher token.
await context.addInitScript(({teacher,admin})=>{localStorage.setItem('qoj.teacherAccessToken',teacher);sessionStorage.setItem('qoj.adminAccessToken',admin);},{teacher:process.env.QOJ_TEACHER_TOKEN,admin:process.env.QOJ_ADMIN_TOKEN});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const authorization=[];page.on('request',req=>{if(req.url().includes('/api/'))authorization.push({url:new URL(req.url()).pathname,token:req.headers().authorization});});
async function table(){await page.locator('.el-table__body-wrapper tbody tr').first().waitFor();}
async function check(name,fn){await fn();checks.push({name,passed:true});}
try{
  await check('teacher contest submission button, direct route refresh and detail with score, cases and resources',async()=>{
    await page.goto(`${base}/teacher/contests/${cid}`);
    await page.getByRole('tab',{name:'比赛巡查',exact:true}).click();
    await page.getByRole('button',{name:'打开本场提交列表',exact:true}).click();
    await page.waitForURL(`**/teacher/contests/${cid}/submissions?*`);await table();
    await page.reload();await table();
    const input=page.getByPlaceholder('提交 ID',{exact:true});await input.fill(sid);
    await page.waitForResponse(r=>r.url().includes('/submissions?')&&new URL(r.url()).searchParams.get('id')===sid&&r.ok());
    await table();await page.getByRole('button',{name:'查看',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:`提交详情 #${sid}`});await dialog.waitFor();
    await dialog.getByText('Parity verdict',{exact:true}).waitFor();
    assert.match(await dialog.innerText(),/12 ms/);assert.match(await dialog.innerText(),/2048 KB/);assert.match(await dialog.innerText(),/fixture/);
    await page.screenshot({path:`${output}/teacher-submission-detail.png`,fullPage:true,animations:'disabled'});
    await page.keyboard.press('Escape');
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出 CSV',exact:true}).click()]);
    await download.saveAs(`${output}/teacher-filtered-submissions.csv`);
    const csv=await fs.readFile(`${output}/teacher-filtered-submissions.csv`,'utf8');assert.equal(csv.trim().split('\n').length,2);
  });
  await check('teacher queue route, logs and priority operation',async()=>{
    await page.goto(`${base}/teacher/contests/${cid}`);await page.getByRole('tab',{name:'比赛巡查',exact:true}).click();
    await page.getByRole('button',{name:'打开本场判题队列',exact:true}).click();await page.waitForURL(`**/teacher/contests/${cid}/judge/queue?*`);await table();
    await page.getByRole('button',{name:'日志',exact:true}).first().click();await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'优先级',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'调整优先级'});await dialog.getByRole('spinbutton').fill('21');
    await dialog.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('优先级已更新',{exact:true}).waitFor();
    await page.screenshot({path:`${output}/teacher-contest-queue.png`,fullPage:true,animations:'disabled'});
  });
  await check('teacher practice server pagination and old-row filter beyond 1000 records',async()=>{
    await page.goto(`${base}/teacher/practices/submissions`);await table();await page.getByText('共 1006 条',{exact:true}).waitFor();
    const request=page.waitForResponse(r=>r.url().includes('/submissions?')&&new URL(r.url()).searchParams.get('keyword')==='Parity exercise'&&r.ok());
    await page.getByPlaceholder('搜索学生、题目、题单或提交 ID').fill('Parity exercise');await request;
    await page.locator('.filters .el-select').filter({hasText:'语言'}).click();await page.getByRole('option',{name:'Python',exact:true}).click();
    await page.getByText('共 1 条',{exact:true}).waitFor();assert.match(await page.locator('.el-table__body-wrapper').innerText(),new RegExp(process.env.QOJ_PARITY_OLD_ID));
    await page.screenshot({path:`${output}/teacher-practice-filter.png`,fullPage:true,animations:'disabled'});
  });
  await check('teacher roster file upload and duplicate result',async()=>{
    await page.goto(`${base}/teacher/contests/${cid}`);await page.getByRole('tab',{name:/报名名单/}).click();
    await page.getByRole('button',{name:'批量导入名单',exact:true}).click();const dialog=page.getByRole('dialog',{name:'批量导入名单'});
    await dialog.getByText('上传文件',{exact:true}).click();await dialog.getByLabel('名单文件').setInputFiles({name:'parity.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFF学号\nPARITY-FILE\nPARITY-FILE\nUNKNOWN\n')});
    await dialog.getByRole('button',{name:'开始导入',exact:true}).click();await dialog.getByText('导入完成：新增 1 人，跳过 1 条，失败 1 条',{exact:true}).waitFor();
    await page.screenshot({path:`${output}/teacher-roster-import.png`,fullPage:true,animations:'disabled'});await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  });
  await check('teacher WebSocket broadcast and reply persist after reload with correct teacher session',async()=>{
    await page.getByRole('tab',{name:'答疑与广播',exact:true}).click();
    await page.getByRole('button',{name:'比赛广播',exact:true}).click();await page.getByLabel('广播内容').fill('Browser teacher broadcast');
    // Wait for the authenticated contest-message subscription to be ready before publishing.
    await page.waitForFunction(()=>!document.querySelector('.admin-chat .el-alert--warning'));
    await page.getByRole('button',{name:'发送广播',exact:true}).click();await page.getByText('广播已发送，所有报名选手可接收并在刷新后补看。',{exact:true}).waitFor();
    await page.getByRole('button',{name:/选手答疑/}).click();await page.getByLabel('答疑回复内容').fill('Browser teacher reply');
    await page.getByRole('button',{name:'发送回复',exact:true}).click();await page.getByText('回复已发送，仅该选手可查看。',{exact:true}).waitFor();
    await page.reload();await page.getByRole('tab',{name:'答疑与广播',exact:true}).click();await page.getByLabel('选手答疑对话').getByText('Browser teacher reply',{exact:true}).waitFor();
    await page.getByRole('button',{name:'比赛广播',exact:true}).click();await page.getByText('Browser teacher broadcast',{exact:true}).waitFor();
    await page.screenshot({path:`${output}/teacher-contest-messages.png`,fullPage:true,animations:'disabled'});
  });
  await check('teacher contest inspection has real queue statistics',async()=>{
    await page.getByRole('tab',{name:'比赛巡查',exact:true}).click();await page.getByText('当前未发现 SE / FAILED 系统失败提交。',{exact:true}).waitFor();
    await page.screenshot({path:`${output}/teacher-contest-inspection.png`,fullPage:true,animations:'disabled'});
  });
  assert.ok(authorization.filter(x=>x.url.includes('/submissions')||x.url.includes('/submission-queue')||x.url.includes('/messages')||x.url.includes('/registrations')).every(x=>x.token===`Bearer ${process.env.QOJ_TEACHER_TOKEN}`),'Teacher pages must never use the simultaneously signed-in admin token');
  await check('administrator shared page regression',async()=>{
    const env=await fs.readFile('.env','utf8');const prefix=env.match(/^VITE_ADMIN_PREFIX=['"]?([^'"\n]+)/m)?.[1]||'admin';
    await page.goto(`${base}/${prefix}/contests/${cid}/submissions`);await table();await page.getByRole('button',{name:'查看',exact:true}).first().click();await page.getByRole('dialog').waitFor();
    await page.screenshot({path:`${output}/admin-submission-regression.png`,fullPage:true,animations:'disabled'});
  });
  assert.deepEqual(errors,[]);passed=true;
}finally{
  await context.tracing.stop({path:`${output}/teacher-management-trace.zip`});
  await fs.writeFile(`${output}/ui-report.json`,JSON.stringify({passed,checks,errors},null,2));
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}

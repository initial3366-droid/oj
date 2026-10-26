// Real login E2E with ephemeral accounts in the disposable database harness.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QOJ_E2E_OUTPUT || 'artifacts/contest-editor');await fs.mkdir(out,{recursive:true});
const api=process.env.QOJ_API_BASE; assert.ok(api && process.env.QOJ_ADMIN_TOKEN, 'Run with QOJ_CONTEST_EDITOR_UI=1 in the disposable database harness');
const env=await fs.readFile('.env','utf8');const prefix=env.match(/^VITE_ADMIN_PREFIX=['"]?([^'"\n]+)/m)?.[1] || 'admin';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){const target=new URL(req.url,api);const upstream=http.request(target,{method:req.method,headers:{...req.headers,host:target.host,origin:'http://127.0.0.1:5173'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;}
  let file=path.resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(path.resolve('dist')+path.sep))file=path.resolve('dist/index.html');
  let data;try{data=await fs.readFile(file);}catch{file=path.resolve('dist/index.html');data=await fs.readFile(file);}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'});
const checks=[];let passed=false;
try {
  for(const portal of ['admin','teacher']) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({portal,token})=>(portal==='teacher'?localStorage:sessionStorage).setItem(portal==='teacher'?'qoj.teacherAccessToken':'qoj.adminAccessToken',token),{portal,token:process.env[portal==='teacher'?'QOJ_TEACHER_TOKEN':'QOJ_ADMIN_TOKEN']});
    await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const management=`/${portal==='admin'?prefix:'teacher'}/contests`;
    const apiPrefix=process.env.QOJ_API_PREFIX;
    async function currentScores(){return page.locator('.score-settings').evaluate(el=>Array.from(el.previousElementSibling.querySelectorAll('input[role="spinbutton"]')).map(input=>Number(input.value)));}
    async function setTotal(value){const input=page.locator('.score-settings input[role="spinbutton"]');await input.fill(String(value));await input.press('Tab');await page.getByText(`当前题目总分：${value} 分`,{exact:true}).waitFor();await page.waitForLoadState('networkidle');}
    try {
      if(portal==='admin') {
        await page.goto(`${base}${management}`);
        const listRows=page.locator('.el-table__body-wrapper tbody tr');
        await listRows.nth(9).waitFor();assert.equal(await listRows.count(),10);
        const first=await listRows.first().innerText();
        await page.locator('.pagination .btn-next').click();
        await page.waitForTimeout(100);assert.notEqual(await listRows.first().innerText(),first);
        await page.getByPlaceholder('搜索比赛名称或 ID',{exact:true}).fill('Pagination fixture');
        await page.waitForTimeout(100);assert.equal(await listRows.count(),10);
        await page.locator('.pagination .btn-next').click();
        await page.waitForTimeout(100);assert.equal(await listRows.count(),2);
        await page.getByPlaceholder('搜索比赛名称或 ID',{exact:true}).fill('Pagination fixture 11');
        await page.waitForTimeout(100);assert.equal(await listRows.count(),1);
        checks.push({portal,scenario:'contest list defaults to 10 rows, paginates, searches all rows and resets page',passed:true});
      }
      await page.goto(`${base}${management}/${process.env.QOJ_MANAGED_ID}`);
      await page.getByRole('button',{name:'查看完整榜单',exact:true}).waitFor();
      assert.equal(await page.getByRole('tab',{name:'排行榜',exact:true}).count(),0);
      await page.getByRole('button',{name:'查看完整榜单',exact:true}).click();
      const pane=page.locator('.ranking-card');
      await pane.locator('.management-score-table tbody tr').nth(3).waitFor();
      {
        const body=pane.locator('tbody tr');
        const name=(await body.first().locator('td').nth(1).innerText()).trim();
        await page.getByRole('textbox',{name:'搜索姓名',exact:true}).fill(name);
        assert.ok(await body.count()>=1);
        await page.getByRole('textbox',{name:'搜索姓名',exact:true}).fill('no_matching_user_92847');
        await page.getByText('暂无符合条件的参赛者',{exact:true}).waitFor();
        await page.getByRole('button',{name:'重置筛选',exact:true}).click();
        await body.nth(3).waitFor();
        await page.locator('.ranking-filters .el-select').click();
        const choice=page.getByRole('option').first();const label=(await choice.innerText()).trim();await choice.click();
        const cells=await body.locator('td:nth-child(3)').allTextContents();
        assert.ok(cells.length>0 && cells.every(value=>value.trim()===label));
        await page.getByRole('button',{name:'重置筛选',exact:true}).click();
        await body.nth(3).waitFor();
        for(const token of [undefined,process.env.QOJ_STUDENT_TOKEN]) {
          const response=await context.request.get(`${api}${apiPrefix}/contests/${process.env.QOJ_MANAGED_ID}/management-scoreboard`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
          const payload=await response.json();
          assert.ok(response.status()===401 || response.status()===403 || payload.code===401 || payload.code===403,JSON.stringify(payload));
        }
        const denied=await context.request.get(`${api}${apiPrefix}/contests/${process.env.QOJ_UNOWNED_CONTEST_ID}/management-scoreboard`,{headers:{Authorization:`Bearer ${process.env.QOJ_TEACHER_TOKEN}`}});
        const deniedBody=await denied.json();
        assert.ok(denied.status()===403 || deniedBody.code===40003 || deniedBody.code===403,JSON.stringify(deniedBody));
        checks.push({portal,scenario:'standalone board filters by name and class, denies unauthenticated and student access',passed:true});
      }

      assert.equal(await pane.getByRole('columnheader',{name:'总分',exact:true}).count(),1);
      assert.equal(await pane.locator('thead .problem-column').count(),3);
      assert.deepEqual(await pane.locator('tbody tr').first().locator('td.problem-column').allTextContents(),['34','33','33']);
      const rankingRows=pane.locator('tbody tr');
      assert.equal(await rankingRows.count(),10);
      assert.equal(await pane.getByRole('columnheader',{name:'学号',exact:true}).count(),0);
      await pane.locator('.btn-next').click();
      await page.waitForTimeout(100);
      assert.equal(await rankingRows.count(),5);
      await page.getByRole('textbox',{name:'搜索姓名',exact:true}).fill('Management 100');
      await page.waitForTimeout(100);assert.equal(await rankingRows.count(),1);
      await page.getByRole('button',{name:'重置筛选',exact:true}).click();
      for(const width of [1440,768,390]) {
        await page.setViewportSize({width,height:1000});
        await page.waitForTimeout(150);
        const overflow=await pane.evaluate(el=>Array.from(el.querySelectorAll('*')).filter(node=>node.clientWidth>0 && node.scrollWidth>node.clientWidth+2).map(node=>node.className));
        assert.deepEqual(overflow,[],`internal overflow at ${width}: ${overflow}`);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
        await page.screenshot({path:`${out}/${portal}-ranking-${width}.png`,fullPage:true});
      }
      await page.setViewportSize({width:1440,height:1000});
      checks.push({portal,scenario:'no student number, default 10 rows, next page, filter resets pagination, responsive without horizontal overflow',passed:true});
      for(const text of ['滚榜控制台','本场提交队列','打开外榜'])assert.equal(await pane.getByText(text,{exact:true}).count(),0);
      await page.screenshot({path:`${out}/${portal}-scoreboard-only.png`,fullPage:true,animations:'disabled'});
      checks.push({portal,scenario:'detail tab removed, independent complete ranking page',passed:true});
      for(const kind of ['OI','LANQIAO']) {
        await page.goto(`${base}${management}/new`);
        await page.getByRole('button',{name:'创建比赛',exact:true}).waitFor();
        await page.locator('.form-grid .el-select').first().click();await page.getByRole('option',{name:kind==='OI'?'OI':'蓝桥杯',exact:true}).click();
        await page.locator('.folder-problem-picker .el-select').click();await page.getByRole('option',{name:'Editor problems',exact:true}).click();
        await page.getByRole('button',{name:'添加本页未选题目',exact:true}).click();await page.getByText('当前题目总分：100 分',{exact:true}).waitFor();
        const settings=page.locator('.score-settings');await settings.scrollIntoViewIfNeeded();
        assert.ok(await settings.evaluate(el=>el.getBoundingClientRect().top-el.previousElementSibling.getBoundingClientRect().bottom)>=19);
        await setTotal(175);assert.deepEqual(await currentScores(),[59,58,58]);
        await page.getByRole('button',{name:'设为 100 分',exact:true}).click();await page.getByText('当前题目总分：100 分',{exact:true}).waitFor();assert.deepEqual(await currentScores(),[34,33,33]);
        const score=page.locator('.score-settings').locator('xpath=preceding-sibling::div[contains(@class,"el-table")]').locator('input[role="spinbutton"]').first();
        await score.fill('40');await score.press('Tab');await page.getByText('当前题目总分：106 分',{exact:true}).waitFor();
        await page.getByRole('button',{name:'按总分均分题目',exact:true}).click();assert.deepEqual(await currentScores(),[36,35,35]);
        await setTotal(175);
        await page.locator('.form-grid .el-input input').first().fill(`${portal} ${kind} custom total`);
        await settings.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${portal}-${kind}-create.png`,fullPage:true,animations:'disabled'});
        const creating=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===apiPrefix+'/contests');
        await page.getByRole('button',{name:'创建比赛',exact:true}).click();const response=await creating;const result=await response.json();assert.equal(result.code,200,JSON.stringify(result));
        const payload=response.request().postDataJSON();assert.equal(payload.problems.reduce((sum,item)=>sum+item.score,0),175);
        assert.ok(payload.problems.every(item=>item.caseScores.reduce((sum,test)=>sum+test.score,0)===item.score));
        const id=result.data.id;
        await page.goto(`${base}${management}/${id}/edit`);await page.getByRole('button',{name:'保存修改',exact:true}).waitFor();
        assert.equal(await page.locator('.score-settings input[role="spinbutton"]').inputValue(),'175');
        assert.deepEqual(await currentScores(),[59,58,58]);
        await setTotal(250);assert.deepEqual(await currentScores(),[84,83,83]);
        await page.getByRole('button',{name:'设为 100 分',exact:true}).click();await page.getByText('当前题目总分：100 分',{exact:true}).waitFor();
        await setTotal(200);
        const updating=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname===apiPrefix+`/contests/${id}`);
        await page.getByRole('button',{name:'保存修改',exact:true}).click();const updated=await updating;assert.equal((await updated.json()).code,200);
        await page.goto(`${base}${management}/${id}/edit`);await page.getByRole('button',{name:'保存修改',exact:true}).waitFor();assert.equal(await page.locator('.score-settings input[role="spinbutton"]').inputValue(),'200');
        await page.locator('.score-settings').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${portal}-${kind}-edit.png`,fullPage:true,animations:'disabled'});
        if(kind==='LANQIAO') {
          await page.setViewportSize({width:390,height:844});await page.locator('.score-settings').scrollIntoViewIfNeeded();
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.screenshot({path:`${out}/${portal}-mobile-score-settings.png`,fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
        }
        checks.push({portal,kind,scenario:'real create and edit persist custom total; reset 100, manual per-problem totals, case splits and spacing',passed:true});
      }
      assert.deepEqual(errors,[]);assert.equal(await page.locator('.el-message--error').count(),0);
    } finally {await context.tracing.stop({path:`${out}/${portal}-editor-trace.zip`});await context.close();}
  }
  passed=true;
} finally {
  await fs.writeFile(`${out}/ui-report.json`,JSON.stringify({passed,checks,scope:'real built frontend and disposable backend/database; no mocks'},null,2));
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}

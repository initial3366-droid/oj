import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/problem-editor-flow';
await fs.mkdir(out, { recursive: true });
await fs.rm(`${out}/report.json`, {force:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
await context.addInitScript(()=>{
  sessionStorage.setItem('qoj.adminAccessToken','fixture');
  localStorage.setItem('qoj.teacherAccessToken','fixture');
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors=[],requests=[],checks=[];
page.on('pageerror', e=>errors.push(e.message));
let cases, failSave=false,failLoad=false,nextId=40;
function resetCases(){cases=[{id:11,caseNo:1,input:'1 2\n',output:'3\n',publicInput:'公开输入1'},{id:12,caseNo:2,input:'4 5\n',output:'9\n',publicInput:'公开输入2'}];}
resetCases();
const summary=()=>cases.map(({id,caseNo})=>({id,caseNo,inputBytes:4,outputBytes:2}));
await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api\/(?:[^/]+\/)?v1/,'');
  if(!url.pathname.startsWith('/api/'))return route.continue();
  requests.push({path,method:request.method(),body:request.postData()});
  let data={};
  if(path==='/me')data={id:1,username:'editor',displayName:'题目管理员',role:'SUPER_ADMIN',status:'ACTIVE'};
  else if(path==='/settings/frontend')data={siteTitle:'QOJ'};
  else if(path==='/problems/1' && request.method()==='PUT'){
    if(failSave)return route.fulfill({status:500,json:{code:500,message:'题目保存失败'}});
    data=null;
  }else if(path==='/problems/1')data={id:1,title:'两数相加',statement:'<p>输入两个整数，输出它们的和。</p>',timeLimit:1000,memoryLimit:256,difficulty:1,samples:[],tags:[],accessScope:'PRIVATE'};
  else if(path.endsWith('/checker-source'))data='';
  else if(path.endsWith('/communication-config'))data={enabled:false};
  else if(path==='/problems/1/test-cases'){
    if(failLoad)return route.fulfill({status:503,json:{code:503,message:'测试点读取失败'}});
    data=cases;
  }else if(path==='/problems/1/test-cases/changes'){
    const {changes,deletedIds}=request.postDataJSON();
    cases=cases.filter(c=>!deletedIds.includes(c.id));
    for(const change of changes){const i=cases.findIndex(c=>c.id===change.id);if(i<0)cases.push({...change,id:nextId++});else cases[i]={...cases[i],...change};}
    data=summary();
  }else if(path==='/problems/1/test-cases/zip'){
    cases=[{id:30,caseNo:1,input:'导入的输入',output:'导入的输出',publicInput:''}];
    return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',data:{code:200,data:null}})+'\n'});
  }else if(path==='/problem-drafts')data={draftId:'draft-1',basic:{title:'新题目',statement:'<p>新题题面</p>'},testCases:[]};
  else if(path==='/problem-drafts/draft-1/basic')data=null;
  else data=[];
  return route.fulfill({json:{code:200,message:'ok',data}});
});
const base=process.env.QOJ_FRONTEND_URL || 'http://127.0.0.1:5173';
const save=()=>page.getByRole('button',{name:'保存题目',exact:true});
const view=()=>page.getByRole('button',{name:'保存题目并查看测试点',exact:true});
const inputs=()=>page.locator('.case-card textarea');
async function open(path){await page.goto(base+path);}
try{
  for(const portal of ['auth_ac','teacher']){
    resetCases();
    await open(`/${portal}/problems/1/edit`);await save().waitFor();
    let start=requests.length;
    await save().click();await page.getByText('题目信息已保存',{exact:true}).first().waitFor();
    assert.equal(await save().isVisible(),true);
    assert.equal(await page.locator('.testcase-toolbar').count(),0);
    assert.equal(requests.slice(start).filter(r=>r.path.includes('/test-cases')).length,0);
    checks.push(`${portal}: 保存题目保持内容页，不请求测试点`);
    await view().click();await inputs().first().waitFor();
    assert.equal(await inputs().count(),4);
    assert.deepEqual(await inputs().evaluateAll(items=>items.map(el=>el.value)),['1 2\n','3\n','4 5\n','9\n']);
    assert.equal(await page.getByRole('button',{name:'加载并编辑此测试点'}).count(),0);
    assert.ok(requests.slice(start).some(r=>r.path==='/problems/1/test-cases' && r.method==='GET'));
    checks.push(`${portal}: 保存并查看自动加载全部输入输出`);
    start=requests.length;
    await page.getByRole('button',{name:'保存测试数据',exact:true}).click();
    await page.getByText('测试点已保存',{exact:true}).first().waitFor();
    assert.equal(requests.slice(start).filter(r=>r.method==='POST').length,0);
    await inputs().first().fill('修改后的输入');
    await page.getByRole('button',{name:'保存测试数据',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.editor-actions .is-loading'));
    assert.equal(await inputs().first().inputValue(),'修改后的输入');
    assert.equal(await inputs().count(),4);
    start=requests.length;
    await page.getByRole('button',{name:'保存测试数据',exact:true}).click();
    await page.waitForTimeout(150);
    assert.equal(requests.slice(start).filter(r=>r.method==='POST').length,0);
    checks.push(`${portal}: 保存测试点后正文仍可见，未修改时不重复写入`);
    assert.equal(cases[0].publicInput,'公开输入1','保存普通题时不得清空隐藏的通信输入');
    await page.locator('.case-card').nth(1).getByRole('button',{name:'删除',exact:true}).click();
    await page.getByRole('button',{name:'添加测试点',exact:true}).click();
    await inputs().nth(2).fill('新增输入');await inputs().nth(3).fill('新增输出');
    await page.getByRole('button',{name:'保存测试数据',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.editor-actions .is-loading'));
    assert.equal(await inputs().nth(2).inputValue(),'新增输入');
    assert.equal(await inputs().nth(3).inputValue(),'新增输出');
    start=requests.length;
    await page.getByRole('button',{name:'保存测试数据',exact:true}).click();await page.waitForTimeout(150);
    assert.equal(requests.slice(start).filter(r=>r.method==='POST').length,0);
    checks.push(`${portal}: 新增删除后保留正文及新ID，不重复保存，也不清空通信输入`);
    await page.screenshot({path:`${out}/${portal}-test-cases.png`,fullPage:true});
    await open(`/${portal}/problems/1/test-cases`);await inputs().first().waitFor();
    assert.equal(await inputs().count(),4);
    checks.push(`${portal}: 直接打开测试点编辑自动加载全部正文`);
  }
  await open('/auth_ac/problems/1/edit');await save().waitFor();
  await page.setViewportSize({width:390,height:844});await save().scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/save-actions-mobile.png`,fullPage:true});
  assert.equal(await save().isVisible(),true);assert.equal(await view().isVisible(),true);
  await page.setViewportSize({width:1440,height:1000});
  failSave=true;let start=requests.length;await view().click();
  await page.getByText('题目保存失败',{exact:true}).first().waitFor();
  assert.equal(await save().isVisible(),true);assert.equal(requests.slice(start).filter(r=>r.path.includes('/test-cases')).length,0);
  failSave=false;failLoad=true;await view().click();
  await page.getByText(/题目信息已保存，但测试点列表加载失败/).first().waitFor();
  assert.equal(await save().isVisible(),true);failLoad=false;
  checks.push('保存失败不进入测试点；保存成功但加载失败明确区分结果并保留内容页');
  await view().click();await inputs().first().waitFor();
  await page.locator('.upload-button input').setInputFiles({name:'tests.zip',mimeType:'application/zip',buffer:Buffer.from('fixture-zip')});
  await page.locator('.el-message-box:visible').getByRole('button',{name:'追加',exact:true}).click();
  await page.getByText('追加导入完成',{exact:true}).first().waitFor();
  assert.equal(await inputs().first().inputValue(),'导入的输入');
  checks.push('ZIP 导入后自动加载最新完整测试点');
  await open('/auth_ac/problems/new');
  await page.getByRole('button',{name:'保存并编辑测试点',exact:true}).click();await page.locator('.testcase-toolbar').waitFor();
  checks.push('新建题目保留草稿与测试点创建流程');
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,requests,errors,scope:'real Vue UI with deterministic API fixtures'},null,2));
  console.log(JSON.stringify({passed:true,checks}));
}catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw e;}
finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

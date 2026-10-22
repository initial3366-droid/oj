import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5178';
const out='.runtime/frontend-session-tabs';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const checks=[];
function jwt(extra){return `e2e.${Buffer.from(JSON.stringify({sub:1,userId:1,role:'STUDENT',exp:Math.floor(Date.now()/1000)+7200,sessionExpiresAt:Math.floor(Date.now()/1000)+10800,...extra})).toString('base64url')}.fixture`;}
try {
 for(const remember of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true});
  const tokens={accessToken:jwt({jti:'initial'}),refreshToken:jwt({familyId:`family-${remember}`,jti:'r0'})};
  let latest=tokens,refreshCount=0;const protectedRequests=[],errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const problem={id:1,contestProblemId:1,title:'会话测试题',statement:'<p>仅已报名用户可读题面</p>',inputFormat:'两个数',outputFormat:'和',samples:[],difficulty:1,tags:[],timeLimit:1000,memoryLimit:256};
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;if(!path.startsWith('/api/'))return route.continue();let data=[];
   if(path==='/api/v1/auth/login'){assert.equal(request.postDataJSON().rememberMe,remember);data={...tokens,portal:'USER'};}
   else if(path==='/api/v1/auth/refresh'){
    const supplied=request.postDataJSON().refreshToken;assert.equal(supplied,latest.refreshToken,'只允许使用最新刷新令牌');refreshCount++;
    latest={accessToken:jwt({jti:`a${refreshCount}`}),refreshToken:jwt({familyId:`family-${remember}`,jti:`r${refreshCount}`})};data=latest;
   }
   else if(path==='/api/v1/auth/me')data={id:1,username:'fixture',email:'fixture@example.com',role:'STUDENT'};
   else if(path==='/api/v1/settings/frontend')data={siteTitle:'QOJ'};
   else if(path==='/api/v1/contests/1')data={id:1,title:'已报名比赛',registered:true,status:'RUNNING',type:'ACM',audience:'ALL',registrationType:'PUBLIC',startTime:'2026-01-01T10:00:00',endTime:'2030-01-01T10:00:00',problems:[{...problem,problemId:1,label:'A'}]};
   else if(path==='/api/v1/contests/1/problems/1'){
    const authorization=request.headers().authorization;protectedRequests.push(authorization);
    if(!authorization){await route.fulfill({status:401,json:{code:401,message:'未登录'}});return;}
    data=problem;
   }
   else if(path.includes('submissions'))data={list:[],total:0};
   else if(path==='/api/v1/settings/code-templates')data={};
   await route.fulfill({json:{code:200,message:'ok',data}});
  });
  const page=await context.newPage();await page.goto(`${base}/login`);
  // Exercise the production login API and storage function in the real browser.
  await page.evaluate(async remember=>{const {login}=await import('/src/data/apiClient.ts');await login('fixture','fixture-password',remember);},remember);
  await page.goto(`${base}/contests/1`);await page.getByRole('tab',{name:'题目列表',exact:true}).waitFor();
  const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'会话测试题',exact:true}).click();const popup=await popupPromise;
  await popup.locator('.problem-rich-text').getByText('仅已报名用户可读题面').waitFor();
  assert.equal(await popup.evaluate(()=>window.opener===null),true);
  const stored=await popup.evaluate(()=>({session:sessionStorage.getItem('qoj.accessToken'),local:localStorage.getItem('qoj.accessToken')}));
  assert.equal(remember?stored.local:stored.session,tokens.accessToken);if(!remember)assert.equal(stored.local,null);
  assert.ok(!popup.url().includes('Token')&&!popup.url().includes('fixture'));
  await popup.reload();await popup.locator('.problem-rich-text').getByText('仅已报名用户可读题面').waitFor();
  const expired=jwt({exp:Math.floor(Date.now()/1000)-1,jti:'expired'});
  for(const tab of [page,popup])await tab.evaluate(({remember,expired})=>(remember?localStorage:sessionStorage).setItem('qoj.accessToken',expired),{remember,expired});
  await Promise.all([page,popup].map(tab=>tab.evaluate(async()=>{const {getValidFrontendAccessToken}=await import('/src/api/authSession.ts');return getValidFrontendAccessToken();})));
  assert.equal(refreshCount,1,'跨页并发续期只发送一次请求');
  for(const tab of [page,popup])assert.equal(await tab.evaluate(()=>sessionStorage.getItem('qoj.refreshToken')||localStorage.getItem('qoj.refreshToken')),latest.refreshToken);
  await popup.screenshot({path:`${out}/${remember?'remembered':'session'}-problem.png`,fullPage:true});
  const independent=await context.newPage();await independent.goto(`${base}/login`);
  assert.equal(await independent.evaluate(()=>sessionStorage.getItem('qoj.accessToken')),null,'独立标签页不自动继承临时登录');await independent.close();
  await page.evaluate(async()=>{const {clearFrontendTokens}=await import('/src/api/authSession.ts');clearFrontendTokens();});
  await popup.waitForFunction(()=>!sessionStorage.getItem('qoj.accessToken')&&!localStorage.getItem('qoj.accessToken'));
  assert.deepEqual(errors,[]);checks.push({remember,newTabAuthenticated:true,reload:true,openerDetached:true,concurrentRefresh:refreshCount,logoutSynchronized:true,protectedRequests:protectedRequests.length});
  await context.tracing.stop({path:`${out}/${remember?'remembered':'session'}-trace.zip`});await context.close();
 }
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}

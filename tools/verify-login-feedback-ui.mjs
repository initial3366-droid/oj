// Real login E2E with ephemeral accounts in the disposable database harness.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QOJ_E2E_OUTPUT || 'artifacts/login-feedback');await fs.mkdir(out,{recursive:true});
const api=process.env.QOJ_API_BASE; assert.ok(api && process.env.QOJ_E2E_PASSWORD, 'Run with QOJ_LOGIN_UI=1 in the disposable database harness');
const env=await fs.readFile('.env','utf8');const prefix=env.match(/^VITE_ADMIN_PREFIX=['"]?([^'"\n]+)/m)?.[1] || 'admin';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){const target=new URL(req.url,api);const upstream=http.request(target,{method:req.method,headers:{...req.headers,host:target.host,origin:'http://127.0.0.1:5173'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;}
  let file=path.resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(path.resolve('dist')+path.sep))file=path.resolve('dist/index.html');
  let data;try{data=await fs.readFile(file);}catch{file=path.resolve('dist/index.html');data=await fs.readFile(file);}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const { execFile } = await import('node:child_process');
const { promisify } = await import('node:util');
const exec = promisify(execFile);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'});
const checks=[];let passed=false;
try {
  for (const portal of ['public','admin','teacher']) for (const success of [false,true]) {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.tracing.start({screenshots:true,snapshots:true});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      const pathname=portal==='public'?'/login':`/${portal==='admin'?prefix:'teacher'}/login`;
      const captchaResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/captcha/image');
      await page.goto(base+pathname);
      const challenge=(await (await captchaResponse).json()).data;
      const { stdout }=await exec('docker',['exec','-e','REDISCLI_AUTH','qoj-redis','redis-cli','-n','15','--raw','GET','oj:captcha:'+challenge.captchaId],{env:{...process.env,REDISCLI_AUTH:process.env.QOJ_E2E_REDIS_PASSWORD}});
      const captcha=stdout.trim();assert.match(captcha,/^[a-zA-Z0-9]+$/);
      assert.equal(await page.locator('input[type=checkbox]:visible').count(),0);
      const username=portal==='admin'?'privacy_admin':portal==='teacher'?'lane_teacher':'sandbox_e2e';
      await page.getByPlaceholder(portal==='public'?'请输入用户名':'用户名',{exact:true}).fill(username);
      await page.getByPlaceholder(portal==='public'?'请输入密码':'密码',{exact:true}).fill(success?process.env.QOJ_E2E_PASSWORD:'incorrect-password');
      await page.getByPlaceholder(portal==='public'?'请输入验证码':'验证码',{exact:true}).fill(captcha);
      const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/auth/login')&&response.request().method()==='POST');
      await page.getByRole('button',{name:portal==='public'?'登录账号':'登录',exact:true}).click();
      const response=await responsePromise;const result=await response.json();
      if(success) {
        assert.equal(result.code,200);
        await page.locator('.el-message--success').filter({hasText:'登录成功'}).waitFor();
        assert.equal(await page.locator('.el-message--success').count(),1);
        await page.screenshot({path:`${out}/${portal}-login-success.png`,fullPage:true,animations:'disabled'});
        await page.waitForURL(portal==='public'?'**/user-center':portal==='teacher'?'**/teacher/dashboard':`**/${prefix}/dashboard`);
        const key=portal==='public'?'qoj.accessToken':portal==='admin'?'qoj.adminAccessToken':'qoj.teacherAccessToken';
        const session=await page.evaluate(key=>({token:localStorage.getItem(key),temporary:sessionStorage.getItem(key)}),key);
        assert.ok(session.token);assert.equal(session.temporary,null);
        const claims=JSON.parse(Buffer.from(session.token.split('.')[1],'base64url').toString());
        assert.ok(Math.abs(claims.sessionExpiresAt-claims.iat-48*3600)<=2);
        const saved=await context.storageState();
        const reopened=await browser.newContext({storageState:saved});
        const reopenedPage=await reopened.newPage();await reopenedPage.goto(page.url());
        await reopenedPage.waitForLoadState('networkidle');assert.ok(!new URL(reopenedPage.url()).pathname.endsWith('/login'));
        await reopened.close();
        const refreshKey=portal==='public'?'qoj.refreshToken':portal==='admin'?'qoj.adminRefreshToken':'qoj.teacherRefreshToken';
        const refreshToken=await page.evaluate(key=>localStorage.getItem(key),refreshKey);
        const refreshed=await context.request.post(base+'/api/v1/auth/refresh',{data:{refreshToken}});
        const refreshedBody=await refreshed.json();assert.equal(refreshedBody.code,200);
        const rotated=JSON.parse(Buffer.from(refreshedBody.data.accessToken.split('.')[1],'base64url').toString());
        assert.equal(rotated.sessionExpiresAt,claims.sessionExpiresAt);


      } else {
        assert.notEqual(result.code,200);
        if(portal==='public')await page.locator('.auth-message').waitFor();
        else await page.locator('.el-message--error').waitFor();
        assert.equal(await page.locator('.el-message--success').count(),0);
        assert.ok(new URL(page.url()).pathname.endsWith('/login'));
      }
      assert.deepEqual(errors,[]);
      checks.push({portal,scenario:success?'successful login shows exactly one success notice and redirects':'invalid password remains on login without success notice',passed:true});
    } finally {
      await context.tracing.stop({path:`${out}/${portal}-${success?'success':'failure'}-trace.zip`});
      await context.close();
    }
  }
  passed=true;
} finally {
  await fs.writeFile(`${out}/login-ui-report.json`,JSON.stringify({passed,checks,scope:'real built frontend and isolated backend accounts; no login API mocks'},null,2));
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}

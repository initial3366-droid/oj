// Read-only browser E2E: real built UI and live captcha; no credentials or login requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve('artifacts/admin-login-simple');await fs.mkdir(out,{recursive:true});
const api=process.env.QOJ_API_BASE || 'http://127.0.0.1:18080';
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
const context=await browser.newContext();await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();const errors=[],checks=[];let loginRequests=0,passed=false;
page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.method()==='POST'&&req.url().includes('/auth/login'))loginRequests++;});
try{
  for(const portal of ['admin','teacher']) for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.goto(`${base}/${portal==='admin'?prefix:'teacher'}/login`);
    await page.getByPlaceholder('用户名',{exact:true}).waitFor();
    await page.locator('.login-card__captcha img').waitFor();
    for(const selector of ['.login-brand','.login-toolbar','.login-footer','.login-card__title','.login-card__desc','.login-card__demo','.login-card__alt','.login-card__options > a'])assert.equal(await page.locator(selector).isVisible(),false,selector);
    assert.equal(await page.locator('form:visible').count(),1);
    assert.match(await page.locator('.login-page').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);
    const remember=page.getByRole('checkbox',{name:'记住密码',exact:true});const label=page.getByText('记住密码',{exact:true});const initial=await remember.isChecked();await label.click();assert.equal(await remember.isChecked(),!initial);await label.click();assert.equal(await remember.isChecked(),initial);
    const form=await page.locator('form').boundingBox();assert.ok(Math.abs(form.x+form.width/2-viewport.width/2)<2);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${out}/${portal}-${viewport.width>1000?'desktop':'mobile'}.png`,fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByText('请输入用户名',{exact:true}).waitFor();
    checks.push(`${portal} ${viewport.width}px: only centered form visible; live captcha, remember toggle and empty-form validation work`);
  }
  assert.equal(loginRequests,0);assert.deepEqual(errors,[]);passed=true;
}finally{
  await context.tracing.stop({path:`${out}/trace.zip`});await fs.writeFile(`${out}/report.json`,JSON.stringify({passed,checks,loginRequests,errors,command:'node tools/verify-admin-login-simple.mjs'},null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}

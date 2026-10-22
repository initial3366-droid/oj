import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/password-reset-dialog';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext();await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage();const checks=[];
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();let data={};if(path.endsWith('/settings/frontend'))data={siteTitle:'QOJ'};if(path.endsWith('/settings/register'))data={enabled:true,emailVerification:false};if(path.endsWith('/captcha/image'))data={captchaId:'fixture',image:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};await route.fulfill({json:{code:200,data}});});
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5178/login');await page.getByRole('button',{name:'找回密码',exact:true}).click();await page.getByRole('dialog',{name:'找回密码',exact:true}).waitFor();await page.waitForTimeout(500);
  const metrics=await page.locator('.auth-reset-modal').evaluate(dialog=>{const overlay=dialog.closest('.el-overlay'),rect=overlay.getBoundingClientRect();return {overlay:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:{width:innerWidth,height:innerHeight},insideAuthPage:!!dialog.closest('.auth-page'),background:getComputedStyle(dialog).backgroundColor};});checks.push({width,...metrics});await page.screenshot({path:`${out}/${process.env.PHASE||'after'}-${width}.png`,fullPage:true});
  if(process.env.PHASE!=='before'){assert.equal(metrics.insideAuthPage,false);assert.ok(Math.abs(metrics.overlay.x)<1&&Math.abs(metrics.overlay.y)<1);assert.equal(metrics.overlay.width,width);assert.equal(metrics.overlay.height,900);assert.equal(metrics.background,'rgb(255, 255, 255)');}
  await page.getByPlaceholder('请输入注册邮箱').fill('test@example.com');await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('dialog',{name:'找回密码',exact:true}).waitFor({state:'hidden'});
 }
 await fs.writeFile(`${out}/${process.env.PHASE||'after'}.json`,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify(checks));
}finally{await context.tracing.stop({path:`${out}/${process.env.PHASE||'after'}-trace.zip`});await browser.close();}

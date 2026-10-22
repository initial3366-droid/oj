import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/boot-loading';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.tracing.start({screenshots:true,snapshots:true});
const page=await context.newPage();
let release;
const gate=new Promise(resolve=>{release=resolve;});
await page.route('**/src/vue/main.ts*',async route=>{await gate;await route.continue();});
try{
  await page.goto(process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'commit'});
  await page.getByRole('status').waitFor();
  const checks=[];
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    const metric=await page.locator('.qoj-boot-spinner').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth,height:innerHeight,animation:getComputedStyle(el).animationName};});
    assert.ok(Math.abs(metric.x-metric.width/2)<1&&Math.abs(metric.y-metric.height/2)<1);
    assert.equal(metric.animation,'qoj-boot-spin');
    await page.screenshot({path:`${out}/loading-${width}.png`});
    checks.push(metric);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.qoj-boot-spinner').evaluate(el=>getComputedStyle(el).animationName),'none');
  release();
  await page.locator('.front-header').waitFor();
  assert.equal(await page.locator('.qoj-boot-loading').count(),0);
  await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,reducedMotion:true,removedAfterMount:true},null,2));
}finally{release();await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

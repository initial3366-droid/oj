import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/qoj-ui-check/node_modules/playwright/index.mjs');
const out='.runtime/folder-create-navigation';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true,sources:true});
await context.addInitScript(()=>{const token=`e2e.${btoa(JSON.stringify({sub:1,role:'SUPER_ADMIN',exp:4102444800}))}.fixture`;sessionStorage.setItem('qoj.adminAccessToken',token);localStorage.setItem('qoj.teacherAccessToken',token);});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],saves=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
let folders=[];
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname;if(!path.startsWith('/api/'))return route.continue();
 const method=route.request().method();let data={};
 if(path.endsWith('/me'))data={id:1,username:'fixture',displayName:'测试管理员',role:path.includes('/teacher/')?'TEACHER':'SUPER_ADMIN'};
 else if(path.endsWith('/settings/frontend'))data={siteTitle:'QOJ'};
 else if(path.endsWith('/majors'))data=[{id:1,name:'计算机',code:'CS'}];
 else if(path.endsWith('/problem-folders')&&method==='POST'){const body=route.request().postDataJSON();saves.push({path,body});data={...body,id:321,canEdit:true,problemCount:0,problems:[],createdAt:'2026-10-15T16:00:00'};folders=[data];}
 else if(path.endsWith('/problem-folders'))data=folders;
 else if(path.endsWith('/problem-folders/321'))data=folders[0];
 return route.fulfill({json:{code:200,message:'ok',data}});
});
const base=process.env.QOJ_FRONTEND_URL||'http://127.0.0.1:5178';
try {
 for(const portal of ['auth_ac','teacher']){
  folders=[];
  await page.goto(`${base}/${portal}/problem-folders`);
  await page.getByRole('button',{name:'新增文件夹',exact:true}).click();
  await page.waitForURL('**/problem-folders/new');
  if(process.env.EXPECT_BROKEN){assert.equal(new URL(page.url()).pathname,'/auth_ac//problem-folders/new');await page.screenshot({path:`${out}/before.png`,fullPage:true});console.log('已复现：后台前缀尾部与路径开头拼出了双斜杠，落入404');break;}
  assert.equal(new URL(page.url()).pathname,`/${portal}/problem-folders/new`);
  await page.locator('.folder-form .el-input input').first().fill(`${portal} 导航验证文件夹`);
  await page.getByRole('button',{name:'创建',exact:true}).click();
  await page.waitForURL(`${base}/${portal}/problem-folders/321`);
  await page.getByRole('button',{name:'保存文件夹信息',exact:true}).waitFor();
  assert.equal(saves.at(-1).body.name,`${portal} 导航验证文件夹`);
  assert.equal(saves.at(-1).body.accessScope,'ALL');
  await page.screenshot({path:`${out}/${portal}-created.png`,fullPage:true});
  await page.getByRole('button',{name:'返回列表',exact:true}).click();await page.waitForURL(`${base}/${portal}/problem-folders`);
  await page.getByRole('button',{name:'编辑',exact:true}).click();await page.waitForURL(`${base}/${portal}/problem-folders/321`);
  checks.push(`${portal}: 新建页、创建后详情、返回列表、编辑跳转均无双斜杠`);
 }
 assert.deepEqual(errors,[]);
 if(!process.env.EXPECT_BROKEN)await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,saves,errors},null,2));
 console.log(JSON.stringify({passed:true,checks}));
} catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw error;}
finally{await context.tracing.stop({path:`${out}/${process.env.EXPECT_BROKEN?'before-trace':'trace'}.zip`});await browser.close();}

import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/folder-problem-picker';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true});
await context.addInitScript(()=>{const token=`e2e.${btoa(JSON.stringify({sub:1,role:'SUPER_ADMIN',exp:4102444800}))}.fixture`;sessionStorage.setItem('qoj.adminAccessToken',token);localStorage.setItem('qoj.teacherAccessToken',token);});
const page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[],saves=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const problems=Array.from({length:25},(_,i)=>({id:i+1,title:`文件夹题目${i+1}`,difficulty:1,folderId:1,testCaseCount:1,tags:[]}));
const contest={id:1,title:'文件夹比赛',type:'ACM',audience:'ALL',audienceTypes:['ALL'],classIds:[],status:'NOT_STARTED',durationMinutes:999,startTime:'2030-01-01T10:00:00',endTime:'2030-01-01T12:30:00',problems:[],registrationType:'PUBLIC'};
const practice={id:1,title:'测试题单',description:'说明',accessScope:'ALL',canEdit:true,canPublish:true,problems:[]};
const course={id:1,title:'课程',status:'ACTIVE',classIds:[1]};
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),p=url.pathname;if(!p.startsWith('/api/'))return route.continue();let data=[];const method=route.request().method();
 if(method!=='GET'){saves.push({path:p,method,body:route.request().postDataJSON()});data={id:1};}
 else if(p.endsWith('/me'))data={id:1,username:'fixture',role:p.includes('teacher')?'TEACHER':'SUPER_ADMIN',email:'fixture@example.com'};
 else if(p.endsWith('/problem-folders')||p.endsWith('/problem-folders/options'))data=[{id:1,name:'基础算法',problemCount:25},{id:2,name:'空文件夹',problemCount:0}];
 else if(p.endsWith('/problem-folders/3'))data={id:3,name:'目标文件夹',accessScope:'ALL',canEdit:true,problems:[]};
 else if(p.endsWith('/problem-folders/3/candidates')){assert.equal(url.searchParams.get('source'),'FOLDER');assert.equal(url.searchParams.get('sourceFolderId'),'1');data={list:problems.slice(0,10),total:25};}
 else if(p.endsWith('/problems')){const filtered=url.searchParams.get('folderId')==='2'?[]:problems.filter(row=>row.title.includes(url.searchParams.get('keyword')||''));const pageNum=Number(url.searchParams.get('page')||1),size=Number(url.searchParams.get('pageSize')||20);data={list:filtered.slice((pageNum-1)*size,pageNum*size),total:filtered.length};}
 else if(p.endsWith('/contests/draft'))data=null;
 else if(p.endsWith('/contests/1'))data=contest;
 else if(p.endsWith('/contests'))data=[contest];
 else if(p.endsWith('/practices/1'))data=practice;
 else if(p.endsWith('/practices/publications/1'))data={id:1,courseId:1,title:'课程发布题单',description:'说明',publicationProblems:[],problems:[],studentAccessMode:'ALL',classIds:[1],startTime:'2030-01-01T10:00:00',endTime:'2030-01-01T12:30:00'};
 else if(p.endsWith('/courses'))data={list:[course],total:1};
 else if(p.endsWith('/courses/1'))data=course;
 else if(p.endsWith('/practices'))data={list:[practice],total:1};
 await route.fulfill({json:{code:200,message:'ok',data}});
});
const base=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5173';
async function chooseFolder(name){const picker=page.locator('.folder-problem-picker');await picker.locator('.el-select').first().click();await page.getByRole('option',{name,exact:true}).click();}
async function checkPicker(label){
 const picker=page.locator('.folder-problem-picker');await picker.getByText('请先选择题目文件夹',{exact:true}).waitFor();
 await chooseFolder('空文件夹');await picker.getByText('该文件夹暂无匹配题目',{exact:true}).waitFor();
 await chooseFolder('基础算法');await picker.getByText('文件夹题目1',{exact:true}).waitFor();
 await picker.locator('.btn-next').click();await picker.getByText('文件夹题目11',{exact:true}).waitFor();
 await picker.getByRole('textbox',{name:'搜索文件夹内题目',exact:true}).fill('文件夹题目25');await picker.getByRole('button',{name:'搜索',exact:true}).click();
 await picker.getByText('文件夹题目25',{exact:true}).waitFor();await picker.getByRole('button',{name:'添加',exact:true}).click();
 await picker.getByRole('button',{name:'已添加',exact:true}).waitFor();assert.equal(await picker.getByRole('button',{name:'已添加',exact:true}).isDisabled(),true);
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
try{
 for(const prefix of ['auth_ac','teacher']){
  for(const suffix of ['contests/new','contests/1/edit','practices/new','practices/1/edit','practices/1/publish?courseId=1','practices/publications/1/edit?courseId=1']){
   await page.goto(`${base}/${prefix}/${suffix}`);
   const isContest=suffix.startsWith('contests');
   if(isContest){await page.locator('.folder-problem-picker').waitFor();assert.equal(await page.getByText('时长（分钟）',{exact:true}).count(),0);if(suffix.includes('/edit')){const dates=page.locator('.form-grid .el-date-editor input');assert.equal(await dates.nth(1).inputValue(),'2030-01-01 12:30:00');await dates.nth(0).fill('2030-01-01 11:00:00');await dates.nth(0).press('Tab');assert.equal(await dates.nth(1).inputValue(),'2030-01-01 12:30:00');}}
   else await page.getByRole('button',{name:'添加题目',exact:true}).click();
   await checkPicker(`${prefix}-${suffix.replaceAll('/','_').replaceAll('?','_').replaceAll('=','_')}`);
   if(isContest){const gap=await page.locator('.folder-problem-picker').evaluate(el=>el.nextElementSibling.getBoundingClientRect().top-el.querySelector('.pagination-container').getBoundingClientRect().bottom);assert.ok(gap>=24,`分页下方间距不足: ${gap}`);assert.equal(await page.locator('.el-backtop:visible').count(),0);}
   if(isContest&&suffix.includes('/edit')){await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.waitForURL(`**/${prefix}/contests`);const saved=saves.findLast(x=>x.path.endsWith('/contests/1')&&x.method==='PUT');assert.equal(saved.body.durationMinutes,90);assert.equal(saved.body.problems[0].problemId,25);}
  }
 }
 for(const prefix of ['auth_ac','teacher']){
  await page.goto(`${base}/${prefix}/problem-folders/3`);
  await page.locator('.candidate-toolbar .el-select').click();
  await page.getByRole('option',{name:'基础算法',exact:true}).click();
  await page.getByText('文件夹题目1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'添加',exact:true}).first().click();
  await page.getByRole('button',{name:'移除',exact:true}).waitFor();
  checks.push(`${prefix}-folder-organization`);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(`${base}/auth_ac/practices/new`);await page.getByRole('button',{name:'添加题目',exact:true}).click();await chooseFolder('基础算法');await page.locator('.folder-problem-picker').getByText('文件夹题目1',{exact:true}).waitFor();await page.screenshot({path:`${out}/mobile.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,errors,computedDuration:90},null,2));
}finally{await page.screenshot({path:`${out}/last.png`,fullPage:true}).catch(()=>{});await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

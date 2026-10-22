import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/qoj-practice-browser/node_modules/playwright/index.mjs');
const out = process.env.MANAGEMENT_OUTPUT || '.runtime/management-layout';
await fs.mkdir(out, { recursive: true });
const routerSource = await fs.readFile('src/vue/router/index.ts', 'utf8');
const adminSource = routerSource.split('component: AdminLayout,')[1].split('path: "/teacher/login"')[0];
const teacherSource = routerSource.split('path: "/teacher",')[1].split('component: FrontLayout,')[0];
const prefix = process.env.LAYOUT_ADMIN_PREFIX || 'auth_ac';
const paths = source => [...source.matchAll(/\bpath:\s*"([^"]+)"/g)].map(m=>m[1]).filter(p=> !p.includes('redirect') && !p.includes('pathMatch') && !p.startsWith('/') && p!=='contests/rankings').map(p=>p.replace(/:[a-zA-Z]+/g,'1'));
const allRoutes = [...new Set([...paths(adminSource).map(p=>`/${prefix}/${p}`), ...paths(teacherSource).map(p=>`/teacher/${p}`)])];
const routes = process.env.MANAGEMENT_PATHS ? allRoutes.filter(path=>process.env.MANAGEMENT_PATHS.split(',').includes(path)) : allRoutes;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(() => { sessionStorage.setItem('qoj.adminAccessToken','fixture');localStorage.setItem('qoj.teacherAccessToken','fixture'); });
const page = await context.newPage(); page.setDefaultTimeout(8000);
let routeErrors = [];
page.on('pageerror', error => routeErrors.push(error.message));
page.on('console', message => { if(message.text().includes('Failed to resolve component')) routeErrors.push(message.text()); });
const user={id:1,userId:1,username:'fixture',displayName:'布局测试用户',studentNo:'2026001',email:'fixture@example.com',role:'SUPER_ADMIN',status:'ACTIVE',createdAt:'2026-10-14T10:00:00',className:'测试班级'};
const problem={id:1,title:'布局测试题目',difficulty:1,description:'<p>计算两个整数之和。</p>',inputFormat:'两个整数',outputFormat:'输出和',samples:[],tags:[],timeLimit:1000,memoryLimit:256,isPublic:true,canEdit:true,canDelete:true,canPublish:true,status:'ACTIVE',createdAt:'2026-10-14T10:00:00'};
if(process.env.LAYOUT_LONG_TEXT) {
 const long = '用于验证完整显示的超长标题与用户名称ABCDEFGHIJKLMN'.repeat(4);
 user.displayName=long;problem.title=long;
}
const classroom={id:1,name:'测试班级',teacherId:1,teacherName:'测试教师',memberCount:1,studentCount:1,joinEnabled:true,approvalRequired:true,members:[user]};
const course={id:1,title:'测试课程',term:'2026 秋季',status:'ACTIVE',classIds:[1],classes:[classroom],studentCount:1,practiceCount:1};
const practice={id:1,title:'测试题单',description:'题单说明',accessScope:'ALL',problems:[problem],canEdit:true,canPublish:true,canDelete:true};
const publication={...practice,courseId:1,startTime:'2026-10-14T10:00:00',endTime:'2026-10-15T10:00:00',publicationProblems:[{problemId:1,title:problem.title,visibility:'VISIBLE'}]};
const contest={id:1,title:'布局测试比赛',type:'ACM',audience:'ALL',status:'NOT_STARTED',ownerId:1,startTime:'2026-10-14T10:00:00',endTime:'2026-10-14T13:00:00',durationMinutes:180,problems:[],audiences:[],classIds:[],participantCount:1,submissionCount:1,description:'比赛说明'};
const folder={id:1,name:'测试文件夹',description:'',problemCount:1,problems:[problem],accessScope:'ALL',canEdit:true,displayOrder:1};
const submission={id:1,submissionId:1,queueId:1,userId:1,displayName:user.displayName,problemId:1,problemTitle:problem.title,practiceId:1,practiceTitle:practice.title,language:'cpp17',status:'AC',statusText:'AC',submitTime:'2026-10-14T10:00:00',priority:0,retryCount:0};
const dashboard={todaySubmissionCount:1,todayAcceptedCount:1,todayActiveUserCount:1,activeContestCount:0,recentContests:[contest],totalStats:{userCount:1,userByRole:{STUDENT:1},problemCount:1,problemByDifficulty:{1:1},submissionCount:1,passRate:100,contestCount:1,contestByType:{ACM:1}},submissionTrend:[{date:'2026-10-14',total:1,accepted:1}],verdictDistribution:[{verdict:'AC',count:1}],languageUsage:[{language:'cpp17',count:1}],difficultyDistribution:[{difficulty:1,count:1}],hourlyActivity:[{hour:10,count:1}],userGrowth:[{month:'2026-10',cumulative:1}],topProblems:[{problemId:1,title:problem.title,difficulty:1,submissions:1,acRate:100}]};
const report={practiceId:1,participantCount:1,submissionCount:1,rankings:[],submissions:[submission],students:[],practices:[]};
const paged=list=>({list,total:list.length});
const unknown = new Set();
let agentSettings={enabled:true,baseUrl:'https://fixture.example/v1',apiKey:'',model:'fixture-model',reasoningEffort:'medium',timeoutMs:30000,maxCodeChars:12000};
const agentSaves=[];

await page.route('**/api/**', async request => {
 const url=new URL(request.request().url()), path=url.pathname;
 if(!path.startsWith('/api/'))return request.continue();
 const suffix=path.replace(/^\/api\/(?:[^/]+\/)?v1/,'');
 let data;
 if(suffix==='/me')data={...user,role:path.includes('/teacher/')?'TEACHER':'SUPER_ADMIN'};
 else if(suffix==='/dashboard')data=dashboard;
 else if(suffix==='/settings/frontend')data={siteTitle:'QOJ'};
 else if(suffix==='/settings/register')data={enabled:true,emailVerification:false,emailConfig:{}};
 else if(suffix==='/settings/system/agent') {
   if(request.request().method()==='PUT') {const payload=request.request().postDataJSON();agentSaves.push(payload);agentSettings={...payload,apiKey:''};}
   data=agentSettings;
 }
 else if(suffix.startsWith('/settings/'))data={};
 else if(suffix==='/classes')data=[classroom];
 else if(suffix==='/classes/1')data=classroom;
 else if(suffix==='/students')data=[user];
 else if(suffix==='/students/quotas')data={1:{remaining:5,total:10,used:5}};
 else if(suffix==='/teachers')data=[{...user,majorId:1,majorName:'计算机'}];
 else if(suffix==='/users')data=paged([user]);
 else if(suffix==='/teams')data=[{id:1,name:'测试队伍',memberCount:1,members:[user]}];
 else if(suffix==='/majors')data=[{id:1,name:'计算机',code:'CS',status:'ACTIVE'}];
 else if(suffix==='/problems')data=paged(process.env.LAYOUT_PICKER ? Array.from({length:25},(_,index)=>({...problem,id:index+1,title:`${problem.title}-${index+1}`})) : [problem]);
 else if(suffix==='/problems/1')data=problem;
 else if(suffix==='/problems/1/test-cases')data=[];
 else if(suffix==='/problems/1/checker-source')data='';
 else if(suffix==='/problems/1/communication-config')data={enabled:false,maxMessageBytes:1024,allowEmptyMessage:false,channelSource:'',checkerSource:''};
 else if(suffix==='/problem-drafts')data={draftId:'fixture',basic:{},testCases:[]};
 else if(suffix==='/problem-folders'||suffix==='/problem-folders/options')data=[folder];
 else if(suffix==='/problem-folders/1')data=folder;
 else if(suffix==='/problem-folders/1/candidates')data=paged([problem]);
 else if(suffix==='/courses')data=paged([course]);
 else if(suffix==='/courses/1')data=course;
 else if(suffix==='/courses/1/practices')data=[publication];
 else if(suffix.endsWith('/report'))data=report;
 else if(suffix==='/practices')data=paged([practice]);
 else if(suffix==='/practices/1')data=practice;
 else if(suffix==='/practices/publications')data=[publication];
 else if(suffix==='/practices/publications/1')data=publication;
 else if(suffix==='/contests')data=paged([contest]);
 else if(suffix==='/contests/1')data=contest;
 else if(suffix==='/contests/draft')data=null;
 else if(suffix.startsWith('/contests/1/'))data=[];
 else if(suffix==='/submissions'||suffix==='/submission-queue')data=paged([submission]);
 else if(suffix==='/submission-queue/stats')data={waiting:0,judging:0,finished:1,total:1,currentConcurrent:0,maxConcurrent:2};
 else if(suffix==='/leaderboard/global')data=[{userId:1,name:user.displayName,className:classroom.name,acCount:1,streak:1}];
 else if(suffix==='/leaderboard/classes')data=[{classId:1,className:classroom.name,memberCount:1,acCount:1}];
 else if(suffix==='/announcements/pinned')data=null;
 else if(suffix==='/announcements')data=paged([]);
 else if(suffix==='/agent/chat/sessions'||suffix==='/applications'||suffix.includes('carousel'))data=[];
 else {unknown.add(suffix);data=[];}
 await request.fulfill({json:{code:200,message:'ok',data}});
});
const base=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5178';
const results=[];
try {
 for(const width of [1440,1024,390]) {
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const path of routes) {
   routeErrors=[];
   try {
    await page.goto(base+path);
    await page.locator('.qoj-management .layout-content > .page-container').waitFor();
    await page.waitForTimeout(250);
    await page.locator('.el-loading-mask:visible').waitFor({state:'hidden',timeout:5000}).catch(()=>{});
    if(path.endsWith('/problems/new')) {
      assert.equal(await page.getByText('新建题目草稿 · 管理后台', {exact:true}).count(),0);
      const inputs=await page.locator('.editor-source textarea').evaluateAll(items=>items.slice(0,3).map(el=>({height:el.getBoundingClientRect().height,rows:el.rows})));
      assert.equal(inputs.length,3);
      assert.deepEqual(inputs.map(item=>item.rows),[18,10,10]);
      assert.ok(Math.abs(inputs[0].height - 444 * 0.8) < 1, `题面应缩短20%: ${inputs[0].height}`);
      assert.ok(inputs[1].height >= 252, `输入实际高度不足: ${inputs[1].height}`);
      assert.equal(inputs[1].height,inputs[2].height);
      const widths=await page.locator('.format-select').evaluateAll(items=>items.slice(0,3).map(el=>el.getBoundingClientRect().width));
      assert.deepEqual(widths,[112,112,112]);
      assert.equal(await page.locator('.management-action-card').count(),0);
      const folder=page.getByRole('combobox',{name:'搜索题目文件夹',exact:true});
      await folder.fill('不存在的文件夹');
      await page.getByText('无匹配数据',{exact:true}).waitFor();
      await folder.fill('测试文件夹');
      await page.getByRole('option',{name:'测试文件夹',exact:true}).click();
      await page.getByRole('button',{name:'添加样例',exact:true}).click();
      const sampleHeights=await page.locator('.sample-card textarea').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().height));
      assert.deepEqual(sampleHeights,[81,81,81]);

    }
    const misplacedActions=await page.locator('.management-card-actions').evaluateAll(items=>items.filter(el=>el.getBoundingClientRect().height>0&&!el.closest('.el-card__header,.management-inline-toolbar')).map(el=>el.textContent));
    assert.deepEqual(misplacedActions,[], '页面操作必须集成在筛选行或无筛选的卡片顶部');
    assert.equal(await page.locator('.management-action-footer').count(),0, '不得保留独立底部操作卡片');
    if(width===1440) {
      const alignment=await page.locator('.management-inline-toolbar:visible').evaluateAll(items=>items.map(toolbar=>{
        const input=toolbar.querySelector('.el-input,.el-select');
        const button=toolbar.querySelector('.management-card-actions .el-button');
        if(!input||!button||!button.getBoundingClientRect().height)return true;
        const a=input.getBoundingClientRect(),b=button.getBoundingClientRect();
        return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<3;
      }));
      assert.ok(alignment.every(Boolean),'桌面端筛选和操作按钮应处于同一行');
    }
    if(/\/(problems|practices)$/.test(path)) {
      const alignment=await page.locator('.el-table:visible .el-table__cell').evaluateAll(items=>items.filter(el=>el.getBoundingClientRect().height>0).map(el=>getComputedStyle(el).textAlign));
      assert.ok(alignment.every(value=>value==='center'),'题目和练习表格统一居中');
      if(width===1440){
        const widths=await page.locator('.el-table:visible').first().locator('thead th').evaluateAll(items=>items.filter(el=>!el.classList.contains('el-table-column--selection')&&!el.classList.contains('el-table__expand-column')&&Boolean(el.textContent.trim())&&!['操作','调整'].includes(el.textContent.trim())).map(el=>el.getBoundingClientRect().width));
        assert.ok(Math.max(...widths)-Math.min(...widths)<=5,`内容列均匀分布: ${widths}`);
      }
    }
    assert.equal(await page.locator('.el-backtop:visible').count(),0,'不显示返回顶部按钮');
    const metrics=await page.evaluate(()=>{
     const content=document.querySelector('.layout-content'),page=content.querySelector(':scope > .page-container');
     const bounds=page.getBoundingClientRect(), parent=content.getBoundingClientRect();
     const outside=[...page.querySelectorAll('.el-card,.filters,.filter-row')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<parent.left-1||r.right>parent.right+1);}).map(el=>el.className);
     const profile=document.querySelector('.layout-user__name');
     const profileBounds=profile?.getBoundingClientRect();
     const navBounds=profile?.closest('.layout-navbar,.layout-header')?.getBoundingClientRect();
     const clippedProfile=!!profile && (profile.scrollWidth>profile.clientWidth+2 || profile.scrollHeight>profile.clientHeight+2 || profileBounds.right>innerWidth+1 || (navBounds && (profileBounds.top<navBounds.top-1 || profileBounds.bottom>navBounds.bottom+1)));
     return {clippedProfile,titleCount:page.querySelectorAll('h1').length,reloads:[...page.querySelectorAll('button')].map(el=>el.textContent.trim()).filter(text=>/^(刷新(?:统计)?|重新载入|重新加载)$/.test(text)),documentOverflow:document.documentElement.scrollWidth>innerWidth,contentOverflow:content.scrollWidth>content.clientWidth+1,pageOverflow:page.scrollWidth>page.clientWidth+1,clippedVertical:page.scrollHeight>page.clientHeight+2,internalScroll:[...page.querySelectorAll('*')].filter(el=>{const style=getComputedStyle(el);return el.clientHeight>0 && el.scrollHeight>el.clientHeight+3 && /^(auto|scroll)$/.test(style.overflowY) && !el.closest('.monaco-editor,.chat-history,.chat-messages,.el-select,.el-textarea');}).map(el=>el.className),outside,pageWidth:bounds.width,contentWidth:content.clientWidth};
    });
    assert.equal(metrics.clippedProfile,false);assert.equal(metrics.titleCount,0);assert.deepEqual(metrics.reloads,[]);
    assert.equal(metrics.documentOverflow,false);assert.equal(metrics.contentOverflow,false);assert.equal(metrics.pageOverflow,false);assert.equal(metrics.clippedVertical,false);assert.deepEqual(metrics.outside,[]);assert.deepEqual(metrics.internalScroll,[]);assert.deepEqual(routeErrors,[]);
    await page.screenshot({path:`${out}/${width}-${path.replaceAll('/','_')}.png`});
    const modalAction = path === `/${prefix}/majors` ? '新增专业' : path === `/${prefix}/users/teachers` ? '新增教师' : path === `/${prefix}/users/students` ? '添加学生' : path.endsWith('/courses') ? '创建课程' : path.endsWith('/classes') ? '创建班级' : undefined;
    if(modalAction) {
      await page.getByRole('button',{name:modalAction,exact:true}).click();
      const dialog = page.locator('.qoj-management-dialog:visible');
      await dialog.waitFor();
      await page.waitForTimeout(400);
      const bounds = await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom,viewport:innerWidth,viewportHeight:innerHeight};});
      assert.ok(bounds.width>200 && bounds.left>=0 && bounds.right<=bounds.viewport,JSON.stringify(bounds));
      assert.ok(bounds.top>=0,JSON.stringify(bounds));
      assert.equal(await dialog.locator('.el-dialog__body').evaluate(el=>el.scrollHeight>el.clientHeight+2 && /auto|scroll/.test(getComputedStyle(el).overflowY)),false);
      const footer=dialog.locator('.el-dialog__footer');
      if(await footer.count()) { await footer.scrollIntoViewIfNeeded(); assert.ok(await footer.isVisible()); }
      await dialog.locator('.el-dialog__header').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/dialog-${width}-${path.replaceAll('/','_')}.png`});
      await dialog.locator('.el-dialog__headerbtn').click();
    }
    if(process.env.LAYOUT_AI_SETTINGS) {
      const unusedWidth=await page.locator('.layout-content > .page-container').evaluate(el=>{
        const style=getComputedStyle(el),width=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        return [...el.querySelectorAll(':scope > .el-card')].filter(card=>card.getBoundingClientRect().width>0).map(card=>width-card.getBoundingClientRect().width);
      });
      assert.ok(unusedWidth.every(width=>width<2),'管理表单卡片必须填满内容宽度');
    }
    if(process.env.LAYOUT_AI_SETTINGS && path.endsWith('/ai/settings')) {
      assert.equal(await page.locator('textarea').count(),0);
      await page.getByRole('textbox',{name:'服务地址',exact:true}).fill('invalid-url');
      const count=agentSaves.length;
      await page.getByRole('button',{name:'保存配置',exact:true}).click();
      await page.getByText('请填写完整的 HTTP 或 HTTPS 服务地址',{exact:true}).waitFor();
      assert.equal(agentSaves.length,count);
      await page.getByRole('textbox',{name:'服务地址',exact:true}).fill('https://fixture.example/v1');
      await page.getByRole('textbox',{name:'模型名称',exact:true}).fill('updated-model');
      await page.getByRole('spinbutton',{name:'请求超时（毫秒）',exact:true}).fill('45000');
      await page.getByRole('button',{name:'保存配置',exact:true}).click();
      await page.getByText('AI 配置已保存',{exact:true}).waitFor();
      assert.equal(agentSaves.length,count+1);
      assert.equal(agentSaves.at(-1).model,'updated-model');
      assert.equal(agentSaves.at(-1).apiKey,'');
      assert.equal(agentSaves.at(-1).timeoutMs,45000);
      assert.equal(typeof agentSaves.at(-1).enabled,'boolean');
      await page.getByRole('textbox',{name:'API 密钥',exact:true}).fill('fixture-key-for-e2e-only');
      await page.getByRole('button',{name:'保存配置',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('input[aria-label="API 密钥"]').value==='');
      assert.equal(agentSaves.at(-1).apiKey,'fixture-key-for-e2e-only');
      await page.reload();
      await page.getByRole('textbox',{name:'模型名称',exact:true}).waitFor();
      await page.waitForFunction(()=>document.querySelector('input[aria-label="模型名称"]').value==='updated-model');
      assert.equal(await page.getByRole('textbox',{name:'API 密钥',exact:true}).inputValue(),'');
      await page.screenshot({path:`${out}/ai-form-${width}.png`,fullPage:true});
    }
    if(process.env.LAYOUT_PICKER && path.endsWith('/contests/new')) {
      const picker=page.locator('.problem-picker');
      assert.equal(await picker.locator('.el-table__body tbody tr').count(),10);
      await picker.locator('.btn-next').click();
      await picker.locator('.el-table__body tbody tr').first().getByText('11',{exact:true}).waitFor();
      await picker.getByPlaceholder('按题目名、ID 或标签搜索').fill('-25');
      assert.equal(await picker.locator('.el-table__body tbody tr').count(),1);
      await picker.locator('.el-table__body tbody tr').first().getByText('25',{exact:true}).waitFor();
      await picker.getByPlaceholder('按题目名、ID 或标签搜索').fill('');
      await picker.locator('.el-table__body tbody tr').first().getByText('1',{exact:true}).waitFor();
    }
    if(width===390 && path.endsWith('/judge/queue')) {
      assert.equal(await page.locator('.filters').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    }
    results.push({path,width,passed:true,metrics});
    if(results.length%12===0) console.log(JSON.stringify({progress:results.length,total:routes.length*3}));
   } catch(error) {
    results.push({path,width,passed:false,error:error.message,errors:routeErrors});
    await page.screenshot({path:`${out}/failure-${width}-${path.replaceAll('/','_')}.png`}).catch(()=>{});
   }
  }
  console.log(JSON.stringify({width,completed:results.length,failures:results.filter(r=>!r.passed)}));
 }
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:results.every(r=>r.passed),fixture:true,routes:routes.length,checks:results,unmatchedFixtureEndpoints:[...unknown]},null,2));
 const cards=results.map(row=>`<figure><a href="${row.width}-${row.path.replaceAll('/','_')}.png"><img loading="lazy" src="${row.width}-${row.path.replaceAll('/','_')}.png"></a><figcaption>${row.path} · ${row.width}px · ${row.passed?'通过':'失败'}</figcaption></figure>`).join('');
 await fs.writeFile(`${out}/gallery.html`,`<!doctype html><html lang="zh"><meta charset="utf-8"><title>后台布局验证</title><style>body{font:14px system-ui;margin:24px;background:#f3f5f8}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}figure{margin:0;padding:12px;background:white;border-radius:8px}img{width:100%;height:240px;object-fit:contain;object-position:top}figcaption{padding-top:10px}</style><h1>后台布局验证：${routes.length} 个路由，三个视口</h1><main>${cards}</main></html>`);
 assert.ok(results.every(r=>r.passed),`${results.filter(r=>!r.passed).length} layout checks failed`);
} finally {await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

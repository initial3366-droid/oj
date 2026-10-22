import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = '.runtime/c-language-display';
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
await context.addInitScript(() => { const token=`e2e.${btoa(JSON.stringify({sub:1,role:'SUPER_ADMIN',exp:4102444800}))}.fixture`;localStorage.setItem('vea:ui:theme','dark');sessionStorage.setItem('qoj.accessToken',token);sessionStorage.setItem('qoj.adminAccessToken',token);localStorage.setItem('qoj.teacherAccessToken',token); });
const page = await context.newPage(); page.setDefaultTimeout(8000);
let routeErrors = [];
page.on('pageerror', error => routeErrors.push(error.message));
page.on('console', message => { if(message.text().includes('Failed to resolve component')) routeErrors.push(message.text()); });
const user={id:1,userId:1,username:'fixture',displayName:'布局测试用户',studentNo:'2026001',email:'fixture@example.com',role:'SUPER_ADMIN',status:'ACTIVE',createdAt:'2026-10-14T10:00:00',className:'测试班级'};
const problem={id:1,title:'布局测试题目',difficulty:1,statement:'<p style="color:#111;background:#fff;border:1px solid #eee">深色题面 $a^2+b^2$</p><blockquote>引用说明</blockquote><p>代码 <code>a + b</code></p><pre>1  2\n3 4</pre><table><tr><th>变量</th><th>数值</th></tr><tr><td>a</td><td>2</td></tr></table><div class="qoj-background-box--green">提示</div><a href="#">题面链接</a><img alt="题面图片" width="8" height="8" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">' ,inputFormat:'两个整数',outputFormat:'输出和',samples:[{input:'<strong>输入</strong> $a^2$\n1  2\n3 4',output:'<em>输出</em> \\(\\frac{1}{2}\\)\n3',explanation:'<p>说明：$$a+b=3$$</p><img src="x" onerror="window.__sampleUnsafe=true">'},{input:'1  2\n3 4',output:'3\n7'}],tags:[],timeLimit:1000,memoryLimit:256,isPublic:true,canEdit:true,canDelete:true,canPublish:true,status:'ACTIVE',createdAt:'2026-10-14T10:00:00'};
if(process.env.LAYOUT_LONG_TEXT) {
 const long = '用于验证完整显示的超长标题与用户名称ABCDEFGHIJKLMN'.repeat(4);
 user.displayName=long;problem.title=long;
}
const classroom={id:1,name:'测试班级',teacherId:1,teacherName:'测试教师',memberCount:1,studentCount:1,joinEnabled:true,approvalRequired:true,members:[user]};
const course={id:1,title:'测试课程',term:'2026 秋季',status:'ACTIVE',classIds:[1],classes:[classroom],studentCount:1,practiceCount:1};
const practice={id:1,title:'测试题单',description:'题单说明',accessScope:'ALL',problems:[problem],canEdit:true,canPublish:true,canDelete:true};
const publication={...practice,courseId:1,startTime:'2026-10-14T10:00:00',endTime:'2026-10-15T10:00:00',publicationProblems:[{problemId:1,title:problem.title,visibility:'VISIBLE'}]};
const contest={id:1,title:'布局测试比赛',type:'ACM',audience:'ALL',status:'RUNNING',registered:true,registrationType:'PUBLIC',ownerId:1,startTime:'2026-10-14T10:00:00',endTime:'2026-10-14T13:00:00',durationMinutes:180,problems:[{problemId:1,contestProblemId:2,label:'A',title:problem.title}],audiences:[],classIds:[],participantCount:1,submissionCount:1,description:'比赛说明'};
const folder={id:1,name:'测试文件夹',description:'',problemCount:1,problems:[problem],accessScope:'ALL',canEdit:true,displayOrder:1};
const submission={id:1,submissionId:1,queueId:1,userId:1,displayName:user.displayName,problemId:1,problemTitle:problem.title,practiceId:1,practiceTitle:practice.title,language:'c',status:'AC',statusText:'AC',submitTime:'2026-10-14T10:00:00',priority:0,retryCount:0};
const dashboard={todaySubmissionCount:1,todayAcceptedCount:1,todayActiveUserCount:1,activeContestCount:0,recentContests:[contest],totalStats:{userCount:1,userByRole:{STUDENT:1},problemCount:1,problemByDifficulty:{1:1},submissionCount:1,passRate:100,contestCount:1,contestByType:{ACM:1}},submissionTrend:[{date:'2026-10-14',total:1,accepted:1}],verdictDistribution:[{verdict:'AC',count:1}],languageUsage:[{language:'c',count:1}],difficultyDistribution:[{difficulty:1,count:1}],hourlyActivity:[{hour:10,count:1}],userGrowth:[{month:'2026-10',cumulative:1}],topProblems:[{problemId:1,title:problem.title,difficulty:1,submissions:1,acRate:100}]};
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
 if(suffix==='/me' && request.request().method()==='PUT') { Object.assign(user,request.request().postDataJSON()); data=null; }
 else if(suffix==='/auth/me')data=user;
 else if(suffix==='/me')data={...user,role:path.includes('/teacher/')?'TEACHER':'SUPER_ADMIN'};
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
 else if(suffix==='/contests/1/problems/1')data=problem;
 else if(suffix.includes('/contests/1/') && suffix.includes('submissions'))data=paged([submission]);
 else if(suffix.startsWith('/contests/1/'))data=[];
 else if(suffix==='/submissions'||suffix==='/submission-queue')data=paged([submission]);
 else if(suffix==='/submission-queue/stats')data={waiting:0,judging:0,finished:1,total:1,currentConcurrent:0,maxConcurrent:2};
 else if(suffix==='/leaderboard/global')data=[{userId:1,name:user.displayName,className:classroom.name,acCount:1,streak:1}];
 else if(suffix==='/leaderboard/classes')data=[{classId:1,className:classroom.name,memberCount:1,acCount:1}];
 else if(suffix==='/announcements/pinned')data=null;
 else if(suffix==='/announcements')data=paged([]);
 else if(suffix==='/agent/chat/context')data={window:512000,outputReserve:65536};
 else if(suffix==='/agent/chat/sessions'||suffix==='/applications'||suffix.includes('carousel'))data=[];
 else {unknown.add(suffix);data=[];}
 await request.fulfill({json:{code:200,message:'ok',data}});
});
const base=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5178';

const cipherSource=await fs.readFile('src/utils/cipher.ts','utf8');
const {encryptId}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(cipherSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const checks=[];
try {
 for(const path of ['/auth_ac/submissions','/auth_ac/judge/queue','/contests/1?tab=submissions','/contests/1?tab=my-submissions']) {
  await page.goto(base+path);
  await page.locator('.el-table__body-wrapper:visible').getByText('C',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.el-table__body-wrapper:visible').getByText('c',{exact:true}).count(),0);
  if(path.includes('/contests/1?')){await page.locator('.el-table__body-wrapper:visible').getByText('A',{exact:true}).first().waitFor();assert.equal(await page.locator('.el-table__body-wrapper:visible').getByText(problem.title,{exact:true}).count(),0);}
  if(path.includes('queue'))assert.equal(await page.getByRole('columnheader',{name:'错误信息',exact:true}).count(),0);checks.push(path);await page.screenshot({path:`${out}/page-${checks.length}.png`,fullPage:true});
 }
 await page.goto(base+'/auth_ac/contests/1');await page.getByText('比赛题目',{exact:true}).waitFor();assert.equal(await page.getByRole('columnheader',{name:'分数',exact:true}).count(),0);checks.push('后台比赛题目不显示分数列');
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

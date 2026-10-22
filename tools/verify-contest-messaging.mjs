import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/contest-messaging';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true});
await context.addInitScript(()=>{const token=role=>`e2e.${btoa(JSON.stringify({sub:role==='STUDENT'?1:9,userId:role==='STUDENT'?1:9,role,exp:Math.floor(Date.now()/1000)+3600}))}.fixture`;sessionStorage.setItem('qoj.accessToken',token('STUDENT'));sessionStorage.setItem('qoj.adminAccessToken',token('SUPER_ADMIN'));});
const messages=[],connections=[],sent=[];let readThroughId=0;let frameId=0;
await context.routeWebSocket('**/ws**',socket=>{

 const connection={socket,subscriptions:new Map()};connections.push(connection);
 const push=(connection,destination,body)=>{const subscription=connection.subscriptions.get(destination);if(!subscription)return;const json=JSON.stringify(body);connection.socket.send(`MESSAGE\nsubscription:${subscription}\nmessage-id:${++frameId}\ncontent-type:application/json\ncontent-length:${Buffer.byteLength(json)}\n\n${json}\0`);};
 socket.onMessage(raw=>{
  const text=typeof raw==='string'?raw:Buffer.from(raw).toString('utf8');for(const frame of text.split('\0')){const clean=frame.trimStart();if(!clean)continue;const [head,...bodyParts]=clean.split('\n\n');const lines=head.split('\n'),command=lines.shift(),headers=Object.fromEntries(lines.map(line=>{const i=line.indexOf(':');return[line.slice(0,i),line.slice(i+1)];}));
   if(command==='CONNECT'||command==='STOMP')socket.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
   if(command==='SUBSCRIBE')connection.subscriptions.set(headers.destination,headers.id);
   if(command==='SEND'&&headers.destination==='/app/contest-messages/ready')push(connection,'/user/queue/contest-message-acks',{ready:true});
   if(command==='SEND'&&headers.destination==='/app/contest-messages/send'){
    const payload=JSON.parse(bodyParts.join('\n\n'));sent.push(payload);
    const message={id:messages.length+1,participantId:payload.kind==='BROADCAST'?null:1,kind:payload.kind,authorName:payload.kind==='QUESTION'?'测试选手':'比赛管理员',content:payload.message.content,createdAt:'2026-10-14T20:00:00'};messages.push(message);
    push(connection,'/user/queue/contest-message-acks',{requestId:payload.message.requestId,code:200,message});
    for(const other of connections)push(other,'/user/queue/contest-messages',{contestId:1,message});
   }
  }
 });
});
const contest={id:1,title:'聊天与广播测试赛',registered:true,type:'ACM',status:'RUNNING',audience:'ALL',registrationType:'PUBLIC',startTime:'2026-10-01T10:00:00',endTime:'2026-12-01T12:00:00',problems:[]};
await context.route('**/api/**',async route=>{const url=new URL(route.request().url()),p=url.pathname;if(!p.startsWith('/api/'))return route.continue();let data=[];
 if(p.endsWith('/messages/read')){readThroughId=route.request().postDataJSON().throughId;data=null;}
 else if(p.endsWith('/messages'))data={contestTitle:contest.title,userId:1,readThroughId,messages:messages.filter(x=>x.id>Number(url.searchParams.get('afterId')||0)),hasMore:false};
 else if(p.endsWith('/me'))data={id:1,username:'fixture',displayName:'测试用户',email:'fixture@example.com',role:p.includes('/auth/')?'STUDENT':'SUPER_ADMIN'};
 else if(p.endsWith('/contests/1'))data=contest;
 else if(p.endsWith('/submissions'))data={list:[],total:0};
 await route.fulfill({json:{code:200,message:'ok',data}});
});
const front=await context.newPage(),admin=await context.newPage();const errors=[];for(const p of [front,admin])p.on('pageerror',e=>errors.push(e.message));
const base=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5173';
try{
 await admin.goto(`${base}/auth_ac/ai/chat`);await admin.locator('.chat-layout').waitFor();const height=await admin.locator('.chat-layout').evaluate(el=>el.getBoundingClientRect().height);assert.ok(height>=760,`AI对话高度不足: ${height}`);await admin.screenshot({path:`${out}/ai-chat-height.png`,fullPage:true});
 await admin.goto(`${base}/auth_ac/contests/1`);await admin.getByRole('tab',{name:'答疑与广播',exact:true}).click();
 await front.goto(`${base}/contests/1`);await front.getByRole('button',{name:'比赛答疑',exact:true}).click();
 await front.getByRole('textbox',{name:'比赛答疑问题',exact:true}).fill('请问题目输入范围？');await front.getByRole('button',{name:'发送问题',exact:true}).click();
 await admin.locator('.thread-list').getByText('请问题目输入范围？',{exact:true}).waitFor();
 await admin.getByRole('textbox',{name:'答疑回复内容',exact:true}).fill('以题面给出的数据范围为准。');await admin.getByRole('button',{name:'发送回复',exact:true}).click();
 await front.locator('.chat-messages').getByText('以题面给出的数据范围为准。',{exact:true}).waitFor();
 await admin.getByRole('button',{name:'比赛广播',exact:true}).click();await admin.getByRole('textbox',{name:'广播内容',exact:true}).fill('全体选手请注意：比赛结束前请及时提交。');await admin.getByRole('button',{name:'发送广播',exact:true}).click();
 await front.locator('.chat-panel').getByRole('button',{name:'比赛广播',exact:true}).click();await front.locator('.chat-messages').getByText('全体选手请注意：比赛结束前请及时提交。',{exact:true}).waitFor();
 await front.getByRole('button',{name:'全部已读',exact:true}).click();await front.waitForTimeout(100);assert.equal(readThroughId,3);
 await front.screenshot({path:`${out}/front-broadcast.png`,fullPage:true});await admin.screenshot({path:`${out}/admin-broadcast.png`,fullPage:true});
 await front.reload();await front.getByRole('button',{name:'比赛答疑',exact:true}).click();await front.locator('.chat-panel').getByRole('button',{name:'比赛广播',exact:true}).click();await front.locator('.chat-messages').getByText('全体选手请注意：比赛结束前请及时提交。',{exact:true}).waitFor();
 await front.setViewportSize({width:390,height:844});await front.waitForTimeout(200);const bounds=await front.locator('.chat-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);await front.screenshot({path:`${out}/front-mobile.png`,fullPage:true});
 await front.goto(`${base}/problems`);assert.equal(await front.locator('[data-testid="contest-messaging"]').count(),0);
 assert.deepEqual(sent.map(x=>x.kind),['QUESTION','REPLY','BROADCAST']);assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,fixture:true,transport:'STOMP WebSocket',aiChatHeight:height,checks:['选手提问到后台','后台回复到选手','后台全体广播到前台','已读记录','刷新补看','手机聊天窗口适配'],errors},null,2));
}finally{await front.screenshot({path:`${out}/last-front.png`,fullPage:true}).catch(()=>{});await admin.screenshot({path:`${out}/last-admin.png`,fullPage:true}).catch(()=>{});await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

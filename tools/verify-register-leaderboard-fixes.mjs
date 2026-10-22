import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/register-leaderboard-fixes';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage();let images=0,sends=0,failSend=false;const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();let data={};let code=200;
 if(path.endsWith('/settings/frontend'))data={siteTitle:'QOJ'};
 if(path.endsWith('/settings/register'))data={enabled:true,emailVerification:true};
 if(path.endsWith('/captcha/image')){images++;data={captchaId:`image-${images}`,image:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44"><text x="5" y="30">${images}</text></svg>`)}`};}
 if(path.endsWith('/captcha/email/remaining'))data={remainingSeconds:0};
 if(path.endsWith('/captcha/email')){sends++;data={remainingSeconds:1};if(failSend)code=400;}
 if(path.endsWith('/leaderboard/global'))data=Array.from({length:45},(_,i)=>({userId:i+1,name:`用户${String(i+1).padStart(2,'0')}`,className:'测试班级',acCount:45-i,streak:1}));
 if(path.endsWith('/leaderboard/classes'))data=[];
 await route.fulfill({json:{code,message:code===400?'图形验证码错误':'ok',data}});
});
try{
 await page.goto('http://127.0.0.1:5178/register');await page.locator('.auth-captcha-img').waitFor();
 await page.getByPlaceholder('请输入邮箱',{exact:true}).fill('test@example.com');await page.getByPlaceholder('请输入验证码',{exact:true}).fill('ABCD');
 const original=await page.locator('.auth-captcha-img').getAttribute('src'),before=images;
 await page.getByRole('button',{name:'发送验证码',exact:true}).click();await page.getByText('验证码已发送到您的邮箱',{exact:true}).waitFor();
 assert.equal(images,before);assert.equal(await page.locator('.auth-captcha-img').getAttribute('src'),original);assert.equal(await page.getByPlaceholder('请输入验证码',{exact:true}).inputValue(),'ABCD');checks.push('成功发送保留图形验证码和输入');
 await page.getByRole('button',{name:'发送验证码',exact:true}).waitFor();await page.getByRole('button',{name:'发送验证码',exact:true}).click();await page.getByText('请填写新的图形验证码后重新发送',{exact:true}).waitFor();assert.equal(sends,1);assert.equal(images,before+1);assert.equal(await page.getByPlaceholder('请输入验证码',{exact:true}).inputValue(),'');checks.push('重发更换已消费验证码，避免复用');
 failSend=true;await page.getByPlaceholder('请输入验证码',{exact:true}).fill('wrong');await page.getByRole('button',{name:'发送验证码',exact:true}).click();await page.getByText('图形验证码错误',{exact:true}).waitFor();await page.waitForTimeout(100);assert.equal(images,before+2);checks.push('发送失败刷新验证码并清理旧输入');
 await page.goto('http://127.0.0.1:5178/leaderboard');await page.getByText('用户01',{exact:true}).waitFor();
 const table=page.locator('.leaderboard-table-user-lb .el-table__body-wrapper tbody');assert.equal(await table.locator('tr').count(),10);
 await page.locator('.leaderboard-pagination .el-pager').getByText('2',{exact:true}).click();await page.getByText('用户11',{exact:true}).waitFor();assert.equal(await page.getByText('用户01',{exact:true}).count(),0);checks.push('下一页展示第11位起用户');
 await page.locator('.leaderboard-pagination .el-select').click();await page.getByRole('option',{name:'50条/页',exact:true}).click();await page.getByText('用户01',{exact:true}).waitFor();assert.equal(await table.locator('tr').count(),45);assert.ok(await page.locator('.leaderboard-pagination').isVisible());checks.push('调整每页条数更新内容，单页仍可切回');
 await page.locator('.leaderboard-pagination .el-select').click();await page.getByRole('option',{name:'10条/页',exact:true}).click();await page.waitForTimeout(100);assert.equal(await table.locator('tr').count(),10);
 await page.getByRole('textbox',{name:'搜索排行榜用户'}).fill('用户45');await page.getByText('用户45',{exact:true}).waitFor();assert.equal(await table.locator('tr').count(),1);checks.push('改变条数及搜索筛选正确');
 const gaps=[];for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);const gap=await page.locator('.leaderboard-pagination').evaluate(el=>el.closest('.el-card').getBoundingClientRect().bottom-el.querySelector('.el-pagination').getBoundingClientRect().bottom);assert.ok(gap>=19);gaps.push({width,gap});await page.screenshot({path:`${out}/leaderboard-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,gaps},null,2));console.log(JSON.stringify({passed:true,checks,gaps}));
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.log((await page.locator('body').innerText()).slice(-1800));throw error;}finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

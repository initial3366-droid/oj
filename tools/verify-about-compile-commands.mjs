import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='.runtime/about-compile-commands';await fs.mkdir(out,{recursive:true});
const source=await fs.readFile('backend/src/main/java/com/qoj/module/judge/gojudge/GoJudgeService.java','utf8');
const flags=Object.fromEntries([...source.matchAll(/private static final String (CPP\d+_STANDARD_FLAG) = "([^"]+)"/g)].map(m=>[m[1],m[2]]));
const blocks=[...source.slice(source.indexOf('enum Language {')).matchAll(/(C|CPP17|CPP20|CPP23|PYTHON|JAVA)\(\s*"[^"]+",\s*"[^"]+",\s*List.of\(([^)]+)\)/g)];
const expected=Object.fromEntries(blocks.map(m=>[m[1],m[2].split(',').map(v=>v.trim()).map(v=>v.startsWith('"')?JSON.parse(v):flags[v]).join(' ')]));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.tracing.start({screenshots:true,snapshots:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();await route.fulfill({json:{code:200,data:path.endsWith('/settings/frontend')?{siteTitle:'QOJ'}:[]}});});
try{
 await page.goto((process.env.LAYOUT_BASE_URL||'http://127.0.0.1:5178')+'/about');
 const rows=page.locator('.about-compiler-table .el-table__body tbody tr');await rows.first().waitFor();
 const keys=['C','CPP17','CPP20','CPP23','PYTHON','JAVA'];
 assert.equal(await rows.count(),keys.length);
 for(let i=0;i<keys.length;i++)assert.equal(await rows.nth(i).locator('.about-command').first().textContent(),expected[keys[i]],keys[i]);
 const script=await fs.readFile('docker/go-judge/qoj-java-compile','utf8');const internal=script.split('\n').filter(line=>line.startsWith('/usr/bin/')||line.startsWith('exec /usr/bin/')).join('\n');
 assert.equal(await page.locator('.about-compile-details code').textContent(),internal);
 assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/commands.png`,fullPage:true});
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,languages:keys,commands:expected,javaScriptMatches:true},null,2));console.log('passed');
}finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

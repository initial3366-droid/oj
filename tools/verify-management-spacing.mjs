import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
// Reuse the route inventory and API fixtures used by the existing management E2E.
const source = await fs.readFile('tools/verify-management-pages.mjs','utf8');
let setup = source.slice(0, source.indexOf('const results=[];'));
setup = setup.replace(/const out = process.env.MANAGEMENT_OUTPUT \|\| '[^']+';/, "const out = process.env.MANAGEMENT_OUTPUT || '.runtime/management-spacing/current';");
setup = setup.replace('/tmp/qoj-practice-browser/node_modules/playwright/index.mjs','/Users/initial/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
setup = setup.replace('/Users/initial/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','/Users/initial/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium');
setup = setup.replace("sessionStorage.setItem('qoj.adminAccessToken','fixture');", "sessionStorage.setItem('qoj.adminAccessToken',`e30.${btoa(JSON.stringify({sub:1,role:'SUPER_ADMIN',exp:4102444800}))}.fixture`);");
setup = setup.replace("else if(suffix==='/agent/chat/sessions'", "else if(suffix==='/agent/chat/context')data={window:512000,outputReserve:65536};\n else if(suffix==='/agent/chat/sessions'");
let audit = await fs.readFile('tools/management-spacing-audit.mjs','utf8');
if(process.env.LAYOUT_DEEP==='1')audit=audit.slice(0,audit.indexOf('try{\n for(const width'))+await fs.readFile('tools/management-spacing-deep.mjs','utf8');
const directory = '.runtime/management-spacing';
await fs.mkdir(directory,{recursive:true});
const runner = path.resolve(directory,'runner.mjs');
await fs.writeFile(runner,setup+'\n'+audit);
const child=spawn(process.execPath,[runner],{stdio:'inherit',env:process.env});
child.on('exit',code=>process.exitCode=code??1);

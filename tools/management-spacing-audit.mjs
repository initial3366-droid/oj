// Executed after the existing management route and fixture setup.
const results=[];
const widths=(process.env.LAYOUT_WIDTHS || '1440,1024,768,390').split(',').map(Number);
async function measure(rootSelector){
 return page.locator(rootSelector).evaluate(root=>{
  const label=el=>(el.getAttribute('aria-label')||el.textContent||el.className).trim().replace(/\s+/g,' ').slice(0,70);
  const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const visible=el=>{const r=bounds(el);if(r.width<1||r.height<1||getComputedStyle(el).visibility==='hidden')return false;
   for(let parent=el.parentElement;parent&&parent!==root;parent=parent.parentElement){const style=getComputedStyle(parent),p=bounds(parent);if(/auto|scroll|hidden|clip/.test(style.overflowX)&& (r.right>p.right+2||r.x<p.x-2))return false;if(/auto|scroll|hidden|clip/.test(style.overflowY)&&(r.bottom>p.bottom+2||r.y<p.y-2))return false;}
   return true;
  };
  const selector='.el-button,.el-input,.el-select,.el-input-number,.el-date-editor,.el-radio-group,.el-checkbox-group,.el-switch,.upload-button';
  const controls=[...root.querySelectorAll(selector)].filter(el=>visible(el)&&!el.parentElement.closest(selector)&&!el.closest('.el-pagination,.monaco-editor,.el-table__header,.el-picker-panel'));
  const overlaps=[],tight=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
   const ar=bounds(a),br=bounds(b),x=Math.min(ar.right,br.right)-Math.max(ar.x,br.x),y=Math.min(ar.bottom,br.bottom)-Math.max(ar.y,br.y);
   if(x>2&&y>2)overlaps.push({a:label(a),b:label(b),x,y});
   if(a.parentElement===b.parentElement && !a.closest('.chat-sessions,.session-row,.el-radio-group,.el-checkbox-group,.el-button-group,.el-input-group,.el-transfer,.el-step,.el-table__body')){
    const gapX=Math.max(ar.x,br.x)-Math.min(ar.right,br.right),gapY=Math.max(ar.y,br.y)-Math.min(ar.bottom,br.bottom);
    if((y>2&&gapX>=-1&&gapX<11)||(x>2&&gapY>=-1&&gapY<11))tight.push({a:label(a),b:label(b),gapX,gapY});
   }
  }
  const overflow=[...root.querySelectorAll('.el-card,.editor-panel,.filters,.filter-row,.el-form,.management-inline-toolbar,.el-tabs')].filter(el=>visible(el)&&!el.closest('.el-table,.el-transfer')).filter(el=>{const r=bounds(el),p=bounds(root);return r.x<p.x-2||r.right>p.right+2;}).map(el=>({label:label(el),bounds:bounds(el)}));
  const clippedLabels=[...root.querySelectorAll('.el-form-item__label')].filter(el=>visible(el)&&(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)).map(el=>label(el));
  return {overlaps:overlaps.slice(0,30),tight:tight.slice(0,30),overflow,clippedLabels,documentOverflow:document.documentElement.scrollWidth>innerWidth+1,controlCount:controls.length};
 });
}
try{
 for(const width of widths){
  await page.setViewportSize({width,height:width<800?844:900});
  for(const routePath of routes){
   routeErrors=[];
   const row={path:routePath,width};
   try{
    await page.goto(base+routePath);
    await page.locator('.qoj-management .layout-content > .page-container').waitFor();
    await page.waitForTimeout(180);
    const root='.qoj-management .layout-content > .page-container';
    row.metrics=await measure(root);row.errors=[...routeErrors];
    const modalAction=routePath===`/${prefix}/majors`?'新增专业':routePath===`/${prefix}/users/teachers`?'新增教师':routePath===`/${prefix}/users/students`?'添加学生':routePath.endsWith('/courses')?'创建课程':routePath.endsWith('/classes')?'创建班级':undefined;
    if(modalAction&&await page.getByRole('button',{name:modalAction,exact:true}).count()){
     await page.getByRole('button',{name:modalAction,exact:true}).click();
     const dialog=page.locator('.qoj-management-dialog:visible');await dialog.waitFor();await page.waitForTimeout(350);
     row.dialog=await measure('.qoj-management-dialog:visible');
     await page.screenshot({path:`${out}/dialog-${width}-${routePath.replaceAll('/','_')}.png`});
     await dialog.locator('.el-dialog__headerbtn').click();await dialog.waitFor({state:'hidden'});
    }
    row.passed=!row.errors.length&&!row.metrics.overlaps.length&&!row.metrics.tight.length&&!row.metrics.overflow.length&&!row.metrics.clippedLabels.length&&!row.metrics.documentOverflow&&(!row.dialog||(!row.dialog.overlaps.length&&!row.dialog.tight.length&&!row.dialog.overflow.length&&!row.dialog.clippedLabels.length));
    if(!row.passed||process.env.LAYOUT_SCREENSHOTS!=='failures')await page.screenshot({path:`${out}/${width}-${routePath.replaceAll('/','_')}.png`});
   }catch(error){row.passed=false;row.error=error.message;await page.screenshot({path:`${out}/error-${width}-${routePath.replaceAll('/','_')}.png`}).catch(()=>{});}
   results.push(row);
   if(!row.passed)console.log(JSON.stringify({layoutFailure:row}));
   if(results.length%15===0)console.log(JSON.stringify({completed:results.length,total:routes.length*widths.length,failures:results.filter(r=>!r.passed).length}));
  }
 }
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:results.every(r=>r.passed),fixture:true,routes:routes.length,widths,checks:results,unmatchedFixtureEndpoints:[...unknown]},null,2));
 const gallery=results.map(r=>`<figure><a href="${r.width}-${r.path.replaceAll('/','_')}.png"><img loading="lazy" src="${r.width}-${r.path.replaceAll('/','_')}.png"></a><figcaption>${r.path} · ${r.width}px · ${r.passed?'通过':'需检查'}</figcaption></figure>`).join('');
 await fs.writeFile(`${out}/gallery.html`,`<!doctype html><html lang="zh"><meta charset="utf-8"><title>后台间距验证</title><style>body{font:14px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}figure{margin:0}img{width:100%;height:260px;object-fit:contain;object-position:top}</style><h1>${routes.length} 个路由 · ${widths.length} 个宽度</h1><main>${gallery}</main></html>`);
 console.log(JSON.stringify({passed:results.every(r=>r.passed),routes:routes.length,checks:results.length,failures:results.filter(r=>!r.passed).map(r=>({path:r.path,width:r.width,error:r.error,metrics:r.metrics,dialog:r.dialog}))}));
 if(process.env.LAYOUT_AUDIT_ONLY!=='1')assert.ok(results.every(r=>r.passed),'Management spacing checks failed');
}finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

const deep=[];
async function check(name,selector){
 await page.waitForTimeout(350);
 const metrics=await measure(selector);
 const passed=!metrics.overlaps.length&&!metrics.tight.length&&!metrics.overflow.length&&!metrics.clippedLabels.length&&!metrics.documentOverflow;
 deep.push({name,width:page.viewportSize().width,passed,metrics});
 await page.screenshot({path:`${out}/${name}-${page.viewportSize().width}.png`});
}
try{
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:width===1440?900:844});
  await page.goto(base+`/${prefix}/problems/new`);
  const editor=page.locator('.html-math-editor').first();await editor.waitFor();
  await editor.getByRole('button',{name:'∑ 插入公式',exact:true}).click();
  const formula=page.getByRole('dialog',{name:'插入公式',exact:true});await formula.waitFor();
  await check('formula-dialog','.el-dialog:has(.formula-layout)');
  await formula.locator('.el-dialog__headerbtn').click();await formula.waitFor({state:'hidden'});
  await editor.getByRole('button',{name:'🖼 图片',exact:true}).click();
  const imageDialog=page.getByRole('dialog',{name:'插入图片',exact:true});await imageDialog.waitFor();
  await check('image-dialog','.el-dialog:has(.image-url-form)');
  await imageDialog.locator('.el-dialog__headerbtn').click();await imageDialog.waitFor({state:'hidden'});
  await page.goto(base+`/${prefix}/contests/1`);await page.getByRole('tab',{name:'比赛信息',exact:true}).waitFor();
  for(const name of ['比赛信息','比赛介绍','报名名单','答疑与广播','比赛巡查']){
   await page.getByRole('tab',{name:new RegExp(name)}).click();await page.waitForTimeout(150);
   await check(`contest-${name}`,'.qoj-management .layout-content > .page-container');
   if(name==='报名名单'){
    await page.getByRole('button',{name:'批量导入名单',exact:true}).click();
    await page.getByRole('dialog',{name:'批量导入名单',exact:true}).waitFor();
    await check('roster-dialog','.el-dialog:has(.import-dialog)');
    await page.getByRole('dialog',{name:'批量导入名单',exact:true}).locator('.el-dialog__headerbtn').click();
   }
  }
  await page.goto(base+`/${prefix}/ai/settings`);
  await page.getByRole('textbox',{name:'服务地址',exact:true}).fill('invalid-url');
  await page.getByRole('button',{name:'保存配置',exact:true}).click();
  await page.locator('.el-form-item__error').first().waitFor();
  await check('validation-errors','.qoj-management .layout-content > .page-container');
 }
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:deep.every(r=>r.passed),fixture:true,checks:deep,errors:routeErrors},null,2));
 console.log(JSON.stringify({checks:deep.length,failures:deep.filter(r=>!r.passed)}));
 assert.ok(deep.every(r=>r.passed),'Deep layout checks failed');
}finally{await context.tracing.stop({path:`${out}/trace.zip`});await browser.close();}

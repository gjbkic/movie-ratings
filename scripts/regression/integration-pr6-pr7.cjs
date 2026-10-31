'use strict';
const {test}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');
test('combined sync/save UI retains conflict recovery and JSON backup after restart',async()=>{
 const browser=await launch();try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const a=await context.newPage(),b=await context.newPage();await a.goto(origin);await ready(a);await b.goto(origin);await ready(b);
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='integration local review'});
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='integration peer review';return save()});
  await a.waitForFunction(()=>!!window.__movie30TabConflict);await a.evaluate(()=>window.__movie30PendingSave);
  await a.locator('[data-page=data]').click();await a.evaluate(()=>window.__movie30PendingSave);
  assert.equal(await a.locator('[data-page=data]').textContent(),'同期・保存');assert.equal(await a.locator('#downloadJson').isVisible(),true);
  await a.getByRole('button',{name:'競合の退避記録を確認',exact:true}).click();
  const panel=a.locator('.movie30-recovery');await panel.getByRole('button',{name:'候補を比較',exact:true}).click();
  await panel.locator('details').first().waitFor({state:'attached'});
  for(const row of await panel.locator('details').all()){await row.locator('summary').click();await row.locator('select').selectOption('left')}
  a.on('dialog',d=>d.accept());await panel.getByRole('button',{name:'選択内容を退避・保存して復帰'}).click();await a.waitForFunction(()=>!window.__movie30TabConflict);
  await a.reload();await ready(a);assert.equal(await a.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'integration local review');
  await a.locator('[data-page=data]').click();assert.equal(await a.locator('#downloadJson').isVisible(),true);assert.equal(await a.getByRole('button',{name:'競合の退避記録を確認',exact:true}).isVisible(),true);
 }finally{await browser.close()}
});

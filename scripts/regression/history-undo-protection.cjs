'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');

test('history Undo keeps its candidate and avoids success on rejected save',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const page=await context.newPage();await page.goto(origin);await ready(page);
  await page.evaluate(async()=>{state.letterboxdMeta['fixture-0012'].note='edited fictional review';await save()});
  const before=await page.evaluate(()=>localStorage.getItem('movie30_change_history_v66'));
  assert(before&&JSON.parse(before).length,'fixture history missing');
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite')throw new DOMException('quota','QuotaExceededError');return original.apply(this,args)};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};window.__historyTestRestoreStorage=()=>{Storage.prototype.setItem=set;IDBDatabase.prototype.transaction=original}});
  await page.evaluate(()=>document.getElementById('histOpen66').click());
  await page.locator('#histBody66 [data-u]').first().click();
  await page.waitForTimeout(200);
  const after=await page.evaluate(()=>({history:localStorage.getItem('movie30_change_history_v66'),note:state.letterboxdMeta['fixture-0012'].note,status:document.getElementById('saveState')?.textContent||''}));
  assert.equal(after.history,before,'failed Undo consumed the only durable history');
  assert.equal(after.note,'edited fictional review','failed Undo lost the in-memory edit');
  assert.match(after.status,/退避を確認できません|保存停止|保存失敗|保存できません/);
 }finally{await context.close();await browser.close()}
});

for(const kind of ['stopped','foreign-policy'])test('history Undo refuses '+kind,async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const page=await context.newPage();await page.goto(origin);await ready(page);
  await page.evaluate(async()=>{state.letterboxdMeta['fixture-0012'].note='protected edit';await save()});
  const before=await page.evaluate(()=>localStorage.getItem('movie30_change_history_v66'));
  await page.evaluate(kind=>{if(kind==='stopped')window.__movie30RecoveryBlocked=true;else state.scorePolicy='balanced-v1';document.getElementById('histOpen66').click()},kind);
  await page.locator('#histBody66 [data-u]').first().click();
  const after=await page.evaluate(()=>({note:state.letterboxdMeta['fixture-0012'].note,history:localStorage.getItem('movie30_change_history_v66')}));
  assert.equal(after.note,'protected edit');assert.equal(after.history,before);
 }finally{await context.close();await browser.close()}
});

test('history Undo saves normally and survives reload',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const page=await context.newPage();await page.goto(origin);await ready(page);
  const original=await page.evaluate(()=>state.letterboxdMeta['fixture-0012'].note);
  await page.evaluate(async()=>{state.letterboxdMeta['fixture-0012'].note='changed review';await save()});
  const undoId=await page.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66'))[0].id);
  await page.evaluate(()=>document.getElementById('histOpen66').click());
  await page.locator('#histBody66 [data-u]').first().click();
  await page.waitForFunction(expected=>state.letterboxdMeta['fixture-0012'].note===expected,original);
  await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]').some(h=>h.id===id),undoId);
  await page.reload();await ready(page);
  assert.equal(await page.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),original);
 }finally{await context.close();await browser.close()}
});

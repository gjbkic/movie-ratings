'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');
async function setup(){const browser=await chromium.launch(options),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await isolate(context);const page=await context.newPage();await page.goto(origin);await ready(page);return {browser,context,page}}
async function drag(page){
 const coords=await page.evaluate(()=>{const list=[...document.querySelectorAll('#rankRoot .score-list')].find(x=>x.querySelectorAll('.rank-card').length>=4),cards=[...list.querySelectorAll('.rank-card')];cards[1].scrollIntoView({behavior:'instant',block:'center'});const a=cards[1].querySelector('.drag-handle').getBoundingClientRect(),b=cards[2].getBoundingClientRect();return {a:{x:a.x+a.width/2,y:a.y+a.height/2},b:{x:a.x+a.width/2,y:b.bottom-b.height*.25},key:list.dataset.score}});
 const cdp=await page.context().newCDPSession(page),send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:9,x,y,radiusX:5,radiusY:5}]});
 await send('touchStart',coords.a.x,coords.a.y);await page.waitForTimeout(160);await send('touchMove',coords.b.x,coords.b.y);await page.waitForTimeout(160);await send('touchEnd');await page.waitForTimeout(350);await page.evaluate(()=>window.__movie30PendingSave);
 assert.equal(await page.locator('#undoLastDrag').isEnabled(),true,'real drag did not create undo');return coords.key;
}
test('failed drag Undo retains candidate and does not claim success',async()=>{
 const {browser,context,page}=await setup();try{
  const key=await drag(page),before=await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};const tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...a){if(a[1]==='readwrite')throw new DOMException('quota','QuotaExceededError');return tx.apply(this,a)}});
  await page.locator('#undoLastDrag').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#undoLastDrag').isEnabled(),true,'failed Undo consumed candidate');
  assert.equal(await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key),before,'failed Undo changed ranking');
  assert.doesNotMatch(await page.locator('#toast').textContent(),/直前のドラッグを戻しました/);
 }finally{await context.close();await browser.close()}
});
test('successful drag Undo restores all rank maps after reload',async()=>{
 const {browser,context,page}=await setup();try{
  const original=await page.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,starOverrides:state.starOverrides,assignments:state.assignments}));
  await drag(page);await page.locator('#undoLastDrag').click();await page.waitForFunction(()=>document.getElementById('undoLastDrag').disabled);await page.evaluate(()=>window.__movie30PendingSave);
  const after=await page.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,starOverrides:state.starOverrides,assignments:state.assignments}));
  if(after!==original)throw Error(JSON.stringify(await page.evaluate(()=>({status:document.getElementById('saveState').textContent,button:document.getElementById('undoLastDrag').disabled,rank80:state.rankOrder['80'].slice(0,5),archive:!!document.getElementById('movie30-drag-undo-warning')}))));assert.equal(await page.locator('#undoLastDrag').isEnabled(),false);
  await page.reload();await ready(page);
  assert.equal(await page.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,starOverrides:state.starOverrides,assignments:state.assignments})),original);
 }finally{await context.close();await browser.close()}
});
test('failed movie write retains a durable drag Undo archive',async()=>{
 const {browser,context,page}=await setup();try{
  const key=await drag(page),before=await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};movie30WriteSnapshot=async()=>false});
  await page.locator('#undoLastDrag').click();await page.waitForFunction(()=>document.getElementById('saveState').textContent.includes('ドラッグUndoを保存できません'));
  assert.equal(await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key),before);
  assert.equal(await page.locator('#undoLastDrag').isEnabled(),true);
  const rows=await page.evaluate(async()=>{const db=await openMovie30Db();return new Promise(resolve=>{const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.id.startsWith('drag-undo-')&&x.status==='pending'))})});
  assert.equal(rows.length,1);assert.equal(typeof rows[0].json,'string');
  await page.reload();await page.waitForFunction(()=>!!document.getElementById('movie30-drag-undo-warning'));
  assert.equal(await page.locator('#movie30-drag-undo-warning button').count(),1);
 }finally{await context.close();await browser.close()}
});
test('later edit during a failed drag Undo save is not rolled back',async()=>{
 const {browser,context,page}=await setup();try{
  await drag(page);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};window.dragUndoWriteStarted=false;movie30WriteSnapshot=async()=>{window.dragUndoWriteStarted=true;await new Promise(resolve=>window.releaseDragUndoWrite=resolve);return false}});
  await page.locator('#undoLastDrag').click();await page.waitForFunction(()=>window.dragUndoWriteStarted);
  await page.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='later fictional edit';window.releaseDragUndoWrite()});
  await page.waitForFunction(()=>document.getElementById('saveState').textContent.includes('ドラッグUndoを保存できません'));
  assert.equal(await page.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'later fictional edit');
  assert.equal(await page.locator('#undoLastDrag').isEnabled(),true);
 }finally{await context.close();await browser.close()}
});
for(const kind of ['stopped','policy','later-map-edit','peer-epoch'])test('drag Undo rejects '+kind,async()=>{
 const {browser,context,page}=await setup();try{
  const key=await drag(page),before=await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key);
  await page.evaluate(k=>{if(k==='stopped')window.__movie30RecoveryBlocked=true;if(k==='policy')state.scorePolicy='balanced-v1';if(k==='later-map-edit')state.starOverrides['fixture-0012']=3;if(k==='peer-epoch')window.__movie30HistoryEpoch=(window.__movie30HistoryEpoch||0)+1},kind);
  await page.locator('#undoLastDrag').click();
  assert.equal(await page.evaluate(k=>JSON.stringify(state.rankOrder[k]),key),before);
  assert.equal(await page.locator('#undoLastDrag').isEnabled(),true);
 }finally{await context.close();await browser.close()}
});

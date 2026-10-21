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

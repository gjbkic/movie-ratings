'use strict';
const {test,after}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');
let browser;
after(async()=>browser?.close());
async function start(){
 browser??=await launch();
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto(origin);await ready(page);
 return {context,page};
}
async function openForSwipe(page){
 await page.evaluate(()=>{
   const film=allFilms()[0];if(!film)throw Error('Missing fixture');
   openSheet(film.id);
   const sheet=document.querySelector('#sheetBg>.sheet');
   sheet.style.maxHeight='42vh';
   let filler=document.getElementById('movie30-test-swipe-filler');
   if(!filler){filler=document.createElement('div');filler.id='movie30-test-swipe-filler';filler.style.height='1800px';sheet.appendChild(filler)}
   sheet.scrollTop=200;
 });
}
async function swipe(page,{scrolled=true,fast=true,distance=145}={}){
 await page.evaluate(async({scrolled,fast,distance})=>{
   const sheet=document.querySelector('#sheetBg>.sheet'),el=document.getElementById('movie30-test-swipe-filler');
   sheet.scrollTop=scrolled?200:0;
   const b=sheet.getBoundingClientRect();
   const x=Math.round(b.left+b.width*.55),y=Math.round(b.top+b.height*.60);
   const fire=(kind,dy)=>{
     const t=new Touch({identifier:2,target:el,clientX:x,clientY:y+dy,pageX:x,pageY:y+dy});
     return el.dispatchEvent(new TouchEvent(kind,{bubbles:true,cancelable:true,
       touches:kind==='touchend'?[]:[t],targetTouches:kind==='touchend'?[]:[t],changedTouches:[t]}));
   };
   fire('touchstart',0);
   fire('touchmove',distance/3);
   if(!fast)await new Promise(resolve=>setTimeout(resolve,360));
   fire('touchmove',distance);
   fire('touchend',distance);
 },{scrolled,fast,distance});
 await page.waitForTimeout(245);
}
test('detail sheet: fast lower-half flick dismisses even after scrolling',async()=>{
 const {context,page}=await start();
 try{
  await openForSwipe(page);
  assert(await page.locator('#sheetBg').evaluate(el=>el.classList.contains('open')));
  await swipe(page);
  assert.equal(await page.locator('#sheetBg').evaluate(el=>el.classList.contains('open')),false);
 }finally{await context.close()}
});
test('detail sheet: normal slower reading swipe does not dismiss a scrolled sheet',async()=>{
 const {context,page}=await start();
 try{
  await openForSwipe(page);
  await swipe(page,{fast:false,distance:82});
  assert.equal(await page.locator('#sheetBg').evaluate(el=>el.classList.contains('open')),true);
 }finally{await context.close()}
});
test('detail sheet: downward swipe at top still dismisses',async()=>{
 const {context,page}=await start();
 try{
  await openForSwipe(page);
  await swipe(page,{scrolled:false});
  assert.equal(await page.locator('#sheetBg').evaluate(el=>el.classList.contains('open')),false);
 }finally{await context.close()}
});
test('sync/save: duplicate add form hidden; top button still opens TMDB/manual add',async()=>{
 const {context,page}=await start();
 try{
  await page.locator('[data-page=data]').click();
  assert.equal(await page.locator('[data-page=data]').textContent(),'同期・保存');
  assert.equal(await page.locator('#newTitle').isVisible(),false);
  // Only the persistent global ＋作品 opens the add sheet.
  await page.locator('#quickAdd').click();
  assert.equal(await page.locator('#addSheetBg').evaluate(el=>el.classList.contains('open')),true);
 }finally{await context.close()}
});
test('sync/save: both sync status panels and JSON backup stay visible, advanced tools remain accessible',async()=>{
 const {context,page}=await start();
 try{
  await page.locator('[data-page=data]').click();
  for(const id of ['lbStatus','gptSyncStatus','downloadJson','importFile']){
    assert.equal(await page.locator('#'+id).count(),1,'missing '+id);
  }
  // Empty status elements can legitimately have zero height. Simulate the
  // completed-sync messages the user needs to be able to check later.
  await page.evaluate(()=>{
    document.getElementById('lbStatus').textContent='同期完了 · 取り込み済み';
    document.getElementById('gptSyncStatus').textContent='設定済み · 最終同期 22:00';
  });
  assert.equal(await page.locator('#lbStatus').isVisible(),true);
  assert.equal(await page.locator('#gptSyncStatus').isVisible(),true);
  assert.equal(await page.locator('#downloadJson').isVisible(),true);
  assert.equal(await page.locator('#downloadHtml').isVisible(),false);
  const advanced=page.locator('#movie30-data-extra');
  assert.equal(await advanced.evaluate(e=>e.open),false);
  await page.locator('#movie30-data-extra>summary').click();
  assert.equal(await page.locator('#tmdbCredential').isVisible(),true);
  assert.equal(await page.locator('#directorTool84').isVisible(),true);
  const backup=page.locator('#movie30-data-backup-advanced');
  await page.locator('#movie30-data-backup-advanced>summary').click();
  assert.equal(await page.locator('#downloadCsv').isVisible(),true);
  assert.equal(await page.locator('#resetAll').isVisible(),false);
  await page.locator('#movie30-data-reset-danger>summary').click();
  assert.equal(await page.locator('#resetAll').isVisible(),true);
 }finally{await context.close()}
});

'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  async function exercise(legacy){
   const page=await browser.newPage();await page.goto(origin);await ready(page);
   await page.evaluate(legacy=>{
    if(legacy)delete window.__movie30DetailUnified.buildSummary;
    window.rankInfoCalls=0;
    const original=window.Movie30RankQueries.rankInfo;
    window.Movie30RankQueries={...window.Movie30RankQueries,rankInfo(...args){window.rankInfoCalls++;return original.apply(this,args)}};
    Object.assign(state.letterboxdMeta['fixture-0012'],{reportedWatchedDate:'2026-01-02',addedDate:'2026-01-03',note:'架空 <レビュー>\n2行目'});
   },legacy);
   const before=await snapshot(page),views=[];
   for(const id of ['fixture-0012','fixture-0002','fixture-0000','fixture-0010','fixture-0012']){
    await page.evaluate(id=>openSheet(id),id);
    views.push(await page.evaluate(()=>{
     const d=document.getElementById('detail66'),stats=d.querySelector('.v66-stats'),note=document.getElementById('note66');
     return {id:selectedId,count:stats.children.length,rank:stats.hidden?null:stats.textContent,note:note.value,readonly:note.readOnly,tip:d.querySelector('.tip').textContent,jumpHidden:document.getElementById('detailJump66').hidden,afterGrid:d.previousElementSibling.className,neighbors:!!d.querySelector('.v66-nei')};
    }));
    await page.locator('#note66').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#memoFull77').inputValue(),before.letterboxdMeta[id].note);
    await page.locator('#memoSave77').click();await page.evaluate(()=>window.__movie30PendingSave);
   }
   const after=await snapshot(page);
   for(const key of Object.keys(before).filter(k=>!['updatedAt','storageIntegrity'].includes(k)))assert.deepEqual(after[key],before[key],key);
   assert.equal(await page.evaluate(()=>document.getElementById('sheetBg').classList.contains('open')),true);
   await page.locator('#detailJump66').click();
   assert.equal(await page.evaluate(()=>document.getElementById('sheetBg').classList.contains('open')),false);
   assert.equal(await page.evaluate(()=>selectedId),null);
   const calls=await page.evaluate(()=>window.rankInfoCalls);await page.close();return {views,calls};
  }
  const legacy=await exercise(true),current=await exercise(false);
  assert.deepEqual(current.views,legacy.views,'Final detail and editor contract must match legacy construction');
  assert(legacy.calls>0,'Legacy comparison must exercise original rankInfo');
  assert.equal(current.calls,0,'Unified detail must not compute discarded legacy ranks');
  console.log('DETAIL_RENDER_CONTRACT_PASS',JSON.stringify({legacyCalls:legacy.calls,currentCalls:current.calls,cases:current.views.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

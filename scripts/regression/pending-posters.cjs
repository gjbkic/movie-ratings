'use strict';
const {launch,ready,origin,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await ready(page);
  const before=await page.evaluate(()=>JSON.stringify(state));
  async function check(){const groups=await page.evaluate(()=>['star','score'].map(kind=>{
   const cards=[...document.querySelectorAll('[data-pending-kind="'+kind+'"] .uns-card')];
   return {kind,count:cards.length,valid:cards.every(c=>{const images=c.querySelectorAll('.movie30-poster84');return images.length===1&&images[0].dataset.posterId===decodeURIComponent(c.dataset.uns||c.dataset.v76Open)})};
  }));for(const g of groups){assert(g.count>0,JSON.stringify(g));assert(g.valid,JSON.stringify(g))}}
  await check();await page.evaluate(()=>{renderRank();window.__movie30PosterDecorate84();window.__movie30PosterDecorate84()});await check();
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.reload();await ready(page);await check();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.locator('[data-pending-kind="star"] [data-v76-open]').first().tap();
  assert.equal(await page.evaluate(()=>selectedId),'fixture-0000');assert(await page.locator('#sheetBg').evaluate(x=>x.classList.contains('open')));
  assert.deepEqual(errors,[]);console.log('PENDING_POSTERS_PASS: both panels, repeat decoration, reload, detail tap, complete state unchanged');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
// These assert reproducible defects, NOT safety guarantees. A fix must replace the
// reproduction with a positive contract test; an unexpected fix deliberately fails here.
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  let context,page;
  context=await browser.newContext();page=await context.newPage();await page.goto(origin);await ready(page);const before=await snapshot(page),other=await context.newPage();await other.goto(origin+'/seed');
  await other.evaluate(()=>{const s=JSON.parse(localStorage.getItem('movie30_data_v1'));s.updatedAt+=100000;delete s.storageIntegrity;s.customFilms=[];s.rankOrder={};s.letterboxdMeta={};localStorage.setItem('movie30_data_v1',JSON.stringify(s))});
  await page.waitForFunction(()=>state.customFilms.length===0);assert(before.customFilms.length>=740);console.log('KNOWN DEFECT MULTITAB: newer unsigned complete-shaped truncation replaces richer in-memory state');await context.close();
  // Network count only: no timing/performance claim.
  context=await browser.newContext();page=await context.newPage();let catalogs=0;page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/tmdb-metadata.json'))catalogs++});await page.goto(origin);await ready(page);await page.waitForTimeout(300);assert.equal(catalogs,5);console.log('KNOWN REDUNDANCY CATALOG: five independent requests for identical catalog');await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

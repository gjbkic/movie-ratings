'use strict';
// These assert reproducible defects, NOT safety guarantees. A fix must replace the
// reproduction with a positive contract test; an unexpected fix deliberately fails here.
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  let context,page;
  // Network count only: no timing/performance claim.
  context=await browser.newContext();page=await context.newPage();let catalogs=0;page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/tmdb-metadata.json'))catalogs++});await page.goto(origin);await ready(page);await page.waitForTimeout(300);assert.equal(catalogs,5);console.log('KNOWN REDUNDANCY CATALOG: five independent requests for identical catalog');await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

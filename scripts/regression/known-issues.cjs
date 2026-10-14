'use strict';
// These assert reproducible defects, NOT safety guarantees. A fix must replace the
// reproduction with a positive contract test; an unexpected fix deliberately fails here.
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  let context=await browser.newContext(),page=await context.newPage();await page.goto(origin);await ready(page);
  const html=await page.evaluate(()=>{try{snapshotHtml();return null}catch(e){return e.message}});assert.match(html,/スナップショット埋込位置/);console.log('KNOWN DEFECT HTML-SNAPSHOT: external-script document has no embedded state marker');
  const bad=await page.evaluate(()=>{const a={id:'duplicate-a',title:'Black Mirror: Hang the DJ',englishTitle:'Black Mirror: Hang the DJ',year:2017,uri:'https://example.invalid/a',added:true},b={...a,id:'duplicate-b',uri:'https://example.invalid/b'};state.customFilms.push(a,b);state.exactScores[a.id]=90;state.exactScores[b.id]=null;state.letterboxdMeta[a.id]={};state.letterboxdMeta[b.id]={};state.updatedAt++;try{allFilms();return null}catch(e){return e.message}});assert.match(bad,/sameEnglish/);console.log('KNOWN DEFECT DUPLICATE-EPISODE: nonidentical URI evaluates undefined sameEnglish');await context.close();
  context=await browser.newContext();page=await context.newPage();await page.goto(origin);await ready(page);const before=await snapshot(page),other=await context.newPage();await other.goto(origin+'/seed');
  await other.evaluate(()=>{const s=JSON.parse(localStorage.getItem('movie30_data_v1'));s.updatedAt+=100000;delete s.storageIntegrity;s.customFilms=[];s.rankOrder={};s.letterboxdMeta={};localStorage.setItem('movie30_data_v1',JSON.stringify(s))});
  await page.waitForFunction(()=>state.customFilms.length===0);assert(before.customFilms.length>=740);console.log('KNOWN DEFECT MULTITAB: newer unsigned complete-shaped truncation replaces richer in-memory state');await context.close();
  context=await browser.newContext();page=await context.newPage();let writes=0;
  await page.route('https://api.github.com/**',async r=>{if(r.request().method()==='PUT'){writes++;return r.fulfill({status:503,json:{message:'synthetic failure'}})}return r.fulfill({json:{sha:'synthetic-sha'}})});
  await page.goto(origin);await ready(page);
  await page.evaluate(()=>{localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token');const box=document.getElementById('gptSyncAuto');box.checked=true;box.onchange();state.titleOverrides['fixture-0012']={title:'Synthetic sync edit'};return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000});
  await page.waitForTimeout(1200);const first=writes;assert(first>0);const fp=await page.evaluate(()=>localStorage.getItem('movie30_github_synced_fingerprint_v1'));assert(fp);
  await page.evaluate(()=>save());await page.waitForTimeout(4500);assert.equal(writes,first);console.log('KNOWN DEFECT SYNC-RETRY: failed PUT records fingerprint; unchanged retry is not scheduled');await context.close();
  // Network count only: no timing/performance claim.
  context=await browser.newContext();page=await context.newPage();let catalogs=0;page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/tmdb-metadata.json'))catalogs++});await page.goto(origin);await ready(page);await page.waitForTimeout(300);assert.equal(catalogs,5);console.log('KNOWN REDUNDANCY CATALOG: five independent requests for identical catalog');await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

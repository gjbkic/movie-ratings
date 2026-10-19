'use strict';
// This opt-in is for an isolated fictional origin only. No production migration.
const {chromium,options,isolate,fixture,origin,ready,snapshot,assert}=require('./harness.cjs');
const policy=require('../../app-score-policy.js');
(async()=>{
 const browser=await chromium.launch(options);
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const seed=policy.plan(fixture().state,[]).target;
  await isolate(context,{seed});await context.addInitScript(()=>{window.__movie30BalancedScorePreview=true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin);await ready(page);
  const ranges=await page.evaluate(()=>STAR_RANGES);assert.deepEqual(ranges,policy.ranges(policy.CURRENT));
  assert.deepEqual(await page.evaluate(()=>Array.from({length:101},(_,n)=>scoreToStar(n))),Array.from({length:101},(_,n)=>policy.starForScore(n,policy.CURRENT)));
  await page.evaluate(()=>renderRank());
  const misplaced=await page.evaluate(()=>[...document.querySelectorAll('.rank-star')].flatMap(sec=>{
   const heading=sec.querySelector('.rank-star-head strong')?.textContent;
   return [...sec.querySelectorAll('.rank-card')].filter(card=>heading!==stars(scoreToStar(effectiveScore(filmById(decodeURIComponent(card.dataset.id)))))).map(c=>c.dataset.id);
  }));assert.deepEqual(misplaced,[]);
  const before=await snapshot(page);
  await page.evaluate(()=>openSheet('fixture-0012'));
  await page.locator('#editScore').fill('76');await page.locator('#editScore').blur();await page.waitForTimeout(200);await page.evaluate(()=>window.__movie30PendingSave);
  assert.equal(await page.locator('#editStar').inputValue(),'3');
  const edited=await snapshot(page);assert.equal(edited.exactScores['fixture-0012'],76);
  for(const key of ['letterboxdMeta','genreOverrides','customFilms','fixtureUnknown'])assert.deepEqual(edited[key],before[key]);
  await page.reload();await ready(page);const reopened=await snapshot(page);
  assert.deepEqual(reopened.exactScores,edited.exactScores);assert.deepEqual(reopened.rankOrder,edited.rankOrder);assert.equal(reopened.scorePolicy,policy.CURRENT);
  await page.evaluate(()=>openSheet('fixture-0012'));assert.equal(await page.locator('#editStar').inputValue(),'3');
  page.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());
  const beforeImport=await snapshot(page);
  assert.equal(await page.evaluate(s=>restorePackage({state:s}),fixture().state),false,'legacy scores must not enter balanced state');
  assert.deepEqual(await snapshot(page),beforeImport);
  assert.equal(await page.evaluate(async()=>{try{await snapshotHtml();return false}catch(e){return /JSON/.test(e.message)}}),true,'balanced HTML must not reopen with legacy thresholds');
  assert.deepEqual(errors,[]);console.log('SCORE_PREVIEW_PASS: thresholds, grouping, editing/reload, incompatible import and HTML protection');
  const legacy=await browser.newContext();await isolate(legacy);
  const oldPage=await legacy.newPage();oldPage.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());
  await oldPage.goto(origin);await ready(oldPage);const oldBefore=await snapshot(oldPage);
  const diskBefore=await oldPage.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  for(const incoming of [seed,{...seed,scorePolicy:'future'},{...seed,scorePolicy:null}]){
   assert.equal(await oldPage.evaluate(s=>restorePackage({state:s}),incoming),false);
   assert.deepEqual(await snapshot(oldPage),oldBefore);
   assert.equal(await oldPage.evaluate(()=>localStorage.getItem(STORAGE_KEY)),diskBefore);
  }
  console.log('SCORE_POLICY_IMPORT_GUARD_PASS: balanced/future/null cannot replace legacy memory or disk');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

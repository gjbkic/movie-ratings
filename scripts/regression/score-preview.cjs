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
  assert.deepEqual(errors,[]);console.log('SCORE_PREVIEW_PASS: 101 thresholds, rank grouping, score input, metadata and reload');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

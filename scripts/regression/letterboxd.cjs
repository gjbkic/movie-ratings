'use strict';
const {launch,origin,ready,snapshot,reload,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  const rss='<?xml version="1.0"?><rss xmlns:letterboxd="https://letterboxd.com"><channel><item><title>Fixture Film 12</title><letterboxd:filmTitle>Fixture Film 12</letterboxd:filmTitle><letterboxd:filmYear>2012</letterboxd:filmYear><letterboxd:memberRating>1</letterboxd:memberRating><letterboxd:watchedDate>2026-01-02</letterboxd:watchedDate><link>https://letterboxd.com/fixture-user/film/synthetic-film/</link><description>synthetic imported review</description></item></channel></rss>';
  let requests=0;await page.route('https://letterboxd.com/**',r=>{requests++;return r.fulfill({contentType:'application/xml',body:rss})});
  await page.goto(origin);await ready(page);const before=await snapshot(page);
  for(let i=0;i<2;i++)assert.equal(await page.evaluate(()=>syncLetterboxd(false)),true);
  assert(requests>=2,'Must exercise the mocked RSS network path');await page.evaluate(()=>window.__movie30PendingSave);
  const after=await snapshot(page);assert.equal(after.customFilms.length,before.customFilms.length);assert.deepEqual(after.exactScores,before.exactScores);assert.deepEqual(after.rankOrder,before.rankOrder);
  assert.equal(after.letterboxdMeta['fixture-0012'].note,before.letterboxdMeta['fixture-0012'].note);
  for(const id of Object.keys(before.letterboxdMeta))for(const event of before.letterboxdMeta[id].watchHistory||[])assert(after.letterboxdMeta[id].watchHistory.some(x=>x.id===event.id));
  await reload(page);const persisted=await snapshot(page);assert.deepEqual(persisted.exactScores,after.exactScores);assert.deepEqual(persisted.rankOrder,after.rankOrder);assert.deepEqual(persisted.letterboxdMeta,after.letterboxdMeta);
  console.log('PASS repeated mocked Letterboxd RSS: no duplicate films; exact scores, ranks, reviews and watch events persist');
  // CSV uses a separate entry point; identical input is idempotent for membership/ranks.
  const csv='Name,Year,Rating,Letterboxd URI\nFixture Film 12,2012,1,https://letterboxd.com/film/synthetic-film/';
  for(let i=0;i<2;i++)await page.evaluate(csv=>importLetterboxdCsv(csv),csv);
  await page.evaluate(()=>window.__movie30PendingSave);await reload(page);const imported=await snapshot(page);assert.equal(imported.customFilms.length,after.customFilms.length);assert.deepEqual(imported.exactScores,after.exactScores);assert.deepEqual(imported.rankOrder,after.rankOrder);assert.equal(imported.letterboxdMeta['fixture-0012'].note,before.letterboxdMeta['fixture-0012'].note);assert.deepEqual(imported.letterboxdMeta['fixture-0010'].seasonScoresV1,{1:91,2:0});
  console.log('PASS repeated mocked Letterboxd CSV: membership, scores, ranks and independent season scores retained');await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

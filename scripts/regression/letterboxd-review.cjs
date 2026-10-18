'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();let body='素晴らしい。マジで良い。';
  const guid='letterboxd-review-1543852049',old='素晴らしい。良い。',id='fixture-0012';
  await page.route(/letterboxd-gjbkic\.xml|https:\/\/letterboxd\.com\//,r=>r.fulfill({contentType:'application/xml',body:`<rss xmlns:letterboxd="https://letterboxd.com"><channel><item><title>Fixture Film 12</title><letterboxd:filmTitle>Fixture Film 12</letterboxd:filmTitle><letterboxd:filmYear>2012</letterboxd:filmYear><letterboxd:memberRating>4</letterboxd:memberRating><guid>${guid}</guid><link>https://letterboxd.com/fixture-user/film/synthetic-film/</link><description>${body}</description></item></channel></rss>`}));
  await page.goto(origin);await ready(page);await page.evaluate(()=>save());await page.evaluate(()=>window.__movie30PendingSave);
  await page.evaluate(()=>syncLetterboxd(false));await page.evaluate(()=>window.__movie30PendingSave);
  await page.evaluate(({id,guid,old})=>Object.assign(state.letterboxdMeta[id],{note:old,noteSource:'manual',noteEditedAt:'2026-01-01',rssReviewRecords:{[guid]:{body:old,block:old}}}),{id,guid,old});
  const before=await snapshot(page);
  async function sync(){assert.equal(await page.evaluate(()=>syncLetterboxd(false)),true);await page.evaluate(()=>window.__movie30PendingSave)}
  async function meta(){return (await snapshot(page)).letterboxdMeta[id]}
  await sync();assert.equal((await meta()).note,body,'false manual must recover from the saved GUID body');assert.equal((await meta()).noteSource,'letterboxd-rss');
  async function edit(value){await page.evaluate(id=>{openSheet(id);document.getElementById('note66').click()},id);if(value!==undefined)await page.locator('#memoFull77').fill(value);await page.locator('#memoSave77').click();await page.evaluate(()=>window.__movie30PendingSave)}
  await edit();assert.equal((await meta()).noteSource,'letterboxd-rss');assert.equal((await meta()).noteEditedAt,undefined);
  body+='追記。';await sync();assert.equal((await meta()).note,body);
  await edit(body+'！');const manual=await meta();assert.equal(manual.noteSource,'manual');assert(manual.noteEditedAt);
  body+='さらに更新。';await sync();await sync();assert.equal((await meta()).note,manual.note);assert.deepEqual((await meta()).rssReviewRecords,manual.rssReviewRecords);
  // Unknown provenance and edits elsewhere in a combined review remain protected.
  for(const note of ['記録のない手編集','別のメモ\n'+manual.rssReviewRecords[guid].body]){
   await page.evaluate(({id,note})=>{state.letterboxdMeta[id].note=note}, {id,note});await sync();assert.equal((await meta()).note,note);
  }
  await page.evaluate(()=>syncLetterboxd(false));await page.evaluate(()=>window.__movie30PendingSave);
  await page.evaluate(({id,guid,old})=>Object.assign(state.letterboxdMeta[id],{note:old,noteSource:'manual',rssReviewRecords:{[guid]:{body:old,block:''}}}),{id,guid,old});
  await sync();await sync();assert.equal((await meta()).note,body);assert.equal(Object.keys((await meta()).rssReviewRecords).length,1);
  const after=await snapshot(page);
  for(const key of Object.keys(before).filter(k=>!['letterboxdMeta','updatedAt','storageIntegrity'].includes(k)))assert.deepEqual(after[key],before[key],key);
  for(const key of Object.keys(before.letterboxdMeta[id]).filter(k=>!['note','noteSource','noteEditedAt','noteImportedAt','rssReviewRecords'].includes(k)))assert.deepEqual(after.letterboxdMeta[id][key],before.letterboxdMeta[id][key],key);
  await page.reload();await ready(page);await page.evaluate(()=>save());await page.evaluate(()=>window.__movie30PendingSave);assert.equal((await meta()).note,body);
  console.log('LETTERBOXD_REVIEW_PASS: false manual repair, unchanged save, real edits protected, GUID idempotence, reload, unrelated fields preserved');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

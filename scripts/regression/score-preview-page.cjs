'use strict';
const {chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
const policy=require('../../app-score-policy.js');
(async()=>{
 const browser=await chromium.launch(options);try{
  const context=await browser.newContext({acceptDownloads:true});const requests=await isolate(context);
  const page=await context.newPage();await page.goto(origin+'/score-preview.html');
  const source=JSON.stringify(fixture()),state=JSON.parse(source).state;
  const before=await page.evaluate(()=>localStorage.getItem('movie30_data_v1'));
  await page.locator('#source').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:Buffer.from(source)});
  await page.locator('#result').waitFor({state:'visible'});
  assert.match(await page.locator('#summary').textContent(),/未確定・未適用/);
  const [originalDownload,candidateDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#download-source').click()]);
  const original=await require('fs').promises.readFile(await originalDownload.path(),'utf8');assert.equal(original,source);
  const pending=page.waitForEvent('download');await page.locator('#download-candidate').click();const download=await pending;
  const candidate=JSON.parse(await require('fs').promises.readFile(await download.path(),'utf8'));
  assert.equal(candidate.type,'fictional-score-preview-only');assert.deepEqual(candidate.state,policy.plan(state,[]).target);
  for(const key of Object.keys(state))if(!['exactScores','rankOrder','storageIntegrity','scorePolicy'].includes(key))assert.deepEqual(candidate.state[key],state[key],key);
  assert.equal(await page.evaluate(()=>localStorage.getItem('movie30_data_v1')),before);assert.equal(await page.evaluate(()=>typeof window.state),'undefined');
  const fake=fixture();fake.state.customFilms[0].title='Real movie';
  await page.locator('#source').setInputFiles({name:'actual.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fake))});
  assert.equal(await page.locator('#result').isHidden(),true);assert.match(await page.locator('#status').textContent(),/架空740作品/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('movie30_data_v1')),before);
  assert(requests.every(r=>r.host==='movie-regression.test'));
  console.log('SCORE_PREVIEW_PAGE_PASS: fictional file, both actual downloads, state invariant, real-looking input rejected, no external request');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

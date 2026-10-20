'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
for(const kind of ['preview','balanced','null','unknown','legacy'])test('fresh installation live envelope: '+kind,async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);await context.addInitScript(()=>localStorage.removeItem('movie30_data_v1'));
  const page=await context.newPage();
  const live={app:'movie30-live',schema:2,state:fixture().state};
  if(kind==='preview')live.type='fictional-score-preview-only';
  if(kind==='balanced')live.state.scorePolicy='balanced-v1';
  if(kind==='null')live.state.scorePolicy=null;
  if(kind==='unknown')live.state.scorePolicy='future-v9';
  await page.route('**/live-state.json',r=>r.fulfill({json:live}));
  await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  const actual=await page.evaluate(()=>({restored:window.__movie30RestoredFrom,blocked:!!window.__movie30RecoveryBlocked}));
  assert.equal(actual.restored,kind==='legacy'?'live-state':undefined);assert.equal(actual.blocked,kind!=='legacy');
 }finally{await context.close();await browser.close()}
});

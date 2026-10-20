'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
test('invalid late rank reference cannot partially change earlier scores',async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context,{seed});
  await context.route('**/recovery-ranks-20261010.json',r=>r.fulfill({json:{sourceCommit:'synthetic-only',correctScores:[{id:'fixture-0012',from:80,to:81}],rankOrder:{'80':{},'81':['fixture-0012']},clearScores:[],knownDamagedOrders:{}}}));
  const page=await context.newPage();await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  const result=await page.evaluate(()=>({score:state.exactScores['fixture-0012'],rank:state.rankOrder['80'],blocked:!!window.__movie30RecoveryBlocked}));
  assert.equal(result.score,80,'early score correction survived a later reference error');
  assert.deepEqual(result.rank,seed.rankOrder['80']);
  assert.equal(result.blocked,true,'invalid reference was not reported as a stopped recovery');
 }finally{await context.close();await browser.close()}
});
test('valid fictional rank repair preserves later films and survives reload',async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 const ref={sourceCommit:'synthetic-only',rankOrder:{...seed.rankOrder,'81':['fixture-0012',...seed.rankOrder['81']]},correctScores:[{id:'fixture-0012',from:80,to:81}],clearScores:[],knownDamagedOrders:{'81':[seed.rankOrder['81']]}};
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context,{seed});await context.route('**/recovery-ranks-20261010.json',r=>r.fulfill({json:ref}));
  const page=await context.newPage();await page.goto(origin);await page.waitForSelector('html.movie30-ready');await page.evaluate(()=>window.__movie30PendingSave);
  const expected=await page.evaluate(()=>({score:state.exactScores['fixture-0012'],order:state.rankOrder['81'],review:state.letterboxdMeta['fixture-0012'].note,unknown:state.fixtureUnknown}));
  assert.equal(expected.score,81);assert(expected.order.includes('fixture-0012'));assert.equal(expected.review,seed.letterboxdMeta['fixture-0012'].note);
  await page.reload();await page.waitForSelector('html.movie30-ready');
  const actual=await page.evaluate(()=>({score:state.exactScores['fixture-0012'],order:state.rankOrder['81'],review:state.letterboxdMeta['fixture-0012'].note,unknown:state.fixtureUnknown}));
  assert.deepEqual(actual,expected);
 }finally{await context.close();await browser.close()}
});

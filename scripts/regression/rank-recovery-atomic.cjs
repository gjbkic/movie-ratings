'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
for(const missing of [false,true])test('invalid late rank reference cannot partially change earlier scores; missing='+missing,async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 if(missing)seed.rankOrder['80']=seed.rankOrder['80'].filter(id=>id!=='fixture-0012');
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
for(const policy of ['balanced-v1',null,'future-v9'])test('rank recovery rejects reference policy '+String(policy),async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context,{seed});await context.route('**/recovery-ranks-20261010.json',r=>r.fulfill({json:{sourceCommit:'synthetic-only',scorePolicy:policy,rankOrder:seed.rankOrder,correctScores:[],clearScores:[],knownDamagedOrders:{}}}));
  const page=await context.newPage();await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  assert.equal(await page.evaluate(()=>!!window.__movie30RecoveryBlocked),true);
  assert.equal(await page.evaluate(()=>state.exactScores['fixture-0012']),seed.exactScores['fixture-0012']);
 }finally{await context.close();await browser.close()}
});
for(const [label,damage] of [
 ['late clearScores record',ref=>ref.clearScores=[{id:'fixture-0013',score:80},{id:'fixture-0014',score:Infinity}]],
 ['damaged-order entry',ref=>ref.knownDamagedOrders={'80':[['fixture-0013'],{}]}],
 ['duplicate rank ID',ref=>ref.rankOrder['81']=['fixture-0012','fixture-0012']],
 ['out-of-range score',ref=>ref.correctScores.push({id:'fixture-0013',from:80,to:101})]
])test('rank recovery rejects entire malformed reference: '+label,async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 const ref={sourceCommit:'synthetic-only',correctScores:[{id:'fixture-0012',from:80,to:81}],rankOrder:{...seed.rankOrder,'81':['fixture-0012',...seed.rankOrder['81']]},clearScores:[],knownDamagedOrders:{}};
 damage(ref);
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context,{seed});await context.route('**/recovery-ranks-20261010.json',r=>r.fulfill({json:ref}));
  const page=await context.newPage();await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  const actual=await page.evaluate(()=>({score:state.exactScores['fixture-0012'],rank:state.rankOrder['80'],blocked:!!window.__movie30RecoveryBlocked}));
  assert.equal(actual.score,80);assert.deepEqual(actual.rank,seed.rankOrder['80']);assert.equal(actual.blocked,true);
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
test('rank recovery does not replace an edit made while reference fetch waits',async()=>{
 const seed=fixture().state;seed.rankRecovery={version:1};
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context,{seed});let release;
  await context.route('**/recovery-ranks-20261010.json',async r=>{await new Promise(resolve=>release=resolve);await r.fulfill({json:{sourceCommit:'synthetic-only',rankOrder:seed.rankOrder,correctScores:[],clearScores:[],knownDamagedOrders:{}}})});
  const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
  for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(typeof release,'function','fixture fetch did not start');
  await page.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='later unsaved review'});release();
  await page.evaluate(()=>window.__movie30StorageReady);
  assert.equal(await page.evaluate(()=>!!window.__movie30RecoveryBlocked),true);
  assert.equal(await page.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'later unsaved review');
 }finally{await context.close();await browser.close()}
});

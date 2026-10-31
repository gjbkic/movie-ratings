'use strict';
// Balanced data is intentionally not activated in the normal app. The separate
// score-preview page tests conversion without writing application storage.
const {chromium,options,isolate,fixture,origin,ready,assert}=require('./harness.cjs');
const policy=require('../../app-score-policy.js');
(async()=>{
 const browser=await chromium.launch(options);
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const seed=policy.plan(fixture().state,[]).target;
  assert.equal(seed.scorePolicy,policy.CURRENT);
  await isolate(context,{seed});await context.addInitScript(()=>{window.__movie30BalancedScorePreview=true});
  const page=await context.newPage();await page.goto(origin);
  await page.evaluate(()=>window.__movie30StorageReady);
  const result=await page.evaluate(()=>({
   blocked:!!window.__movie30RecoveryBlocked,
   ready:document.documentElement.classList.contains('movie30-ready'),
   saveStatus:document.getElementById('saveState').textContent,
   raw:localStorage.getItem('movie30_data_v1'),
   hasPendingSave:!!window.__movie30PendingSave
  }));
  assert.equal(result.blocked,true);
  assert.equal(result.ready,false);
  assert.match(result.saveStatus,/現行の保存形式を確認できません/);
  assert.equal(result.raw,JSON.stringify(seed),'refused preview must not alter the saved candidate');
  assert.equal(result.hasPendingSave,false,'refused preview must not queue a write');
  await context.close();

  const legacy=await browser.newContext();await isolate(legacy);
  const oldPage=await legacy.newPage();await oldPage.goto(origin);await ready(oldPage);
  const oldBefore=await oldPage.evaluate(()=>({state:JSON.stringify(state),disk:localStorage.getItem('movie30_data_v1')}));
  oldPage.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());
  for(const incoming of [seed,{...seed,scorePolicy:'future'},{...seed,scorePolicy:null}]){
   assert.equal(await oldPage.evaluate(s=>restorePackage({state:s}),incoming),false);
   assert.deepEqual(await oldPage.evaluate(()=>({state:JSON.stringify(state),disk:localStorage.getItem('movie30_data_v1')})),oldBefore);
  }
  await legacy.close();
  console.log('SCORE_PREVIEW_GUARD_PASS: balanced startup remains inactive; legacy startup and import rejection remain intact');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

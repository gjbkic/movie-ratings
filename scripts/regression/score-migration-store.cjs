'use strict';
const {chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
const fs=require('fs'),path=require('path'),policy=require('../../app-score-policy.js');
(async()=>{
 const browser=await chromium.launch(options);
 try{
  const context=await browser.newContext();await isolate(context);
  const page=await context.newPage();await page.goto(origin+'/seed');
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../../app-score-migration-store.js'),'utf8')});
  const s=fixture().state,p=policy.plan(s,[]),input={sourceJson:p.sourceJson,targetJson:JSON.stringify(p.target)};
  const result=await page.evaluate(async input=>{
   const api=window.Movie30ScoreMigrationStore,old=localStorage.getItem('movie30_data_v1');
   const empty=await api.read();
   // Real IDB transaction abort after the backup write has been queued.
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(v){if(this.transaction.db.name===api.DB_NAME&&v.id==='current'){this.transaction.abort();throw new DOMException('synthetic quota','QuotaExceededError')}return original.apply(this,arguments)};
   const failed=await api.commit(input);IDBObjectStore.prototype.put=original;
   const afterFailed=await api.read();
   const first=await api.commit(input),reopened=await api.read(),retry=await api.commit(input);
   const other={...input,targetJson:JSON.stringify({...JSON.parse(input.targetJson),fixtureLater:true})};
   const conflict=await api.commit(other),afterConflict=await api.read();
   const invalid=await api.commit({...input,targetJson:'{}'});
   return {empty,failed,afterFailed,first,reopened,retry,conflict,afterConflict,invalid,legacyUnchanged:old===localStorage.getItem('movie30_data_v1')};
  },input);
  assert.equal(result.empty.status,'empty');assert.equal(result.failed.status,'failed');assert.equal(result.afterFailed.status,'empty');
  assert.equal(result.first.status,'committed');assert.equal(result.reopened.status,'ready');
  assert.equal(result.reopened.sourceJson,input.sourceJson);assert.equal(result.reopened.targetJson,input.targetJson);
  assert.equal(result.retry.status,'already-committed');assert.equal(result.conflict.status,'conflict');assert.deepEqual(result.afterConflict,result.reopened);
  assert.equal(result.invalid.status,'invalid');assert(result.legacyUnchanged);
  await page.reload();await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../../app-score-migration-store.js'),'utf8')});
  assert.deepEqual(await page.evaluate(()=>Movie30ScoreMigrationStore.read()),result.reopened);
  console.log('SCORE_MIGRATION_STORE_PASS: atomic rollback, readback, retry, conflict, invalid input, legacy protection, reload');
  const raceContext=await browser.newContext();await isolate(raceContext);
  const tabs=await Promise.all([raceContext.newPage(),raceContext.newPage()]);
  for(const tab of tabs){await tab.goto(origin+'/seed');await tab.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../../app-score-migration-store.js'),'utf8')})}
  const other={...input,targetJson:JSON.stringify({...p.target,fixtureRace:true})};
  const race=await Promise.all(tabs.map((tab,i)=>tab.evaluate(input=>Movie30ScoreMigrationStore.commit(input),i?other:input)));
  assert.deepEqual(race.map(x=>x.status).sort(),['committed','conflict']);
  const winner=race[0].status==='committed'?input:other;
  const durable=await tabs[1].evaluate(()=>Movie30ScoreMigrationStore.read());assert.equal(durable.targetJson,winner.targetJson);assert.equal(durable.sourceJson,input.sourceJson);
  // A partial/damaged checkpoint must be protected, never silently replaced.
  await tabs[0].evaluate(async()=>{const req=indexedDB.open(Movie30ScoreMigrationStore.DB_NAME,1);await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve();req.onerror=reject});const db=req.result;await new Promise(resolve=>{const tx=db.transaction('migration','readwrite');tx.objectStore('migration').delete('before-conversion');tx.oncomplete=resolve});db.close()});
  assert.equal((await tabs[0].evaluate(()=>Movie30ScoreMigrationStore.read())).status,'damaged');
  assert.equal((await tabs[0].evaluate(input=>Movie30ScoreMigrationStore.commit(input),input)).status,'conflict');
  assert.equal((await tabs[0].evaluate(()=>Movie30ScoreMigrationStore.read())).status,'damaged');
  console.log('SCORE_MIGRATION_STORE_RACE_PASS: two actual tabs, one winner; damaged checkpoint protected');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

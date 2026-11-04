'use strict';
const {test,after}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');let browser;
const {remoteFrom,reply}=require('./cloud-fixture.cjs');
after(async()=>browser?.close());
const fpKey='movie30_github_synced_fingerprint_v1',metaKey='movie30_lb_meta_fp_v63';
test('balanced local policy is stopped before GitHub GET',async()=>{
 const {context,page,puts}=await setup();try{
  let gets=0;await page.route('https://api.github.com/**',r=>{gets++;return r.fulfill({json:{}})});
  await page.evaluate(()=>{state.scorePolicy='balanced-v1'});
  await page.evaluate(()=>document.getElementById('gptSyncNow').onclick());
  assert.equal(gets,0);assert.equal(puts.length,0);
 }finally{await context.close()}
});
test('balanced remote policy is protected without PUT',async()=>{
 const {context,page,puts,remote}=await setup();try{
  remote.state.scorePolicy='balanced-v1';
  let requests=0;await page.route('https://api.github.com/**',r=>{requests++;return r.fulfill({json:reply(remote)})});
  await page.evaluate(()=>document.getElementById('gptSyncNow').onclick());
  assert.equal(requests,1);assert.equal(puts.length,0);
  assert.match(await page.locator('#gptSyncStatus').innerText(),/同期を停止/);
 }finally{await context.close()}
});
test('policy change while GitHub GET waits cancels PUT',async()=>{
 const {context,page,puts,remote}=await setup();try{
  let unlock,notify;const held=new Promise(r=>unlock=r),arrived=new Promise(r=>notify=r);
  let requests=0;await page.route('https://api.github.com/**',async r=>{requests++;notify();await held;return r.fulfill({json:reply(remote)})});
  const pending=page.evaluate(()=>document.getElementById('gptSyncNow').onclick());await arrived;
  await page.evaluate(()=>{state.scorePolicy='balanced-v1'});unlock();await pending;
  assert.equal(requests,1);assert.equal(puts.length,0);assert.match(await page.locator('#gptSyncStatus').innerText(),/同期を停止/);
 }finally{await context.close()}
});
async function setup(){browser??=await launch();const context=await browser.newContext();const page=await context.newPage();let fail=true,puts=[];
 let remote;
 await page.route('https://api.github.com/**',async r=>{if(r.request().method()==='PUT'){const sent=JSON.parse(Buffer.from(r.request().postDataJSON().content,'base64').toString('utf8'));puts.push(sent);if(!fail)remote=sent;return r.fulfill({status:fail?503:200,json:{content:{sha:'fixture-sha'}}})}return r.fulfill({json:reply(remote)})});
 await page.goto(origin);await ready(page);await page.evaluate(({fpKey,metaKey})=>{
 function fp(value){const str=JSON.stringify(value);let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)+':'+str.length}
 const data={};for(const key of ['exactScores','rankOrder','customFilms','starOverrides','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides'])data[key]=state[key]||{};
 localStorage.setItem(fpKey,fp(data));localStorage.setItem(metaKey,fp(state.letterboxdMeta||{}));
 localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token');const b=document.getElementById('gptSyncAuto');b.checked=true;b.onchange()},{fpKey,metaKey});
 remote=await remoteFrom(page);
 return {context,page,puts,remote,succeed:()=>{fail=false}};
}
test('failed GitHub PUT cannot acknowledge data; unchanged save retries successfully',async()=>{
 const {context,page,puts,succeed}=await setup();try{
  const before=await page.evaluate(k=>localStorage.getItem(k),fpKey);
  await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'Synthetic retry title'};return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000}).catch(async error=>{throw Error(error.message+' status='+await page.locator('#gptSyncStatus').innerText()+' puts='+puts.length)});
  await page.waitForTimeout(1200);assert(puts.length>0);assert.equal(await page.evaluate(k=>localStorage.getItem(k),fpKey),before);
  succeed();const first=puts.length;await page.evaluate(()=>save());await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期しました'),{},{timeout:12000});
  assert(puts.length>first);assert.notEqual(await page.evaluate(k=>localStorage.getItem(k),fpKey),before);
  assert.equal(puts.at(-1).state.titleOverrides['fixture-0012'].title,'Synthetic retry title');
  const count=puts.length;await page.evaluate(()=>save());await page.waitForTimeout(4200);assert.equal(puts.length,count);
 }finally{await context.close()}
});
test('failed review-only sync leaves metadata pending for retry',async()=>{
 const {context,page,puts,succeed}=await setup();try{
  const key=metaKey;
  const before=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='Synthetic retry review';return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000});
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);
  succeed();const first=puts.length;await page.evaluate(()=>save());await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期しました'),{},{timeout:12000});assert(puts.length>first);
  assert.equal(puts.at(-1).state.letterboxdMeta['fixture-0012'].note,'Synthetic retry review');
 }finally{await context.close()}
});
test('an edit during PUT is not falsely acknowledged by the earlier request',async()=>{
 const {context,page,remote}=await setup();try{
  let unlock,notify;const held=new Promise(r=>unlock=r),arrived=new Promise(r=>notify=r);const payloads=[];
  await page.route('https://api.github.com/**',async r=>{
   if(r.request().method()!=='PUT')return r.fulfill({json:reply(remote)});
   payloads.push(JSON.parse(Buffer.from(r.request().postDataJSON().content,'base64').toString('utf8')));
   if(payloads.length===1){notify();await held}return r.fulfill({json:{content:{sha:'fixture-sha'}}});
  });
  await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'First sent edit'};return save()});
  const first=page.evaluate(()=>document.getElementById('gptSyncNow').onclick());await arrived;
  await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'Later local edit'};state.letterboxdMeta['fixture-0012'].note='Later local review';return save()});
  unlock();await first;
  const fp=await page.evaluate(k=>({stored:localStorage.getItem(k),current:window.__movie30GithubDataFingerprintV29(state),last:JSON.parse(localStorage.getItem('movie30_github_sync_last_v1'))}),fpKey);
  assert.notEqual(fp.stored,fp.current);assert.equal(fp.last.sourceUpdatedAt,payloads[0].sourceUpdatedAt);
  assert.equal(payloads[0].state.titleOverrides['fixture-0012'].title,'First sent edit');
  await page.evaluate(()=>document.getElementById('gptSyncNow').onclick());
  assert.equal(payloads.at(-1).state.titleOverrides['fixture-0012'].title,'Later local edit');assert.equal(payloads.at(-1).state.letterboxdMeta['fixture-0012'].note,'Later local review');
 }finally{await context.close()}
});
test('authorization failure, conflict, and stopped local saves do not advance acknowledgement',async()=>{
 for(const status of [401,409]){
  const {context,page,remote}=await setup();try{
   await page.route('https://api.github.com/**',r=>r.request().method()==='PUT'?r.fulfill({status,json:{message:'fixture refusal'}}):r.fulfill({json:reply(remote)}));
   await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'Unsent edit'};return save()});
   const before=await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[fpKey,metaKey]);
   await page.evaluate(()=>document.getElementById('gptSyncNow').onclick());
   assert.deepEqual(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[fpKey,metaKey]),before);
  }finally{await context.close()}
 }
 const {context,page,puts}=await setup();try{
  await page.evaluate(()=>{window.__movie30TabConflict=true});await page.evaluate(()=>document.getElementById('gptSyncNow').onclick());assert.equal(puts.length,0);
 }finally{await context.close()}
});
test('local edits or a conflict arriving during GET stop the obsolete PUT',async()=>{
 for(const change of ['edit','conflict']){
  const {context,page,remote}=await setup();try{
   let unlock,notify;const held=new Promise(r=>unlock=r),arrived=new Promise(r=>notify=r);let puts=0;
   await page.route('https://api.github.com/**',async r=>{if(r.request().method()==='PUT'){puts++;return r.fulfill({json:{}})}notify();await held;return r.fulfill({json:reply(remote)})});
   await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'Before GET'};return save()});
   const before=await page.evaluate(k=>localStorage.getItem(k),fpKey),pending=page.evaluate(()=>document.getElementById('gptSyncNow').onclick());await arrived;
   await page.evaluate(async change=>{if(change==='edit'){state.titleOverrides['fixture-0012']={title:'After GET began'};await save()}else window.__movie30TabConflict=true},change);
   unlock();await pending;assert.equal(puts,0);assert.equal(await page.evaluate(k=>localStorage.getItem(k),fpKey),before);
  }finally{await context.close()}
 }
});

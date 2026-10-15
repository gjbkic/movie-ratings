'use strict';
const {test,after}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');let browser;
after(async()=>browser?.close());
const fpKey='movie30_github_synced_fingerprint_v1',metaKey='movie30_lb_meta_fp_v63';
async function setup(){browser??=await launch();const context=await browser.newContext();const page=await context.newPage();let fail=true,puts=[];
 await page.route('https://api.github.com/**',async r=>{if(r.request().method()==='PUT'){puts.push(JSON.parse(Buffer.from(r.request().postDataJSON().content,'base64').toString('utf8')));return r.fulfill({status:fail?503:200,json:{content:{sha:'fixture-sha'}}})}return r.fulfill({json:{sha:'fixture-sha'}})});
 await page.goto(origin);await ready(page);await page.evaluate(({fpKey,metaKey})=>{
 function fp(value){const str=JSON.stringify(value);let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)+':'+str.length}
 const data={};for(const key of ['exactScores','rankOrder','customFilms','starOverrides','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides'])data[key]=state[key]||{};
 localStorage.setItem(fpKey,fp(data));localStorage.setItem(metaKey,fp(state.letterboxdMeta||{}));
 localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token');const b=document.getElementById('gptSyncAuto');b.checked=true;b.onchange()},{fpKey,metaKey});
 return {context,page,puts,succeed:()=>{fail=false}};
}
test('failed GitHub PUT cannot acknowledge data; unchanged save retries successfully',async()=>{
 const {context,page,puts,succeed}=await setup();try{
  const before=await page.evaluate(k=>localStorage.getItem(k),fpKey);
  await page.evaluate(()=>{state.titleOverrides['fixture-0012']={title:'Synthetic retry title'};return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000});
  assert(puts.length>0);assert.equal(await page.evaluate(k=>localStorage.getItem(k),fpKey),before);
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

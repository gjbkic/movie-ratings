'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
async function records(page){return page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('movie30_state_db',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const rows=await new Promise(resolve=>{const tx=db.transaction('snapshots','readonly'),s=tx.objectStore('snapshots'),out={};for(const id of ['current','previous']){const r=s.get(id);r.onsuccess=()=>out[id]=r.result?.json||null}tx.oncomplete=()=>resolve(out)});db.close();return {local:localStorage.getItem('movie30_data_v1'),...rows};
});}
for(const kind of ['idb-new-current','ls-new-current','ls-null-current','ls-unknown-current','ls-preview-current','idb-legacy'])test('protect startup current: '+kind,async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  const requests=await isolate(context);const page=await context.newPage();await page.goto(origin+'/seed');
  const legacy=fixture().state,newer=structuredClone(legacy);newer.updatedAt+=1000000;newer.scorePolicy=kind==='ls-null-current'?null:kind==='ls-unknown-current'?'future-v9':'balanced-v1';
  const raw=kind==='ls-preview-current'?{type:'fictional-score-preview-only',state:newer}:newer;
  await page.evaluate(async({kind,legacy,raw})=>{
   localStorage.removeItem('movie30_data_v1');
   if(kind.startsWith('ls-')){localStorage.setItem('movie30_data_v1',JSON.stringify(raw));localStorage.setItem('movie30_data_backup_1',JSON.stringify(legacy));return}
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('movie30_state_db',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
   await new Promise(resolve=>{const tx=db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots');s.put({id:'current',json:JSON.stringify(kind==='idb-new-current'?raw:legacy),updatedAt:kind==='idb-new-current'?raw.updatedAt:legacy.updatedAt});if(kind==='idb-new-current')s.put({id:'previous',json:JSON.stringify(legacy),updatedAt:legacy.updatedAt});tx.oncomplete=resolve});db.close();
  },{kind,legacy,raw});
  const before=await records(page);await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  let result;
  if(kind==='idb-legacy'){
   await page.waitForSelector('html.movie30-ready',{timeout:30000});
   await page.evaluate(()=>openSheet('fixture-0012'));
   await page.locator('#editScore').fill('92');await page.locator('#editScore').blur();
   result=await page.evaluate(async()=>({ok:await window.__movie30PendingSave,blocked:!!window.__movie30RecoveryBlocked,score:state.exactScores['fixture-0012']}));
   assert.equal(result.score,92,'UI score edit missing from runtime');
  }else{
   result=await page.evaluate(async()=>{state.genreOverrides['fixture-0012']=['new-genre'];save(false);return {ok:await window.__movie30PendingSave,blocked:!!window.__movie30RecoveryBlocked,status:document.getElementById('saveState')?.textContent||''}});
   assert.match(result.status,/保存停止|保存できません/,'rejected startup did not show save stop');
   await page.locator('#movie30-startup-mask').getByText('保存データの復元を停止しました').waitFor();
   assert.equal(await page.locator('html.movie30-ready').count(),0,'rejected state became editable');
  }
  const after=await records(page);
  assert.equal(result.blocked,kind!=='idb-legacy');
  if(kind==='idb-legacy'){
   assert.equal(JSON.parse(after.current).exactScores['fixture-0012'],92,'UI score missing from IndexedDB current');
   assert.equal(JSON.parse(after.local).exactScores['fixture-0012'],92,'UI score missing from localStorage current');
  }else{assert.equal(after.current,before.current);assert.equal(after.local,before.local)}
  if(kind!=='idb-legacy'){assert.notEqual(result.ok,true);assert.equal(after.previous,before.previous)}
  else assert.equal(result.ok,true);
  await page.reload();await page.evaluate(()=>window.__movie30StorageReady);
  const reopened=await records(page);
  if(kind!=='idb-legacy'){assert.equal(await page.evaluate(()=>!!window.__movie30RecoveryBlocked),true);assert.equal(reopened.current,before.current);assert.equal(reopened.local,before.local)}
  else{
   assert.equal(await page.evaluate(()=>!!window.__movie30RecoveryBlocked),false);
   assert.equal(await page.evaluate(()=>state.exactScores['fixture-0012']),92,'UI score missing after restart');
   assert.equal(JSON.parse(reopened.current).exactScores['fixture-0012'],92,'IndexedDB score missing after restart');
   assert.equal(JSON.parse(reopened.local).exactScores['fixture-0012'],92,'localStorage score missing after restart');
  }
  assert.equal(requests.some(r=>r.path==='/live-state.json'),false);
 }finally{await context.close();await browser.close()}
});

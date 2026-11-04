'use strict';
const {test}=require('node:test');
const {launch,origin,ready,assert,snapshot}=require('./harness.cjs');
test('quota-full localStorage plus closed IDB connection recovers without losing latest edits',async()=>{
 const browser=await launch();try{const p=await browser.newPage();await p.goto(origin);await ready(p);
 const before=await snapshot(p);
 const ok=await p.evaluate(async()=>{(await openMovie30Db()).close();const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===STORAGE_KEY)throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v)};state.letterboxdMeta['fixture-0012'].note='latest unsaved sentinel';return await save()});
 assert.equal(ok,true);await p.reload();await ready(p);assert.equal(await p.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'latest unsaved sentinel');assert.deepEqual((await snapshot(p)).rankOrder,before.rankOrder);
 const recovered=await p.evaluate(async()=>{movie30InvalidateDb(await openMovie30Db());const open=indexedDB.open;indexedDB.open=()=>{throw new DOMException('Temporary failure','UnknownError')};const failed=await openMovie30Db();indexedDB.open=open;state.letterboxdMeta['fixture-0012'].note='after open failure';return failed===null&&await save()});assert.equal(recovered,true);await p.reload();await ready(p);assert.equal(await p.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'after open failure');
 }finally{await browser.close()}
});
test('warning provides reason and retry saves current edit without a restore',async()=>{
 const browser=await launch();try{const p=await browser.newPage();await p.goto(origin);await ready(p);
 await p.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='retry button edit';setSaveStatus('保存失敗 test');movie30StorageWarning(true,false)});
 assert.match(await p.locator('#movie30-save-failure-detail').textContent(),/保存失敗 test/);await p.locator('#movie30-save-retry').click();await p.evaluate(()=>window.__movie30PendingSave);assert.equal(await p.locator('#movie30-storage-warning').isVisible(),false);await p.reload();await ready(p);assert.equal(await p.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'retry button edit');
 }finally{await browser.close()}
});
test('unreadable existing IDB cannot be overwritten by a later reconnect',async()=>{
 const browser=await launch();try{const p=await browser.newPage();await p.goto(origin);await ready(p);
 const result=await p.evaluate(async()=>{const prior=await movie30ReadSnapshot();movie30InvalidateDb(await openMovie30Db());const open=indexedDB.open;indexedDB.open=()=>{throw new DOMException('Temporary failure','UnknownError')};await movie30ReadSnapshot();indexedDB.open=open;const next=JSON.stringify({...state,updatedAt:Date.now()+100000});const saved=await movie30WriteSnapshot(next,Date.now());const current=await movie30ReadSnapshot();return {saved,same:prior.json===current.json}});assert.deepEqual(result,{saved:false,same:true});
 }finally{await browser.close()}
});

test('unreadable disk comparison preserves both stores and retry cannot clear protection',async()=>{
 const browser=await launch();try{const p=await browser.newPage();await p.goto(origin);await ready(p);
 const result=await p.evaluate(async()=>{
  const prior=await movie30ReadDisk();const tx=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readonly')throw new DOMException('Unreadable','UnknownError');return tx.apply(this,args)};
  state.letterboxdMeta['fixture-0012'].note='unsaved after read failure';const saved=await save();
  IDBDatabase.prototype.transaction=tx;return {saved,prior,blocked:!!window.__movie30DbReadUncertain};
 });
 assert.equal(result.saved,false);assert.equal(result.blocked,true);
 await p.locator('#movie30-save-retry').click();await p.evaluate(()=>window.__movie30PendingSave);
 assert.equal(await p.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'unsaved after read failure');
 assert.equal(await p.evaluate(()=>localStorage.getItem(STORAGE_KEY)),result.prior.local);
 assert.equal(await p.evaluate(async()=>(await movie30ReadSnapshot()).json),result.prior.db);
 assert.equal(await p.evaluate(()=>!!window.__movie30TabConflict),true);
 }finally{await browser.close()}
});

test('reconnected IDB-only commit includes receipt and reaches clean peer',async()=>{
 const browser=await launch();try{const ctx=await browser.newContext();const a=await ctx.newPage();await a.goto(origin);await ready(a);const b=await ctx.newPage();await b.goto(origin);await ready(b);
 assert.equal(await a.evaluate(async()=>{(await openMovie30Db()).close();Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};state.letterboxdMeta['fixture-0012'].note='reconnected commit';return save()}),true);
 await b.waitForFunction(()=>state.letterboxdMeta['fixture-0012'].note==='reconnected commit');
 const committed=await a.evaluate(async()=>({snapshot:await movie30ReadSnapshot(),receipt:await movie30Record('multitab-commit')}));assert.equal(committed.snapshot.json,committed.receipt.json);
 await b.reload();await ready(b);assert.equal(await b.evaluate(()=>state.letterboxdMeta['fixture-0012'].note),'reconnected commit');
 }finally{await browser.close()}
});

test('closed handle reconnect still refuses stale writer after peer commit',async()=>{
 const browser=await launch();try{const ctx=await browser.newContext();const a=await ctx.newPage();await a.goto(origin);await ready(a);const b=await ctx.newPage();await b.goto(origin);await ready(b);
 await a.evaluate(async()=>{window.addEventListener('storage',e=>e.stopImmediatePropagation(),true);movie30Channel.close();(await openMovie30Db()).close();state.letterboxdMeta['fixture-0012'].note='uncommitted A'});
 assert.equal(await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='committed B';return save()}),true);
 assert.equal(await a.evaluate(()=>save()),false);
 assert.equal(await b.evaluate(async()=>JSON.parse((await movie30ReadSnapshot()).json).letterboxdMeta['fixture-0012'].note),'committed B');
 const entries=await a.evaluate(async()=>(await movie30Record('multitab-conflicts')).entries);
 for(const note of ['uncommitted A','committed B'])assert(entries.some(e=>JSON.parse(e.json).letterboxdMeta['fixture-0012'].note===note));
 }finally{await browser.close()}
});

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

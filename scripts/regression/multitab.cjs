'use strict';
const {test,after}=require('node:test');
const {isDeepStrictEqual}=require('node:util');
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
let browser;
after(async()=>browser?.close());
async function pair(){
 browser??=await launch();const context=await browser.newContext();
 const a=await context.newPage();await a.goto(origin);await ready(a);
 const b=await context.newPage();await b.goto(origin);await ready(b);
 await a.waitForTimeout(200);
 return {context,a,b};
}
function payload(s){const x=structuredClone(s);delete x.updatedAt;delete x.storageIntegrity;return x;}
test('MULTITAB: newer unsigned truncation must not replace a healthy tab',async()=>{
 const {context,a,b}=await pair();try{
  const before=await snapshot(a);
  await b.evaluate(()=>{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));delete x.storageIntegrity;x.updatedAt+=100000;x.customFilms=[];x.rankOrder={};x.letterboxdMeta={};localStorage.setItem(STORAGE_KEY,JSON.stringify(x))});
  await a.waitForTimeout(300);assert(isDeepStrictEqual(payload(await snapshot(a)),payload(before)),'Healthy payload was replaced by incomplete peer data');
 }finally{await context.close()}
});
test('MULTITAB: unsaved local review must survive a legitimate other-tab edit',async()=>{
 const {context,a,b}=await pair();try{
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='unsaved A review'});
  await b.evaluate(()=>{state.genreOverrides['fixture-0013']=['SF','ドラマ'];return save()});
  await a.waitForTimeout(300);
  assert.equal((await snapshot(a)).letterboxdMeta['fixture-0012'].note,'unsaved A review');
 }finally{await context.close()}
});
test('MULTITAB: complete clean-tab updates retain the whole payload including unknown fields',async()=>{
 const {context,a,b}=await pair();try{
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='saved B review';state.fixtureUnknown={nested:['remote',0,null]};return save()});
  await a.waitForFunction(()=>state.letterboxdMeta['fixture-0012'].note==='saved B review');
  assert(isDeepStrictEqual(payload(await snapshot(a)),payload(await snapshot(b))),'Complete peer payload differs');
 }finally{await context.close()}
});
test('MULTITAB: a stale tab save must not erase an already committed peer edit',async()=>{
 const {context,a,b}=await pair();try{
  // Pause only event dispatch, reproducing a suspended/background tab. Shared
  // localStorage and real saves are untouched; this is not a synthetic StorageEvent.
  await a.evaluate(()=>{window.addEventListener('storage',e=>e.stopImmediatePropagation(),true);movie30Channel.close()});
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='committed B review';return save()});
  await a.evaluate(()=>{state.genreOverrides['fixture-0013']=['SF','ドラマ'];return save()});
  const disk=await b.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)));
  assert.equal(disk.letterboxdMeta['fixture-0012'].note,'committed B review');
 }finally{await context.close()}
});

async function disk(page){return page.evaluate(async()=>({ls:localStorage.getItem(STORAGE_KEY),db:(await movie30ReadSnapshot())?.json}));}
async function conflict(page){await page.waitForFunction(()=>window.__movie30TabConflict);await page.waitForSelector('#movie30-tab-conflict');}
test('MULTITAB: competing saves are serialized; losing edit is archived and survives reopening',async()=>{
 const {context,a,b}=await pair();try{
  await a.evaluate(()=>{window.testHolding=navigator.locks.request('movie30-state-write',()=>new Promise(resolve=>{window.testRelease=resolve}));});
  await a.waitForFunction(()=>!!window.testRelease);
  await Promise.all([a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='simultaneous A';void save()}),b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='simultaneous B';void save()})]);
  await a.evaluate(()=>window.testRelease());
  const results=await Promise.all([a.evaluate(()=>window.__movie30PendingSave),b.evaluate(()=>window.__movie30PendingSave)]);
  assert.equal(results.filter(Boolean).length,1);
  const winner=results[0]?a:b,loser=results[0]?b:a;await conflict(loser);
  const committed=await disk(winner);assert.equal(committed.ls,committed.db);
  const archive=await loser.evaluate(()=>movie30Record('multitab-conflicts'));
  for(const note of ['simultaneous A','simultaneous B'])assert(archive.entries.some(e=>JSON.parse(e.json).letterboxdMeta['fixture-0012'].note===note));
  await loser.close();const reopened=await context.newPage();await reopened.goto(origin);await ready(reopened);
  await reopened.waitForSelector('#movie30-tab-conflict');assert.equal((await snapshot(reopened)).letterboxdMeta['fixture-0012'].note,JSON.parse(committed.db).letterboxdMeta['fixture-0012'].note);
 }finally{await context.close()}
});
test('MULTITAB: IDB-only peer save propagates and stale writer cannot overwrite it',async()=>{
 const {context,a,b}=await pair();try{
  await b.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};state.letterboxdMeta['fixture-0012'].note='IDB-only peer';return save()});
  await a.waitForFunction(()=>state.letterboxdMeta['fixture-0012'].note==='IDB-only peer');
  await a.evaluate(()=>{state.genreOverrides['fixture-0013']=['SF'];return save()});
  assert.equal(JSON.parse((await disk(a)).db).letterboxdMeta['fixture-0012'].note,'IDB-only peer');
 }finally{await context.close()}
});
test('MULTITAB: localStorage-only commit can propagate when IDB writes fail',async()=>{
 const {context,a,b}=await pair();try{
  await b.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite')throw new DOMException('quota','QuotaExceededError');return original.apply(this,args)};state.letterboxdMeta['fixture-0012'].note='LS-only peer';return save()});
  await a.waitForFunction(()=>state.letterboxdMeta['fixture-0012'].note==='LS-only peer',{},{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__movie30SaveFailed),false);
 }finally{await context.close()}
});
test('MULTITAB: conflict archive failure leaves both stores untouched and offers both JSON candidates',async()=>{
 const {context,a,b}=await pair();try{
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='uncommitted A';const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite')throw Error('archive unavailable');return original.apply(this,args)}});
  await b.evaluate(()=>{state.genreOverrides['fixture-0013']=['SF'];return save()});
  await conflict(a);const before=await disk(b);
  assert.equal(await a.evaluate(()=>save()),false);assert.deepEqual(await disk(b),before);
  assert.match(await a.locator('#movie30-tab-conflict').textContent(),/退避保存できません/);
  const [download]=await Promise.all([a.waitForEvent('download'),a.locator('#movie30-tab-conflict button').click()]);
  const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;
  const backup=JSON.parse(text);assert(backup.candidates.some(e=>JSON.parse(e.json).letterboxdMeta['fixture-0012'].note==='uncommitted A'));
  assert(backup.candidates.some(e=>JSON.parse(e.json).genreOverrides['fixture-0013']?.includes('SF')));
  // Unsaved edits must not retain an old checksum that makes their export unimportable.
  for(const entry of backup.candidates)assert.equal(await a.evaluate(json=>!!movie30Candidate(json,'export test'),entry.json),true);
 }finally{await context.close()}
});
test('MULTITAB: signed truncation is not proof of a legitimate edit',async()=>{
 const {context,a,b}=await pair();try{
  const before=await snapshot(a);
  await b.evaluate(()=>{state.customFilms=[];state.rankOrder={};state.letterboxdMeta={};state.updatedAt++;movie30SealState();localStorage.setItem(STORAGE_KEY,JSON.stringify(state))});
  await conflict(a);assert(isDeepStrictEqual(payload(await snapshot(a)),payload(before)));
 }finally{await context.close()}
});
test('MULTITAB: legitimate score clearing and deletion propagate with null, zero, stars and unknown fields intact',async()=>{
 const {context,a,b}=await pair();try{
  await b.evaluate(()=>{state.exactScores['fixture-0002']=null;state.rankOrder['0']=[];state.customFilms=state.customFilms.filter(f=>f.id!=='fixture-0000');state.fixtureUnknown={zero:0,empty:null};return save()});
  await a.waitForFunction(()=>state.exactScores['fixture-0002']===null);
  assert(isDeepStrictEqual(payload(await snapshot(a)),payload(await snapshot(b))));
  await a.reload();await ready(a);assert(isDeepStrictEqual(payload(await snapshot(a)),payload(await snapshot(b))));
 }finally{await context.close()}
});
test('MULTITAB: missing Web Locks reads existing data but refuses unsafe saves',async()=>{
 const {context,a,b}=await pair();try{
  const before=await snapshot(a),stored=await disk(a);
  await context.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  await a.reload();await ready(a);
  assert(isDeepStrictEqual(payload(await snapshot(a)),payload(before)));
  assert.equal(await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='unsupported edit';return save()}),false);
  assert.deepEqual(await disk(b),stored);assert.equal(await a.evaluate(()=>window.__movie30SaveFailed),true);
 }finally{await context.close()}
});

test('P1: edits after a stop are archived before reopening',async()=>{
 const {context,a,b}=await pair();try{
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='first local'});
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='peer';return save()});await conflict(a);
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='after stop';return save()});
  const archive=await a.evaluate(()=>movie30Record('multitab-conflicts'));
  assert(archive.entries.some(e=>JSON.parse(e.json).letterboxdMeta['fixture-0012'].note==='after stop'));
 }finally{await context.close()}
});
test('P1: explicit field choices restore both edits and survive reopening',async()=>{
 const {context,a,b}=await pair();try{
  await a.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='local review';state.fixtureUnknown.local='keep'});
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='peer review';state.genreOverrides['fixture-0013']=['SF'];return save()});await conflict(a);
  assert.equal(await a.evaluate(()=>typeof movie30RecoveryPlan),'function');
  await a.evaluate(async()=>{window.testPlan=await movie30RecoveryPlan();});
  assert.equal(await a.evaluate(()=>movie30ResolveConflict(testPlan,{})),false);
  const ok=await a.evaluate(()=>{const choices={};for(const d of testPlan.diffs)choices[d.key]=d.path.includes('genreOverrides')?'right':'left';return movie30ResolveConflict(testPlan,choices)});assert.equal(ok,true);
  assert.equal((await snapshot(a)).letterboxdMeta['fixture-0012'].note,'local review');assert.deepEqual((await snapshot(a)).genreOverrides['fixture-0013'],['SF']);
  await a.reload();await ready(a);assert.equal((await snapshot(a)).letterboxdMeta['fixture-0012'].note,'local review');assert.deepEqual((await snapshot(a)).genreOverrides['fixture-0013'],['SF']);
  assert.equal(await a.evaluate(()=>window.__movie30TabConflict),false);
 }finally{await context.close()}
});

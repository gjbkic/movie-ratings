'use strict';
const {launch,chromium,options,isolate,fixture,origin,ready,snapshot,saved,reload,assert}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');
const {test,after}=require('node:test');
let browser;
async function app(){browser??=await launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto(origin);await ready(page);return {context,page};}
after(async()=>browser?.close());
// Exclude only documented volatile fields, not arbitrary unknown fields or metadata.
function content(s){const c=structuredClone(s);delete c.updatedAt;delete c.storageIntegrity;return c;}
function protectedFields(s){return {exactScores:s.exactScores,rankOrder:s.rankOrder,starOverrides:s.starOverrides};}
test('740 fictional films: score presence, null, zero, stars, metadata and unknown fields round-trip',async()=>{
 const {context,page}=await app();try{
  const values=await page.evaluate(()=>['fixture-0000','fixture-0001','fixture-0002','fixture-0003','fixture-0004','fixture-0006'].map(id=>({has:Object.hasOwn(state.exactScores,id),score:effectiveScore(filmById(id)),star:filmStar(filmById(id))})));
  assert.equal(values[0].has,false);assert.equal(values[0].score,null);assert.equal(values[1].has,true);assert.equal(values[1].score,null);assert.equal(values[2].score,0);assert.equal(values[3].score,null);assert.equal(values[4].has,false);assert.equal(values[4].score,74);assert.equal(values[5].star,4);assert.equal(values[5].score,null);
  const before=await snapshot(page);assert.equal(before.customFilms.filter(f=>f.id.startsWith('fixture-')).length,740);
  await page.evaluate(()=>save());assert.equal((await saved(page)).failed,false);await reload(page);
  assert.deepEqual(content(await snapshot(page)),content(before));
 }finally{await context.close()}
});
test('visible-slot reorder preserves every hidden position and survives reopening',async()=>{
 const {context,page}=await app();try{
  const before=await snapshot(page),ids=before.rankOrder['88'],shown=[ids[0],ids[2],ids[4]];
  await page.evaluate(shown=>{movie30StoreVisibleOrder(88,[...shown].reverse());return save()},shown);
  const after=await snapshot(page);assert.notDeepEqual(after.rankOrder['88'],ids);
  ids.forEach((id,i)=>{if(!shown.includes(id))assert.equal(after.rankOrder['88'][i],id)});
  assert.deepEqual(after.exactScores,before.exactScores);await page.close();const reopened=await context.newPage();await reopened.goto(origin);await ready(reopened);
  assert.deepEqual((await snapshot(reopened)).rankOrder,after.rankOrder);
 }finally{await context.close()}
});
test('real localStorage quota exhaustion falls back to IDB; no false success when both stores fail',async()=>{
 const {context,page}=await app();try{
  await page.evaluate(()=>{let n=0;try{while(true)localStorage.setItem('test-quota-'+n++,'x'.repeat(1024))}catch{}try{while(true)localStorage.setItem('tiny-'+n++,'x')}catch{}state.letterboxdMeta['fixture-0012'].note='large synthetic note '.repeat(100000);return save()});
  const status=await saved(page);assert.equal(status.failed,false);assert.match(status.status,/IndexedDB/);
  const committed=await snapshot(page);await reload(page);assert.deepEqual(content(await snapshot(page)),content(committed));
  const raw=await page.evaluate(async()=>({ls:localStorage.getItem(STORAGE_KEY),db:(await movie30ReadSnapshot()).json}));
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('test quota','QuotaExceededError')};const tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite')throw new DOMException('test quota','QuotaExceededError');return tx.apply(this,args)};state.letterboxdMeta['fixture-0012'].note='uncommitted synthetic edit';return save()});
  assert.equal((await saved(page)).failed,true);assert.match((await saved(page)).status,/保存失敗/);assert.equal(await page.locator('#movie30-storage-warning').isVisible(),true);
  const unchanged=await page.evaluate(async()=>({ls:localStorage.getItem(STORAGE_KEY),db:(await movie30ReadSnapshot()).json}));assert.deepEqual(unchanged,raw);
  await reload(page);assert.deepEqual(content(await snapshot(page)),content(committed));
 }finally{await context.close()}
});
test('checksum damage and unsigned newer truncation cannot replace the committed startup snapshot',async()=>{
 for(const mode of ['checksum','truncation']){
  const {context,page}=await app();try{
   const before=await snapshot(page),idbBefore=await page.evaluate(async()=>await movie30ReadSnapshot().then(x=>x?.json));
   await page.evaluate(mode=>{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));s.updatedAt+=100000;s.rankOrder={};if(mode==='truncation'){delete s.storageIntegrity;s.customFilms=[];s.letterboxdMeta={}}localStorage.setItem(STORAGE_KEY,JSON.stringify(s))},mode);
   const damaged=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
   await page.reload();await page.evaluate(()=>window.__movie30StorageReady);
   await page.waitForFunction(()=>window.__movie30RecoveryBlocked||document.documentElement.classList.contains('movie30-ready'));
   if(await page.evaluate(()=>!!window.__movie30RecoveryBlocked)){
    await page.locator('#movie30-startup-mask').getByText('保存データの復元を停止しました').waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),damaged,mode+' rejected LS current changed');
    assert.equal(await page.evaluate(async()=>await movie30ReadSnapshot().then(x=>x?.json)),idbBefore,mode+' committed IDB current changed');
   }else{
    assert.deepEqual(content(await snapshot(page)),content(before),mode+' restored content changed');
   }
  }finally{await context.close()}
 }
});
test('destructive partial rank save is rejected and committed order survives restart',async()=>{
 const {context,page}=await app();try{
  const before=await snapshot(page);
  assert.equal(await page.evaluate(()=>{state.rankOrder['88'].pop();return save()}),false);
  assert.match((await saved(page)).status,/保存停止/);await reload(page);assert.deepEqual((await snapshot(page)).rankOrder,before.rankOrder);
 }finally{await context.close()}
});
test('JSON serialization/import preserves additions, reviews, watch events, season scores and unknown fields',async()=>{
 const {context,page}=await app();try{
  const json=await page.evaluate(()=>backupString()),backup=JSON.parse(json),before=await snapshot(page);
  assert.deepEqual(content(backup.state),content(before));
  const id=await page.evaluate(async()=>{const f=addFilm('Synthetic later addition',2026,'追加映画',0,'',{keepUnscored:true});state.letterboxdMeta[f.id]={note:'later review',watchHistory:[{id:'later-watch',date:'2026-02-03',source:'manual'}],unknown:{retain:true}};await save();return f.id});
  page.on('dialog',d=>d.accept());assert.equal(await page.evaluate(pkg=>restorePackage(pkg),backup),true);await reload(page);
  const after=await snapshot(page);assert(after.customFilms.some(f=>f.id===id));assert.equal(after.letterboxdMeta[id].note,'later review');assert.equal(after.letterboxdMeta[id].watchHistory[0].id,'later-watch');assert.deepEqual(after.letterboxdMeta[id].unknown,{retain:true});
  assert.deepEqual(after.rankOrder,before.rankOrder);assert.deepEqual(after.fixtureUnknown,before.fixtureUnknown);
  assert.deepEqual(after.letterboxdMeta['fixture-0010'].seasonScoresV1,{1:91,2:0});assert.equal(after.exactScores['fixture-0010'],null);
  const durable=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));assert.equal(await page.evaluate(()=>restorePackage({state:{rankOrder:{}}})),false);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),durable);
 }finally{await context.close()}
});
test('manual restore rejects preview and unknown policy before confirmation or any write',async()=>{
 const {context,page}=await app();try{
  const before=await snapshot(page),backup=JSON.parse(await page.evaluate(()=>backupString()));
  const storage=await page.evaluate(async()=>({ls:localStorage.getItem(STORAGE_KEY),db:await movie30ReadSnapshot()}));
  let confirms=0;page.on('dialog',d=>{if(d.type()==='confirm')confirms++;d.dismiss()});
  for(const pkg of [{type:'fictional-score-preview-only',state:backup.state},{...backup,state:{...backup.state,scorePolicy:null}}]){
   assert.equal(await page.evaluate(x=>restorePackage(x),pkg),false);
   assert.deepEqual(await snapshot(page),before);
   assert.deepEqual(await page.evaluate(async()=>({ls:localStorage.getItem(STORAGE_KEY),db:await movie30ReadSnapshot()})),storage);
  }
  assert.equal(confirms,0);
 }finally{await context.close()}
});
test('series season UI changes persist without rating the whole series',async()=>{
 const {context,page}=await app();try{
  const before=await snapshot(page);await page.evaluate(()=>openSheet('fixture-0010'));
  const fields=page.locator('#movie30SeasonRows input');assert.equal(await fields.count(),2);
  await fields.first().fill('87');await fields.first().blur();await page.evaluate(()=>window.__movie30PendingSave);
  await reload(page);const after=await snapshot(page);
  assert.equal(after.letterboxdMeta['fixture-0010'].seasonScoresV1['1'],87);assert.equal(after.letterboxdMeta['fixture-0010'].seasonScoresV1['2'],0);assert.deepEqual(protectedFields(after),protectedFields(before));
 }finally{await context.close()}
});
test('addition, title/runtime/classification edits and explicit deletion preserve existing ratings',async()=>{
 const {context,page}=await app();try{
  const before=await snapshot(page);
  const id=await page.evaluate(async()=>{const f=addFilm('Synthetic CRUD',2026,'追加映画',0,'',{keepUnscored:true});await save();openSheet(f.id);return f.id});
  await page.locator('#editTitle').fill('Synthetic edited title');await page.locator('#editTitle').blur();
  await page.locator('#editRuntime').fill('123');await page.locator('#editRuntime').blur();
  await page.locator('#movie30-detail-classification>summary').click();
  for(const [label,value] of [['種別','drama'],['制作区分','ハリウッド'],['形式','animation']]){
   const row=page.locator('#editGenrePicker .struct-row').filter({has:page.locator('.struct-label').filter({hasText:new RegExp('^'+label+'$')})});
   await row.locator(`[data-struct-value="${value}"]`).click({force:true});
  }
  assert.equal((await snapshot(page)).formatOverrides[id],'hybrid','Selecting animation alongside live action retains both formats');
  await page.locator('#editGenrePicker [data-struct-value="live"]').click({force:true});
  const genre=page.locator('#editGenrePicker .struct-chip').filter({hasText:/^SF$/});await genre.first().click({force:true});
  await page.waitForTimeout(180);await page.evaluate(()=>window.__movie30PendingSave);const edited=await snapshot(page);const preview=await page.locator('#movie30-detail-class-preview').textContent();
  assert.equal(edited.titleOverrides[id].title,'Synthetic edited title');assert.equal(Number(edited.runtimeOverrides[id]),123);assert.equal(edited.mediaTypeOverrides[id],'drama');assert.equal(edited.originOverrides[id],'ハリウッド');assert.equal(edited.formatOverrides[id],'animation');assert(edited.genreOverrides[id].includes('SF'));assert.match(preview,/SF/);
  await reload(page);const restored=await snapshot(page);for(const key of ['titleOverrides','runtimeOverrides','mediaTypeOverrides','originOverrides','formatOverrides','genreOverrides'])assert.deepEqual(restored[key][id],edited[key][id]);
  await page.evaluate(id=>openSheet(id),id);page.on('dialog',d=>d.accept());await page.locator('#deleteCustom').click();await page.evaluate(()=>window.__movie30PendingSave);await reload(page);
  const deleted=await snapshot(page);assert(!deleted.customFilms.some(f=>f.id===id));assert.deepEqual(deleted.rankOrder,before.rankOrder);for(const [id,score] of Object.entries(before.exactScores))assert.equal(deleted.exactScores[id],score);
 }finally{await context.close()}
});
test('IDB-only edits survive closing and relaunching a browser process',async()=>{
 const profileRoot=path.resolve(__dirname,'../../test-results/profiles');fs.mkdirSync(profileRoot,{recursive:true});
 const profile=fs.mkdtempSync(path.join(profileRoot,'movie-regression-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,options);await isolate(context);let page=await context.newPage();await page.goto(origin);await ready(page);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};state.letterboxdMeta['fixture-0012'].note='process restart sentinel';return save()});const saveResult=await saved(page);assert.equal(saveResult.failed,false,JSON.stringify(saveResult));const expected=await snapshot(page);await context.close();context=null;
  context=await chromium.launchPersistentContext(profile,options);await isolate(context);page=await context.newPage();await page.goto(origin);await ready(page);assert.deepEqual(content(await snapshot(page)),content(expected));
 }finally{await context?.close();if(path.dirname(profile)===profileRoot&&path.basename(profile).startsWith('movie-regression-'))fs.rmSync(profile,{recursive:true,force:true});}
});

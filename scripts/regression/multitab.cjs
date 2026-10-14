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
  await a.evaluate(()=>window.addEventListener('storage',e=>e.stopImmediatePropagation(),true));
  await b.evaluate(()=>{state.letterboxdMeta['fixture-0012'].note='committed B review';return save()});
  await a.evaluate(()=>{state.genreOverrides['fixture-0013']=['SF','ドラマ'];return save()});
  const disk=await b.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)));
  assert.equal(disk.letterboxdMeta['fixture-0012'].note,'committed B review');
 }finally{await context.close()}
});

'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');

test('only a committed tab save enters shared history',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const a=await context.newPage(),b=await context.newPage();await a.goto(origin);await ready(a);await b.goto(origin);await ready(b);
  await a.evaluate(()=>{window.__holdPromise=navigator.locks.request('movie30-state-write',async()=>{window.__holding=true;await new Promise(resolve=>window.__releaseStateLock=resolve)})});
  await a.waitForFunction(()=>window.__holding===true);
  await a.evaluate(()=>{state.genreOverrides['fixture-0012']=['架空A'];window.__saveA=save()});
  await b.evaluate(()=>{state.genreOverrides['fixture-0013']=['架空B'];window.__saveB=save()});
  await a.evaluate(()=>window.__releaseStateLock());
  const committed=await a.evaluate(()=>window.__saveA),rejected=await b.evaluate(()=>window.__saveB);
  assert.equal(committed,true);assert.equal(rejected,false);
  const entries=await a.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]'));
  assert(entries.some(h=>h.c?.some(c=>c.f==='genreOverrides'&&c.k==='fixture-0012')),'committed edit history lost');
  assert(!entries.some(h=>h.c?.some(c=>c.f==='genreOverrides'&&c.k==='fixture-0013')),'rejected edit entered committed history');
 }finally{await context.close();await browser.close()}
});

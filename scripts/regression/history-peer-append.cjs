'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');
test('peer history survives a later save in the receiving tab',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const a=await context.newPage(),b=await context.newPage();await a.goto(origin);await ready(a);await b.goto(origin);await ready(b);
  await a.evaluate(async()=>{state.genreOverrides['fixture-0012']=['架空A'];await save()});
  const first=await a.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]')[0].id);
  await b.waitForFunction(()=>state.genreOverrides['fixture-0012']?.[0]==='架空A');
  await b.evaluate(async()=>{state.genreOverrides['fixture-0013']=['架空B'];await save()});
  const ids=await b.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]').map(x=>x.id));
  assert(ids.includes(first),`later save erased the first tab history: first=${first}, ids=${JSON.stringify(ids)}`);
  const edits=await b.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]').filter(h=>h.c?.some(c=>c.f==='genreOverrides'&&['fixture-0012','fixture-0013'].includes(c.k))));
  assert.equal(edits.length,2);
  await b.reload();await ready(b);assert.equal(await b.evaluate(()=>state.genreOverrides['fixture-0012']?.[0]),'架空A');assert.equal(await b.evaluate(()=>state.genreOverrides['fixture-0013']?.[0]),'架空B');
 }finally{await context.close();await browser.close()}
});

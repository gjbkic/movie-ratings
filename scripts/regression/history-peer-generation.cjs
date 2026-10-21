'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');
test('new local history after peer review contains only the local genre edit',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const a=await context.newPage(),b=await context.newPage();await a.goto(origin);await ready(a);await b.goto(origin);await ready(b);
  await b.evaluate(async()=>{state.letterboxdMeta['fixture-0012'].note='B peer review';await save()});
  await a.waitForFunction(()=>state.letterboxdMeta['fixture-0012'].note==='B peer review');
  const before=await a.evaluate(()=>({genre:JSON.stringify(state.genreOverrides['fixture-0013']),note:state.letterboxdMeta['fixture-0012'].note}));
  await a.evaluate(async()=>{state.genreOverrides['fixture-0013']=['架空ジャンル'];await save()});
  const created=await a.evaluate(()=>JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]')[0]);
  assert(created,'local history was not recorded');
  await a.evaluate(()=>document.getElementById('histOpen66').click());await a.locator('#histBody66 [data-u]').first().click();
  await a.waitForFunction(id=>!JSON.parse(localStorage.getItem('movie30_change_history_v66')||'[]').some(h=>h.id===id),created.id);
  const check=async p=>p.evaluate(async()=>({note:state.letterboxdMeta['fixture-0012'].note,genre:JSON.stringify(state.genreOverrides['fixture-0013']),ls:JSON.parse(localStorage.getItem('movie30_data_v1')).letterboxdMeta['fixture-0012'].note,db:JSON.parse((await movie30ReadSnapshot()).json).letterboxdMeta['fixture-0012'].note}));
  const result=await check(a);if(result.genre!==before.genre)throw Error(JSON.stringify({created:created.c.map(x=>({f:x.f,k:x.k})),status:await a.evaluate(()=>document.getElementById('saveState').textContent),result}));assert.equal(result.note,before.note);assert.equal(result.ls,before.note);assert.equal(result.db,before.note);
  await a.reload();await ready(a);assert.equal((await check(a)).note,before.note);
 }finally{await context.close();await browser.close()}
});

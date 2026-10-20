'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
for(const kind of ['balanced-candidate','balanced-partial','legacy-partial','legacy'])test('startup candidates: '+kind,async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const page=await context.newPage();await page.goto(origin+'/seed');
  const base=fixture().state;const invalid=structuredClone(base);invalid.updatedAt=Number(base.updatedAt||0)+1000000;
  invalid.customFilms.push({id:'foreign-policy-film',title:'Foreign policy film'});
  if(kind.startsWith('balanced'))invalid.scorePolicy='balanced-v1';
  if(kind==='balanced-partial'||kind==='legacy-partial')delete invalid.exactScores;
  await page.evaluate(({base,invalid,kind})=>{
   localStorage.setItem('movie30_data_v1',JSON.stringify(kind==='balanced-candidate'?invalid:base));
   if(kind!=='balanced-candidate')localStorage.setItem('movie30_data_backup_1',JSON.stringify(invalid));
  },{base,invalid,kind});
  const before=await page.evaluate(()=>({current:localStorage.getItem('movie30_data_v1'),backup:localStorage.getItem('movie30_data_backup_1')}));
  await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  const actual=await page.evaluate(()=>({from:window.__movie30RestoredFrom,blocked:!!window.__movie30RecoveryBlocked,current:localStorage.getItem('movie30_data_v1'),backup:localStorage.getItem('movie30_data_backup_1')}));
  if(kind==='legacy')assert.equal(actual.from,'movie30_data_backup_1');
  else if(kind==='legacy-partial')assert.match(actual.from,/^movie30_data_v1 \+ partial fields/);
  else assert.equal(!!actual.from?.includes('partial fields'),false);
  assert.equal(actual.blocked,kind==='balanced-candidate');
  assert.equal(actual.current,before.current);assert.equal(actual.backup,before.backup);
 }finally{await context.close();await browser.close()}
});

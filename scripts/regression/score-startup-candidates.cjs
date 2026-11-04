'use strict';
const {test}=require('node:test'),{chromium,options,isolate,fixture,origin,assert}=require('./harness.cjs');
const protectedKeys=['customFilms','exactScores','starOverrides','rankOrder','letterboxdMeta','fixtureUnknown'];
function compareFields(actual,expected,label){
 for(const key of protectedKeys)assert.equal(JSON.stringify(actual[key]),JSON.stringify(expected[key]),`${label}: changed ${key}`);
}
for(const kind of ['balanced-candidate','balanced-partial','legacy-partial','legacy'])test('startup candidates: '+kind,async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext();try{
  await isolate(context);const page=await context.newPage();await page.goto(origin+'/seed');
  const base=fixture().state;const invalid=structuredClone(base);invalid.updatedAt=Number(base.updatedAt||0)+1000000;
  invalid.customFilms.push({id:'foreign-policy-film',title:'Foreign policy film'});
  if(kind==='balanced-partial')invalid.letterboxdMeta['fixture-0012'].note='foreign policy review';
  if(kind.startsWith('balanced'))invalid.scorePolicy='balanced-v1';
  if(kind==='balanced-partial'||kind==='legacy-partial')delete invalid.exactScores;
  await page.evaluate(({base,invalid,kind})=>{
   localStorage.setItem('movie30_data_v1',JSON.stringify(kind==='balanced-candidate'?invalid:base));
   if(kind!=='balanced-candidate')localStorage.setItem('movie30_data_backup_1',JSON.stringify(invalid));
  },{base,invalid,kind});
  const before=await page.evaluate(()=>({current:localStorage.getItem('movie30_data_v1'),backup:localStorage.getItem('movie30_data_backup_1')}));
  await page.goto(origin);await page.evaluate(()=>window.__movie30StorageReady);
  if(kind!=='balanced-candidate'){
   await page.waitForSelector('html.movie30-ready',{timeout:30000});
   await page.evaluate(()=>window.__movie30PendingSave);
  }
  const actual=await page.evaluate(()=>({from:window.__movie30RestoredFrom,blocked:!!window.__movie30RecoveryBlocked,current:localStorage.getItem('movie30_data_v1'),backup:localStorage.getItem('movie30_data_backup_1'),runtime:JSON.parse(JSON.stringify(state))}));
  if(kind==='legacy')assert.equal(actual.from,'movie30_data_backup_1');
  else if(kind==='legacy-partial')assert.match(actual.from,/^movie30_data_v1 \+ partial fields/);
  else assert.equal(!!actual.from?.includes('partial fields'),false);
  assert.equal(actual.blocked,kind==='balanced-candidate');
  if(kind==='balanced-candidate')await page.locator('#movie30-startup-mask').getByText('保存データの復元を停止しました').waitFor();
  assert.equal(actual.backup,before.backup,'rejected/archived backup changed');
  if(kind==='balanced-candidate')assert.equal(actual.current,before.current,'rejected current changed');
  else {
   const expected=kind==='legacy'?invalid:kind==='legacy-partial'?{...base,customFilms:invalid.customFilms}:base;
   compareFields(actual.runtime,expected,'runtime');
   compareFields(JSON.parse(actual.current),expected,'persisted current');
   if(kind==='balanced-partial'){
    assert.equal(actual.runtime.customFilms.some(f=>f.id==='foreign-policy-film'),false,'rejected film merged into runtime');
    assert.equal(JSON.parse(actual.current).customFilms.some(f=>f.id==='foreign-policy-film'),false,'rejected film persisted');
    assert.equal(actual.runtime.letterboxdMeta['fixture-0012'].note,base.letterboxdMeta['fixture-0012'].note,'rejected review merged into runtime');
   }
  }
 }finally{await context.close();await browser.close()}
});

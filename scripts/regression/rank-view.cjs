'use strict';
const fs=require('node:fs');
const {launch,origin,ready,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  async function collect(legacy){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(legacy)await page.route('**/app-core.js*',r=>{
    let body=fs.readFileSync('app-core.js','utf8').replace(/const BASE_FILMS=\[[^\n]*\];(?=\r?\nconst DEFAULT_MAP=)/,'const BASE_FILMS=[];');
    const a=body.indexOf('function renderRank(){'),b=body.indexOf('function clearDragListeners()',a);
    body=body.slice(0,a)+fs.readFileSync('scripts/regression/rank-view-baseline.txt','utf8')+body.slice(b);
    return r.fulfill({contentType:'text/javascript',body});
   });
   await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
   const results=await page.evaluate(()=>{
    const result=[];
    for(const scenario of ['initial','search','mutate','clear','empty']){
     if(scenario==='search')document.getElementById('searchRank').value='架空作品 12';
     if(scenario==='mutate'){
      state.titleOverrides['fixture-0012']={title:'架空作品 12 <変更>'};
      state.exactScores['fixture-0012']=0;
      state.rankOrder['80'].reverse();
     }
     if(scenario==='clear')document.getElementById('searchRank').value='';
     if(scenario==='empty')view.showEmpty=true;
     const before=JSON.stringify(state);renderRank();
     if(JSON.stringify(state)!==before)throw Error('Rendering mutated state');
     result.push({scenario,html:document.getElementById('rankRoot').innerHTML});
    }
    return result;
   });
   // A freshly rebuilt card must still open the detail sheet.
   await page.locator('#rankRoot .rank-card [data-open]').first().click();
   assert(await page.evaluate(()=>selectedId!=null));assert.deepEqual(errors,[]);
   await page.close();return results;
  }
  assert.deepEqual(await collect(false),await collect(true));
  console.log('RANK_VIEW_PASS: identical decorated DOM across five scenarios, live state edits, data invariant and detail event');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
// Read-only UI profiling on the existing isolated 740-film fixture. No network forwarding.
// MOVIE_APP_ROOT selects a second checkout for before/after runs with identical probes.
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  const before=await snapshot(page);
  const report=await page.evaluate(async()=>{
   const samples=[];
   async function sample(name,fn){
    const counts={childList:0,attributes:0,characterData:0,added:0,removed:0};
    const observer=new MutationObserver(records=>{for(const r of records){counts[r.type]++;counts.added+=r.addedNodes.length;counts.removed+=r.removedNodes.length}});
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    const start=performance.now();fn();const syncMs=performance.now()-start;
    await new Promise(r=>setTimeout(r,160));observer.disconnect();
    samples.push({name,syncMs,...counts,domNodes:document.querySelectorAll('*').length});
   }
   for(let n=0;n<3;n++)await sample('rank-repeat',()=>renderRank());
   for(const q of ['架空作品 12',''])await sample(q?'search':'clear-search',()=>{const el=document.getElementById('searchRank');el.value=q;el.dispatchEvent(new Event('input',{bubbles:true}))});
   for(const id of ['fixture-0012','fixture-0001','fixture-0012'])await sample('detail-'+id,()=>openSheet(id));
   for(let n=0;n<3;n++)await sample('detail-refresh',()=>window.__movie30DetailUnified.refresh());
   closeSheet();return {userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},samples};
  });
  assert.deepEqual(await snapshot(page),before,'Read-only UI operations changed movie state');
  const output=path.resolve(process.env.MOVIE_PROFILE_OUTPUT||'test-results/ui-profile.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

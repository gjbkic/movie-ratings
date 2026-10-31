'use strict';
// Instrument a served copy only. Existing harness substitutes fictional state and blocks networking.
const {launch,ready,origin,snapshot,assert}=require('./harness.cjs');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let source=fs.readFileSync(path.join(__dirname,'../../app-enhancements.js'),'utf8').replace(/\r\n/g,'\n');
  function inject(anchor,label){assert.equal(source.split(anchor).length,2,'Instrumentation anchor must be unique: '+label);source=source.replace(anchor,anchor+`window.__posterTrace.push('${label}');`)}
  inject('let pending=false;\nfunction refresh(){','v89-run');
  inject('function queue(){\n if(pending)return;','v89-schedule');
  inject('function refreshPosters(){','v90-run');
  inject('function refreshDetailPoster(){','v90-detail-run');
  inject('function scheduleRefresh(scope){','v90-request');
  inject('new MutationObserver(mutations=>{\n  // Only track added/removed nodes: src changes should not cause infinite observer loops.\n','v90-observer');
  await page.addInitScript(()=>{window.__posterTrace=[]});
  await page.route('**/app-enhancements.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));
  await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  const before=await snapshot(page);
  const samples=await page.evaluate(async()=>{
   const samples=[];
   async function sample(name,fn){window.__posterTrace=[];fn();await new Promise(r=>setTimeout(r,300));const trace=window.__posterTrace.slice();samples.push({name,trace,counts:trace.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{})})}
   await sample('rank',()=>renderRank());
   await sample('search',()=>{const s=document.getElementById('searchRank');s.value='架空作品 12';s.dispatchEvent(new Event('input',{bubbles:true}))});
   await sample('clear-search',()=>{const s=document.getElementById('searchRank');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}))});
   await sample('detail',()=>openSheet('fixture-0012'));
   await sample('detail-switch',()=>{openSheet('fixture-0001');openSheet('fixture-0012')});
   await sample('detail-refresh',()=>window.__movie30DetailUnified.refresh());
   await sample('idle',()=>{});
   return samples;
  });
  assert.deepEqual(await snapshot(page),before);
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/poster-async-profile.json',JSON.stringify(samples,null,2)+'\n');
  console.log(JSON.stringify(samples.map(({name,counts})=>({name,counts})),null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

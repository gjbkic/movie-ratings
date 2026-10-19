'use strict';
const fs=require('node:fs');
const {launch,origin,ready,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  const report=await page.evaluate(()=>{
   const types=['movie','series','drama','documentary','other','fixture-unknown'];
   const ids=types.map((type,i)=>{const id='fixture-'+String(20+i).padStart(4,'0');state.mediaTypeOverrides[id]=type;state.genreOverrides[id]=['SF','ドラマ'];return id});
   const read=()=>ids.map((id,i)=>{const card=document.querySelector('#rankRoot .rank-card[data-id="'+id+'"]');return {type:types[i],id,present:!!card,pills:[...card?.querySelectorAll('.media-pill')||[]].map(x=>x.textContent),genres:card?.querySelector('.genre-line')?.textContent||''}});
   const before=JSON.stringify(state);renderRank();const first=read();renderRank();const repeated=read();
   document.getElementById('searchRank').value='架空作品 2';renderRank();document.getElementById('searchRank').value='';renderRank();const cleared=read();
   // An out-of-root card demonstrates the legacy document-wide decorator scope.
   const outside=document.querySelector('#rankRoot .rank-card[data-id="'+ids[1]+'"]').cloneNode(true);outside.id='decoration-probe';document.body.append(outside);
   renderRank();const outsideLabel=outside.querySelector('.media-pill')?.textContent;outside.remove();
   return {first,repeated,cleared,outsideLabel,stateUnchanged:JSON.stringify(state)===before};
  });
  assert(report.first.every(x=>x.present),'Every synthetic type must retain a card');
  assert.deepEqual(report.first.map(x=>x.pills),[[],['TVシリーズ'],['TVシリーズ'],['映画'],['その他'],['映画']]);
  assert(report.first.every(x=>x.genres==='SF・ドラマ'));
  assert.equal(report.outsideLabel,'ドラマ・シリーズ');
  assert.deepEqual(report.repeated,report.first);assert.deepEqual(report.cleared,report.first);assert(report.stateUnchanged);assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/card-decoration-baseline.json',JSON.stringify(report,null,2)+'\n');
  console.log('CARD_DECORATION_PROBE_PASS',JSON.stringify(report.first),JSON.stringify({outsideLabel:report.outsideLabel}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

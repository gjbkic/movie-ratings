'use strict';
const {launch,origin,ready,assert}=require('./harness.cjs');
(async()=>{const browser=await launch();try{
 const page=await browser.newPage();await page.goto(origin);await ready(page);
 const result=await page.evaluate(()=>{
  const id='fixture-0021';state.mediaTypeOverrides[id]='series';state.runtimeOverrides[id]=123;state.genreOverrides[id]=['SF','ドラマ'];
  const firstState=JSON.stringify(state);renderRank();const card=()=>document.querySelector('#rankRoot .rank-card[data-id="'+id+'"] .rank-meta');const first=card()?.innerHTML;
  const firstUnchanged=JSON.stringify(state)===firstState;
  state.runtimeOverrides[id]=124;state.genreOverrides[id]=['ドラマ'];const secondState=JSON.stringify(state);renderRank();const second=card()?.innerHTML;
  return {first,second,firstUnchanged,secondUnchanged:JSON.stringify(state)===secondState};
 });
 assert(result.first?.includes('123分')&&result.first.includes('SF・ドラマ'));
 assert(result.second?.includes('124分')&&result.second.includes('>ドラマ</div>')&&!result.second.includes('SF・ドラマ'));
 assert(result.firstUnchanged&&result.secondUnchanged);console.log(JSON.stringify(result));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

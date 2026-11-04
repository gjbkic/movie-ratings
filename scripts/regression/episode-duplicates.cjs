'use strict';
const {test,after}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');let browser;
after(async()=>browser?.close());
test('episode duplicate display is read-only and uses explicit nonempty identity',async()=>{
 browser=await launch();const context=await browser.newContext();try{
  const page=await context.newPage();await page.goto(origin);await ready(page);
  const result=await page.evaluate(()=>{
   const cases=[['empty',{}],['note',{note:'preserve me'}],['watch',{watchHistory:[{date:'2026-01-01'}]}],['review',{rssReviewRecords:{one:{text:'preserve'}}}],['year',{}],['english',{}],['scored',{}]];
   return cases.map(([name,meta],i)=>{
    const a={id:'episode-'+name+'-a',title:'Black Mirror: Hang the DJ',englishTitle:'Black Mirror: Hang the DJ',year:2017,uri:'https://example.invalid/a',added:true};
    const b={...a,id:'episode-'+name+'-b',uri:'https://example.invalid/b'};
    if(name==='year')b.year=2018;if(name==='english')b.englishTitle='A distinct fictional episode';
    const prior=state.customFilms;state.customFilms=prior.filter(f=>!f.id.startsWith('episode-')).concat(a,b);
    state.exactScores[a.id]=90;state.exactScores[b.id]=name==='scored'?0:null;
    state.letterboxdMeta[a.id]={};state.letterboxdMeta[b.id]=meta;state.updatedAt++;
    const before=JSON.stringify(state);let ids,error;try{ids=allFilms().filter(f=>f.id.startsWith('episode-')).map(f=>f.id)}catch(e){error=e.message}
    return {name,a:a.id,b:b.id,ids,error,unchanged:JSON.stringify(state)===before};
   });
  });
  for(const x of result){assert.equal(x.error,undefined,JSON.stringify(x));assert(x.unchanged);assert(x.ids.includes(x.a));assert.equal(x.ids.includes(x.b),x.name!=='empty',JSON.stringify(x))}
 }finally{await context.close()}
});

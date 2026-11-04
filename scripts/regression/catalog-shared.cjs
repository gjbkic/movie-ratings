'use strict';
const {test}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');
test('five metadata consumers share one request, with explicit refresh and isolated results',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();let count=0;
  await page.route('**/tmdb-metadata.json*',r=>{count++;return r.fulfill({json:{schema:1,updatedAt:'2026-01-01',films:{},fixtureGeneration:count}})});
  await page.goto(origin);await ready(page);await page.waitForTimeout(300);
  assert.equal(count,1,'Five startup consumers must use one catalog fetch');
  const before=await page.evaluate(()=>JSON.stringify({scores:state.exactScores,ranks:state.rankOrder,meta:state.letterboxdMeta}));
  const result=await page.evaluate(async()=>{
   const [a,b]=await Promise.all([window.__movie30LoadCatalog(),window.__movie30LoadCatalog()]);
   a.films.fake={title:'Consumer-only mutation'};
   const c=await window.__movie30LoadCatalog();
   return {generation:c.fixtureGeneration,isolated:!b.films.fake&&!c.films.fake};
  });
  assert.deepEqual(result,{generation:1,isolated:true});assert.equal(count,1);
  await page.evaluate(()=>window.__movie30CloudCredits88.reload());assert.equal(count,2);
  assert.equal(await page.evaluate(()=>JSON.stringify({scores:state.exactScores,ranks:state.rankOrder,meta:state.letterboxdMeta})),before);
 }finally{await browser.close()}
});
test('shared fictional catalog still drives credits, poster, search, actor filtering and cast lookup',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();
  await page.route('**/tmdb-metadata.json*',r=>r.fulfill({json:{schema:1,updatedAt:'2026-01-01',films:{'fixture-0012':{title:'架空作品 12',directors:['Fictional Director'],directorAliases:['Test Director Alias'],posterPath:'/fictional.jpg',tmdbId:999012,cast:[{id:999100,name:'Fictional Actor',character:'Test role'}]}}}}));
  await page.goto(origin);await ready(page);
  await page.waitForFunction(()=>window.__movie30CloudCredits88.stats().total===1);
  const out=await page.evaluate(async()=>{
   const f=allFilms().find(f=>f.id==='fixture-0012'),before=JSON.stringify({score:state.exactScores[f.id],ranks:state.rankOrder,note:state.letterboxdMeta[f.id].note,watch:state.letterboxdMeta[f.id].watchHistory});
   const cast=await window.__movie30CastSource.retrieve(f);
   window.__movie30AdvancedFilter93.setFilters({actor:'Fictional Actor'});
   const filter=window.__movie30AdvancedFilter93.matches(f);window.__movie30AdvancedFilter93.reset();
   return {cast:cast.cast[0].name,filter,search:match(f,'Test Director Alias'),poster:state.letterboxdMeta[f.id].poster84.path,crew:state.letterboxdMeta[f.id].crew84.directors,before,after:JSON.stringify({score:state.exactScores[f.id],ranks:state.rankOrder,note:state.letterboxdMeta[f.id].note,watch:state.letterboxdMeta[f.id].watchHistory})};
  });
  assert.equal(out.cast,'Fictional Actor');assert.equal(out.filter,true);assert.equal(out.search,true);assert.equal(out.poster,'/fictional.jpg');assert.deepEqual(out.crew,['Fictional Director']);assert.equal(out.before,out.after);
 }finally{await browser.close()}
});
test('failed catalog does not poison manual retry or change stored ratings',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();let count=0,fail=true;
  await page.route('**/tmdb-metadata.json*',async r=>{count++;await new Promise(resolve=>setTimeout(resolve,100));return r.fulfill({status:fail?503:200,json:fail?{error:'fixture failure'}:{schema:1,films:{}}})});
  await page.goto(origin);await ready(page);await page.waitForTimeout(300);assert.equal(count,1);
  const before=await page.evaluate(()=>JSON.stringify({scores:state.exactScores,ranks:state.rankOrder}));
  await page.evaluate(()=>window.__movie30LoadCatalog().catch(()=>null));assert.equal(count,1,'Late consumers must not create a retry storm');
  fail=false;await page.evaluate(()=>window.__movie30CloudCredits88.reload());assert.equal(count,2);
  assert.match(await page.locator('#cloudCreditsStatus88').textContent(),/反映済み/);
  assert.equal(await page.evaluate(()=>JSON.stringify({scores:state.exactScores,ranks:state.rankOrder})),before);
 }finally{await browser.close()}
});

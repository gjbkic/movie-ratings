'use strict';
const {launch,isolate,fixture,origin,ready,snapshot,assert}=require('./harness.cjs');
let browser;
(async()=>{
 browser=await launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const seed=fixture(30).state;await isolate(context,{seed});
 await context.addInitScript(seed=>{if(!localStorage.getItem('unrated-search-fixture')){localStorage.setItem('movie30_data_v1',JSON.stringify(seed));localStorage.setItem('unrated-search-fixture','1')}},seed);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin);await ready(page);await page.waitForFunction(()=>window.__movie30Classification);
 const ids=await page.evaluate(async()=>{
  const a=addFilm('検索保留Alpha',2026,'SF',0,'',{keepUnscored:true,englishTitle:'Unstarred Alpha',originalTitle:'Original Alpha'}),b=addFilm('検索保留Beta',2026,'SF',0,'',{keepUnscored:true,englishTitle:'Unstarred Beta',originalTitle:'Original Beta'}),c=addFilm('点数待ちAlpha',2026,'SF',4,'',{keepUnscored:true});
  state.starOverrides[a.id]=0;state.starOverrides[b.id]=0;
  state.genreOverrides[a.id]=['ホラー','comfort'];state.genreOverrides[b.id]=['ドラマ'];state.genreOverrides[c.id]=['SF'];
  for(const [f,company,country,language]of [[a,'Studio Ghibli','JP','ja'],[b,'Pixar','US','en'],[c,'Studio Ghibli','JP','ja']]){
   const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
   m.studio130={schema:2,source:'tmdb',checkedAt:'2026-11-20T00:00:00Z',filmTitles:[f.title],filmYear:2026,companies:[{id:company==='Pixar'?3:10342,name:company}],productionCountries:[{code:country}],originalLanguage:language,spokenLanguages:[{code:language}],genres:[],kind:'movie'};
  }
  await save();view.page='rank';renderHeader();renderRank();window.dispatchEvent(new Event('movie30-studio-update'));
  return {a:a.id,b:b.id,c:c.id};
 });
 await page.waitForTimeout(800);const before=await snapshot(page);
 const stars=()=>page.locator('#rankRoot [data-v76-open]').evaluateAll(es=>es.map(e=>decodeURIComponent(e.dataset.v76Open)));
 const scores=()=>page.locator('#rankRoot [data-uns]').evaluateAll(es=>es.map(e=>decodeURIComponent(e.dataset.uns)));
 const search=page.locator('#searchRank');
 for(const query of ['Original Alpha','Unstarred Alpha','comfort','Alpha ジブリ']){
  await search.fill(query);const found=await stars();assert(found.includes(ids.a),query+' finds the star-unset film');assert(!found.includes(ids.b),query+' excludes unrelated star-unset film');
 }
 await search.fill('ジブリ');assert((await stars()).includes(ids.a));assert(!(await stars()).includes(ids.b));assert((await scores()).includes(ids.c),'Score-unset panel follows the same company search');
 const counter=await page.locator('#rankRoot [data-pending-kind="star"] .uns-head .meta').textContent();assert(counter.startsWith('1本'));
 await search.fill('no-such-production-or-title');assert.equal((await stars()).length,0);assert.equal(await page.locator('[data-pending-star-jump]').count(),0);
 await search.fill('');await page.locator('#movie131CompanyRank').selectOption('ghibli');assert((await stars()).includes(ids.a));assert(!(await stars()).includes(ids.b));
 await page.locator('#movie131CompanyRank').selectOption('');await page.locator('#movie131LanguageRank').selectOption('en');assert((await stars()).includes(ids.b));assert(!(await stars()).includes(ids.a),'Language filter applies with empty search text');
 await page.locator('#movie131LanguageRank').selectOption('');await page.locator('#movie131CountryRank').selectOption('JP');assert((await stars()).includes(ids.a));assert(!(await stars()).includes(ids.b));
 await page.locator('#movie131CountryRank').selectOption('');
 // The native advanced genre filter must also apply to star-unset entries.
 await page.evaluate(()=>{const e=document.getElementById('genreFilterRank');if(![...e.options].some(x=>x.value==='SF'))e.add(new Option('SF','SF'));e.value='SF';e.dispatchEvent(new Event('change',{bubbles:true}))});
 assert(!(await stars()).includes(ids.a),'Advanced genre filter excludes non-SF pending film');
 await page.evaluate(()=>{document.getElementById('genreFilterRank').value='';renderRank()});
 await search.fill('comfort');await page.locator('#rankRoot [data-pending-kind="star"] .uns-head').click({force:true});
 await search.fill('Original Alpha');assert.equal(await page.locator('#pending-grid-star').getAttribute('hidden'),'','Fold state survives filtering');
 const after=await snapshot(page);for(const key of ['rankOrder','exactScores','starOverrides','letterboxdMeta'])assert.deepEqual(after[key],before[key],key+' unchanged by filtering');
 assert.deepEqual(errors,[]);console.log('PASS star-unset search across original/English titles, custom genres, company aliases and mixed queries; empty-query country/language/company filters, advanced filters, counts, jump links, folds and data preservation');
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});

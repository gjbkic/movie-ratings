/* Full current dataset; isolated origin, no external network and no user's browser storage. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),origin='https://movie-cast.test';
const live=JSON.parse(fs.readFileSync(path.join(root,'live-state.json'),'utf8'));
const base=JSON.parse(fs.readFileSync(path.join(root,'app-core.js'),'utf8').match(/const BASE_FILMS=(.*);\r?\n/)[1]);
const seed=JSON.parse(JSON.stringify(live.state)),films=base.concat(seed.customFilms).filter(f=>f.id!=='lb-386-wbAi');seed.updatedAt=live.sourceUpdatedAt;
// Four title misses, then a valid animation under a UI drama classification, empty cache,
// 429, transient network failure, persistent 5xx, authentication failure, cached follow-up.
const targets=films.slice(0,11),ids=new Map(targets.map((f,i)=>[900000+i,{...f,title:seed.titleOverrides[f.id]?.title||f.title,originalTitle:seed.titleOverrides[f.id]?.originalTitle||f.originalTitle}]));
for(const [i,f]of targets.entries()){
 seed.titleOverrides[f.id]={...(seed.titleOverrides[f.id]||{}),tmdbId:900000+i};
 seed.letterboxdMeta[f.id]={...(seed.letterboxdMeta[f.id]||{}),contentType:'movie'};
 delete seed.letterboxdMeta[f.id].tmdbSeriesId;
}
seed.mediaTypeOverrides[targets[4].id]='drama';
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const c=await browser.newContext(),requests=[],attempts={};
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='api.themoviedb.org'){
   const id=Number(u.pathname.split('/')[3]),item=ids.get(id),i=id-900000,attempt=attempts[id]=(attempts[id]||0)+1;requests.push({id,path:u.pathname,at:Date.now()});
   if(u.pathname.includes('/search/'))return r.fulfill({contentType:'application/json',body:'{"results":[]}'});
   if(!item||i<4)return r.fulfill({status:404,body:'{}'});
   if(i===6&&attempt===1)return r.fulfill({status:429,headers:{'Retry-After':'1'},body:'{}'});
   if(i===7&&attempt===1)return r.abort('failed');
   if(i===8)return r.fulfill({status:503,body:'{}'});
   if(i===9)return r.fulfill({status:401,body:'{}'});
   const actors=i===5?[]:[{id:123456,name:'声優テスト',character:'役名 (voice)'}];
   return r.fulfill({contentType:'application/json',body:JSON.stringify({id,title:item.title,original_title:item.originalTitle,release_date:item.year+'-01-01',credits:{cast:actors},cast:actors})});
  }
  if(u.origin!==origin)return r.abort();
  if(u.pathname==='/seed')return r.fulfill({contentType:'text/html',body:'seed'});
  const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(file==='tmdb-metadata.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({films:{[targets[10].id]:{tmdbId:900010,type:'movie',cast:[{id:666,name:'GitHubに保存済みの出演者'}]}}})});
  try{return r.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html',body:fs.readFileSync(path.join(root,file))});}catch{return r.fulfill({status:404,body:'missing'});}
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/seed');
 await p.evaluate(async({seed,films,targets})=>{
  localStorage.setItem('movie30_data_v1',JSON.stringify(seed));localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({auto:false,username:'gjbkic'}));localStorage.setItem('movie30_github_stable_auto_v1','0');localStorage.setItem('movie30_tmdb_credential','test-key');
  await new Promise(resolve=>{const req=indexedDB.open('movie30_cast_cache_v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('films',{keyPath:'filmId'});req.onsuccess=()=>{const db=req.result,tx=db.transaction('films','readwrite');for(const f of films){const i=targets.findIndex(x=>x.id===f.id);if(i>=0&&i!==5)continue;tx.objectStore('films').put({filmId:f.id,tmdbType:'movie',resolverVersion:2,tmdbId:0,cast:i===5?[]:[{id:33,name:'既存キャッシュ出演者'}]});}tx.oncomplete=()=>{db.close();resolve();};};});
 },{seed,films,targets});
 await p.goto(origin+'/');await p.waitForSelector('html.movie30-ready');await p.evaluate(async()=>{await window.__movie30Cast.ready;await window.__movie30PendingSave});
 await p.waitForTimeout(600);const before=await p.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,letterboxdMeta:state.letterboxdMeta,starOverrides:state.starOverrides,customFilms:state.customFilms}));
 await p.evaluate(async()=>await window.__movie30Cast.runBulk());const report=await p.evaluate(()=>window.__movie30Cast.report());
 assert.equal(report.counts.total,films.length);assert.equal(report.counts.checked,films.length);assert.equal(report.counts.pending,0);assert.equal(report.counts.unmatched,4);assert.equal(report.counts.empty,1);assert.equal(report.counts.api,2);assert.equal(report.counts.success,films.length-7);
 assert(requests.filter(x=>x.id===900006)[1].at-requests.filter(x=>x.id===900006)[0].at>=900);assert.equal(attempts[900007],2);assert.equal(attempts[900008],3);assert.equal(attempts[900009],1);assert(!attempts[900010]);
 assert.equal(await p.evaluate(id=>window.__movie30Cast.get(id).cast[0].role,targets[4].id),'役名 (voice)');
 assert(report.results.filter(x=>x.status!=='success').every(x=>x.title&&x.reason));const after=JSON.parse(await p.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,letterboxdMeta:state.letterboxdMeta,starOverrides:state.starOverrides,customFilms:state.customFilms})));for(const [key,value]of Object.entries(JSON.parse(before))){if(JSON.stringify(value)!==JSON.stringify(after[key]))console.log('DIFFERENCE',key,Object.keys(value).filter(k=>JSON.stringify(value[k])!==JSON.stringify(after[key][k])));assert.deepEqual(after[key],value);}
 console.log('PASS all '+films.length+' films checked despite four consecutive misses; empty cache rechecked; movie ID under drama; voice cast; 429 Retry-After; network retry; bounded 5xx; auth stops API but catalog continues; full titled report; movie state unchanged');
 await p.reload();await p.waitForSelector('html.movie30-ready');await p.waitForFunction(()=>window.__movie30Cast.report()?.counts.checked>0);assert.equal(await p.evaluate(()=>window.__movie30Cast.report().counts.checked),films.length);assert.deepEqual(errors,[]);console.log('PASS cast report and successful cache persist across reload');await c.close();await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});

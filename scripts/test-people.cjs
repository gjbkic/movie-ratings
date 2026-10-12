/* Isolated Chrome origin and deterministic TMDB replies. Never opens the user's app storage. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'), live=JSON.parse(fs.readFileSync(path.join(root,'live-state.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tmdb-metadata.json'),'utf8')).films;
const origin='https://movie-people.test', personId=990090, name='人物ページ検証';
let browser;
async function setup(context){
 let fixtures;
 await context.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.protocol==='blob:')return r.continue();
  if(u.hostname==='api.themoviedb.org'){
   let body={};const p=u.pathname.replace('/3','');
   if(p==='/search/person')body={results:u.searchParams.get('query')==='同名検証'?[{id:1,name:'同名検証',known_for_department:'Acting',known_for:[{title:'A'}]},{id:2,name:'同名検証',known_for_department:'Directing',known_for:[{title:'B'}]}]:[{id:personId,name}]};
   else if(p==='/search/multi')body={results:u.searchParams.get('query')==='オンライン検証'?[{media_type:'person',id:personId,name:'オンライン検証'}]:[]};
   else if(p===`/person/${personId}`)body={id:personId,name,also_known_as:[],profile_path:'/person-test.jpg'};
   else if(p===`/person/${personId}/combined_credits`)body={cast:[...fixtures.works,{id:990001,media_type:'movie',title:'追加検証映画',release_date:'2026-01-01',popularity:1000,poster_path:'/new-test.jpg'},{id:990002,media_type:'tv',name:'追加検証ドラマ',first_air_date:'2026-01-01',popularity:900},{id:990001,media_type:'tv',name:'映画と同番号のドラマ',popularity:700}],crew:[{...fixtures.works[0],job:'Director'},{id:990003,media_type:'movie',title:'編集のみの作品',job:'Editor'}]};
   else if(p==='/movie/990001')body={id:990001,title:'追加検証映画',original_title:'New test movie',overview:'作品の詳細を見てから登録するテストです。',poster_path:'/new-test.jpg',genres:[]};
   else if(p==='/tv/990002')body={id:990002,name:'追加検証ドラマ',original_name:'New test TV',overview:'ドラマの登録テスト',genres:[]};
   else if(p.endsWith('/credits'))body={cast:[],crew:[{id:personId,name,job:'Director'}]};
   else if(p.startsWith('/tv/'))body={created_by:[{id:personId,name}]};
   return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  }
  if(u.origin!==origin)return r.abort();
  if(u.pathname==='/seed')return r.fulfill({contentType:'text/html',body:'seed'});
  const file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  try{return r.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html',body:fs.readFileSync(path.join(root,file))});}
  catch{return r.fulfill({status:404,body:'missing'});}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 const seed=JSON.parse(JSON.stringify(live.state));seed.updatedAt=live.sourceUpdatedAt;
 const base=JSON.parse(fs.readFileSync(path.join(root,'app-core.js'),'utf8').match(/const BASE_FILMS=(.*);\r?\n/)[1]);
 const all=base.concat(seed.customFilms||[]), candidates=all.filter(f=>!String(seed.letterboxdMeta?.[f.id]?.contentType||'').startsWith('tv_') && Number(seed.titleOverrides?.[f.id]?.tmdbId||seed.letterboxdMeta?.[f.id]?.poster84?.tmdbId||catalog[f.id]?.tmdbId)>0);
 const rank=Object.entries(seed.rankOrder).filter(([k,v])=>v.filter(id=>candidates.some(f=>f.id===id)).length>=2).sort((a,b)=>Number(b[0])-Number(a[0]))[0];
 const selected=rank[1].filter(id=>candidates.some(f=>f.id===id)).slice(0,2).reverse().map(id=>candidates.find(f=>f.id===id));
 fixtures={key:rank[0],films:selected,works:selected.map((f,i)=>({id:Number(seed.titleOverrides?.[f.id]?.tmdbId||seed.letterboxdMeta?.[f.id]?.poster84?.tmdbId||catalog[f.id]?.tmdbId),media_type:'movie',title:f.title,release_date:String(f.year)+'-01-01',popularity:10+i}))};
 for(const f of selected){seed.letterboxdMeta[f.id]??={};seed.letterboxdMeta[f.id].crew84={directors:[name],fetchedAt:new Date().toISOString()};}
 await page.evaluate(async({seed,fixtures,personId,name})=>{
  localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({username:'gjbkic',auto:false}));
  localStorage.setItem('movie30_github_stable_auto_v1','0');localStorage.setItem('movie30_tmdb_credential','fixture-key');
  localStorage.setItem('movie30_data_v1',JSON.stringify(seed));
  await new Promise(resolve=>{const req=indexedDB.open('movie30_cast_cache_v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('films',{keyPath:'filmId'});req.onsuccess=()=>{const db=req.result,tx=db.transaction('films','readwrite');for(const [i,f]of fixtures.films.entries())tx.objectStore('films').put({filmId:f.id,tmdbType:'movie',tmdbId:fixtures.works[i].id,cast:[{id:personId,name,role:'主役',order:0}],fetchedAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve()};};});
 },{seed,fixtures,personId,name});
 await page.goto(origin+'/');await page.waitForSelector('html.movie30-ready');await page.evaluate(async()=>{await window.__movie30Cast.ready;await window.__movie30PendingSave});
 return {page,fixtures,errors};
}
const protectedState=p=>p.evaluate(()=>JSON.parse(JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores,starOverrides:state.starOverrides,letterboxdMeta:state.letterboxdMeta,customFilms:state.customFilms})));
const keys=p=>p.locator('.movie-person-work').evaluateAll(es=>es.map(e=>e.dataset.key));
async function waitPeople(p){await p.waitForSelector('#moviePersonScope');await p.waitForFunction(()=>document.querySelector('#moviePersonStatus')?.textContent.includes('同点内'));}
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const {page:p,fixtures:f,errors}=await setup(c),before=await protectedState(p);
 await p.evaluate(id=>openSheet(id),f.films[0].id);await p.locator('#movieCastList .movie-cast-person').filter({hasText:name}).click();await waitPeople(p);
 assert.equal(await p.locator('#moviePersonScope').inputValue(),'registered');assert.equal(await p.locator('#moviePersonSort').inputValue(),'rank');
 const ordered=before.rankOrder[f.key].filter(id=>f.films.some(x=>x.id===id));assert.deepEqual(await keys(p),ordered.map(id=>'local:'+id));
 assert.equal(await p.locator('.movie-person-badge.seen').count(),2);assert.equal(await p.locator('#moviePersonBg').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 await p.locator('#moviePersonScope').selectOption('all');assert.equal(await p.locator('#moviePersonSort').inputValue(),'popularity');
 assert.equal((await keys(p))[0],'movie:990001');assert.equal(await p.locator('[data-key="movie:990003"]').count(),0);assert.equal((await keys(p)).length,5);
 assert.equal(await p.locator(`[data-key="movie:${f.works[0].id}"] .seen`).count(),1);assert.equal(await p.locator('[data-key="tv:990001"] .seen').count(),0);
 await p.locator('#moviePersonType').selectOption('tv');assert.deepEqual(await keys(p),['tv:990002','tv:990001']);
 await p.locator('#moviePersonType').selectOption('movie');await p.locator('#moviePersonRole').selectOption('監督');assert.deepEqual(await keys(p),['movie:'+f.works[0].id]);
 await p.locator('#moviePersonRole').selectOption('all');await p.locator('[data-key="movie:990001"]').click();await p.waitForSelector('#moviePersonRegister');assert.match(await p.locator('#moviePersonContent').innerText(),/作品の詳細を見てから/);
 assert.deepEqual(await protectedState(p),before);console.log('PASS actor navigation, registered rank/tie order, type/role/popularity filters, watched badges and read-only preview');
 await p.locator('#moviePersonRegister').click();await p.waitForFunction(()=>document.querySelector('#moviePersonRegisterStatus')?.textContent.includes('登録して保存'));
 const added=await p.evaluate(()=>{const f=allFilms().find(f=>f.title==='追加検証映画');return {f,score:effectiveScore(f),star:filmStar(f)}});assert(added.f);assert.equal(added.score,null);assert.equal(added.star,0);
 await p.locator('#moviePersonBack').click();await p.waitForSelector('#moviePersonScope');await p.locator('#moviePersonType').selectOption('all');await p.locator('#moviePersonScope').selectOption('registered');
 assert.equal((await keys(p)).at(-1),'local:'+added.f.id);assert.equal(await p.locator(`[data-key="local:${added.f.id}"] .seen`).count(),0);
 await p.locator('#moviePersonScope').selectOption('all');await p.locator('[data-key="tv:990002"]').click();await p.waitForSelector('#moviePersonRegister');await p.locator('#moviePersonRegister').click();await p.waitForFunction(()=>document.querySelector('#moviePersonRegisterStatus')?.textContent.includes('登録して保存'));
 const addedTV=await p.evaluate(()=>allFilms().find(f=>f.title==='追加検証ドラマ'));assert.equal(addedTV.tmdbType,'tv');
 const after=await protectedState(p);assert.deepEqual(after.rankOrder,before.rankOrder);for(const [id,score]of Object.entries(before.exactScores))assert.equal(after.exactScores[id],score);for(const [id,m]of Object.entries(before.letterboxdMeta))assert.deepEqual(after.letterboxdMeta[id],m);
 await p.reload();await p.waitForSelector('html.movie30-ready');await p.evaluate(async()=>await window.__movie30PendingSave);
 assert.deepEqual((await protectedState(p)).rankOrder,before.rankOrder);assert.equal(await p.evaluate(id=>filmStar(filmById(id)),added.f.id),0);assert(await p.evaluate(id=>!!filmById(id),addedTV.id));console.log('PASS explicit unviewed/unscored movie and TV registration persists after reload; all existing scores/ranks/reviews/history unchanged');
 await p.evaluate(id=>openSheet(id),f.films[0].id);await p.locator('#directorPanel84 .movie-person-link').first().click();await waitPeople(p);await p.locator('#moviePersonBack').click();await p.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});
 assert.deepEqual(await p.evaluate(()=>[document.documentElement.style.overflow,document.body.style.overflow]),['','']);
 await p.evaluate(()=>window.scrollTo(0,500));assert((await p.evaluate(()=>window.scrollY))>0);
 await p.evaluate(id=>openSheet(id),f.films[0].id);assert.equal(await p.evaluate(()=>document.getElementById('directorPanel84').nextElementSibling.className),'movie-cast-panel');
 await p.locator('#movieCastList .movie-cast-person').filter({hasText:name}).click();await waitPeople(p);
 const touch=await c.newCDPSession(p);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:220,y:45}]});for(const y of [65,100,150,190])await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:220,y}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});assert.deepEqual(await p.evaluate(()=>[document.documentElement.style.overflow,document.body.style.overflow]),['','']);console.log('PASS movie -> person -> Close and physical CDP pull-down restore scrolling; cast directly follows staff');
 const search=p.locator('#searchRank');await search.fill(name);await search.dispatchEvent('focus');await p.waitForSelector('.movie92-suggestions:not([hidden])');await p.locator('.movie92-entry').filter({hasText:name}).first().click();await waitPeople(p);console.log('PASS director tap and local person autocomplete open filmography');
 await p.locator('#moviePersonBack').click();await p.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});await search.fill('オンライン検証');await search.dispatchEvent('focus');await p.locator('.movie92-entry').filter({hasText:'オンライン検証'}).click();await waitPeople(p);console.log('PASS online person autocomplete opens exact TMDB person ID');
 await p.locator('#moviePersonBack').click();await p.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});await p.evaluate(()=>window.__movie30People.open({name:'同名検証'}));await p.waitForSelector('.movie-person-choice');assert.equal(await p.locator('.movie-person-choice').count(),2);console.log('PASS ambiguous names require person selection');
 await p.locator('#moviePersonBack').click();await p.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});await p.evaluate(()=>{localStorage.removeItem('movie30_tmdb_credential');window.__movie30People.open({name:'人物ページ検証'})});await p.waitForFunction(()=>document.querySelector('#moviePersonStatus')?.textContent.includes('APIキー'));assert((await keys(p)).length>=2);assert.deepEqual((await protectedState(p)).rankOrder,before.rankOrder);console.log('PASS missing API key still shows saved person works without changing rankings');
 assert.deepEqual(errors,[]);await p.screenshot({path:path.resolve(root,'../person-registered-mobile.png'),fullPage:false});
 await c.close();
 const c2=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}}),test=await setup(c2),p2=test.page;
 const persisted=await p2.evaluate(async()=>({local:localStorage.getItem('movie30_data_v1'),db:(await movie30ReadSnapshot()).json,rank:JSON.stringify(state.rankOrder)}));
 await p2.evaluate(()=>window.__movie30People.open({id:990090,name:'人物ページ検証'}));await waitPeople(p2);await p2.locator('#moviePersonScope').selectOption('all');await p2.locator('[data-key="movie:990001"]').click();await p2.waitForSelector('#moviePersonRegister');
 await p2.evaluate(()=>{
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='movie30_data_v1')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v)};
  const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(this.name==='movie30_state_db'&&mode==='readwrite')throw new DOMException('quota','QuotaExceededError');return transaction.call(this,stores,mode,...rest)};
 });
 await p2.locator('#moviePersonRegister').click();await p2.waitForFunction(()=>document.querySelector('#moviePersonRegisterStatus')?.textContent.includes('保存できていません'));
 await p2.evaluate(async()=>await window.__movie30PendingSave);assert.equal(await p2.evaluate(()=>window.__movie30SaveFailed),true);const persistedAfter=await p2.evaluate(async()=>({local:localStorage.getItem('movie30_data_v1'),db:(await movie30ReadSnapshot()).json,rank:JSON.stringify(state.rankOrder)}));assert.deepEqual(persistedAfter,persisted);
 // This managed Chrome environment cancels OS downloads, even for a minimal about:blank Blob.
 // Verify the actual JSON Blob and download event without claiming an OS file was saved.
 await p2.evaluate(()=>{const create=URL.createObjectURL;URL.createObjectURL=function(blob){window.__personTestBackupBlob=blob;return create.call(this,blob)};});
 const downloadPromise=p2.waitForEvent('download');await p2.getByRole('button',{name:'現在のデータをJSON保存',exact:true}).last().click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.json$/);
 const backup=await p2.evaluate(async()=>JSON.parse(await window.__personTestBackupBlob.text()));assert(backup.state.customFilms.some(f=>f.title==='追加検証映画'));assert.equal(backup.state.starOverrides[backup.state.customFilms.find(f=>f.title==='追加検証映画').id],0);
 await p2.goBack();await p2.waitForSelector('#moviePersonScope');assert.equal(await p2.locator('#moviePersonScope').inputValue(),'all');await p2.goBack();await p2.waitForSelector('#moviePersonBg[hidden]',{state:'attached'});
 await p2.reload();await p2.waitForSelector('html.movie30-ready');assert.equal(await p2.evaluate(()=>JSON.stringify(state.rankOrder)),persisted.rank);assert.equal(await p2.evaluate(()=>allFilms().some(f=>f.title==='追加検証映画')),false);
 console.log('PASS both storage writes fail: clear warning and correct JSON Blob/download initiation (OS download unverified); previous localStorage/IndexedDB snapshots unchanged; browser Back and reload preserve original data');
 assert.deepEqual(test.errors,[]);await c2.close();await browser.close();console.log('ALL PERSON PAGE CHECKS PASSED');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});


/* Runs in isolated browser profiles against real live-state data. Never uses the user's origin. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),live=JSON.parse(fs.readFileSync(path.join(root,'live-state.json'),'utf8'));
const seed={...live.state,updatedAt:live.sourceUpdatedAt};
const origin='http://movie-persistence.test';
let browser,persistent;
async function route(context,old=false){await context.route('**/*',async r=>{
 const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
 if(u.pathname==='/seed')return r.fulfill({contentType:'text/html',body:'seed'});
 const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
 try{const body=old&&['app-core.js','app-boot.js','index.html'].includes(name)?cp.execFileSync('git',['show','78c8e38f4bea:'+name],{cwd:root}):fs.readFileSync(path.join(root,name));
 return r.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html',body});}catch{return r.fulfill({status:404,body:'missing'})}
 });}
async function context(old=false){const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await route(c,old);return c}
async function init(c,data=seed,{full=false,blockDB=false,blockLocal=false}={}){
 const p=await c.newPage();await p.goto(origin+'/seed');
 p.on('console',m=>{if(m.type()==='warning'&&m.text().includes('database'))console.log('DB_WARNING',m.text())});
 await p.evaluate(({data,full})=>{
  localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({username:'gjbkic',auto:false}));
  localStorage.setItem('movie30_github_stable_auto_v1','0');
  if(data)localStorage.setItem('movie30_data_v1',JSON.stringify(data));
  if(full){let n=0;try{while(true)localStorage.setItem('quota-'+n++,'x'.repeat(1024))}catch(_){}try{while(true)localStorage.setItem('q'+n++,'x')}catch(_){}}
 },{data,full});
 if(blockDB||blockLocal)await c.addInitScript(({blockDB,blockLocal})=>{
  if(blockDB)Object.defineProperty(window,'indexedDB',{value:undefined});
  if(blockLocal)Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};
 },{blockDB,blockLocal});
 await p.goto(origin+'/');await p.waitForSelector('html.movie30-ready',{timeout:25000});
 return p;
}
async function snapshot(p){return p.evaluate(()=>JSON.parse(JSON.stringify(state)))}
async function saved(p){return p.evaluate(async()=>{await window.__movie30PendingSave;return {failed:window.__movie30SaveFailed,status:document.getElementById('saveState').textContent}})}
async function restart(p){await p.reload();await p.waitForSelector('html.movie30-ready');await saved(p)}
async function edit(p){return p.evaluate(()=>{
 const f=addFilm('Black Mirror persistence regression',2026,'SF',4,89,{englishTitle:'Persistence regression'});
 state.letterboxdMeta[f.id]={note:'保持するレビュー',watchHistory:[{id:'test-watch',date:'2026-10-12',source:'manual'}]};
 const key=Object.keys(state.rankOrder).find(k=>state.rankOrder[k].length>8),before=[...state.rankOrder[key]];
 const visible=[before[4],before[0],before[2]];movie30StoreVisibleOrder(key,visible);
 save();return {id:f.id,key,before,visible,order:[...state.rankOrder[key]]};
 })}
async function check(p,e){const s=await snapshot(p);assert(s.customFilms.some(f=>f.id===e.id));assert.equal(s.exactScores[e.id],89);assert.equal(s.letterboxdMeta[e.id].note,'保持するレビュー');assert.equal(s.letterboxdMeta[e.id].watchHistory.length,1);assert.deepEqual(s.rankOrder[e.key],e.order);for(const f of seed.customFilms)assert(s.customFilms.some(x=>x.id===f.id));for(const [id,m] of Object.entries(seed.letterboxdMeta)){if(m.note)assert.equal(s.letterboxdMeta[id]?.note,m.note);for(const h of m.watchHistory||[])assert(s.letterboxdMeta[id]?.watchHistory?.some(x=>x.id===h.id));}}
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let c,p;
 const damaged=JSON.parse(cp.execFileSync('git',['show','88ddd6bd7475f9856ec8033f90ba2f234eded127:live-state.json'],{cwd:root,encoding:'utf8',maxBuffer:20e6})).state;
 c=await context();p=await init(c,damaged);let actual=await snapshot(p);
 assert.deepEqual(actual.rankOrder,seed.rankOrder);assert.equal(actual.exactScores['lb-369-2aVk'],82);
 for(const x of JSON.parse(fs.readFileSync(path.join(root,'recovery-ranks-20261010.json'))).clearScores){assert.equal(actual.exactScores[x.id],null);assert.equal(actual.starOverrides[x.id],damaged.starOverrides[x.id]);}
 assert.equal(actual.customFilms.length,145);assert.deepEqual(actual.letterboxdMeta,damaged.letterboxdMeta);
 await restart(p);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);
 console.log('PASS damaged 726 ranks -> Oct10 721, five cleared, all 145 custom films and metadata retained after restart');
 const counts=[];for(let i=0;i<4;i++){await restart(p);counts.push(await p.evaluate(async()=>{const db=await openMovie30Db();return new Promise(resolve=>{const q=db.transaction('snapshots').objectStore('snapshots').count();q.onsuccess=()=>resolve(q.result)})}))}assert(counts.every(n=>n===counts[0]));console.log('PASS repeated startup does not grow snapshot records',counts);
 const e=await edit(p);await saved(p);
 p.on('dialog',d=>d.accept());
 assert.equal(await p.evaluate(async data=>restorePackage({state:data}),seed),true);
 await restart(p);actual=await snapshot(p);assert(actual.customFilms.some(f=>f.id===e.id));assert.equal(actual.letterboxdMeta[e.id].note,'保持するレビュー');
 for(const [k,a]of Object.entries(seed.rankOrder))assert.deepEqual(actual.rankOrder[k].filter(id=>a.includes(id)),a);
 assert.equal(await p.evaluate(()=>restorePackage({state:{rankOrder:{}}})),false);
 console.log('PASS JSON restore preserves newer additions/reviews/history; invalid import rejected; ranks survive restart');
 await p.evaluate(()=>{state.rankOrder['82']=[]});assert.equal(await p.evaluate(()=>save()),false);assert.match((await saved(p)).status,/保存停止/);await restart(p);assert((await snapshot(p)).rankOrder['82'].length>0);console.log('PASS destructive partial rank save rejected, committed data restored after restart');
 await c.close();
 // Complete-shaped but truncated newer state must not win by timestamp.
 c=await context();p=await init(c,seed);await saved(p);
 await p.evaluate(()=>{const x={...state,updatedAt:Date.now()+100000,customFilms:[],rankOrder:{},letterboxdMeta:{}};delete x.storageIntegrity;localStorage.setItem('movie30_data_v1',JSON.stringify(x))});
 await restart(p);actual=await snapshot(p);assert.deepEqual(actual.rankOrder,seed.rankOrder);assert.equal(actual.customFilms.length,145);assert.deepEqual(actual.letterboxdMeta,seed.letterboxdMeta);console.log('PASS timestamp-newer complete-shaped truncation cannot replace richer state');await c.close();
 // Integrity seal rejects a damaged payload even if it otherwise looks complete.
 c=await context();p=await init(c,seed);await saved(p);await p.evaluate(()=>{const x=JSON.parse(localStorage.getItem('movie30_data_v1'));x.rankOrder={};localStorage.setItem('movie30_data_v1',JSON.stringify(x))});await restart(p);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);console.log('PASS checksum detects partial/tampered snapshot and restores committed IDB');await c.close();
 c=await context();p=await init(c,seed);const id=seed.customFilms[0].id;await p.evaluate(id=>{state.letterboxdMeta[id]={...state.letterboxdMeta[id],note:'大きなレビュー'.repeat(900000)};save()},id);const large=await saved(p);assert.equal(large.failed,false);assert.match(large.status,/IndexedDB/);await restart(p);assert.equal((await snapshot(p)).letterboxdMeta[id].note.length,'大きなレビュー'.length*900000);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);console.log('PASS growing reviews exceed localStorage capacity, IndexedDB retains full review and ranks after restart');await c.close();
 await browser.close();console.log('ALL RECOVERY CHECKS PASSED');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});

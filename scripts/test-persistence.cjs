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
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let c,p;
 if(!process.env.PROCESS_ONLY){
 // First reproduce the shipped failure with a real quota-full localStorage.
 c=await context(true);p=await init(c,seed,{full:true,blockDB:true});
 const broken=await snapshot(p);assert.notDeepEqual(broken.rankOrder,seed.rankOrder);console.log('REPRODUCED shipped build: quota-full startup loses saved ranking');await c.close();
 for(const options of [{},{full:true},{full:true,blockDB:true},{blockLocal:true}]){
  c=await context();p=await init(c,seed,options);
  assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);
  if(options.full&&options.blockDB){const e=await edit(p),status=await saved(p);assert.equal(status.failed,true);assert.match(status.status,/保存失敗/);const disk=await p.evaluate(()=>JSON.parse(localStorage.getItem('movie30_data_v1')));assert.deepEqual(disk.rankOrder,seed.rankOrder);await c.close();console.log('PASS both stores unavailable: explicit failure, old durable data untouched');continue}
  const e=await edit(p);const st=await saved(p);assert(!st.failed);
  assert.deepEqual(e.order.filter(id=>!e.visible.includes(id)),e.before.filter(id=>!e.visible.includes(id)));
  assert.equal(e.order.length,e.before.length);await restart(p);await check(p,e);
  // Closing the page and opening another page preserves the persistent DB.
  await p.close();p=await c.newPage();await p.goto(origin+'/');await p.waitForSelector('html.movie30-ready');await check(p,e);
  await c.close();console.log('PASS add/score/review/history/filtered reorder/reload/close-open',JSON.stringify(options));
 }
 c=await context();p=await init(c,null);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);await c.close();console.log('PASS fresh install restores confirmed 726 ranks');
 c=await context();p=await init(c,seed);await p.evaluate(()=>localStorage.setItem('movie30_data_v1',JSON.stringify({updatedAt:Date.now(),rankOrder:{}})));await restart(p);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);await c.close();console.log('PASS incomplete newer record cannot overwrite valid IndexedDB');
 const partial={...seed,rankOrder:{},updatedAt:Date.now()};partial.letterboxdMeta=JSON.parse(JSON.stringify(seed.letterboxdMeta));partial.letterboxdMeta[seed.customFilms[0].id]={note:'最新の正当な変更'};
 c=await context();p=await init(c,partial);assert.deepEqual((await snapshot(p)).rankOrder,seed.rankOrder);assert.equal((await snapshot(p)).letterboxdMeta[seed.customFilms[0].id].note,'最新の正当な変更');await c.close();console.log('PASS missing 726 ranks restored from confirmed record without replacing latest review');
 }
 const profiles=path.resolve(root,'..','browser-profiles');fs.mkdirSync(profiles,{recursive:true});
 const profile=fs.mkdtempSync(path.join(profiles,'movie-save-regression-'));
 const opts={executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true};
 let pc=persistent=await chromium.launchPersistentContext(profile,opts);await route(pc);p=await init(pc,seed,{blockLocal:true});const pe=await edit(p);assert.equal((await saved(p)).failed,false);assert(JSON.parse((await p.evaluate(()=>movie30ReadSnapshot())).json).customFilms.some(f=>f.id===pe.id));await pc.close();
 pc=persistent=await chromium.launchPersistentContext(profile,opts);await route(pc);p=await pc.newPage();await p.goto(origin+'/');await p.waitForSelector('html.movie30-ready');await check(p,pe);await pc.close();console.log('PASS browser process shutdown and restart: IndexedDB-only changes persist');
 // Real pointer drag and animated arrows are tested separately in touch suite.
 await browser.close();console.log('ALL PERSISTENCE CHECKS PASSED');
})().catch(async e=>{console.error(e);await persistent?.close();await browser?.close();process.exitCode=1});

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
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const c=await context(),p=await init(c,seed);await saved(p);
 const fixture=await p.evaluate(()=>{for(const [k,ids]of Object.entries(state.rankOrder)){const groups={};for(const id of ids){for(const g of state.genreOverrides[id]||[])(groups[g]??=[]).push(id)}for(const [cat,shown]of Object.entries(groups))if(shown.length>=2&&shown.length<ids.length){const from=ids.find((id,i)=>shown.includes(id)&&shown.includes(ids[i+1]));if(from)return {k,cat,shown,from,before:[...ids]}}}throw Error('No partial category fixture')});
 await p.evaluate(()=>{const e=document.getElementById('advBox66');e.classList.add('movie96-is-open','open');e.style.display='block'});await p.locator('#advBox66 [data-inc]').filter({hasText:fixture.cat}).first().click({force:true});await p.waitForTimeout(250);
 const from=fixture.from;await p.evaluate(id=>{window.__movie30FocusRankCard(id);document.querySelector('.rank-card[data-id="'+id+'"]').scrollIntoView({block:'center'})},from);
 await p.locator('.rank-card[data-id="'+from+'"] [data-sw="1"]').click({force:true});await p.waitForTimeout(120);assert.equal(await p.locator('.movie30-floating-drag').count(),1);await p.waitForTimeout(900);await saved(p);
 const changed=(await snapshot(p)).rankOrder[fixture.k];assert.notDeepEqual(changed,fixture.before);assert.deepEqual(changed.filter(id=>!fixture.shown.includes(id)),fixture.before.filter(id=>!fixture.shown.includes(id)));assert.equal(changed.length,fixture.before.length);
 await restart(p);assert.deepEqual((await snapshot(p)).rankOrder[fixture.k],changed);console.log('PASS actual filtered arrow swap preserves hidden slots and order after restart',fixture.k,fixture.cat);
 await c.close();await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});


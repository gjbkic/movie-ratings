/* Production-company library. Uses the user's existing TMDb credential locally.
   Never changes film ratings, ranking, original title metadata or comparison history.
   Company metadata is stored per film in state.letterboxdMeta[id].studio130,
   so existing backup/import/export and state normalization preserve it. */
(()=>{
'use strict';
const VERSION='20261120-studio-metadata-v130',KEY='studio130';
const getFilmMeta=f=>state.letterboxdMeta?.[f.id]||{};
const record=f=>f&&getFilmMeta(f)[KEY]||null;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const safeText=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const yearOf=f=>Number(f?.year)||0;
const isTv=f=>{
 const m=getFilmMeta(f),p=m.poster84;
 return p?.mediaKind84==='tv'||['tv_episode','tv_series'].includes(m.contentType)||
  ['drama','series'].includes(String(state.mediaTypeOverrides?.[f.id]||f.mediaType||''));
};
const normCompany=x=>({id:Number(x.id)||0,name:String(x.name||'').trim()});
function nameAliases(f){
 const t=typeof titleInfo==='function'?titleInfo(f):{};
 const m=getFilmMeta(f);
 // Never use the candidate poster's matched title as evidence that the
 // candidate itself belongs to the selected film.
 return [...new Set([f.title,f.lbTitle,f.originalTitle,f.englishTitle,
  t.title,t.originalTitle,t.englishTitle,m.englishTitle,m.originalTitle]
  .map(safeText).filter(Boolean))];
}
function matchTitle(f,d){
 const titles=nameAliases(f),options=[d.title,d.original_title,d.name,d.original_name];
 return options.some(x=>titles.includes(safeText(x)));
}
function matchYear(f,d,kind){
 const y=yearOf(f),remote=Number(String(
  kind==='tv'?d.first_air_date:d.release_date||'').slice(0,4));
 // A TV episode can be much later than its parent series; do not trust an
 // unverified series ID solely because an episode uses a series poster.
 return !y||!remote||Math.abs(y-remote)<=1;
}
const active=new Map(),requestCache=new Map();
let batchRunning=false,stopRequested=false,batchProgress={done:0,total:0,ok:0,skipped:0,failed:0};
const knownCustom=new Set();
const queue=[],queued=new Set();let draining=false;
async function tmdb(path,params={language:'en-US'}){
 let retry=0;
 for(;;){
  try{return await tmdbFetch(path,params)}
  catch(e){
   if(!/HTTP 429|HTTP 500|HTTP 502|HTTP 503|HTTP 504/.test(String(e?.message||''))||retry++>=2)throw e;
   await wait(1200*retry);
  }
 }
}
function potential(f){
 const m=getFilmMeta(f),raw=m.poster84||{},kind=isTv(f)?'tv':'movie';
 const t=typeof titleInfo==='function'?titleInfo(f):{};
 const identity=safeText(t.englishTitle||t.title||t.originalTitle||f.title)+'|'+yearOf(f);
 // If the film's title/year was edited, reject an old poster ID instead of
 // attributing somebody else's production companies to the new title.
 const p=raw.checkedIdentity84&&raw.checkedIdentity84!==identity?{}:raw;
 // Only use poster IDs that were checked for the current title, or test the
 // returned details again. An old unverified poster can be the wrong film.
 const fromPoster=Number(p.tmdbId)||0;
 const fromFilm=Number(f.tmdbId)||0;
 const fromMeta=Number(kind==='tv'?m.tmdbSeriesId:m.tmdbId)||0;
 const id=fromPoster||fromFilm||fromMeta;
 return {kind,id,trusted:!!(fromPoster&&p.validated84&&
   (p.mediaKind84===kind||!p.mediaKind84))};
}
async function details(kind,id){
 const key=kind+':'+id;
 if(requestCache.has(key))return requestCache.get(key);
 const promise=tmdb('/'+kind+'/'+id);
 requestCache.set(key,promise);
 try{return await promise}catch(e){requestCache.delete(key);throw e}
}
async function discover(f,kind){
 // Only automatically select an unambiguous title/year match. Never guess
 // based on popularity or a matching poster alone.
 const aliases=[f.englishTitle,f.originalTitle,f.title,f.lbTitle].filter(Boolean);
 for(const title of [...new Set(aliases)].slice(0,3)){
  const list=await tmdb('/search/'+kind,{query:title,language:'en-US'});
  const valid=(list.results||[]).filter(hit=>matchTitle(f,hit)&&matchYear(f,hit,kind));
  const ids=[...new Set(valid.map(x=>Number(x.id)).filter(Number.isInteger))];
  if(ids.length===1)return details(kind,ids[0]);
  if(ids.length>1)return null;
 }
 return null;
}
async function fetchCompany(f,force=false,quiet=false){
 if(!f||!filmById(f.id))return {status:'missing'};
 if(!force&&record(f)?.checkedAt)return {status:'cached',record:record(f)};
 if(!getTmdbCredential())return {status:'no-key'};
 if(active.has(f.id))return active.get(f.id);
 const job=(async()=>{
  const {kind,id,trusted}=potential(f);
  let d=null;
  if(id){
   try{
    d=await details(kind,id);
    if(!trusted&&(!matchTitle(f,d)||!matchYear(f,d,kind)))d=null;
   }catch(e){
    if(!/HTTP (404|422)/.test(String(e?.message||'')))throw e;
   }
  }
  if(!d)d=await discover(f,kind);
  if(!d)return {status:'unmatched'};
  const companies=[...new Map((d.production_companies||[]).map(normCompany)
   .filter(x=>x.id>0&&x.name).map(x=>[x.id,x])).values()];
  // Television broadcaster/network is *not* a production company.
  const item={source:'tmdb',checkedAt:new Date().toISOString(),
   kind,tmdbId:Number(d.id),companies};
  // Verify the film still exists before making a metadata-only change.
  if(!filmById(f.id))return {status:'missing'};
  state.letterboxdMeta=state.letterboxdMeta||{};
  const meta=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
  meta[KEY]=item;
  if(!quiet){save();dispatch()}
  if(selectedId===f.id)renderSheet(f.id);
  return {status:'fetched',record:item};
 })().catch(e=>({status:'error',error:String(e?.message||e)}))
  .finally(()=>active.delete(f.id));
 active.set(f.id,job);return job;
}
function aggregate(){
 const counts=new Map();let fetched=0,empty=0;
 const films=allFilms();
 for(const f of films){
  const r=record(f);
  if(!r?.checkedAt)continue;
  fetched++;
  if(!r.companies?.length)empty++;
  for(const c of r.companies||[]){
   if(!counts.has(c.id))counts.set(c.id,{id:c.id,name:c.name,count:0});
   counts.get(c.id).count++;
  }
 }
 return {total:films.length,fetched,missing:films.length-fetched,empty,
  unique:counts.size,companies:[...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))};
}
function aliases(company){
 const n=String(company.name||'');
 const labels=[];
 if(/studio ghibli/i.test(n))labels.push('スタジオジブリ','ジブリ');
 if(/disney/i.test(n))labels.push('ディズニー');
 if(/pixar/i.test(n))labels.push('ピクサー');
 if(/lucasfilm/i.test(n))labels.push('ルーカスフィルム');
 if(/marvel studios/i.test(n))labels.push('マーベルスタジオ');
 if(/toho/i.test(n))labels.push('東宝');
 if(/toei/i.test(n))labels.push('東映');
 if(/shochiku/i.test(n))labels.push('松竹');
 if(/universal/i.test(n))labels.push('ユニバーサル');
 if(/warner bros/i.test(n))labels.push('ワーナー');
 if(/a24/i.test(n))labels.push('A24');
 return labels.join(' ');
}
function searchable(f){
 const studios=record(f)?.companies||[];
 return studios.map(c=>c.name+' '+aliases(c)).join(' ');
}
function fits(f,q){
 if(!q)return true;
 const text=safeText(searchable(f)),parts=String(q).trim().split(/\s+/).map(safeText).filter(Boolean);
 return parts.every(q=>text.includes(q));
}
function dispatch(){
 window.dispatchEvent(new Event('movie30-studio-update'));
}
async function fetchBulk(){
 if(batchRunning)return;
 if(!getTmdbCredential()){alert('TMDbのキー／トークンを「データ」タブで設定してください。');return}
 batchRunning=true;stopRequested=false;
 const todo=allFilms().filter(f=>!record(f)?.checkedAt);
 batchProgress={done:0,total:todo.length,ok:0,skipped:0,failed:0};
 dispatch();
 try{
  // Two workers, bounded rate. Saves each small group so the user can stop
  // or leave/reopen the app without losing completed metadata.
  let cursor=0,saved=0;
  async function worker(){
   while(cursor<todo.length&&!stopRequested){
    const f=todo[cursor++];
    const result=await fetchCompany(f,false,true);
    batchProgress.done++;
    if(result.status==='fetched'||result.status==='cached')batchProgress.ok++;
    else if(result.status==='error')batchProgress.failed++;
    else batchProgress.skipped++;
    saved++;
    if(saved>=8){saved=0;save();dispatch()}
    await wait(300);
   }
  }
  await Promise.all([worker(),worker()]);
  save();
 }finally{batchRunning=false;dispatch()}
}
function stop(){stopRequested=true}
function progress(){return {...batchProgress,running:batchRunning}}
function queueAuto(f){
 if(!f||queued.has(f.id)||record(f)?.checkedAt||!getTmdbCredential())return;
 queued.add(f.id);queue.push(f.id);
 if(!draining)void drain();
}
async function drain(){
 draining=true;
 try{
  while(queue.length){
   const id=queue.shift();queued.delete(id);
   const f=filmById(id);
   if(f&&!record(f)?.checkedAt){
    await fetchCompany(f,false,false);
    await wait(350);
   }
  }
 }finally{draining=false}
}
function renderSheet(id){
 const panel=document.getElementById('movie30ProductionPanel');
 if(!panel||!filmById(id))return;
 const f=filmById(id),r=record(f);
 const text=r?.companies?.length?r.companies.map(c=>c.name).join('、'):
  r?.checkedAt?'TMDbに制作会社の登録なし':'未取得';
 const escHTML=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 panel.innerHTML='<h3>制作会社（TMDb）</h3>'+
  '<p>'+escHTML(text)+'</p><button type="button" id="movie30ProductionFetch">制作会社を取得／更新</button>'+
  (r?.checkedAt?'<small> 最終取得 '+escHTML(r.checkedAt.slice(0,10))+'</small>':'');
 const btn=panel.querySelector('#movie30ProductionFetch');
 btn.onclick=async()=>{
  btn.disabled=true;btn.textContent='取得中…';
  const result=await fetchCompany(f,true,false);
  if(result.status==='error'||result.status==='unmatched'||result.status==='no-key'){
   btn.textContent=result.status==='no-key'?'TMDbキー未設定':'取得失敗・再試行可';
   btn.disabled=false;
  }else renderSheet(id);
 };
}
function installSheet(){
 const host=document.querySelector('#sheetBg .sheet');
 if(!host||document.getElementById('movie30ProductionPanel'))return;
 const panel=document.createElement('section');
 panel.id='movie30ProductionPanel';panel.className='watch83-editor';
 host.insertBefore(panel,document.getElementById('closeSheet')||null);
 if(typeof openSheet==='function'){
  const original=openSheet;
  openSheet=function(id){original(id);renderSheet(id)};
 }
}
function installHooks(){
 const custom=state.customFilms||[];
 for(const f of custom)knownCustom.add(f.id);
 // Existing custom/Letterboxd imports may add films directly rather than
 // calling addFilm; detect those on the next ordinary save.
 if(typeof save==='function'){
  const originalSave=save;
  save=function(...args){
   const output=originalSave.apply(this,args);
   if(!window.__movie30BulkBoot){
    for(const f of state.customFilms||[]){
     if(knownCustom.has(f.id))continue;
     knownCustom.add(f.id);
     queueAuto(f);
    }
   }
   return output;
  };
 }
 if(typeof addFilm==='function'){
  const originalAdd=addFilm;
  addFilm=function(...args){const f=originalAdd.apply(this,args);if(f)queueAuto(f);return f};
 }
 // Reuse the main movie-list search field; companies are not mixed into
 // genre labels, but can still be searched by their own names.
 if(typeof match==='function'){
  const originalMatch=match;
  match=function(f,q){return originalMatch(f,q)||
   !!(q&&String(q).trim()&&record(f)?.companies?.length&&fits(f,q))};
 }
 installSheet();
}
window.__movie30Studios={
 version:VERSION,entry:record,stats:aggregate,searchable,fits,aliases,
 fetchOne:fetchCompany,fetchBulk,stop,progress,hasKey:()=>!!getTmdbCredential()
};
Promise.resolve(window.__movie30StorageReady).then(()=>{
 if(window.__movie30RecoveryBlocked)return;
 installHooks();
}).catch(()=>{});
})();

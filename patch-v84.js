(() => {
'use strict';
// v84: source-aware TMDb director (films), show creator and episode director (TV).
// Stored in letterboxdMeta only; score/rank and review data are untouched.
const BUILD='20261011b';
const unique=names=>[...new Set((names||[]).map(v=>String(v||'').trim()).filter(Boolean))];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=new Map();
const meta=id=>(state.letterboxdMeta=state.letterboxdMeta||{},
  state.letterboxdMeta[id]=state.letterboxdMeta[id]||{});
function details(f){
  const m=state.letterboxdMeta?.[f.id]||{};
  const names=m.crew84||{};
  return {directors:m.directors84Manual||names.directors||[],creators:names.creators||[],
    stored:!!names.fetchedAt,source:names.source||'',fetchedAt:names.fetchedAt||''};
}
async function retrieve(f,force=false){
  if(!f||!filmById(f.id))return null;
  const m=meta(f.id);
  if(!force&&m.crew84?.fetchedAt)return m.crew84;
  if(!getTmdbCredential())throw Error('「データ」タブでTMDb APIキー／トークンを設定してください');
  if(active.has(f.id))return active.get(f.id);
  const job=(async()=>{
    const kind=m.contentType||((state.mediaTypeOverrides?.[f.id]==='drama')?'tv_series':'movie');
    const people={directors:[],creators:[],source:'tmdb',fetchedAt:new Date().toISOString()};
    if(kind==='tv_episode'||kind==='tv_series'){
      const id=Number(m.tmdbSeriesId)||0;
      if(!id)throw Error('TMDbシリーズIDが未登録です。ドラマの各話照合を先に実行してください');
      const tv=await tmdbFetch('/tv/'+id,{language:'en-US'});
      people.creators=unique((tv.created_by||[]).map(x=>x.name));
      if(kind==='tv_episode'&&m.seasonNumber!=null&&m.episodeNumber!=null){
        const ep=await tmdbFetch('/tv/'+id+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber,{language:'en-US'});
        people.directors=unique((ep.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
      }
    }else{
      const id=Number(titleInfo(f).tmdbId||f.tmdbId)||0;
      if(!id)throw Error('作品のTMDb映画IDが未登録です');
      const response=await tmdbFetch('/movie/'+id+'/credits',{language:'en-US'});
      people.directors=unique((response.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
    }
    // Metadata only. Never touch exactScores, rankOrder, starOverrides or notes.
    if(filmById(f.id)){
      meta(f.id).crew84=people;save(false);
      if(selectedId===f.id)drawCrew(f.id);
      populateInWatchList();
    }
    return people;
  })().finally(()=>active.delete(f.id));
  active.set(f.id,job);return job;
}
let panel=null;
const sheet=document.querySelector('#sheetBg .sheet');
const watchSection=document.getElementById('watchEditor83');
if(sheet){
  panel=document.createElement('section');
  panel.id='directorPanel84';panel.className='watch83-editor';
  if(watchSection)sheet.insertBefore(panel,watchSection);
  else sheet.insertBefore(panel,document.getElementById('closeSheet'));
}
function drawCrew(id){
  if(!panel)return;
  const f=filmById(id);if(!f){panel.innerHTML='';return;}
  const d=details(f),m=state.letterboxdMeta?.[id]||{};
  const tv=m.contentType==='tv_episode'||m.contentType==='tv_series';
  const directors=d.directors.join('、');
  const creators=d.creators.join('、');
  const empty=d.stored?'TMDbに該当する記載なし':'未取得';
  panel.innerHTML='<h3>監督・制作スタッフ（TMDb）</h3>'
    +'<p>'+(tv?'各話の監督：':'監督：')+'<strong>'+esc(directors||empty)+'</strong></p>'
    +(tv?'<p>シリーズの製作者：<strong>'+esc(creators||empty)+'</strong></p>':'')
    +'<button type="button" id="getDirector84">TMDbから監督・制作者を取得／更新</button>'
    +'<small id="directorStatus84">'+(d.fetchedAt?'最終取得：'+esc(d.fetchedAt.slice(0,10)):'')+'</small>';
  const b=panel.querySelector('#getDirector84');
  b.onclick=async()=>{
    b.disabled=true;
    panel.querySelector('#directorStatus84').textContent='取得中…';
    try{await retrieve(f,true)}
    catch(e){const el=panel.querySelector('#directorStatus84');if(el)el.textContent='取得できません：'+(e?.message||e);}
    finally{b.disabled=false;}
  };
}
function populateInWatchList(){
  const root=document.getElementById('watchList83');if(!root||root.style.display==='none')return;
  root.querySelectorAll('[data-film]').forEach(button=>{
    const id=decodeURIComponent(button.dataset.film),f=filmById(id);
    if(!f)return;
    const d=details(f),directors=d.directors.length?d.directors:d.creators;
    const old=button.querySelector('[data-director84]');
    if(old)old.remove();
    if(!directors.length)return;
    const small=document.createElement('small');small.dataset.director84='1';
    small.textContent='監督／製作者：'+directors.join('、');
    button.appendChild(small);
  });
}
const openBefore=openSheet;
openSheet=function(...args){
  const result=openBefore.apply(this,args);
  drawCrew(args[0]);
  return result;
};
const renderRankBefore=renderRank;
renderRank=function(...args){
  const result=renderRankBefore.apply(this,args);
  populateInWatchList();
  return result;
};
// Credit lookup for freshly imported films and manually added TMDb films.
const addBefore=addFilm;
addFilm=function(...args){
  const f=addBefore.apply(this,args);
  if(f&&getTmdbCredential()&&f.tmdbId){
    Promise.resolve().then(()=>retrieve(f)).catch(()=>{});
  }
  return f;
};
const addLetterboxdBefore=addLbFilm;
addLbFilm=function(...args){
  const f=addLetterboxdBefore.apply(this,args);
  // TV import finishes assigning series/episode metadata before this callback.
  if(f&&getTmdbCredential()){
    Promise.resolve().then(()=>retrieve(f)).catch(()=>{});
  }
  return f;
};
// Some episode metadata is attached by the sync wrapper after creating new rows.
const syncBefore=syncLetterboxd;
syncLetterboxd=async function(...args){
  const start=new Set(allFilms().map(f=>f.id));
  const result=await syncBefore.apply(this,args);
  if(result!==false&&getTmdbCredential()){
    const fresh=allFilms().filter(f=>!start.has(f.id));
    for(const f of fresh)if(!details(f).stored)retrieve(f).catch(()=>{});
  }
  return result;
};
const lb=document.getElementById('syncLetterboxd');
if(lb)lb.onclick=()=>syncLetterboxd(false);
const data=document.getElementById('page-data');
if(data&&!document.getElementById('directorTool84')){
  const box=document.createElement('div');
  box.id='directorTool84';box.className='panel';
  box.innerHTML='<h2>監督・制作者の取得</h2>'
    +'<p class="tip">映画はTMDbの映画クレジットから監督を取得。ドラマはシリーズ制作者と、登録されていれば各話監督を取得します。取得結果はアプリ内に保存されます。</p>'
    +'<div class="tools"><button class="btn" type="button" id="batchDirector84">監督を未取得の15作品から取得</button></div>'
    +'<div class="sync-status" id="directorBatchStatus84"></div>';
  data.insertBefore(box,data.firstChild);
  const button=box.querySelector('#batchDirector84');
  button.onclick=async()=>{
    const status=box.querySelector('#directorBatchStatus84');
    if(!getTmdbCredential()){status.textContent='「データ」タブでTMDbキーを設定してください';return;}
    button.disabled=true;
    const target=allFilms().filter(f=>!details(f).stored&&(
      Number(titleInfo(f).tmdbId||f.tmdbId)||
      Number(state.letterboxdMeta?.[f.id]?.tmdbSeriesId))).slice(0,15);
    let ok=0,ng=0;
    try{
      for(const f of target){
        try{await retrieve(f);ok++}catch(_){ng++}
        status.textContent='取得中 '+(ok+ng)+'/'+target.length+'件';
      }
      status.textContent='監督・制作者 '+ok+'件を取得、失敗 '+ng+'件。次回クリックすると次の未取得作品を調べます。';
    }finally{button.disabled=false;}
  };
}
populateInWatchList();
window.__movie30TmdbCreditsV84={build:BUILD};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

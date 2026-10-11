(() => {
'use strict';
// v84: source-aware TMDb director (films), show creator and episode director (TV).
// Stored in letterboxdMeta only; score/rank and review data are untouched.
const BUILD='20261011f';
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
      meta(f.id).crew84=people;save();
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

// Lazy, non-blocking poster library. Film scores, reviews and ranks are untouched.
const POSTER_CDN84='https://image.tmdb.org/t/p/';
const posterValid84=path=>typeof path==='string'&&/^\/[a-zA-Z0-9_\-./]+\.(jpg|jpeg|png|webp)$/i.test(path)&&!path.includes('..');
const posterMeta84=f=>state.letterboxdMeta?.[f.id]?.poster84||null;
const posterUrl84=(path,size='w185')=>posterValid84(path)?POSTER_CDN84+size+path:'';
function normPoster84(t){return String(t||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
const posterTasks84=[],queuedPoster84=new Set();let fetchingPoster84=0,savePosterTimer84=0;
let posterIntersection84=null;
function cachePoster84(f,poster){
  if(!filmById(f.id))return;
  state.letterboxdMeta=state.letterboxdMeta||{};
  const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
  m.poster84=poster;
  if(savePosterTimer84)clearTimeout(savePosterTimer84);
  savePosterTimer84=setTimeout(()=>{savePosterTimer84=0;save();},4000);
}
async function loadPoster84(f,force=false){
  if(!f) return null;
  const old=posterMeta84(f);
  if(!force&&posterValid84(old?.path))return old.path;
  if(!force&&old?.checkedAt&&Date.now()-Date.parse(old.checkedAt)<14*86400000)return null;
  if(!getTmdbCredential())return null;
  const m=state.letterboxdMeta?.[f.id]||{};
  const tv=m.contentType==='tv_episode'||m.contentType==='tv_series';
  const stamp=new Date().toISOString();
  let path=null,matchedId=null;
  if(tv){
    let id=Number(m.tmdbSeriesId)||0;
    if(!id){
      const candidate=(m.englishTitle||titleInfo(f).englishTitle||f.lbTitle||f.title||'').split(':')[0].trim();
      if(candidate){
        const result=await tmdbFetch('/search/tv',{query:candidate,language:'en-US'});
        const hit=(result.results||[]).find(x=>normPoster84(x.name)===normPoster84(candidate));
        id=Number(hit?.id)||0;
      }
    }
    if(id){
      const details=await tmdbFetch('/tv/'+id,{language:'ja-JP'});
      path=details.poster_path||null;
      matchedId=id;
    }
  }else{
    let id=Number(m.poster84?.tmdbId||titleInfo(f).tmdbId||f.tmdbId)||0;
    if(id){
      const details=await tmdbFetch('/movie/'+id,{language:'ja-JP'});
      path=details.poster_path||null;
      matchedId=id;
    }else{
      const t=titleInfo(f);
      const english=t.englishTitle||f.lbTitle||t.originalTitle||t.title||'';
      const y=Number(f.year)||0;
      if(english){
        const result=await tmdbFetch('/search/movie',{query:english,language:'en-US',include_adult:'false'});
        const aliases=[english,t.originalTitle,t.title].map(normPoster84).filter(Boolean);
        const hit=(result.results||[]).find(x=>
          aliases.includes(normPoster84(x.title))||aliases.includes(normPoster84(x.original_title)));
        const eligible=hit&&(!y||!hit.release_date||Math.abs(Number(hit.release_date.slice(0,4))-y)<=2);
        if(eligible){path=hit.poster_path||null;matchedId=hit.id;}
      }
    }
  }
  cachePoster84(f,{path:posterValid84(path)?path:null,tmdbId:matchedId,checkedAt:stamp,provider:'tmdb'});
  return posterValid84(path)?path:null;
}
function setPosterSources84(id,path){
  if(!posterValid84(path))return;
  document.querySelectorAll('.movie30-poster84[data-poster-id]').forEach(img=>{
    if(img.dataset.posterId!==id)return;
    const url=posterUrl84(path,img.dataset.posterSize||'w185');
    if(url&&img.getAttribute('src')!==url)img.src=url;
    img.classList.add('movie30-poster-loaded84');
  });
}
function queuePoster84(f,force=false){
  if(!f||!getTmdbCredential())return;
  const p=posterMeta84(f);
  if(!force&&posterValid84(p?.path)){setPosterSources84(f.id,p.path);return;}
  if(!force&&p?.checkedAt&&Date.now()-Date.parse(p.checkedAt)<14*86400000)return;
  if(queuedPoster84.has(f.id))return;
  queuedPoster84.add(f.id);posterTasks84.push({id:f.id,force});runPosterQueue84();
}
function runPosterQueue84(){
  while(fetchingPoster84<3&&posterTasks84.length){
    const item=posterTasks84.shift();
    const f=filmById(item.id);
    if(!f){queuedPoster84.delete(item.id);continue;}
    fetchingPoster84++;
    Promise.resolve().then(()=>loadPoster84(f,item.force)).then(path=>{
      if(path)setPosterSources84(item.id,path);
      if(selectedId===item.id)drawPosterDetail84(item.id);
    }).catch(e=>{
      // Abort/retry errors are intentionally not persisted as a missing poster.
      if(selectedId===item.id){
        const target=document.getElementById('posterStatus84');
        if(target)target.textContent='ポスターを取得できません：'+String(e?.message||e);
      }
    }).finally(()=>{queuedPoster84.delete(item.id);fetchingPoster84--;runPosterQueue84();});
  }
}
function observePoster84(img,f){
  const p=posterMeta84(f);
  if(posterValid84(p?.path)){
    img.src=posterUrl84(p.path,img.dataset.posterSize||'w185');img.classList.add('movie30-poster-loaded84');
    return;
  }
  if(!getTmdbCredential())return;
  if(!posterIntersection84&&typeof IntersectionObserver==='function'){
    posterIntersection84=new IntersectionObserver(changes=>{
      for(const e of changes)if(e.isIntersecting){
        posterIntersection84.unobserve(e.target);
        const film=filmById(e.target.dataset.posterId);
        if(film)queuePoster84(film);
      }
    },{rootMargin:'250px'});
  }
  if(posterIntersection84)posterIntersection84.observe(img);
  else if(document.querySelectorAll('.movie30-poster84:not([src])').length<=12)queuePoster84(f);
}
function putPoster84(el,id,mode){
  if(el.querySelector('.movie30-poster84'))return;
  const f=filmById(id);if(!f)return;
  const img=document.createElement('img');img.className='movie30-poster84';img.dataset.posterId=id;
  img.dataset.posterSize=mode==='detail'?'w342':'w185';
  img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  el.classList.add(mode==='rank'?'movie30-rank-poster84':'movie30-watch-poster84');
  el.appendChild(img);
  observePoster84(img,f);
}
function decoratePosters84(){
  const rank=document.getElementById('rankRoot');
  if(rank&&rank.style.display!=='none'){
    rank.querySelectorAll('.rank-card[data-id]').forEach(el=>putPoster84(el,decodeURIComponent(el.dataset.id),'rank'));
  }
  const watch=document.getElementById('watchList83');
  if(watch&&watch.style.display!=='none'){
    watch.querySelectorAll('.watch83-item[data-film]').forEach(el=>
      putPoster84(el,decodeURIComponent(el.dataset.film),'watch'));
  }
}
window.__movie30PosterDecorate84=decoratePosters84;
const posterStyles84=document.createElement('style');
posterStyles84.textContent=
 '.rank-card.movie30-rank-poster84{position:relative;padding-left:43px;min-height:53px}'
 +'.movie30-rank-poster84>.movie30-poster84{position:absolute;left:5px;top:50%;transform:translateY(-50%);width:30px;height:45px;object-fit:cover;pointer-events:none}'
 +'.watch83-item.movie30-watch-poster84{position:relative;padding-left:70px;min-height:92px}'
 +'.movie30-watch-poster84>.movie30-poster84{position:absolute;top:8px;left:9px;width:50px;height:75px;object-fit:cover;pointer-events:none}'
 +'.movie30-poster84{display:block;border-radius:5px;background:linear-gradient(155deg,#21334b,#101823);border:1px solid #3f4d5f;color:transparent}'
 +'.movie30-poster-detail84{display:flex;align-items:flex-start;gap:12px;margin:9px 0 12px;font-size:12px}'
 +'.movie30-poster-detail84 img{width:88px;height:132px;object-fit:cover;background:#21334b;border-radius:7px;border:1px solid #465569}'
 +'.movie30-poster-detail84 button{font-size:12px;border:1px solid #475569;border-radius:7px;background:#192b40;color:#eef4ff;padding:8px}'
 +'.movie30-poster-detail84 small{display:block;color:#aabbd0;line-height:1.5;margin:7px 0}';
document.head.appendChild(posterStyles84);
let posterDetail84=null;
const posterSheet84=document.querySelector('#sheetBg .sheet');
if(posterSheet84){
  posterDetail84=document.createElement('section');
  posterDetail84.id='movie30PosterDetail84';posterDetail84.className='movie30-poster-detail84';
  const header=posterSheet84.querySelector('.sheet-title');
  if(header)header.insertAdjacentElement('afterend',posterDetail84);
}
function drawPosterDetail84(id){
  if(!posterDetail84)return;
  const f=filmById(id);if(!f)return;
  const m=posterMeta84(f),url=posterUrl84(m?.path,'w342');
  posterDetail84.innerHTML='<img class="movie30-poster84" data-poster-id="'+encodeURIComponent(id)
    +'" data-poster-size="w342" alt="ポスター" loading="lazy"'+(url?' src="'+url+'"':'')+'>'
    +'<div><button type="button" id="posterReload84">TMDbからポスター取得・更新</button>'
    +'<small id="posterStatus84">'+(url?'ポスター取得済み':getTmdbCredential()?'未取得：画面に表示されると自動取得します':'TMDb APIキーを設定すると取得できます')
    +'</small><small>画像提供：The Movie Database (TMDb)</small></div>';
  const img=posterDetail84.querySelector('img');
  if(img)observePoster84(img,f);
  const btn=posterDetail84.querySelector('#posterReload84');
  if(btn)btn.onclick=()=>{
    const status=posterDetail84.querySelector('#posterStatus84');
    status.textContent=getTmdbCredential()?'更新中…':'TMDb APIキーが必要です';
    if(getTmdbCredential())queuePoster84(f,true);
  };
}

const openBefore=openSheet;
openSheet=function(...args){
  const result=openBefore.apply(this,args);
  drawCrew(args[0]);
  drawPosterDetail84(args[0]);
  return result;
};
const renderRankBefore=renderRank;
renderRank=function(...args){
  const result=renderRankBefore.apply(this,args);
  populateInWatchList();
  decoratePosters84();
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
decoratePosters84();
window.__movie30TmdbCreditsV84={build:BUILD};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

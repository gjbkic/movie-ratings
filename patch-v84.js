(() => {
'use strict';
// v84: source-aware TMDb director (films), show creator and episode director (TV).
// Stored in letterboxdMeta only; score/rank and review data are untouched.
const BUILD='20261011j';
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
const crewDelay84=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const crewMissing84=(f)=>{
  const m=state.letterboxdMeta?.[f.id]||{};
  if(m.crew84?.fetchedAt)return false;
  const fail=m.crew84Failure,age=Date.now()-Number(fail?.at||0);
  if(fail&&age<(fail.retryAfterMs||14*86400000))return false;
  return true;
};
async function crewLookupMovie84(f,m){
  const known=Number(m.poster84?.tmdbId||titleInfo(f).tmdbId||f.tmdbId)||0;
  if(known)return known;
  const t=titleInfo(f),name=t.englishTitle||f.lbTitle||t.originalTitle||t.title||'';
  if(!name)throw Error('作品名が未設定です');
  const year=Number(f.year)||0;
  let response=await tmdbFetch('/search/movie',{query:name,language:'en-US',include_adult:'false'});
  let results=response?.results||[];
  const aliases=[name,t.title,t.originalTitle,t.englishTitle,f.lbTitle]
    .map(v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')).filter(Boolean);
  function choose(list){
    const hits=list.filter(item=>{
      const names=[item.title,item.original_title].map(v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,''));
      const dateYear=Number((item.release_date||'').slice(0,4))||0;
      return names.some(v=>aliases.includes(v))&&(!year||!dateYear||Math.abs(dateYear-year)<=2);
    });
    return hits.length===1?hits[0]:null;
  }
  let hit=choose(results);
  if(!hit&&year){
    response=await tmdbFetch('/search/movie',{query:name,year,language:'en-US',include_adult:'false'});
    results=response?.results||[];
    hit=choose(results);
  }
  if(!hit?.id)throw Error('作品名・公開年に一致するTMDb映画が見つかりません');
  return Number(hit.id);
}
async function crewLookupTv84(f,m){
  const existing=Number(m.tmdbSeriesId||m.poster84?.tmdbId)||0;
  if(existing)return existing;
  const ti=titleInfo(f);
  const original=(m.englishTitle||ti.englishTitle||f.lbTitle||ti.title||'');
  const query=original.includes(':')?original.split(':')[0].trim():original.trim();
  if(!query)throw Error('ドラマのシリーズ名がありません');
  const result=await tmdbFetch('/search/tv',{query,language:'en-US'});
  const key=String(query).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const candidates=(result.results||[]).filter(x=>
    [x.name,x.original_name].some(n=>String(n||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')===key));
  if(candidates.length!==1||!candidates[0]?.id)throw Error('シリーズ名がTMDbで一意に照合できません');
  return Number(candidates[0].id);
}
async function retrieve(f,force=false,batchMode=false){
  if(!f||!filmById(f.id))return null;
  const m=meta(f.id);
  if(!force&&m.crew84?.fetchedAt)return m.crew84;
  if(!getTmdbCredential())throw Error('TMDbキーが未設定です');
  if(active.has(f.id))return active.get(f.id);
  const job=(async()=>{
    const kind=m.contentType||((state.mediaTypeOverrides?.[f.id]==='drama')?'tv_series':'movie');
    const people={directors:[],creators:[],source:'tmdb',fetchedAt:new Date().toISOString()};
    if(kind==='tv_episode'||kind==='tv_series'){
      const id=await crewLookupTv84(f,m);
      const tv=await tmdbFetch('/tv/'+id,{language:'en-US'});
      people.creators=unique((tv.created_by||[]).map(x=>x.name));
      if(kind==='tv_episode'&&m.seasonNumber!=null&&m.episodeNumber!=null){
        const ep=await tmdbFetch('/tv/'+id+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber,{language:'en-US'});
        people.directors=unique((ep.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
      }
    }else{
      const id=await crewLookupMovie84(f,m);
      const response=await tmdbFetch('/movie/'+id+'/credits',{language:'en-US'});
      people.directors=unique((response.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
    }
    if(filmById(f.id)){
      const target=meta(f.id);
      target.crew84=people;
      delete target.crew84Failure;
      if(!batchMode)save();
      if(selectedId===f.id)drawCrew(f.id);
      if(!batchMode)populateInWatchList();
    }
    return people;
  })().catch(err=>{
    if(filmById(f.id)){
      const message=String(err?.message||err||'取得失敗');
      const transient=/HTTP (429|500|502|503|504)|network|fetch|タイムアウト|接続|429/i.test(message);
      meta(f.id).crew84Failure={
        at:Date.now(),reason:message.slice(0,170),
        retryAfterMs:transient?60*60*1000:14*24*60*60*1000
      };
      if(!batchMode)save();
    }
    throw err;
  }).finally(()=>active.delete(f.id));
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
    img.parentElement?.classList.add('movie30-has-poster84');
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
  img.alt=displayTitle(f)+' のポスター';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  el.classList.add(mode==='rank'?'movie30-rank-poster84':'movie30-watch-poster84');
  if(posterValid84(posterMeta84(f)?.path))el.classList.add('movie30-has-poster84');
  if(mode==='rank')el.dataset.title84=displayTitle(f);
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

const RANK_POSTER_VIEW84='movie30_rank_poster_only_v84';
let rankPosterOnly84=false;
try{rankPosterOnly84=localStorage.getItem(RANK_POSTER_VIEW84)==='true'}catch(_){}
const rankPosterToolbar84=document.querySelector('#page-rank .tools');
let rankPosterButton84=document.getElementById('rankPosterOnly84');
if(rankPosterToolbar84&&!rankPosterButton84){
  rankPosterButton84=document.createElement('button');
  rankPosterButton84.id='rankPosterOnly84';
  rankPosterButton84.type='button';
  rankPosterButton84.className='btn';
  rankPosterButton84.setAttribute('aria-label','点数・順位の表示を切り替える');
  rankPosterToolbar84.appendChild(rankPosterButton84);
}
function updateRankPosterMode84(){
  const rank=document.getElementById('rankRoot');
  const viewingRank=rank?.style.display!=='none';
  if(rank)rank.classList.toggle('movie30-rank-grid-only84',rankPosterOnly84&&viewingRank);
  if(rankPosterButton84){
    rankPosterButton84.textContent=rankPosterOnly84?'通常一覧':'ポスターだけ';
    rankPosterButton84.classList.toggle('active',rankPosterOnly84);
    rankPosterButton84.style.display=viewingRank?'':'none';
    rankPosterButton84.setAttribute('aria-pressed',String(rankPosterOnly84));
  }
  if(!rank)return;
  for(const card of rank.querySelectorAll('.rank-card[data-id]')){
    if(!card.dataset.posterModeHandler84){
      card.dataset.posterModeHandler84='1';
      card.addEventListener('click',e=>{
        if(!rankPosterOnly84||rank.style.display==='none')return;
        if(e.target.closest('.drag-handle'))return;
        e.preventDefault();
        const id=decodeURIComponent(card.dataset.id||'');
        if(filmById(id))openSheet(id);
      });
      card.addEventListener('keydown',e=>{
        if(rankPosterOnly84&&(e.key==='Enter'||e.key===' ')){
          e.preventDefault();openSheet(decodeURIComponent(card.dataset.id||''));
        }
      });
    }
    card.tabIndex=rankPosterOnly84?0:-1;
    card.setAttribute('role',rankPosterOnly84?'button':'group');
  }
}
if(rankPosterButton84)rankPosterButton84.onclick=()=>{
  rankPosterOnly84=!rankPosterOnly84;
  try{localStorage.setItem(RANK_POSTER_VIEW84,String(rankPosterOnly84))}catch(_){}
  updateRankPosterMode84();
  decoratePosters84();
};

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

posterStyles84.textContent +=
 '.rank-card.movie30-rank-poster84{padding-left:77px;min-height:53px;overflow:hidden}'
 +'.rank-card.movie30-rank-poster84 .rank-meta{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}'
 +'.movie30-rank-poster84>.movie30-poster84{position:absolute;left:6px;top:6px;transform:none;width:62px;height:calc(100% - 12px);max-height:none;object-fit:cover;pointer-events:none;border-radius:7px}'
 +'#rankRoot.movie30-rank-grid-only84 .score-list{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(102px,1fr));gap:10px;padding:7px;align-items:start}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84{display:block!important;position:relative;padding:0!important;min-width:0;min-height:0;height:auto;aspect-ratio:2/3;overflow:hidden;border-radius:8px;cursor:pointer}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card .drag-handle,#rankRoot.movie30-rank-grid-only84 .rank-card>.rank-edit{display:none!important}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84>.movie30-poster84{left:0;top:0;transform:none;width:100%;height:100%;max-height:none;border:0;border-radius:6px;object-fit:cover;pointer-events:none}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card:not(.movie30-has-poster84)::after{content:attr(data-title84);position:absolute;inset:auto 5px 9px;color:#e7edf6;font-size:11px;line-height:1.35;text-align:center;overflow:hidden;max-height:5.4em;text-shadow:0 1px 2px #000}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card:focus-visible{outline:3px solid #a1c9ff;outline-offset:2px}'
 +'#rankRoot.movie30-rank-grid-only84 .score-label{position:sticky;top:55px;align-self:start}'
 +'@media(max-width:420px){#rankRoot.movie30-rank-grid-only84 .score-list{grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:7px}}';
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
  updateRankPosterMode84();
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
    +'<p class="tip">映画IDがない作品もTMDbのタイトル・公開年から慎重に照合して取得します。取得不能な作品は一定期間スキップするため、同じ15件で止まりません。ブラウザ内に設定済みのTMDbキーを使用します。</p>'
    +'<div class="tools"><button class="btn" type="button" id="batchDirector84">未取得の監督をすべて取得</button>'
    +'<button class="btn" type="button" id="retryDirector84">失敗分を再確認</button></div>'
    +'<div class="sync-status" id="directorBatchStatus84"></div>';
  data.insertBefore(box,data.firstChild);
  const button=box.querySelector('#batchDirector84'),retry=box.querySelector('#retryDirector84');
  let bulkRunning=false;
  async function bulkCrew84(retryFailed=false,autoLimit=Infinity){
    const status=box.querySelector('#directorBatchStatus84');
    if(bulkRunning)return;
    if(!getTmdbCredential()){status.textContent='TMDbキーが設定されていません';return;}
    bulkRunning=true;button.disabled=true;retry.disabled=true;
    const all=allFilms().filter(f=>!details(f).stored);
    const candidates=(retryFailed?all:all.filter(crewMissing84)).slice(0,autoLimit);
    let ok=0,ng=0,done=0;
    const summarize=()=> {
      const remaining=allFilms().filter(f=>!details(f).stored).length;
      status.textContent='監督・制作者：今回 '+done+'/'+candidates.length
        +'件処理（取得 '+ok+'／照合不可 '+ng+'）。未取得 '+remaining
        +'件。照合できない作品は次回自動的に飛ばします。';
    };
    summarize();
    try{
      // Two small workers limit TMDb API load and keep iPhone scrolling responsive.
      let next=0;
      const worker=async()=>{
        while(next<candidates.length){
          const f=candidates[next++];
          try{await retrieve(f,true,true);ok++;}
          catch(_){ng++;}
          done++;
          if(done%5===0||done===candidates.length){save();summarize();}
          await crewDelay84(220);
        }
      };
      await Promise.all([worker(),worker()]);
      if(candidates.length)save();
      summarize();
      populateInWatchList();
    }finally{
      bulkRunning=false;button.disabled=false;retry.disabled=false;
    }
  }
  button.onclick=()=>bulkCrew84(false);
  retry.onclick=()=>bulkCrew84(true);
  // Continue small unattended batches only in the browser already holding the key.
  // Keep the initial render fast; work happens after the application is visible.
  if(getTmdbCredential())setTimeout(()=>bulkCrew84(false).catch(()=>{}),9000);
}
populateInWatchList();
decoratePosters84();
updateRankPosterMode84();
window.__movie30TmdbCreditsV84={build:BUILD};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

(() => {
'use strict';
// v85: complete watched.csv backfill, larger posters, robust full-catalog TMDb credits.
const BUILD='20261011k';
const esc85=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm85=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const validDate85=v=>/^\d{4}-\d\d-\d\d$/.test(String(v||''))&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))?String(v):'';
const unique85=a=>[...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];

function backfillWatched85(){
  let added=0, skipped=0, missing=0;
  state.letterboxdMeta=state.letterboxdMeta||{};
  for(const f of allFilms()){
    const m=state.letterboxdMeta[f.id];
    if(!m?.watchedFlag)continue;
    const date=validDate85(m.watchedAddedDate);
    if(!date){missing++;continue;}
    const rows=Array.isArray(m.watchHistory)?m.watchHistory:(m.watchHistory=[]);
    // watched.csv Date is normally the actual first-view date for this account.
    // Only suppress it when that SAME DATE is already represented by Diary/RSS/manual data.
    if(rows.some(r=>validDate85(r.date)===date)){skipped++;continue;}
    const id='csv:watched:'+f.id+'|'+date;
    if((m.watchHistoryDeleted||[]).includes(id)){skipped++;continue;}
    rows.push({id,date,recordedAt:'',rewatch:false,retroactive:!!m.historicalWatched,
      source:'letterboxd-watched-csv',inferred:true,manualEdited:false});
    added++;
  }
  if(added){
    save();
    try{renderRank();}catch(_){}
  }
  const status=document.getElementById('watchImportStatus83');
  if(status && (added||/取得：|保存済み鑑賞履歴/.test(status.textContent||''))){
    const total=allFilms().reduce((n,f)=>n+(state.letterboxdMeta?.[f.id]?.watchHistory?.length||0),0);
    status.textContent='保存済み鑑賞履歴：'+total+'件。watched.csv の追加日を基本の鑑賞日として補完済み'
      +(added?'（今回 '+added+'件追加）':'')+'。Diary/RSSと同日のものは重複させていません。';
  }
  return {added,skipped,missing};
}

// Upgrade already imported ZIP data immediately.
setTimeout(backfillWatched85,250);
const watchStatus85=document.getElementById('watchImportStatus83');
if(watchStatus85 && typeof MutationObserver==='function'){
  new MutationObserver(()=>{
    if(/取得：/.test(watchStatus85.textContent||''))setTimeout(backfillWatched85,80);
  }).observe(watchStatus85,{childList:true,characterData:true,subtree:true});
}

// Poster enlargement without changing row height.
const css85=document.createElement('style');
css85.textContent=
 '.rank-card.movie30-rank-poster84{padding-left:86px!important;overflow:hidden}'
 +'.movie30-rank-poster84>.movie30-poster84{left:4px!important;top:4px!important;width:74px!important;height:calc(100% - 8px)!important;max-height:none!important;object-fit:cover!important;border-radius:7px!important}'
 +'.watch83-item.movie30-watch-poster84:not(.poster-gallery84 *){padding-left:76px!important}'
 +'.watch83-item.movie30-watch-poster84:not(.poster-gallery84 *)>.movie30-poster84{left:5px!important;top:4px!important;width:62px!important;height:calc(100% - 8px)!important;max-height:none!important;object-fit:cover!important}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84{padding:0!important}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84>.movie30-poster84{left:0!important;top:0!important;width:100%!important;height:100%!important}'
 +'#rankRoot.movie30-rank-grid-only84 .score-list{grid-template-columns:repeat(auto-fill,minmax(108px,1fr))!important;gap:9px!important}'
 +'@media(max-width:420px){#rankRoot.movie30-rank-grid-only84 .score-list{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}}';
document.head.appendChild(css85);
const rankPosterBtn85=document.getElementById('rankPosterOnly84');
if(rankPosterBtn85){
  const refreshLabel=()=>{rankPosterBtn85.textContent=rankPosterBtn85.classList.contains('active')?'通常一覧':'ポスターだけ表示';};
  refreshLabel();rankPosterBtn85.addEventListener('click',()=>setTimeout(refreshLabel,0));
}

// More tolerant but still year-aware TMDb matching.
function aliases85(f,m){
  const t=titleInfo(f);
  return unique85([t.englishTitle,t.originalTitle,t.title,f.lbTitle,f.englishTitle,f.originalTitle,f.title,m?.englishTitle])
    .filter(Boolean);
}
function bestCandidate85(results,aliases,year,isTv=false){
  const keys=new Set(aliases.map(norm85).filter(Boolean));
  let best=null,bestScore=-1e9;
  for(const x of results||[]){
    const names=isTv?[x.name,x.original_name]:[x.title,x.original_title];
    if(!names.some(n=>keys.has(norm85(n))))continue;
    const y=Number(((isTv?x.first_air_date:x.release_date)||'').slice(0,4))||0;
    const diff=year&&y?Math.abs(year-y):0;
    if(year&&y&&diff>3)continue;
    let score=100-(diff*18);
    if(y&&year&&y===year)score+=25;
    score+=Math.min(8,Number(x.popularity||0)/25);
    if(score>bestScore){best=x;bestScore=score;}
  }
  return best;
}
async function movieId85(f,m){
  const known=Number(m.poster84?.tmdbId||titleInfo(f).tmdbId||f.tmdbId)||0;
  if(known)return known;
  const names=aliases85(f,m),year=Number(f.year)||0;
  for(const name of names){
    for(const withYear of [true,false]){
      const p={query:name,language:'en-US',include_adult:'false'};
      if(withYear&&year)p.year=year;
      const r=await tmdbFetch('/search/movie',p);
      const hit=bestCandidate85(r?.results,names,year,false);
      if(hit?.id)return Number(hit.id);
    }
  }
  throw Error('TMDb映画を照合できません');
}
async function tvId85(f,m){
  const known=Number(m.tmdbSeriesId||m.poster84?.tmdbId)||0;
  if(known)return known;
  const names=aliases85(f,m).map(s=>s.includes(':')?s.split(':')[0].trim():s);
  const year=Number(f.year)||0;
  for(const name of unique85(names)){
    const r=await tmdbFetch('/search/tv',{query:name,language:'en-US'});
    const hit=bestCandidate85(r?.results,names,year,true);
    if(hit?.id)return Number(hit.id);
  }
  throw Error('TMDbシリーズを照合できません');
}
async function retrieve85(f){
  const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
  const kind=m.contentType||((state.mediaTypeOverrides?.[f.id]==='drama')?'tv_series':'movie');
  const people={directors:[],creators:[],source:'tmdb',fetchedAt:new Date().toISOString()};
  if(kind==='tv_episode'||kind==='tv_series'){
    const id=await tvId85(f,m);
    const tv=await tmdbFetch('/tv/'+id,{language:'en-US'});
    people.creators=unique85((tv.created_by||[]).map(x=>x.name));
    m.tmdbSeriesId=m.tmdbSeriesId||id;
    if(kind==='tv_episode'&&m.seasonNumber!=null&&m.episodeNumber!=null){
      const ep=await tmdbFetch('/tv/'+id+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber,{language:'en-US'});
      people.directors=unique85((ep.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
    }
  }else{
    const id=await movieId85(f,m);
    const cr=await tmdbFetch('/movie/'+id+'/credits',{language:'en-US'});
    people.directors=unique85((cr.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
    m.poster84=m.poster84||{};m.poster84.tmdbId=m.poster84.tmdbId||id;
  }
  m.crew84=people;delete m.crew84Failure;delete m.crew85Failure;
  return people;
}
let running85=false;
async function allCredits85(retryFailures=true){
  const status=document.getElementById('directorBatchStatus84');
  if(running85)return;
  if(!getTmdbCredential()){if(status)status.textContent='TMDbキーが設定されていません';return;}
  running85=true;
  const b=document.getElementById('batchDirector84'),r=document.getElementById('retryDirector84');
  if(b)b.disabled=true;if(r)r.disabled=true;
  const films=allFilms().filter(f=>{
    const m=state.letterboxdMeta?.[f.id]||{};
    if(m.crew84?.fetchedAt)return false;
    if(!retryFailures&&m.crew85Failure)return false;
    return true;
  });
  try { await tmdbFetch('/configuration'); }
  catch(err) {
    if(status)status.textContent='開始できません：'+String(err?.message||err)+'。残りの作品は失敗扱いにしていません。';
    running85=false;if(b)b.disabled=false;if(r)r.disabled=false;return;
  }
  let next=0,ok=0,ng=0,done=0;
  const reasons=new Map();
  const paint=()=>{
    if(status)status.textContent='監督・製作者：'+done+'/'+films.length+
      '件確認、取得 '+ok+'、照合不可 '+ng+'。失敗作で止まらず最後まで進みます。';
  };
  paint();
  const worker=async()=>{
    while(true){
      const i=next++; if(i>=films.length)break;
      const f=films[i];
      try{await retrieve85(f);ok++;}
      catch(e){
        ng++;
        const reason=String(e?.message||e).slice(0,180);
        reasons.set(reason,(reasons.get(reason)||0)+1);
        const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
        m.crew85Failure={at:Date.now(),reason:String(e?.message||e).slice(0,180)};
      }
      done++;
      if(done%8===0){save();paint();}
      if(done>=12&&ok===0){
        const top=[...reasons.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'不明なエラー';
        if(/HTTP|認証|fetch|network|429|403|401|TMDB検索に失敗/i.test(top))
          throw Error('連続失敗のため停止：'+top+'。未処理作は失敗登録しません。');
      }
      await new Promise(res=>setTimeout(res,140));
    }
  };
  try{
    await worker();
    if(films.length)save();
    paint();
    if(status)status.textContent+=' 完了。'+(ng?('失敗理由：'+[...reasons.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([reason,n])=>reason+' '+n+'件').join('／')):'');
    try{renderRank();}catch(_){}
  }catch(err){
    save();
    if(status)status.textContent='一括取得を中断：'+String(err?.message||err)+'。取得 '+ok+'件／失敗 '+ng+'件。';
  }finally{
    running85=false;if(b)b.disabled=false;if(r)r.disabled=false;
  }
}
const batch85=document.getElementById('batchDirector84');
const retry85=document.getElementById('retryDirector84');
if(batch85){batch85.textContent='未取得の監督・製作者を全件取得';batch85.onclick=()=>allCredits85(true);}
if(retry85){retry85.textContent='照合不可も含め全件再確認';retry85.onclick=()=>allCredits85(true);}
// One automatic full pass in the browser that already has the user's TMDb credential.
// Automatic v85 fetching disabled to avoid competing with v84 job and masking failures.

window.__movie30V85={build:BUILD,backfillWatched:backfillWatched85,fetchAllCredits:allCredits85};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
/* Consolidated from patch-v85.js; original order retained. */
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
 +'@media(max-width:620px){#rankRoot.movie30-rank-grid-only84 .score-list{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important}#searchRank,#searchClassify{font-size:18px!important}}';
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

/* Consolidated from patch-v86.js; original order retained. */
(() => {
'use strict';
// v86 uniform film rows and Wildlife (2018) TMDb poster fix.
const BUILD='20261011l';
const css=document.createElement('style');
css.textContent=
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card{height:82px!important;min-height:82px!important;max-height:82px!important;box-sizing:border-box!important;overflow:hidden!important;align-items:center!important}'
 +'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84{padding-left:86px!important}'
 +'#rankRoot:not(.movie30-rank-grid-only84) .rank-card .rank-meta{overflow:hidden!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important}'
 +'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84>.movie30-poster84{top:4px!important;left:4px!important;transform:none!important;width:74px!important;height:74px!important;max-height:74px!important;object-fit:cover!important}'
 +'.watch83-grid:not(.poster-gallery84) .watch83-item{height:104px!important;min-height:104px!important;max-height:104px!important;box-sizing:border-box!important;overflow:hidden!important}'
 +'.watch83-grid:not(.poster-gallery84) .watch83-item.movie30-watch-poster84>.movie30-poster84{height:96px!important;max-height:96px!important;top:4px!important;left:5px!important;width:64px!important;object-fit:cover!important}'
 +'#rankRoot.movie30-rank-grid-only84 .rank-card{height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:2/3!important}'
 +'.watch83-grid.poster-gallery84 .watch83-item{height:auto!important;max-height:none!important}';
document.head.appendChild(css);
function matchWildlife(f){
 const m=state.letterboxdMeta?.[f.id]||{},t=titleInfo(f);
 const aliases=[f.title,f.lbTitle,f.englishTitle,f.originalTitle,t.title,t.englishTitle,t.originalTitle,m.englishTitle];
 return (Number(f.year)===2018||Number(f.year)===2017)&&aliases.some(s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z]/g,'')==='wildlife');
}
let fixed=0;
for(const f of allFilms()){
 if(!matchWildlife(f))continue;
 const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
 const p=m.poster84=m.poster84||{};
 // Confirmed movie/417812, not the separate Wild Life (2023) documentary.
 if(Number(p.tmdbId)!==417812||p.checkedAt||!p.path){
   p.tmdbId=417812;
   delete p.checkedAt;delete p.path;
   fixed++;
 }
}
if(fixed){save();try{window.__movie30PosterDecorate84?.();}catch(_){}}
window.__movie30V86={build:BUILD,wildlifeMatched:fixed};
const label=document.getElementById('movie30BuildV29');if(label)label.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v87.js; original order retained. */
(() => {
'use strict';
const BUILD='20261011n';
const css=document.createElement('style');
css.textContent=[
'#rankRoot:not(.movie30-rank-grid-only84) .movie30-rank-poster84>.movie30-poster84{width:48px!important;height:74px!important;left:17px!important;top:4px!important;object-fit:contain!important;object-position:center!important;background:#101820!important}',
'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84{padding-left:76px!important}',
'.watch83-grid:not(.poster-gallery84) .movie30-watch-poster84>.movie30-poster84{width:62px!important;height:96px!important;left:6px!important;top:4px!important;object-fit:contain!important;background:#101820!important}',
'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84>.movie30-poster84{width:100%!important;height:100%!important;left:0!important;top:0!important;object-fit:contain!important;background:#101820!important}',
'.watch83-grid.poster-gallery84 .movie30-watch-poster84>.movie30-poster84{object-fit:contain!important;background:#101820!important}',
'#movie30PosterDetail84 img{object-fit:contain!important;background:#101820!important}'
].join('');
document.head.appendChild(css);
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const meta=id=>(state.letterboxdMeta=state.letterboxdMeta||{},state.letterboxdMeta[id]=state.letterboxdMeta[id]||{});
const uniq=a=>[...new Set((a||[]).map(s=>String(s||'').trim()).filter(Boolean))];
const names=f=>{const t=titleInfo(f);return uniq([t.title,t.englishTitle,t.originalTitle,f.title,f.englishTitle,f.originalTitle,f.lbTitle]);};
const isWild=f=>names(f).some(x=>['wildlife','ワイルドライフ'].includes(norm(x)));
let wildlife=[];
for(const f of allFilms()){
 if(!isWild(f))continue;
 const y=Number(f.year)||0;
 if(y&&y!==2018)continue; // do not confuse the 2018 drama with other productions
 const m=meta(f.id);m.poster84=m.poster84||{};
 m.poster84.tmdbId=417812; // verified Wildlife (2018)
 // Clear stale unsuccessful checks. Directly refresh the actual image below.
 if(!m.poster84.path)delete m.poster84.checkedAt;
 const previous=m.crew84||{};
 m.crew84={...previous,directors:uniq([...(previous.directors||[]),'Paul Dano']),
  creators:previous.creators||[],fetchedAt:previous.fetchedAt||new Date().toISOString(),
  source:previous.source||'verified'};
 wildlife.push(f);
}
if(wildlife.length)save();
async function refreshWild(){
 if(!getTmdbCredential())return;
 for(const f of wildlife){
  const m=meta(f.id),p=m.poster84||{};
  try{
   const d=await tmdbFetch('/movie/417812',{language:'en-US'});
   if(!d.poster_path)throw Error('TMDbにposter_pathがありません');
   m.poster84={tmdbId:417812,path:d.poster_path,provider:'tmdb',checkedAt:new Date().toISOString()};
   const url='https://image.tmdb.org/t/p/w342'+d.poster_path;
   document.querySelectorAll('.movie30-poster84[data-poster-id]').forEach(img=>{
    if(img.dataset.posterId===f.id){img.src=url;img.classList.add('movie30-poster-loaded84');img.parentElement?.classList.add('movie30-has-poster84');}
   });
   save();
  }catch(e){
   const el=document.getElementById('posterStatus84');
   if(el)el.textContent='Wildlife取得失敗：'+String(e?.message||e);
  }
 }
}
setTimeout(()=>refreshWild().catch(()=>{}),600);

function filmKind(f,m){
 const kind=m.contentType||'';
 return kind==='tv_series'||kind==='tv_episode'||state.mediaTypeOverrides?.[f.id]==='drama'?'tv':'movie';
}
function choose(items,keys,year,tv){
 const wanted=new Set(keys.map(norm));
 const candidates=(items||[]).map(x=>{
  const match=(tv?[x.name,x.original_name]:[x.title,x.original_title]).some(n=>wanted.has(norm(n)));
  const date=tv?x.first_air_date:x.release_date, y=Number((date||'').slice(0,4))||0;
  const difference=year&&y?Math.abs(year-y):0;
  return {x,match,difference,score:(match?100:0)+(year&&y&&difference===0?25:0)-difference*12};
 }).filter(z=>z.match&&z.difference<=3).sort((a,b)=>b.score-a.score);
 return candidates[0]?.x||null;
}
async function identify(f,m,tv){
 const existing=Number(tv?m.tmdbSeriesId:(m.poster84?.tmdbId||titleInfo(f).tmdbId||f.tmdbId))||0;
 if(existing)return existing;
 const keys=names(f),year=Number(f.year)||0;
 for(const name of keys.slice(0,4)){
  const query=tv?name.split(/[:：]/)[0].trim():name;
  if(!query)continue;
  const params={query,language:'en-US'};
  if(!tv){params.include_adult='false';if(year)params.year=year;}
  let r=await tmdbFetch(tv?'/search/tv':'/search/movie',params);
  let hit=choose(r.results,keys,year,tv);
  if(!hit&&!tv&&year){
   delete params.year;
   r=await tmdbFetch('/search/movie',params);
   hit=choose(r.results,keys,year,false);
  }
  if(hit?.id)return Number(hit.id);
 }
 throw Error('タイトル・公開年からTMDb作品を一意に照合できません');
}
async function retrieve(f){
 const m=meta(f.id),tv=filmKind(f,m)==='tv',id=await identify(f,m,tv);
 let directors=[],creators=[];
 if(tv){
  const t=await tmdbFetch('/tv/'+id,{language:'en-US'});
  creators=uniq((t.created_by||[]).map(x=>x.name));
  m.tmdbSeriesId=id;
  if(m.contentType==='tv_episode'&&m.seasonNumber!=null&&m.episodeNumber!=null){
   const ep=await tmdbFetch('/tv/'+id+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber);
   directors=uniq((ep.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
  }
 }else{
  const d=await tmdbFetch('/movie/'+id+'/credits',{language:'en-US'});
  directors=uniq((d.crew||[]).filter(x=>x.job==='Director').map(x=>x.name));
  m.poster84=m.poster84||{};
  m.poster84.tmdbId=id;
 }
 if(!directors.length&&!creators.length)throw Error('作品は見つかりましたが監督・製作者情報が空です');
 m.crew84={directors,creators,source:'tmdb',fetchedAt:new Date().toISOString()};
 delete m.crew84Failure;delete m.crew85Failure;
 return true;
}
let busy=false;
const box=document.getElementById('directorTool84'),output=document.getElementById('directorBatchStatus84');
const first=document.getElementById('batchDirector84'),second=document.getElementById('retryDirector84');
const report=s=>{if(output)output.textContent=s;};
async function run(retry=false){
 if(busy)return;
 if(!getTmdbCredential()){report('TMDb APIキーが未設定です。データ画面で設定してください。');return;}
 busy=true;if(first)first.disabled=true;if(second)second.disabled=true;
 try{
  await tmdbFetch('/configuration'); // detect systemwide auth/network failures before marking entries
  const films=allFilms().filter(f=>{
   const m=meta(f.id),c=m.crew84||{};
   return !(c.directors?.length||c.creators?.length)&& (retry||!m.crew87Failure);
  });
  let success=0,fail=0,done=0;const reasons=new Map();
  for(const f of films){
   try{await retrieve(f);success++;}
   catch(err){
    fail++;
    const message=String(err?.message||err).slice(0,150);
    reasons.set(message,(reasons.get(message)||0)+1);
    meta(f.id).crew87Failure={at:Date.now(),reason:message};
   }
   done++;
   if(done%5===0||done===films.length){
    save();report('監督取得 '+done+'/'+films.length+'件を確認・成功 '+success+'件・失敗 '+fail+'件');
    if(document.getElementById('searchRank')?.value||document.getElementById('searchClassify')?.value)render();
   }
   if(done>=8&&success===0){
    const common=[...reasons.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(common&&common[1]>=6)throw Error('同じ失敗が連続：'+common[0]);
   }
   await new Promise(resolve=>setTimeout(resolve,210));
  }
  report('監督取得完了：成功 '+success+'、失敗 '+fail+'。'+(fail?' 主な原因：'+[...reasons.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,n])=>k+' ('+n+'件)').join('／'):''));
  render();
 }catch(e){save();report('監督取得を中断：'+String(e?.message||e)+'。正常に取得できた作品は保存済み。');}
 finally{busy=false;if(first)first.disabled=false;if(second)second.disabled=false;}
}
if(first){first.textContent='監督・製作者の未取得をすべて取得';first.onclick=()=>run(false);}
if(second){second.textContent='失敗した作品も再取得';second.onclick=()=>run(true);}
if(box){
 let note=document.getElementById('crewHelp87');
 if(!note){note=document.createElement('small');note.id='crewHelp87';note.style.display='block';note.style.marginTop='9px';box.appendChild(note);}
 note.textContent='取得した監督名は検索対象に即時反映します。0件で止まる場合は失敗理由を表示します。';
}
const matchPrior=match;
match=function(f,q){
 if(matchPrior(f,q))return true;
 if(!q)return true;
 return window.Movie30SearchQueries.crew(q,meta(f.id));
};
if(wildlife.length)try{renderRank()}catch(_){}
window.__movie30V87={build:BUILD,wildlifeCount:wildlife.length,fetchDirectors:run};
const label=document.getElementById('movie30BuildV29');if(label)label.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v88.js; original order retained. */
(() => {
'use strict';
// GitHub-backed director and poster catalog. The TMDb secret never enters browser code.
const BUILD='20261011q';
const style=document.createElement('style');
style.id='movie30-poster-ratio88';
style.textContent=[
'#rankRoot:not(.movie30-rank-grid-only84) .rank-card{height:82px!important;min-height:82px!important;max-height:82px!important;box-sizing:border-box!important;overflow:hidden!important}',
'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84{padding-left:64px!important}',
'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84>.movie30-poster84{position:absolute!important;top:4px!important;left:8px!important;width:48px!important;height:72px!important;max-height:72px!important;aspect-ratio:2/3!important;transform:none!important;object-fit:contain!important;object-position:center!important;box-sizing:border-box!important}',
'.watch83-grid:not(.poster-gallery84) .watch83-item{height:104px!important;min-height:104px!important;max-height:104px!important;overflow:hidden!important;box-sizing:border-box!important}',
'.watch83-grid:not(.poster-gallery84) .watch83-item.movie30-watch-poster84>.movie30-poster84{position:absolute!important;top:4px!important;left:7px!important;width:64px!important;height:96px!important;max-height:96px!important;aspect-ratio:2/3!important;transform:none!important;object-fit:contain!important;object-position:center!important;box-sizing:border-box!important}',
'#rankRoot.movie30-rank-grid-only84 .rank-card.movie30-rank-poster84>.movie30-poster84{position:absolute!important;inset:0!important;top:0!important;left:0!important;width:100%!important;height:100%!important;max-height:none!important;transform:none!important;object-fit:contain!important;object-position:center!important}',
'.watch83-grid.poster-gallery84 .watch83-item.movie30-watch-poster84>.movie30-poster84{position:static!important;width:100%!important;height:auto!important;aspect-ratio:2/3!important;object-fit:contain!important}',
'.movie30-poster-detail84 img{object-fit:contain!important}',
'#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84>.rank-meta{overflow:hidden!important}'
].join('\n');
document.head.appendChild(style);

// Keep a copy of remote credits outside local storage as well.
let catalog={};
const validPath=p=>typeof p==='string'&&/^\/[a-zA-Z0-9_\-./]+\.(?:jpe?g|png|webp)$/i.test(p)&&!p.includes('..');
const norm=s=>String(s||'').normalize('NFKC').toLowerCase();
const allNames=r=>[...(r.directors||[]),...(r.creators||[]),...(r.directorAliases||[])];
const oldMatch=match;
match=function(f,q){
 if(oldMatch(f,q))return true;
 if(!q)return true;
 return window.Movie30SearchQueries.catalogCredits(q,catalog[f.id],allNames);
};
const target=document.getElementById('directorTool84')||document.getElementById('page-data');
const panel=document.createElement('div');
panel.id='cloudCreditsPanel88';
panel.style.cssText='margin:12px 0;padding:11px;border:1px solid #3b526b;border-radius:9px;font-size:12px;line-height:1.6';
const heading=document.createElement('strong');heading.textContent='監督・ポスターのGitHub一括データ';
const status=document.createElement('div');status.id='cloudCreditsStatus88';status.textContent='データを確認中…';
const reload=document.createElement('button');reload.type='button';reload.className='btn';reload.textContent='データを再読み込み';reload.style.marginTop='8px';
const link=document.createElement('a');link.href='https://github.com/gjbkic/movie-ratings/actions/workflows/update-tmdb.yml';link.target='_blank';link.rel='noopener noreferrer';link.textContent='GitHub Actions の実行状況';link.style.cssText='display:inline-block;margin-left:10px';
panel.append(heading,status,reload,link);
target?.appendChild(panel);
function applyCatalog(data){
 if(!data||data.schema!==1||!data.films||typeof data.films!=='object')throw Error('メタデータ形式が不正です');
 catalog=data.films;
 state.letterboxdMeta=state.letterboxdMeta||{};
 let directors=0,posters=0,recognized=0;
 for(const f of allFilms()){
  const r=catalog[f.id];if(!r)continue;
  recognized++;
  const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
  if((r.directors?.length||0)+(r.creators?.length||0)>0){
   directors++;
   // Explicit user edits take precedence; remote fetched credits go into automatic field only.
   m.crew84={directors:r.directors||[],creators:r.creators||[],
    source:'tmdb-github',fetchedAt:data.updatedAt||new Date().toISOString()};
   delete m.crew84Failure;delete m.crew85Failure;delete m.crew87Failure;
  }
  // Remove previously cached covers that belonged to incorrectly matched TMDb entries.
  if(r.source==='corrected-credits-recheck-required'&&!validPath(r.posterPath)){
   if(m.poster84){
    delete m.poster84.path;
    delete m.poster84.checkedAt;
    m.poster84.tmdbId=r.tmdbId||null;
   }
  }
  if(validPath(r.posterPath)){
   posters++;
   m.poster84=m.poster84||{};
   m.poster84.tmdbId=Number(r.tmdbId)||m.poster84.tmdbId;
   // Replace invalid or absent image paths and the specially misidentified Wildlife poster.
   const names=[f.title,f.lbTitle,titleInfo(f).englishTitle].map(x=>String(x||'').toLowerCase().replace(/[^a-z]/g,''));
   const wild=Number(f.year)===2018&&names.includes('wildlife');
   if(wild||!validPath(m.poster84.path)||m.poster84.tmdbId===Number(r.tmdbId)){
    m.poster84.path=r.posterPath;m.poster84.checkedAt=data.updatedAt;
   }
  }
 }
 // Does not change scores, ranks, reviews, or the updatedAt used by GitHub state sync.
 save(false);
 try{render()}catch(err){console.warn('Movie metadata render failed',err)}
 // Update already-mounted poster images, including missing Wildlife thumbnails.
 for(const img of document.querySelectorAll('img.movie30-poster84[data-poster-id]')){
  const r=catalog[img.dataset.posterId];
  if(!r||!validPath(r.posterPath))continue;
  img.src='https://image.tmdb.org/t/p/'+(img.dataset.posterSize||'w185')+r.posterPath;
  img.classList.add('movie30-poster-loaded84');
  img.parentElement?.classList.add('movie30-has-poster84');
 }
 return {recognized,directors,posters};
}
let fetching=false;
async function loadCloud(refresh=true){
 if(fetching)return;
 fetching=true;reload.disabled=true;
 status.textContent='GitHubのメタデータを確認中…';
 try{
  const data=await window.__movie30LoadCatalog({refresh});
  // Restoring IDB replaces state; apply automatic metadata only after that completes.
  await window.__movie30StorageReady;
  if(window.__movie30RecoveryBlocked)throw Error('保存データの復元が完了していません');
  const result=applyCatalog(data);
  status.textContent='反映済み：監督・製作者 '+result.directors+'作品／ポスター '+result.posters+'作品（照合 '+result.recognized+'作品）。データ更新：'+String(data.updatedAt||'').slice(0,10)+'。';
 }catch(e){
  status.textContent='未反映：'+String(e?.message||e)+'。GitHub Actionsが成功したあと「データを再読み込み」を押してください。';
 }finally{fetching=false;reload.disabled=false}
}
reload.onclick=()=>loadCloud();
loadCloud(false);
// Make runtime debugging possible without exposing secret data.
window.__movie30CloudCredits88={reload:loadCloud,stats:()=>({total:Object.keys(catalog).length,withDirectors:Object.values(catalog).filter(x=>x.directors?.length||x.creators?.length).length})};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v89.js; original order retained. */
(() => {
'use strict';
const filmId='custom-1791664055006-96rv';
const cover='https://www.sonymusic.co.jp/Music/Info/utadahikaru/en/music/img/dvd/img_music_dvd_14.jpg';
let pending=false;
function refresh(){
  for(const img of document.querySelectorAll('img.movie30-poster84[data-poster-id]')){
    if(decodeURIComponent(img.dataset.posterId||'')!==filmId)continue;
    if(img.getAttribute('src')!==cover)img.src=cover;
    img.classList.add('movie30-poster-loaded84');
    img.closest('.rank-card,.watch83-item')?.classList.add('movie30-has-poster84');
  }
}
function queue(){
 if(pending)return;
 pending=true;
 requestAnimationFrame(()=>{pending=false;refresh();});
}
const oldRank=renderRank;
renderRank=function(...args){const value=oldRank.apply(this,args);queue();return value;};
const oldSheet=openSheet;
openSheet=function(...args){const value=oldSheet.apply(this,args);queue();return value;};
for(const id of ['rankRoot','watchList83','movie30PosterDetail84']){
 const el=document.getElementById(id);if(!el)continue;
 new MutationObserver(queue).observe(el,{childList:true,subtree:true});
}
queue();
const legacyHelp=document.querySelector('#directorTool84 .tip');
if(legacyHelp)legacyHelp.textContent='監督・ポスター情報はGitHub Actionsで取得し、アプリに配信します。スマホにTMDbキーを設定する必要はありません。';
const btn=document.getElementById('batchDirector84');
if(btn){btn.textContent='GitHubの監督データを読み込む';btn.onclick=()=>window.__movie30CloudCredits88?.reload();}
const retry=document.getElementById('retryDirector84');
if(retry){retry.textContent='残りを取得する（GitHub Actions）';retry.onclick=()=>window.open('https://github.com/gjbkic/movie-ratings/actions/workflows/update-tmdb.yml','_blank','noopener');}
window.__movie30WildLife89={refresh,source:'official-artist-cover'};
})();

/* Consolidated from patch-v90.js; original order retained. */
(() => {
'use strict';
// v90: Search results reuse posters in every view; details open a full-screen cover viewer.
const VERSION='20261012a';
const WILD='custom-1791664055006-96rv';
const WILD_COVER='https://www.sonymusic.co.jp/Music/Info/utadahikaru/en/music/img/dvd/img_music_dvd_14.jpg';
const css=document.createElement('style');css.id='movie30-search-posters-lightbox90';
css.textContent=[
'.movie90-result-with-art{position:relative!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;min-height:76px!important;box-sizing:border-box!important;overflow:hidden!important}',
'.movie90-result-with-art .movie90-result-art{display:block!important;position:static!important;flex:none!important;width:42px!important;height:63px!important;object-fit:contain!important;border-radius:5px;border:1px solid #405169;background:#15202e}',
'.movie90-result-text{display:flex;flex-direction:column;min-width:0;flex:1;align-items:flex-start}',
'.movie90-result-art-placeholder{font-size:9px;line-height:1.5;color:#bdcadb;text-align:center;display:flex!important;align-items:center;justify-content:center;padding:5px;box-sizing:border-box}',
'.movie90-result-text .card-title,.movie90-result-text strong{overflow-wrap:anywhere}',
'#classifyRoot .card.movie90-result-with-art .badge{margin-top:6px}',
'#rankRoot .uns-card.movie90-result-with-art{min-height:77px!important}',
'#watchList83 .movie30-poster84,#rankRoot .movie30-poster84,#movie30PosterDetail84 img{object-fit:contain!important;object-position:center!important}',
'#movie30PosterDetail84 img.movie30-poster84{cursor:zoom-in;touch-action:manipulation}',
'#movie30PosterDetail84 img.movie30-poster84:focus-visible{outline:3px solid #d1e5ff}',
'#movie30PosterDetail84 .movie90-expand-note{display:block;margin:4px 0;font-size:11px;color:#aebbd0}',
'.movie90-viewer{position:fixed;inset:0;z-index:25000;background:rgba(1,3,7,.975);display:flex;flex-direction:column;color:#fff;padding:env(safe-area-inset-top) 10px env(safe-area-inset-bottom);box-sizing:border-box}',
'.movie90-viewer[hidden]{display:none!important}',
'.movie90-viewer-toolbar{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:9px 4px;min-height:45px;flex:0 0 auto}',
'.movie90-viewer-title{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.movie90-viewer-close{background:#273342;color:#fff;border:1px solid #566378;border-radius:30px;min-height:40px;min-width:44px;padding:5px 13px;font-size:18px}',
'.movie90-viewer-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;overscroll-behavior:contain}',
'.movie90-viewer-stage img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;box-shadow:0 6px 28px #0008;cursor:zoom-in}',
'.movie90-viewer-stage.is-zoomed{display:block;text-align:center}',
'.movie90-viewer-stage.is-zoomed img{width:auto;height:auto;max-width:none;max-height:none;min-width:100%;cursor:zoom-out}',
'.movie90-viewer-hint{font-size:11px;color:#a8b9cf;text-align:center;padding:5px 0 12px;flex:0 0 auto}'
].join('\n');
document.head.appendChild(css);

function posterFor(id,size='w342'){
 const film=filmById(id),m=state.letterboxdMeta?.[id]||{};
 if(id===WILD)return WILD_COVER;
 const path=m.poster84?.path;
 if(typeof path==='string'&&/^\/[a-zA-Z0-9_\-./]+\.(?:jpe?g|png|webp)$/i.test(path)&&!path.includes('..')){
  return 'https://image.tmdb.org/t/p/'+size+path;
 }
 return '';
}
const roots=['rankRoot','classifyRoot','watchList83'];
function decorateResult(card,id){
 if(card.querySelector('.movie90-result-art'))return;
 // Pending ranking cards already own a poster and edit controls. Wrapping all
 // children a second time squeezes those controls and moves the poster into text.
 if(card.matches('#rankRoot .uns-card')&&card.querySelector(':scope > .movie30-poster84'))return;
 const src=posterFor(id,'w185');
 const searched=Boolean(document.getElementById('searchRank')?.value.trim()||document.getElementById('searchClassify')?.value.trim());
 if(!src&&!searched)return;
 card.classList.add('movie90-result-with-art');
 const art=document.createElement(src?'img':'span');
 art.className='movie90-result-art'+(src?'':' movie90-result-art-placeholder');
 if(src){art.src=src;art.alt='';art.loading='lazy';art.decoding='async';}
 else art.textContent='画像未取得';
 const wrapper=document.createElement('span');wrapper.className='movie90-result-text';
 while(card.firstChild)wrapper.appendChild(card.firstChild);
 card.append(art,wrapper);
}
function refreshPosters(){
 // Rank list posters and date-sort posters already exist in v84; also fill in after searches.
 try{window.__movie30PosterDecorate84?.()}catch(_){}
 for(const card of document.querySelectorAll('#rankRoot .uns-card[data-uns],#classifyRoot .card[data-id]')){
  const encoded=card.dataset.uns||card.dataset.id;if(!encoded)continue;
  decorateResult(card,decodeURIComponent(encoded));
 }
 for(const img of document.querySelectorAll('.movie30-poster84[data-poster-id]')){
  const id=decodeURIComponent(img.dataset.posterId||'');
  const wanted=posterFor(id,img.dataset.posterSize||'w185');
  if(!wanted)continue;
  if(img.getAttribute('src')!==wanted)img.src=wanted;
  img.classList.add('movie30-poster-loaded84');
  img.closest('.rank-card,.watch83-item')?.classList.add('movie30-has-poster84');
 }
 // A metadata download may have arrived after search results were drawn.
 for(const card of document.querySelectorAll('.movie90-result-with-art')){
  const id=decodeURIComponent(card.dataset.id||card.dataset.uns||'');
  const wanted=posterFor(id,'w185');
  const img=card.querySelector('.movie90-result-art');
  if(!wanted||!img)continue;
  if(img.tagName==='IMG'){if(img.getAttribute('src')!==wanted)img.src=wanted;}
  else{
   const real=document.createElement('img');real.className='movie90-result-art';
   real.src=wanted;real.alt='';real.loading='lazy';real.decoding='async';
   img.replaceWith(real);
  }
 }
 refreshDetailPoster();
}
function refreshDetailPoster(){
 const detail=document.getElementById('movie30PosterDetail84');
 const img=detail?.querySelector('img.movie30-poster84[data-poster-id]');
 if(img&&selectedId){
  const src=posterFor(selectedId,'w342');
  if(src&&img.getAttribute('src')!==src)img.src=src;
  if(!img.hasAttribute('tabindex'))img.tabIndex=0;
  if(img.getAttribute('role')!=='button')img.setAttribute('role','button');
  if(img.getAttribute('aria-label')!=='ポスターを大きく表示')img.setAttribute('aria-label','ポスターを大きく表示');
  if(!detail.querySelector('.movie90-expand-note')){
   const note=document.createElement('small');note.className='movie90-expand-note';
   note.textContent='ポスターをタップして拡大表示';
   detail.appendChild(note);
  }
 }
}
let queued=false,fullPending=false;
function scheduleRefresh(scope){
 if(scope!=='detail')fullPending=true;
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{
  const full=fullPending;queued=false;fullPending=false;
  if(full)refreshPosters();else refreshDetailPoster();
 });
}
for(const id of roots){
 const el=document.getElementById(id);if(!el)continue;
 new MutationObserver(mutations=>{
  // Only track added/removed nodes: src changes should not cause infinite observer loops.
  if(mutations.some(x=>x.addedNodes.length||x.removedNodes.length))scheduleRefresh();
 }).observe(el,{childList:true,subtree:true});
}
// Renderers are wrapped by older feature modules and redraw on each search keystroke.
for(const [method,original] of [['rank',renderRank],['classify',renderClassify]]){
 if(method==='rank')renderRank=function(...args){const result=original.apply(this,args);scheduleRefresh();return result};
 else renderClassify=function(...args){const result=original.apply(this,args);scheduleRefresh();return result};
}
const posterPanel=document.getElementById('movie30PosterDetail84');
if(posterPanel)new MutationObserver(()=>scheduleRefresh('detail')).observe(posterPanel,{childList:true,subtree:true});

const overlay=document.createElement('div');
overlay.id='movie30CoverLightbox90';overlay.className='movie90-viewer';overlay.hidden=true;
overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
overlay.setAttribute('aria-label','ポスターの拡大表示');
const bar=document.createElement('div');bar.className='movie90-viewer-toolbar';
const title=document.createElement('div');title.className='movie90-viewer-title';
const close=document.createElement('button');close.className='movie90-viewer-close';close.type='button';close.textContent='閉じる ×';close.setAttribute('aria-label','拡大表示を閉じる');
bar.append(title,close);
const stage=document.createElement('div');stage.className='movie90-viewer-stage';
const large=document.createElement('img');large.alt='';stage.appendChild(large);
const hint=document.createElement('div');hint.className='movie90-viewer-hint';hint.textContent='画像をタップすると拡大・縮小できます';
overlay.append(bar,stage,hint);document.body.appendChild(overlay);
let previousFocus=null,previousOverflow='';
function closeViewer(){
 if(overlay.hidden)return;overlay.hidden=true;
 stage.classList.remove('is-zoomed');large.removeAttribute('src');
 document.body.style.overflow=previousOverflow;
 previousFocus?.focus?.({preventScroll:true});previousFocus=null;
}
function openViewer(id,thumbnail){
 const film=filmById(id);if(!film)return;
 let url=posterFor(id,'original');
 if(!url){
  url=thumbnail?.getAttribute('src')||'';
  if(url.includes('image.tmdb.org/t/p/'))url=url.replace(/\/t\/p\/(?:w\d+|original)\//,'/t/p/original/');
 }
 if(!url)return;
 previousFocus=document.activeElement;
 previousOverflow=document.body.style.overflow;
 document.body.style.overflow='hidden';
 title.textContent=displayTitle(film);
 large.alt=displayTitle(film)+' のポスター';
 large.src=url;
 stage.classList.remove('is-zoomed');
 overlay.hidden=false;
 close.focus({preventScroll:true});
}
close.addEventListener('click',closeViewer);
overlay.addEventListener('click',e=>{if(e.target===overlay||e.target===stage)closeViewer()});
large.addEventListener('click',()=>{stage.classList.toggle('is-zoomed');stage.scrollTop=0;stage.scrollLeft=0;});
document.addEventListener('keydown',e=>{
 if(overlay.hidden)return;
 if(e.key==='Escape'){e.preventDefault();closeViewer();}
 if(e.key==='Tab'){
  e.preventDefault();close.focus();
 }
});
document.addEventListener('click',e=>{
 const img=e.target.closest?.('#movie30PosterDetail84 img.movie30-poster84');
 if(!img)return;
 e.preventDefault();e.stopPropagation();
 openViewer(decodeURIComponent(img.dataset.posterId||selectedId||''),img);
},true);
document.addEventListener('keydown',e=>{
 if(!['Enter',' '].includes(e.key))return;
 const img=e.target.closest?.('#movie30PosterDetail84 img.movie30-poster84');
 if(!img)return;e.preventDefault();openViewer(decodeURIComponent(img.dataset.posterId||selectedId||''),img);
});
const openDetailBefore90=openSheet;
openSheet=function(...args){
 const result=openDetailBefore90.apply(this,args);
 const id=args[0];
 if(id==='custom-1790185844116-j1vu'){
  const panel=document.getElementById('directorPanel84');
  const line=panel?.querySelector('p');
  if(line){
   line.textContent='';
   line.append('講師・解説：');
   const name=document.createElement('strong');name.textContent='今敏';
   line.appendChild(name);
  }
  if(panel&&!panel.querySelector('.movie90-role-note')){
   const note=document.createElement('small');
   note.className='movie90-role-note';
   note.style.cssText='display:block;color:#a4b6ca;margin:6px 0';
   note.textContent='本映像に監督名の独立した記載はないため、作品の講師・解説者を表示しています。';
   panel.appendChild(note);
  }
 }
 return result;
};
window.__movie30SearchPosters90={refresh:scheduleRefresh,openViewer,closeViewer};
scheduleRefresh();
const build=document.getElementById('movie30BuildV29');if(build)build.textContent='app build '+VERSION;
})();

/* Consolidated from patch-v91.js; original order retained. */
(() => {
'use strict';
// v91: Japanese director-name aliases, and tap posters in list mode to open the existing viewer.
const BUILD='20261012b';
const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const pairs=[
['Yukihiko Tsutsumi','堤幸彦'],['Hayao Miyazaki','宮崎駿'],
['Yasuichiro Yamamoto','山本泰一郎'],['Satoshi Kon','今敏'],
['Hideaki Anno','庵野秀明'],['Kenji Kodama','こだま兼嗣'],
['Kobun Shizuno','静野孔文'],['Kazuya Tsurumaki','鶴巻和哉'],
['Makoto Shinkai','新海誠'],['Mamoru Hosoda','細田守'],
['Katsuyuki Motohiro','本広克行'],['Hiroaki Matsuyama','松山博昭'],
['Isao Takahata','高畑勲'],['Hirokazu Kore-eda','是枝裕和'],
['Mahiro Maeda','前田真宏'],['Takashi Yamazaki','山崎貴'],
['Masayuki Suzuki','鈴木雅之'],['Mamoru Oshii','押井守'],
['Akira Kurosawa','黒澤明','黒沢明'],['Masayuki','摩砂雪'],
['Takeshi Kitano','北野武'],['Sang-il Lee','李相日'],
['Hiroshi Nishitani','西谷弘'],['Katsuo Fukuzawa','福澤克雄'],
['Haruo Sotozaki','外崎春雄'],['Junichi Ishikawa','石川淳一'],
['Norihiro Koizumi','小泉徳宏'],['Chika Nagaoka','永岡智佳'],
['Tōya Satō','佐藤東弥'],['Nobuhiro Doi','土井裕泰'],
['Yūichirō Hayashi','林祐一郎'],['Yasuharu Ishii','石井康晴'],
['Fuminori Kaneko','金子文紀'],['Katsuhiro Otomo','大友克洋'],
['Masayuki Suō','周防正行'],['Shusuke Kaneko','金子修介'],
['Yuzuru Tachikawa','立川譲'],['Izuru Narushima','成島出'],
['Hideki Takeuchi','武内英樹'],['Hiromasa Yonebayashi','米林宏昌'],
['Eiichiro Hasumi','羽住英一郎'],['Yuichi Fukuda','福田雄一'],
['Kōji Morimoto','森本晃司'],['Koji Morimoto','森本晃司'],
['Tensai Okamura','岡村天斎'],['Hiroshi Hamasaki','浜崎博嗣'],
['Sion Sono','園子温'],['Yoshifumi Kondo','近藤喜文'],
['Yukiyo Teramoto','寺本幸代'],['Kinji Fukasaku','深作欣二'],
['Kiyoshi Kurosawa','黒沢清','黒澤清'],['Kazuhiko Hasegawa','長谷川和彦'],
['Tetsuya Nakashima','中島哲也'],['Yu Irie','入江悠'],
['Hiroyuki Morita','森田宏幸'],['Sho Tsukikawa','月川翔'],
['Hideo Nakata','中田秀夫'],['Akira Nagai','永井聡'],
['Goro Taniguchi','谷口悟朗'],['Kon Ichikawa','市川崑'],
['Koreyoshi Kurahara','蔵原惟繕'],['Shinichiro Ueda','上田慎一郎'],
['Masato Harada','原田眞人'],['Keishi Otomo','大友啓史'],
['Genki Kawamura','川村元気'],['Hayato Kawai','河合勇人'],
['Kazuaki Imai','今井一暁'],['Yusuke Hirota','廣田裕介'],
['Kazuya Shiraishi','白石和彌'],['Koki Mitani','三谷幸喜'],
['Yoshihiro Nakamura','中村義洋'],['Hitoshi One','大根仁'],
['Yoshitarō Nomura','野村芳太郎'],['Kenji Uchida','内田けんじ'],
['Shinji Higuchi','樋口真嗣'],['Junta Yamaguchi','山口淳太'],
['Tatsuya Nagamine','長峯達也'],['Takayuki Hirao','平尾隆之'],
['Tetsuro Kodama','児玉徹郎'],['Yuri Kanchiku','寒竹ゆり'],
['Tsutomu Shibayama','芝山努'],['Masahiro Hosoda','細田雅弘'],
['Hisashi Kimura','木村ひさし'],['Seiji Mizushima','水島精二'],
['Shota Goshozono','御所園翔太'],['Masaomi Ando','安藤正臣'],
['Hiroyuki Kitakubo','北久保弘之'],['Shinichiro Watanabe','渡辺信一郎'],
['Yoshiaki Kawajiri','川尻善昭'],['Takeshi Koike','小池健'],
['Shojiro Nishimi','西見祥示郎'],['Kazuto Nakazawa','中澤一登'],
['Shoji Kawamori','河森正治'],['Shinzo Katayama','片山慎三'],
['Yuichiro Hirakawa','平川雄一朗'],['Ayuko Tsukahara','塚原あゆ子'],
['Kentarō Takemura','竹村謙太郎'],['Tomokazu Yamada','山田智和'],
['Tatsuya Yoshihara','吉原達矢'],['Ryu Nakayama','中山竜'],
['Akihiko Uda','宇田鋼之介'],['Atsushi Takahashi','高橋敦史'],
['Kenichi Suzuki','鈴木健一'],['Naokatsu Tsuda','津田尚克'],
['Yuichi Satoh','佐藤祐市'],['Yuichi Sato','佐藤祐市']
];
const aliases=new Map(pairs.map(([english,...names])=>[fold(english),names]));
const priorMatch=match;
match=function(f,q){
 if(priorMatch(f,q))return true;
 return window.Movie30SearchQueries.directorAliases(q,state.letterboxdMeta?.[f.id]||{},aliases,fold);
};
const style=document.createElement('style');
style.id='movie30-poster-click91';
style.textContent=[
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card>.movie30-poster84,',
 '#watchList83 .watch83-grid:not(.poster-gallery84) .watch83-item>.movie30-poster84,',
 '#rankRoot .uns-card img.movie90-result-art,',
 '#rankRoot .uns-card img.movie30-poster84,',
 '#classifyRoot .card img.movie90-result-art{pointer-events:auto!important;cursor:zoom-in!important;touch-action:manipulation}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card>.movie30-poster84:focus-visible,',
 '#watchList83 .watch83-grid:not(.poster-gallery84) .watch83-item>.movie30-poster84:focus-visible,',
 '#rankRoot .uns-card img.movie90-result-art:focus-visible,',
 '#rankRoot .uns-card img.movie30-poster84:focus-visible,',
 '#classifyRoot .card img.movie90-result-art:focus-visible{outline:3px solid #b6d6ff!important;outline-offset:1px}'
].join('\n');
document.head.appendChild(style);
const posterSelector=[
 '#rankRoot .rank-card img.movie30-poster84',
 '#watchList83 .watch83-item img.movie30-poster84',
 '#rankRoot .uns-card img.movie90-result-art',
 '#rankRoot .uns-card img.movie30-poster84',
 '#classifyRoot .card img.movie90-result-art'
].join(',');
function clickablePoster(event){
 const img=event.target?.closest?.(posterSelector);
 if(!img||img.closest('#rankRoot.movie30-rank-grid-only84, .watch83-grid.poster-gallery84'))return null;
 const card=img.closest('[data-id], [data-film], [data-uns]');
 const raw=card?.dataset.id||card?.dataset.film||card?.dataset.uns||img.dataset.posterId||'';
 const id=decodeURIComponent(raw);
 return id&&filmById(id)&&img.getAttribute('src')?{img,id}:null;
}
document.addEventListener('click',event=>{
 const target=clickablePoster(event),viewer=window.__movie30SearchPosters90;
 if(!target||!viewer?.openViewer)return;
 event.preventDefault();event.stopImmediatePropagation();
 viewer.openViewer(target.id,target.img);
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const target=clickablePoster(event),viewer=window.__movie30SearchPosters90;
 if(!target||!viewer?.openViewer)return;
 event.preventDefault();event.stopImmediatePropagation();
 viewer.openViewer(target.id,target.img);
},true);
let queued=false;
function setFocus(){
 queued=false;
 for(const img of document.querySelectorAll(posterSelector)){
  const gallery=!!img.closest('#rankRoot.movie30-rank-grid-only84, .watch83-grid.poster-gallery84');
  if(gallery){
   if(img.dataset.posterClick91){img.removeAttribute('tabindex');img.removeAttribute('role');img.removeAttribute('aria-label');delete img.dataset.posterClick91;}
  }else if(!img.dataset.posterClick91){
   img.dataset.posterClick91='1';img.tabIndex=0;img.setAttribute('role','button');
   img.setAttribute('aria-label','ポスターを拡大表示');
  }
 }
}
function queueFocus(){if(queued)return;queued=true;requestAnimationFrame(setFocus);}
for(const id of ['rankRoot','watchList83','classifyRoot']){
 const root=document.getElementById(id);
 if(root)new MutationObserver(queueFocus).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
queueFocus();
window.__movie30JPDirector91={build:BUILD,knownNames:aliases.size,aliases};
const marker=document.getElementById('movie30BuildV29');
if(marker)marker.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v92.js; original order retained. */
(() => {
'use strict';
// v92: autocomplete for the existing rank/classify searches.
// Suggestions from the local film library are always available.
// Real-time TMDb proposals are an optional addition only when the device has a credential.
const BUILD='20261012c';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const validPoster=s=>typeof s==='string'&&/^\/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp)$/i.test(s)&&!s.includes('..');
const escText=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jpNames=window.__movie30JPDirector91?.aliases||new Map();
let catalog=Object.create(null);
const baseMatch=match;
match=function(f,q){
 if(baseMatch(f,q))return true;
 return window.Movie30SearchQueries.catalogLabels(q,catalog[f.id]||{},norm);
};
window.__movie30LoadCatalog()
 .then(data=>{
   if(!data?.films)return;
   catalog=data.films;
   if(document.getElementById('searchRank')?.value.trim())renderRank();
   if(document.getElementById('searchClassify')?.value.trim())renderClassify();
   for(const box of inputs)if(box.input.value.trim()&&document.activeElement===box.input)refresh(box);
 }).catch(err=>console.warn('TMDb catalog suggestions unavailable',err));

const style=document.createElement('style');
style.id='movie30-search-autocomplete92';
style.textContent=[
 '.movie92-search-wrap{position:relative;flex:1 1 170px;min-width:170px;max-width:100%;}',
 '.movie92-search-wrap>.search{width:100%;min-width:0;display:block;}',
 '.movie92-suggestions{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:1000;overflow-y:auto;overscroll-behavior:contain;max-height:min(410px,60vh);background:#121b26;border:1px solid #53667e;border-radius:12px;box-shadow:0 12px 32px #000b;padding:6px;text-align:left;}',
 '.movie92-suggestions[hidden]{display:none!important;}',
 '.movie92-section{font-size:10px;font-weight:750;color:#afc2d9;letter-spacing:.03em;margin:8px 7px 5px;}',
 '.movie92-entry{display:flex;align-items:center;gap:9px;width:100%;min-height:49px;background:transparent;border:0;border-radius:8px;padding:6px 7px;text-align:left;color:#eaf1fb;}',
 '.movie92-entry:hover,.movie92-entry.is-current,.movie92-entry:focus-visible{background:#29405a;outline:none;}',
 '.movie92-entry img{width:28px;height:42px;flex:0 0 28px;object-fit:contain;background:#0d141d;border-radius:4px;}',
 '.movie92-entry>*{pointer-events:none;}.movie92-entry{touch-action:manipulation;-webkit-tap-highlight-color:rgba(70,130,180,.2);}',
 '.movie92-person{display:flex;align-items:center;justify-content:center;width:28px;height:42px;flex:0 0 28px;background:#233346;border-radius:5px;font-size:17px;}',
 '.movie92-entry-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}',
 '.movie92-entry-title{font-weight:700;font-size:12px;line-height:1.3;overflow-wrap:anywhere;}',
 '.movie92-entry-sub{font-size:10px;line-height:1.35;color:#b2c0d2;overflow-wrap:anywhere;}',
 '.movie92-footer{font-size:10px;color:#9eafc5;margin:7px;padding-top:6px;border-top:1px solid #3a4758;line-height:1.45;}',
 '.movie92-entry-tag{font-size:9px;color:#92e0b1;white-space:nowrap;}',
 '@media (max-width:560px){.movie92-suggestions{max-height:min(390px,59vh)}.movie92-entry{min-height:47px}.movie92-entry-title{font-size:11px}}'
].join('\n');
document.head.appendChild(style);

const inputs=[];
const remoteCache=new Map();
function poster(f){
 const m=state.letterboxdMeta?.[f.id]?.poster84||{};
 const r=catalog[f.id]||{};
 const p=validPoster(m.path)?m.path:r.posterPath;
 return validPoster(p)?'https://image.tmdb.org/t/p/w92'+p:'';
}
function localData(q){
 const target=norm(q),movieItems=[],people=new Map();
 if(!target)return {movies:[],people:[]};
 for(const f of allFilms()){
  const ti=titleInfo(f),r=catalog[f.id]||{},meta=state.letterboxdMeta?.[f.id]||{},crew=meta.crew84||{};
  const titles=[ti.title,ti.englishTitle,ti.originalTitle,f.lbTitle,r.title].filter(Boolean);
  const matching=titles.map(x=>norm(x)).filter(x=>x.includes(target));
  if(matching.length){
   const prefix=matching.some(x=>x.startsWith(target)),exact=matching.some(x=>x===target);
   movieItems.push({kind:'movie',f,id:f.id,label:displayTitle(f),
    detail:[f.year||'',ti.englishTitle&&ti.englishTitle!==displayTitle(f)?ti.englishTitle:''].filter(Boolean).join(' · '),
    score:(exact?900:prefix?700:400)+(effectiveScore(f)!=null?10:0),image:poster(f)});
  }
  const persons=[...(crew.directors||r.directors||[]),...(crew.creators||r.creators||[]),...(window.__movie30Cast?.namesForFilm(f.id)||[])];
  for(const name of persons){
   const key=norm(name);if(!key)continue;
   let item=people.get(key);
   if(!item){
    item={kind:'director',name,aliases:new Set(jpNames.get(key)||[]),ids:new Set(),count:0};
    people.set(key,item);
   }
   item.ids.add(f.id);
   if(persons.length===1)for(const alias of r.directorAliases||[])item.aliases.add(alias);
  }
 }
 const peopleMatches=[];
 for(const item of people.values()){
  item.count=item.ids.size;
  const names=[item.name,...item.aliases];
  const matches=names.map(norm).filter(s=>s.includes(target));
  if(!matches.length)continue;
  const japanese=names.slice(1).find(name=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(name));
  item.label=japanese||item.name;
  item.detail=japanese?item.name+' · '+item.count+'作品':item.count+'作品';
  item.score=(matches.some(x=>x===target)?900:matches.some(x=>x.startsWith(target))?700:400)+Math.min(item.count,40);
  peopleMatches.push(item);
 }
 movieItems.sort((a,b)=>b.score-a.score||(a.label||'').localeCompare(b.label||'','ja'));
 peopleMatches.sort((a,b)=>b.score-a.score||b.count-a.count);
 return {movies:movieItems.slice(0,7),people:peopleMatches.slice(0,6)};
}
function remoteData(data,q){
 const result=[];
 const used=new Set();
 for(const x of data?.results||[]){
  const kind=x.media_type;
  if(kind!=='movie'&&kind!=='tv'&&kind!=='person')continue;
  if(x.adult===true)continue;
  if(!x.id||used.has(kind+':'+x.id))continue;
  used.add(kind+':'+x.id);
  const title=String(x.title||x.name||'').trim();
  if(!title)continue;
  const image=kind==='person'?x.profile_path:x.poster_path;
  result.push({
   kind:'remote',media:kind,tmdbId:x.id,label:title,
   detail:kind==='person'?'人物・別名からの候補':kind==='tv'?[(x.first_air_date||'').slice(0,4),'ドラマ・番組'].filter(Boolean).join(' · '):(x.release_date||'').slice(0,4)+' · TMDb',
   image:validPoster(image)?'https://image.tmdb.org/t/p/w92'+image:'',
   original:x.original_title||x.original_name||'',
  });
  if(result.length>=7)break;
 }
 return result;
}
function remoteAlreadyLocal(item){
 if(item.media==='person'){
  return allFilms().some(f=>{
   const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
   return [...(crew.directors||[]),...(crew.creators||[]),...(window.__movie30Cast?.namesForFilm(f.id)||[])].some(n=>norm(n)===norm(item.label));
  });
 }
 return allFilms().some(f=>{
   const ti=titleInfo(f),m=state.letterboxdMeta?.[f.id]||{},r=catalog[f.id]||{};
   if(item.media==='tv'&&['tv_episode','tv_season'].includes(m.contentType))return false;
   const kind=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'').toLowerCase();
   const tv=['tvseries','drama','series'].includes(kind)||m.contentType==='tv_series'||m.tmdbType==='tv'||f.tmdbType==='tv';
   if((item.media==='tv')!==tv)return false;
   const ids=item.media==='tv'?[m.tmdbSeriesId,m.poster84?.tmdbId,ti.tmdbId,r.tmdbId]:[m.poster84?.tmdbId,ti.tmdbId,r.tmdbId];
   if(Number(item.tmdbId)>0&&ids.some(id=>Number(id)===Number(item.tmdbId)))return true;
   const year=Number(item.year||String(item.detail||'').slice(0,4))||0;
   if(!year||Number(f.year)!==year)return false;
   return [ti.title,ti.englishTitle,ti.originalTitle,f.lbTitle].some(n=>
    !!norm(n)&&(norm(n)===norm(item.label)||norm(n)===norm(item.original)));
 });
}
function hide(box){box.menu.hidden=true;box.entries=[];box.selected=-1;}
function fitSuggestions(box){
 if(box.menu.hidden)return;
 const viewport=window.visualViewport;
 // On iOS the visual viewport can pan while the keyboard is open. Use the
 // smaller coordinate-space bound so candidates never extend under it.
 const visibleBottom=viewport?Math.min(window.innerHeight,viewport.height,viewport.offsetTop+viewport.height):window.innerHeight;
 const top=box.menu.getBoundingClientRect().top;
 const available=Math.max(0,visibleBottom-top-12);
 box.menu.style.maxHeight=Math.min(410,available)+'px';
 box.menu.style.visibility=available<48?'hidden':'';
}
function label(item){
 if(item.kind==='movie')return item.label;
 if(item.kind==='director')return item.label;
 return item.label;
}
function addEntry(box,item){
 const b=document.createElement('button');b.type='button';b.className='movie92-entry';
 const image=item.image;
 if(image){const img=document.createElement('img');img.src=image;img.alt='';img.loading='lazy';b.appendChild(img);}
 else {const placeholder=document.createElement('span');placeholder.className='movie92-person';placeholder.textContent=item.kind==='director'||item.media==='person'?'👤':'🎬';b.appendChild(placeholder);}
 const span=document.createElement('span');span.className='movie92-entry-text';
 const title=document.createElement('span');title.className='movie92-entry-title';title.textContent=label(item);
 const sub=document.createElement('span');sub.className='movie92-entry-sub';sub.textContent=item.detail||'';
 span.append(title,sub);b.appendChild(span);
 if(item.kind==='remote'){const tag=document.createElement('span');tag.className='movie92-entry-tag';tag.textContent='TMDb';b.append(tag);}
 // iOS installed-web-app Safari can cancel click on an image while dismissing
 // the software keyboard. Handle a stationary finger lift directly as well.
 let finger=null,lastTouch=0;
 b.addEventListener('pointerdown',event=>event.preventDefault());
 b.addEventListener('touchstart',event=>{
  const t=event.touches[0];
  finger=t?{x:t.clientX,y:t.clientY}:null;
 },{passive:true});
 b.addEventListener('touchend',event=>{
  const t=event.changedTouches[0],origin=finger;finger=null;
  if(!t||!origin||Math.hypot(t.clientX-origin.x,t.clientY-origin.y)>14)return;
  event.preventDefault();event.stopPropagation();lastTouch=Date.now();
  choose(box,item);
 },{passive:false});
 b.addEventListener('touchcancel',()=>{finger=null;},{passive:true});
 b.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();
  if(Date.now()-lastTouch<800)return;
  choose(box,item);
 });
 box.menu.appendChild(b);box.entries.push(b);
}
function section(box,title,list){
 if(!list.length)return;
 const heading=document.createElement('div');heading.className='movie92-section';heading.textContent=title;box.menu.appendChild(heading);
 for(const item of list)addEntry(box,item);
}
function refresh(box){
 if(document.activeElement!==box.input)return;
 const q=box.input.value.trim();
 if(!q){hide(box);return;}
 const local=localData(q);
 box.menu.textContent='';box.entries=[];box.selected=-1;box.menu.hidden=false;
 section(box,'登録済みの作品',local.movies);
 section(box,'監督・製作者・出演者',local.people);
 const online=(box.remoteQuery===q?box.remoteItems:[]).filter(x=>!remoteAlreadyLocal(x));
 section(box,'TMDbオンライン（未登録・追加候補）',online);
 const foot=document.createElement('div');foot.className='movie92-footer';
 if(!box.entries.length){foot.textContent='候補はまだありません。通常の検索はそのまま使えます。';}
 else if(!getTmdbCredential())foot.textContent='現在は登録作品の候補を表示中。オンライン候補は端末側にTMDbキーを設定すると使えます。';
 else if(box.remoteQuery!==q&&q.length>=2)foot.textContent='入力を止めるとTMDbの追加候補も表示します。';
 else foot.textContent='人物候補は人物の作品一覧を開きます。作品候補は一覧の絞り込み・追加に使えます。';
 box.menu.appendChild(foot);
 requestAnimationFrame(()=>fitSuggestions(box));
}
function setQuery(box,s){
 box.input.value=s;
 box.input.dispatchEvent(new Event('input',{bubbles:true}));
 hide(box);
 box.input.focus({preventScroll:true});
}
let movie92RemoteLoader=null;
function loadRemoteAdd92(){
 if(window.__movie30RemoteAdd?.open)return Promise.resolve(true);
 if(movie92RemoteLoader)return movie92RemoteLoader;
 movie92RemoteLoader=new Promise(resolve=>{
  const script=document.createElement('script');
  script.src=new URL('app-remote-add.js?v=20261014c',document.baseURI).href;
  script.async=true;
  script.onload=()=>resolve(!!window.__movie30RemoteAdd?.open);
  script.onerror=()=>resolve(false);
  document.head.appendChild(script);
 }).finally(()=>{movie92RemoteLoader=null;});
 return movie92RemoteLoader;
}
async function choose(box,item){
 hide(box);
 if(item.kind==='remote' && (item.media==='movie'||item.media==='tv')){
  box.input.blur();
  const ready=await loadRemoteAdd92();
  if(ready){window.__movie30RemoteAdd.open(item);}
  else toast('作品追加画面を読み込めません。再読み込みしてください。');
  return;
 }
 if(window.__movie30People && (item.kind==='director'||item.media==='person')){
  box.input.blur();
  window.__movie30People.open({id:item.media==='person'?item.tmdbId:0,name:item.name||item.label});
  return;
 }
 if(item.kind==='movie'){box.input.blur();openSheet(item.f.id);return;}
 if(item.kind==='director'){setQuery(box,item.name);return;}
 if(item.media==='person'){
  // TMDb often returns the Latin spelling for a Japanese alias.
  const q=norm(item.label);
  let canonical=allFilms().flatMap(f=>{
   const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
   return [...(crew.directors||[]),...(crew.creators||[]),...(window.__movie30Cast?.namesForFilm(f.id)||[])];
  }).find(name=>norm(name)===q);
  if(!canonical&&getTmdbCredential()){
   try{
    const detail=await tmdbFetch('/person/'+item.tmdbId,{language:'ja-JP'});
    const variants=[detail.name,...(detail.also_known_as||[])].map(norm);
    canonical=allFilms().flatMap(f=>{
     const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
     return [...(crew.directors||[]),...(crew.creators||[]),...(window.__movie30Cast?.namesForFilm(f.id)||[])];
    }).find(name=>variants.includes(norm(name)));
   }catch(_){}
  }
  setQuery(box,canonical||item.label);
  return;
 }
 if(item.media==='movie'){
  const local=allFilms().find(f=>{
   const ti=titleInfo(f),rec=catalog[f.id]||{},m=state.letterboxdMeta?.[f.id]||{};
   return Number(item.tmdbId)===Number(m.poster84?.tmdbId||ti.tmdbId||rec.tmdbId);
  });
  if(local){box.input.blur();openSheet(local.id);return;}
  document.getElementById('quickAdd')?.click();
  if(typeof selectTmdb==='function')selectTmdb(item.tmdbId);
  return;
 }
}
function queueOnline(box){
 if(box.timer)clearTimeout(box.timer);
 const q=box.input.value.trim();
 if(q.length<2||!getTmdbCredential()){
  box.remoteQuery='';box.remoteItems=[];return;
 }
 if(remoteCache.has(q)){box.remoteQuery=q;box.remoteItems=remoteCache.get(q);refresh(box);return;}
 const ticket=++box.ticket;
 box.timer=setTimeout(async()=>{
  try{
   const data=await tmdbFetch('/search/multi',{query:q,language:'ja-JP',include_adult:'false',page:1});
   remoteCache.set(q,remoteData(data,q));
   if(ticket!==box.ticket||box.input.value.trim()!==q)return;
   box.remoteItems=remoteCache.get(q);box.remoteQuery=q;refresh(box);
  }catch(e){
   if(ticket===box.ticket){box.remoteQuery='';box.remoteItems=[];}
   console.warn('TMDb live search unavailable',e);
  }
 },380);
}
function setup(input){
 if(!input)return;
 const shell=document.createElement('div');shell.className='movie92-search-wrap';
 input.parentNode.insertBefore(shell,input);shell.appendChild(input);
 const menu=document.createElement('div');menu.className='movie92-suggestions';menu.hidden=true;
 menu.setAttribute('role','listbox');menu.setAttribute('aria-label','検索候補');
 shell.appendChild(menu);
 const box={input,shell,menu,entries:[],selected:-1,timer:null,ticket:0,remoteQuery:'',remoteItems:[]};
 inputs.push(box);
 input.setAttribute('autocomplete','off');
 input.setAttribute('aria-autocomplete','list');
 input.addEventListener('input',()=>{box.ticket++;refresh(box);queueOnline(box);});
 // Suggestions appear in response to typing, not when the user merely focuses the field.
 input.addEventListener('keydown',event=>{
  if(menu.hidden)return;
  if(event.key==='Escape'){event.preventDefault();hide(box);return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   if(!box.entries.length)return;
   event.preventDefault();
   box.selected=(box.selected+(event.key==='ArrowDown'?1:-1)+box.entries.length)%box.entries.length;
   for(const [i,b] of box.entries.entries())b.classList.toggle('is-current',i===box.selected);
   box.entries[box.selected].scrollIntoView({block:'nearest'});
  }else if(event.key==='Enter'&&box.selected>=0){
   event.preventDefault();box.entries[box.selected]?.click();
  }
 });
 document.addEventListener('pointerdown',event=>{if(!shell.contains(event.target))hide(box);});
}
setup(document.getElementById('searchRank'));
setup(document.getElementById('searchClassify'));
window.visualViewport?.addEventListener('resize',()=>inputs.forEach(fitSuggestions),{passive:true});
window.visualViewport?.addEventListener('scroll',()=>inputs.forEach(fitSuggestions),{passive:true});
window.addEventListener('resize',()=>inputs.forEach(fitSuggestions),{passive:true});
window.__movie30AutoComplete92={build:BUILD,refresh:()=>inputs.forEach(refresh)};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v93.js; original order retained. */
(() => {
'use strict';
// v93: Read-only combined director / performer / genre filters.
// Works with ranked, classified, and every chronological / poster list.
// No changes to rating, order, notes, or the user's genre classifications.
const VERSION='20261012d';
const fold=x=>String(x||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const knownJP=window.__movie30JPDirector91?.aliases||new Map();
let catalog={};
const chosen={director:'',actor:'',genre:''};
const panels=[];
const genresSynonyms={
 'sf':['sf','サイエンスフィクション','sciencefiction'],
 'サイエンスフィクション':['sf','サイエンスフィクション','sciencefiction'],
 'アニメ':['アニメーション','animation'], 'アニメーション':['アニメ','animation'],
 'クライム':['犯罪','crime'],'犯罪':['クライム','crime'],
 'ホラー':['horror'],'スリラー':['thriller'],
 '恋愛':['romance'],'ロマンス':['恋愛'],
 'ファンタジー':['fantasy']
};
function rowFor(f){return catalog[f.id]||{};}
function directors(f){
 const m=state.letterboxdMeta?.[f.id]||{},cr=m.crew84||{},r=rowFor(f);
 const assigned=m.directors84Manual?.length?m.directors84Manual:(cr.directors?.length?cr.directors:(r.directors||[]));
 return {names:[...assigned,...(cr.creators||[]),...(r.creators||[])],
  aliases:Array.isArray(r.directorAliases)?r.directorAliases:[]};
}
function actors(f){
 const r=rowFor(f);
 return Array.isArray(r.cast)?r.cast:[];
}
function genres(f){
 const manual=state.genreOverrides?.[f.id]||[];
 const remote=rowFor(f).genres||[];
 return [...new Set([...(Array.isArray(manual)?manual:[]),...(Array.isArray(remote)?remote:[])].filter(Boolean))];
}
function genreMatch(f,q){
 const needle=fold(q),equivalent=(genresSynonyms[needle]||[]).map(fold);
 return genres(f).some(n=>{
  const k=fold(n);
  return k.includes(needle)||equivalent.some(a=>k.includes(a));
 });
}
function matches(f){
 if(chosen.director){
  const needle=fold(chosen.director),entry=directors(f);
  const all=[...entry.names,...entry.aliases];
  for(const name of entry.names)all.push(...(knownJP.get(fold(name))||[]));
  if(!all.some(s=>fold(s).includes(needle)))return false;
 }
 if(chosen.actor){
  const needle=fold(chosen.actor);
  if(!actors(f).some(p=>{
   const name=typeof p==='string'?p:p.name;
   return [name,...(typeof p==='string'?[]:(p.aliases||[]))].some(s=>fold(s).includes(needle));
  }))return false;
 }
 if(chosen.genre&&!genreMatch(f,chosen.genre))return false;
 return true;
}
function options(){
 const person={director:new Map(),actor:new Map()};
 const g=new Map();
 const count=(map,text,english)=>{
  const key=fold(english||text);if(!key)return;
  const item=map.get(key)||{text:english||text,display:text||english,count:0};
  item.count++;if(!map.has(key))map.set(key,item);
 };
 for(const f of allFilms()){
  const entry=directors(f),distinctNames=new Set(entry.names.map(s=>String(s).trim()).filter(Boolean));
  for(const name of distinctNames){
   const aliases=knownJP.get(fold(name))||[];
   const japanese=aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x))
    ||(distinctNames.size===1?entry.aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x)):null);
   count(person.director,japanese||name,name);
  }
  const cast=actors(f);
  const actorSeen=new Set();
  for(const p of cast){
   const name=typeof p==='string'?p:p.name;
   if(!name||actorSeen.has(fold(name)))continue;
   actorSeen.add(fold(name));
   const aliases=typeof p==='string'?[]:p.aliases||[];
   const native=aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x));
   count(person.actor,native||name,name);
  }
  for(const genre of new Set(genres(f))){
   const key=fold(genre);if(key)g.set(genre,(g.get(genre)||0)+1);
  }
 }
 return {director:[...person.director.values()],actor:[...person.actor.values()],genre:[...g].sort((a,b)=>a[0].localeCompare(b[0],'ja'))};
}
let candidates=options();
function counter(){
 const total=allFilms().length;
 const matched=allFilms().filter(matches).length;
 const castNum=allFilms().filter(f=>Array.isArray(rowFor(f).cast)).length;
 const active=Object.values(chosen).filter(Boolean).length;
 return {total,matched,castNum,active};
}
function rerender(){
 try{renderRank();renderClassify();}catch(e){console.error('Movie filters could not redraw',e);}
 updateLabels();
}
function updateLabels(){
 const count=counter();
 for(const p of panels){
  p.heading.textContent=count.active?'絞り込み（'+count.active+'条件）':'監督・出演者・ジャンルで絞り込み';
  p.summary.textContent=(count.active?count.matched+' / '+count.total+'作品に絞り込み。':'登録作品 '+count.total+'本。')+' 出演者データ '+count.castNum+'作品。';
  if(count.castNum<Math.min(count.total,20))p.summary.textContent+=' TMDbの出演者データは更新後に増えます。';
  for(const field of ['director','actor','genre']){
   if(document.activeElement!==p.inputs[field]&&p.inputs[field].value!==chosen[field])p.inputs[field].value=chosen[field];
  }
  const newValue=p.select.value;
  const genreLabels=candidates.genre.map(([name,n])=>({name,n}));
  p.select.replaceChildren(new Option('ジャンルを選択',''),...genreLabels.map(({name,n})=>new Option(name+'（'+n+'本）',name)));
  p.select.value=chosen.genre;
  p.clear.disabled=!count.active;
 }
}
const css=document.createElement('style');css.id='movie30-library-filters93';
css.textContent=[
 '.movie93-filter{border:1px solid #384b60;border-radius:11px;margin:6px 0 11px;background:#101923;padding:0 10px;}',
 '.movie93-filter>summary{display:flex;align-items:center;justify-content:space-between;cursor:pointer;min-height:42px;gap:10px;font-size:12px;font-weight:750;color:#d7e5f7;list-style:none;}',
 '.movie93-filter>summary::-webkit-details-marker{display:none;}',
 '.movie93-filter>summary:after{content:"⌄";color:#a8bfd8;font-size:17px;}',
 '.movie93-filter[open]>summary:after{content:"⌃";}',
 '.movie93-filter-content{padding:3px 0 10px;}',
 '.movie93-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}',
 '.movie93-label{display:block;color:#b0c2d5;font-size:11px;font-weight:700;margin-bottom:5px;}',
 '.movie93-box{position:relative;min-width:0;}',
 '.movie93-box input,.movie93-box select{display:block;width:100%;min-height:40px;color:#edf3fb;border:1px solid #50637a;border-radius:8px;background:#172637;padding:7px 9px;font-size:15px;}',
 '.movie93-box input::placeholder{color:#9aacc1;}',
 '.movie93-drop{position:absolute;left:0;right:0;top:100%;z-index:1500;max-height:240px;overflow:auto;background:#182739;border:1px solid #5b748f;border-radius:8px;box-shadow:0 8px 20px #0009;}',
 '.movie93-drop[hidden]{display:none!important;}',
 '.movie93-drop button{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;padding:10px 9px;min-height:39px;text-align:left;color:#edf2fb;background:transparent;border:0;border-bottom:1px solid #2e4256;font-size:12px;}',
 '.movie93-drop button:hover,.movie93-drop button:focus-visible{background:#304968;}',
 '.movie93-drop small{color:#a6bad1;font-size:10px;white-space:nowrap;}',
 '.movie93-tail{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:space-between;margin-top:10px;}',
 '.movie93-stats{font-size:10px;color:#a9b9ca;line-height:1.4;}',
 '.movie93-clear{color:#dce9f7;background:#263a4f;border:1px solid #536a83;border-radius:8px;padding:6px 12px;font-size:12px;}',
 '.movie93-clear:disabled{opacity:.45;}',
 '@media(max-width:620px){.movie93-filter-grid{grid-template-columns:1fr 1fr;gap:8px}.movie93-box.movie93-genre{grid-column:1/-1}.movie93-filter{margin:6px 0 10px;}}'
].join('\n');document.head.append(css);
function openSuggestions(panel,field){
 const input=panel.inputs[field],menu=panel.drop[field],needle=fold(input.value.trim());
 if(!needle){menu.hidden=true;return;}
 const hits=candidates[field].filter(item=>
  fold(item.text).includes(needle)||fold(item.display).includes(needle))
  .sort((a,b)=>{
   const aStart=fold(a.display).startsWith(needle)||fold(a.text).startsWith(needle);
   const bStart=fold(b.display).startsWith(needle)||fold(b.text).startsWith(needle);
   return Number(bStart)-Number(aStart)||b.count-a.count;
  }).slice(0,8);
 menu.replaceChildren();
 if(!hits.length){menu.hidden=true;return;}
 for(const item of hits){
  const button=document.createElement('button');button.type='button';
  const name=document.createElement('span');
  name.textContent=item.display===item.text?item.text:item.display+' / '+item.text;
  const count=document.createElement('small');count.textContent=item.count+'作品';
  button.append(name,count);
  button.addEventListener('pointerdown',event=>event.preventDefault());
  button.addEventListener('click',()=>{
   chosen[field]=item.text;
   menu.hidden=true;
   syncValues();rerender();
  });
  menu.appendChild(button);
 }
 menu.hidden=false;
}
function syncValues(){
 for(const panel of panels){
  for(const field of ['director','actor'])panel.inputs[field].value=chosen[field];
  panel.select.value=chosen.genre;
 }
}
function construct(page){
 const root=document.getElementById('page-'+page);
 if(!root)return;
 const tool=root.querySelector('.tools');
 if(!tool)return;
 const details=document.createElement('details');details.className='movie93-filter';details.id='movie93-filter-'+page;
 const heading=document.createElement('summary');heading.textContent='監督・出演者・ジャンルで絞り込み';
 const content=document.createElement('div');content.className='movie93-filter-content';
 const grid=document.createElement('div');grid.className='movie93-filter-grid';
 const panel={details,heading,inputs:{},drop:{},select:null,clear:null,summary:null};
 for(const [field,name,placeholder] of [['director','監督','例：宮崎駿'],['actor','出演者','例：トム・ハンクス']]){
  const box=document.createElement('div');box.className='movie93-box';
  const label=document.createElement('label');label.className='movie93-label';label.textContent=name;
  const input=document.createElement('input');input.type='search';input.placeholder=placeholder;
  input.autocomplete='off';input.setAttribute('aria-label',name+'で絞り込み');
  const drop=document.createElement('div');drop.className='movie93-drop';drop.hidden=true;
  label.appendChild(input);box.append(label,drop);grid.appendChild(box);
  panel.inputs[field]=input;panel.drop[field]=drop;
  input.addEventListener('input',()=>{
   chosen[field]=input.value.trim();
   for(const other of panels)if(other!==panel)other.inputs[field].value=chosen[field];
   openSuggestions(panel,field);rerender();
  });
  input.addEventListener('focus',()=>openSuggestions(panel,field));
  input.addEventListener('keydown',event=>{
   if(event.key==='Escape'){drop.hidden=true;input.blur();}
   if(event.key==='Enter'&&!drop.hidden){
    const first=drop.querySelector('button');
    if(first){event.preventDefault();first.click();}
   }
  });
 }
 const genreBox=document.createElement('div');genreBox.className='movie93-box movie93-genre';
 const genreLabel=document.createElement('label');genreLabel.className='movie93-label';genreLabel.textContent='外部情報も含むジャンル（1つ）';
 const sel=document.createElement('select');sel.setAttribute('aria-label','外部情報も含むジャンルで絞り込み');
 genreLabel.append(sel);genreBox.append(genreLabel);grid.append(genreBox);
 panel.select=sel;panel.inputs.genre=sel;
 sel.addEventListener('change',()=>{
  chosen.genre=sel.value;for(const other of panels)other.select.value=chosen.genre;
  rerender();
 });
 const footer=document.createElement('div');footer.className='movie93-tail';
 const summary=document.createElement('span');summary.className='movie93-stats';
 const clear=document.createElement('button');clear.type='button';clear.className='movie93-clear';clear.textContent='条件をすべて解除';
 clear.addEventListener('click',()=>{
  chosen.director='';chosen.actor='';chosen.genre='';
  for(const p of panels)for(const field of ['director','actor'])p.drop[field].hidden=true;
  syncValues();rerender();
 });
 panel.clear=clear;panel.summary=summary;
 footer.append(summary,clear);content.append(grid,footer);details.append(heading,content);
 tool.insertAdjacentElement('afterend',details);
 details.addEventListener('toggle',()=>{
  for(const p of panels)if(p!==panel)p.details.open=details.open;
 });
 panels.push(panel);
}
construct('rank');construct('classify');
document.addEventListener('pointerdown',event=>{
 for(const panel of panels){
  for(const field of ['director','actor']){
   if(!panel.inputs[field].parentElement.contains(event.target) &&
      !panel.drop[field].contains(event.target))panel.drop[field].hidden=true;
  }
 }
});
async function load(){
 try{
  const data=await window.__movie30LoadCatalog();
  if(data.schema!==1||!data.films)return;
  catalog=data.films;
  candidates=options();
  updateLabels();
  rerender();
 }catch(e){console.warn('Movie cast/genre catalog unavailable; using saved genres and directors',e);}
}
window.__movie30AdvancedFilter93={matches,hasActive:()=>Boolean(chosen.director||chosen.actor||chosen.genre),reset:()=>{
 chosen.director='';chosen.actor='';chosen.genre='';syncValues();rerender();
},setFilters:value=>{
 chosen.director=String(value?.director||'');chosen.actor=String(value?.actor||'');chosen.genre=String(value?.genre||'');syncValues();rerender();
},getFilters:()=>({...chosen}),version:VERSION};
updateLabels();
load();
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+VERSION;
})();

/* Consolidated from patch-v94.js; original order retained. */
(() => {
'use strict';
// v94: Letterboxd-style vertical swipe to dismiss the full-screen poster.
// Images still tap to zoom; while zoomed, gestures pan the zoomed artwork.
const viewer=document.getElementById('movie30CoverLightbox90');
const stage=viewer?.querySelector('.movie90-viewer-stage');
const poster=stage?.querySelector('img');
const service=window.__movie30SearchPosters90;
if(!viewer||!stage||!poster||!service?.closeViewer)return;
const css=document.createElement('style');css.id='movie30-poster-swipe94';
css.textContent=[
 '.movie90-viewer:not([hidden]) .movie90-viewer-stage:not(.is-zoomed){touch-action:pan-x;overscroll-behavior:contain;}',
 '.movie90-viewer-stage:not(.is-zoomed) img{will-change:transform;}',
 '.movie90-viewer-stage.is-zoomed{touch-action:pan-x pan-y;}',
 '@media (prefers-reduced-motion:reduce){.movie90-viewer-stage img{transition:none!important;}}'
].join('\n');
document.head.appendChild(css);
const hint=viewer.querySelector('.movie90-viewer-hint');
if(hint)hint.textContent='上下にスワイプして戻る · 画像をタップして拡大・縮小';
let gesture=null,suppressClickUntil=0;
function clearTransform(animate=false){
 poster.style.transition=animate?'transform 160ms ease-out':'';
 poster.style.transform='';
 viewer.style.background='';
 if(animate)setTimeout(()=>{poster.style.transition='';},180);
}
function reset(){gesture=null;clearTransform(false);}
const baseOpen=service.openViewer,baseClose=service.closeViewer;
// Keep other callers intact; observer resets after a prior viewer session closes.
const observer=new MutationObserver(()=>{
 if(viewer.hidden)reset();
});
observer.observe(viewer,{attributes:true,attributeFilter:['hidden']});
stage.addEventListener('touchstart',event=>{
 if(viewer.hidden||stage.classList.contains('is-zoomed')||event.touches.length!==1){gesture=null;return;}
 const t=event.touches[0];
 gesture={x:t.clientX,y:t.clientY,vertical:false,moved:false};
 clearTransform();
},{passive:true});
stage.addEventListener('touchmove',event=>{
 if(!gesture||viewer.hidden||stage.classList.contains('is-zoomed')||event.touches.length!==1)return;
 const t=event.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
 if(!gesture.vertical){
  if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)){gesture=null;return;}
  if(Math.abs(dy)<9||Math.abs(dy)<Math.abs(dx)*1.2)return;
  gesture.vertical=true;
 }
 if(event.cancelable)event.preventDefault();
 gesture.moved=true;
 const move=Math.max(-300,Math.min(300,dy));
 poster.style.transform='translate3d(0,'+move+'px,0)';
 viewer.style.background='rgba(1,3,7,'+(0.975-0.32*Math.min(Math.abs(move)/300,1))+')';
},{passive:false});
stage.addEventListener('touchend',event=>{
 if(!gesture)return;
 const g=gesture;gesture=null;
 if(!g.vertical||!event.changedTouches.length){clearTransform(true);return;}
 const t=event.changedTouches[0],dy=t.clientY-g.y,dx=t.clientX-g.x;
 suppressClickUntil=Date.now()+650;
 if(Math.abs(dy)>=90&&Math.abs(dy)>=Math.abs(dx)*1.25){
  clearTransform();
  service.closeViewer();
 }else clearTransform(true);
},{passive:true});
stage.addEventListener('touchcancel',()=>{gesture=null;clearTransform(true);},{passive:true});
// Suppress the delayed image-click (zoom) after dragging the poster to dismiss.
poster.addEventListener('click',event=>{
 if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
},true);
window.__movie30PosterSwipe94={version:'20261012d',active:()=>!viewer.hidden};
const marker=document.getElementById('movie30BuildV29');
if(marker)marker.textContent='app build 20261012d';
})();

/* Consolidated from patch-v95.js; original order retained. */
(() => {
'use strict';
// v95: merge redundant advanced controls, sticky score numbers, and variable-height rank cards.
const BUILD='20261012e';
const old=document.getElementById('advBox66');
const facets=document.getElementById('movie93-filter-rank');
const toggle=document.getElementById('advToggle66');
const current=window.__movie30AdvancedFilter93;

const rules=document.createElement('style');
rules.id='movie30-layout95';
rules.textContent=[
 // There should be one advanced-filter panel, not two stacked independent boxes.
 '#advBox66 .movie95-facet{padding:0 0 13px;margin:0 0 14px;border-bottom:1px solid #344458;}',
 '#advBox66 .movie95-facet-title{font-size:12px;font-weight:750;color:#d9e6f7;margin:1px 0 9px;}',
 '#advBox66 #movie93-filter-rank{margin:0;padding:0;background:transparent;border:0;border-radius:0;}',
 '#advBox66 #movie93-filter-rank>summary{display:none!important;}',
 '#advBox66 #movie93-filter-rank .movie93-filter-content{padding:0;}',
 '#advBox66 .movie93-tail{margin-top:7px;}',
 // The score is sticky until the last movie in that particular score group.
 // The parent used overflow:hidden, which prevented WebKit sticky from tracking viewport scroll.
 '#rankRoot .rank-star{overflow:visible!important;}',
 '#rankRoot .rank-star>.rank-star-head{border-radius:12px 12px 0 0;}',
 '#rankRoot .score-bin{align-items:stretch;}',
 '#rankRoot .score-bin>.score-label{position:-webkit-sticky!important;position:sticky!important;top:var(--movie95-score-top,112px)!important;align-self:start!important;z-index:6;background:#132031!important;box-shadow:0 3px 9px rgba(0,0,0,.35);border-radius:0 0 6px 0;}',
 // Allow cards to grow for two-line titles, long Japanese titles, and multi-genre metadata.
 // The fixed 82px height was clipping the genre underneath the title.
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card{height:auto!important;min-height:82px!important;max-height:none!important;overflow:visible!important;align-items:center!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card.movie30-rank-poster84{box-sizing:border-box!important;padding-top:6px!important;padding-bottom:6px!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card .rank-edit{min-width:0!important;max-width:100%!important;overflow:visible!important;white-space:normal!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card .rank-title{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.32!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card .rank-meta{display:block!important;overflow:visible!important;max-height:none!important;-webkit-line-clamp:unset!important;white-space:normal!important;line-height:1.38!important;margin-top:5px!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card .genre-line{display:block!important;max-height:none!important;white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere!important;line-height:1.4!important;margin-top:4px!important;}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card>.movie30-poster84{object-fit:contain!important;}',
 '@media (max-width:560px){#rankRoot:not(.movie30-rank-grid-only84) .rank-card .rank-title{font-size:11.5px!important;line-height:1.38!important;}#rankRoot:not(.movie30-rank-grid-only84) .rank-card .genre-line{font-size:9.3px!important;line-height:1.45!important;}}'
].join('\n');
document.head.appendChild(rules);

// The older 詳細絞込 panel is redrawn whenever a genre chip changes.
// Keep the *same* faceted-filter DOM node alive and reattach it after such redraws,
// preserving typed values, event handlers, and catalog state.
if(old&&facets){
 const group=document.createElement('section');
 group.className='movie95-facet';
 group.id='movie95FacetGroup';
 const heading=document.createElement('div');
 heading.className='movie95-facet-title';
 heading.textContent='2. 人物・外部情報から探す';
 group.append(heading,facets);
 facets.open=true;
 const relink=()=>{
  if(group.parentElement!==old)old.insertBefore(group,old.firstChild);
 };
 relink();
 new MutationObserver(mutations=>{
  if(mutations.some(m=>m.type==='childList'&&m.target===old))relink();
 }).observe(old,{childList:true});
 // Advanced filters open in their existing place; the standalone panel is gone.
 if(toggle){
  toggle.setAttribute('aria-controls','advBox66');
  toggle.setAttribute('aria-expanded',String(old.classList.contains('open')));
  toggle.addEventListener('click',()=>{
   toggle.setAttribute('aria-expanded',String(old.classList.contains('open')));
  });
 }
}
function flagActive(){
 const active=Boolean(current?.hasActive?.());
 if(toggle){
  toggle.textContent=active?'詳細絞込 ●':'詳細絞込';
  toggle.title=active?'監督・出演者・TMDbジャンルの条件が適用中':'監督・出演者・ジャンル・年・点数などで絞り込み';
 }
 if(active)document.getElementById('advBadge66')?.classList.add('on');
 return active;
}

// The v66 rank renderer otherwise makes the drag handles active again, even
// after v93 filtered the list. Disable editing while these new facets are set.
renderRank=window.Movie30RenderLifecycle.decorate(renderRank,{after(){
 if(flagActive()){
  for(const handle of document.querySelectorAll('#rankRoot .rank-card .drag-handle')){
   handle.disabled=true;
   handle.onpointerdown=null;
   handle.title='絞り込みを解除すると順位を変更できます';
   handle.textContent='—';
   handle.style.opacity='.35';
  }
 }
}});
flagActive();

// Compute the actual bottom of the existing sticky page header.
// Fixed pixel top values overlap on iPhone when its header wraps into 2-3 rows.
let raf=0,previous=-1;
function alignLabel(){
 raf=0;
 const header=document.querySelector('.top');
 if(!header)return;
 const bottom=(header.getBoundingClientRect().height+(parseFloat(getComputedStyle(header).top)||0));
 const offset=Math.max(0,Math.ceil(bottom+5));
 if(Math.abs(offset-previous)>=1){
  previous=offset;
  document.documentElement.style.setProperty('--movie95-score-top',offset+'px');
 }
}
function scheduleAlign(){
 if(raf)return;
 raf=requestAnimationFrame(alignLabel);
}
alignLabel();
window.addEventListener('resize',scheduleAlign,{passive:true});

if(typeof ResizeObserver==='function'){
 const header=document.querySelector('.top');
 if(header)new ResizeObserver(scheduleAlign).observe(header);
}
window.__movie30Layout95={version:BUILD,refresh:scheduleAlign};
const marker=document.getElementById('movie30BuildV29');
if(marker)marker.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v96.js; original order retained. */
(() => {
'use strict';
// v96: one compact search field, expandable full filters and score labels below sticky star nav.
const BUILD='20261012h';
const page=document.getElementById('page-rank');
const tools=page?.querySelector(':scope > .tools');
const adv=document.getElementById('advBox66');
const input=document.getElementById('searchRank');
const searchShell=input?.closest('.movie92-search-wrap')||input;
const quickToggle=document.getElementById('advToggle66');
const nav=document.getElementById('starJumpBar');
if(!page||!tools||!adv||!input||!searchShell)return;

const css=document.createElement('style');
css.id='movie30-search-unified96';
css.textContent=[
 '#page-rank>.tools.movie96-compact-tools{display:block!important;margin:12px 0 8px!important;}',
 '#page-rank>.tools .movie92-search-wrap{display:block!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;}',
 '#page-rank>.tools #searchRank{width:100%!important;min-width:0!important;padding-right:83px!important;min-height:43px!important;}',
 '.movie96-expand{position:absolute;top:4px;right:5px;min-width:41px;min-height:35px;z-index:2;padding:0 8px;border-radius:8px;background:#213449;border:1px solid #50657a;color:#cfe7ff;font-size:16px;}',
 '.movie96-expand[aria-expanded="true"]{background:#31577c;border-color:#7398b8;}',
 '.movie96-expand.movie96-filtering:after{content:"";position:absolute;right:3px;top:2px;width:7px;height:7px;border-radius:50%;background:#4dd48a;}',
 // The suggestion popup should stay on top when the filter panel is open.
 '#page-rank>.tools{position:relative!important;z-index:52!important;}',
 '#page-rank #advBox66{margin:0 0 10px!important;padding:12px!important;}',
 '#page-rank #advBox66.movie96-is-open{display:block!important;}',
 '#page-rank #advBox66:not(.movie96-is-open){display:none!important;}',
 '.movie96-filter-header{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:13px;}',
 '.movie96-filter-header strong{font-size:14px;color:#dae9f8;}',
 '.movie96-close{background:#26384c;border:1px solid #50637a;border-radius:8px;color:#d8e7f7;padding:7px 11px;font-size:11px;}',
 '.movie96-filtergroup{padding:10px 0;margin-bottom:10px;border-bottom:1px solid #304255;}',
 '.movie96-filtergroup>h3{font-size:12px;color:#d6e7f6;margin:0 0 10px;}',
 '.movie96-range-heading{font-size:12px;color:#d6e7f6;margin:12px 0 10px;padding-top:12px;border-top:1px solid #304255;}',
 '.movie96-chip-group{border:1px solid #304255;border-radius:9px;margin:8px 0;background:#111a25;}',
 '.movie96-chip-group>summary{cursor:pointer;padding:10px;font-size:11px;font-weight:750;color:#d2e4f6;list-style:none;}',
 '.movie96-chip-group>summary::-webkit-details-marker{display:none;}',
 '.movie96-chip-group>summary:after{content:" ▾";float:right;}',
 '.movie96-chip-group[open]>summary:after{content:" ▴";}',
 '.movie96-chip-group>.v66-chips{padding:0 10px 10px;}',
 '.movie96-basegrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}',
 '.movie96-basicfield{display:flex;flex-direction:column;gap:5px;min-width:0;}',
 '.movie96-basicfield label{font-size:10.5px;font-weight:750;color:#b1c4d7;}',
 '.movie96-basicfield select,.movie96-basicfield .field{width:100%;min-height:40px;max-width:100%;min-width:0;font-size:13px;}',
 '.movie96-basicfield[hidden]{display:none!important;}',
 '.movie96-basicfield .genre-combo{width:100%;flex:0 1 auto;}',
 '.movie96-filteroptions{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0 4px;}',
 '.movie96-filteroptions button{min-height:36px;}',
 '.movie96-extras{margin:11px 0 0;display:flex;flex-wrap:wrap;gap:8px;}',
 '.movie96-viewbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:7px 0 6px;}',
 '.movie96-viewbar>select{flex:1 1 170px;min-width:0;max-width:320px;}',
 '.movie96-viewbar>.btn{flex:0 0 auto;}',
 '#advBox66 .v66-range{min-width:0;}#advBox66 .v66-range input{min-width:0;width:100%;box-sizing:border-box;}#advBox66 .v66-range em{flex-shrink:0;}',
 '#page-rank #advBox66 .persist{font-size:10px!important;padding:8px!important;}',
 '#page-rank #advBox66>.tip{font-size:10px!important;margin-top:10px!important;}',
 '#page-rank .star-jump{position:sticky!important;z-index:24!important;}',
 // Sticky rank numbers stay beneath BOTH the fixed header and sticky star navigation.
 '#rankRoot .score-bin>.score-label{top:var(--movie96-score-top,165px)!important;z-index:7!important;box-sizing:border-box!important;padding-top:8px!important;padding-bottom:8px!important;}',
 '#rankRoot .rank-star{overflow:visible!important;}',
 '#rankRoot .rank-star,#rankRoot .uns-panel{scroll-margin-top:calc(var(--movie96-score-top,165px) + 10px)!important;}',
 '#rankRoot .rank-star-head{position:relative!important;}',
 '@media(max-width:620px){.movie96-basegrid{grid-template-columns:1fr 1fr;gap:7px}.movie96-basicfield select{font-size:12px}.movie96-viewbar>select{max-width:none}.movie96-filter-header{margin-bottom:9px}}'
].join('\n');
document.head.append(css);

// The original v66 advanced box redraws its innerHTML on genre changes. Persistent
// toolbar controls must be reattached rather than cloned or rebound.
const title=document.createElement('div');
title.className='movie96-filter-header';title.id='movie96FilterHeader';
const head=document.createElement('strong');head.textContent='詳細絞り込み';
const close=document.createElement('button');close.className='movie96-close';close.type='button';close.textContent='閉じる';close.setAttribute('aria-label','詳細絞り込みを閉じる');
title.append(head,close);

const basic=document.createElement('section');
basic.id='movie96BasicGroup';basic.className='movie96-filtergroup';
const basicHeading=document.createElement('h3');basicHeading.textContent='1. 作品情報';
const basicGrid=document.createElement('div');basicGrid.className='movie96-basegrid';
basic.append(basicHeading);
const guide=document.createElement('p');
guide.className='tip';guide.textContent='条件はすぐに一覧へ反映されます。複数選ぶと、すべてに一致する作品を表示します。適用中の条件と一括解除は検索欄の下に表示します。';
basic.append(guide,basicGrid);
const opts=document.createElement('div');opts.className='movie96-filteroptions';
basic.append(opts);

const controlNames=[
 ['genreFilterRank','登録ジャンル（複数）'],
 ['mediaFilterRank','種別'],
 ['tvSubtypeFilterRank','TV区分'],
 ['originFilterRank','制作区分'],
 ['formatFilterRank','形式'],
 ['decadeFilterRank','年代'],
 ['runtimeFilterRank','上映時間'],
 ['categoryFilterRank','カテゴリ']
];
let genreWrap=null;
for(const [id,label] of controlNames){
 const node=document.getElementById(id);if(!node)continue;
 const wrap=document.createElement('div');wrap.className='movie96-basicfield';
 const lbl=document.createElement('label');lbl.setAttribute('for',id);lbl.textContent=label;
 wrap.append(lbl,node);basicGrid.append(wrap);
 if(id==='genreFilterRank'){
  genreWrap=wrap;
  const chips=document.getElementById('genreComboRank');if(chips)wrap.append(chips);
 }
 if(id==='tvSubtypeFilterRank'){
  const sync=()=>{wrap.hidden=node.hidden||getComputedStyle(node).display==='none';};
  sync();new MutationObserver(sync).observe(node,{attributes:true,attributeFilter:['hidden','style','class']});
  document.getElementById('mediaFilterRank')?.addEventListener('change',()=>requestAnimationFrame(sync));
 }
}
for(const id of ['toggleEmpty']){
 const node=document.getElementById(id);if(node)opts.append(node);
}

const extras=document.createElement('div');extras.className='movie96-extras';
for(const id of ['auditOpen66','histOpen66','undo66']){
 const n=document.getElementById(id);if(n)extras.append(n);
}
const persist=page.querySelector(':scope > .persist');
const info=page.querySelector(':scope > .tip');
if(persist)extras.append(persist);
if(info)extras.append(info);

const persistentFacet=document.getElementById('movie95FacetGroup');
const rangeHeading=document.createElement('h3');
rangeHeading.className='movie96-range-heading';
rangeHeading.textContent='3. ジャンルと数値を細かく指定';
const relatedHeading=document.createElement('h3');
relatedHeading.className='movie96-range-heading';relatedHeading.textContent='関連操作（絞り込み条件には含まれません）';
const genreOpen={include:false,exclude:false};
function foldGenreChips(prefix,label,key,selectedClass){
 const heading=[...adv.querySelectorAll(':scope > .v66-lbl')].find(el=>el.textContent.startsWith(prefix));
 const chips=heading?.nextElementSibling;
 if(!heading||!chips?.classList.contains('v66-chips'))return;
 const count=chips.querySelectorAll('.'+selectedClass).length;
 const group=document.createElement('details');group.className='movie96-chip-group';
 group.open=genreOpen[key]||count>0;
 const summary=document.createElement('summary');summary.textContent=label+'（'+count+'件選択）';
 group.append(summary,chips);heading.replaceWith(group);
 group.addEventListener('toggle',()=>{genreOpen[key]=group.open});
}
function attachPersistent(){
 // v66's redrawing and v95's own facet observer both rearrange the panel.
 // Preserve control nodes and handlers across genre redraws; basic choices come first.
 if(adv.firstElementChild!==title)adv.prepend(title);
 const facet=persistentFacet;
 if(basic.previousElementSibling!==title)title.insertAdjacentElement('afterend',basic);
 if(facet&&(facet.parentElement!==adv||facet.previousElementSibling!==basic))basic.insertAdjacentElement('afterend',facet);
 const range=adv.querySelector(':scope > .v66-grid');
 if(range&&genreWrap&&(rangeHeading.parentElement!==adv||rangeHeading.nextElementSibling!==genreWrap||genreWrap.nextElementSibling!==range)){
  range.insertAdjacentElement('beforebegin',rangeHeading);
  rangeHeading.insertAdjacentElement('afterend',genreWrap);
 }
 foldGenreChips('必須ジャンル','必須ジャンル：すべて含む','include','inc');
 foldGenreChips('除外ジャンル','除外ジャンル：いずれも含まない','exclude','exc');
 if(relatedHeading.parentElement!==adv)adv.append(relatedHeading);
 if(extras.parentElement!==adv)adv.append(extras);
}
attachPersistent();
const obs=new MutationObserver(changes=>{
 if(changes.some(ch=>ch.target===adv&&ch.type==='childList'))attachPersistent();
});
obs.observe(adv,{childList:true});

// Display mode and poster layout are not search filters: keep in a separate,
// compact viewing toolbar, independent of the expandable search group.
const viewbar=document.createElement('div');
viewbar.className='movie96-viewbar';viewbar.id='movie96ViewBar';
for(const id of ['watchSort83','rankPosterOnly84','posterMode83']){
 const node=document.getElementById(id);if(node)viewbar.append(node);
}
if(nav?.parentElement)nav.insertAdjacentElement('beforebegin',viewbar);
else adv.insertAdjacentElement('afterend',viewbar);

const expand=document.createElement('button');
expand.className='movie96-expand';expand.type='button';
expand.textContent='絞込 ▾';expand.title='詳細絞り込みを開閉';expand.setAttribute('aria-label','詳細絞り込みを開閉する');
searchShell.append(expand);
tools.classList.add('movie96-compact-tools');
// Original "詳細絞込" button is superseded by the arrow inside the search field.
if(quickToggle)quickToggle.hidden=true;
const badge=document.getElementById('advBadge66');
if(badge){badge.hidden=true;badge.style.setProperty('display','none','important');}

function openPanel(open){
 if(open){input.blur();const suggestions=searchShell.querySelector('.movie92-suggestions');if(suggestions)suggestions.hidden=true;}
 adv.classList.toggle('movie96-is-open',Boolean(open));
 adv.classList.toggle('open',Boolean(open));
 expand.textContent=open?'閉じる ▴':'絞込 ▾';
 expand.setAttribute('aria-expanded',String(Boolean(open)));
 expand.setAttribute('aria-controls','advBox66');
 input.setAttribute('aria-expanded',String(Boolean(open)));
}
openPanel(false);
input.setAttribute('aria-controls','advBox66');
// Keep the filter panel closed when the search field receives focus. The adjacent
// chevron is the sole control that opens it.
expand.addEventListener('pointerdown',e=>e.preventDefault());
expand.addEventListener('click',()=>openPanel(!adv.classList.contains('movie96-is-open')));
close.addEventListener('click',()=>{openPanel(false);input.blur();});
const activeSummary=document.createElement('div');
activeSummary.id='movie96ActiveSummary';activeSummary.className='tip';
const activeText=document.createElement('span');activeText.setAttribute('role','status');
const clearAll=document.createElement('button');clearAll.type='button';clearAll.className='btn';clearAll.textContent='検索・絞り込みをすべて解除';
clearAll.onclick=()=>window.__movie30ResetRankFilters66?.();
activeSummary.append(activeText,document.createElement('br'),clearAll);tools.after(activeSummary);
function updateActive(){
 const bits=[];
 for(const [id,label] of [['searchRank','検索'],...controlNames]){
  const el=document.getElementById(id);if(!el?.value)continue;
  bits.push(label+'：'+(el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:el.value));
 }
 for(const [id,label] of [['y166','公開年の下限'],['y266','公開年の上限'],['r166','時間の下限'],['r266','時間の上限'],['s166','点数の下限'],['s266','点数の上限']]){
  const value=document.getElementById(id)?.value;if(value!=null&&value!=='')bits.push(label+'：'+value);
 }
 for(const [selector,label] of [['[data-inc].inc','必須ジャンル'],['[data-exc].exc','除外ジャンル']]){
  const names=[...adv.querySelectorAll(selector)].map(el=>el.textContent);if(names.length)bits.push(label+'：'+names.join('・'));
 }
 const facets=window.__movie30AdvancedFilter93?.getFilters?.()||{};
 for(const [key,label] of [['director','監督'],['actor','出演者'],['genre','TMDBジャンル']])if(facets[key])bits.push(label+'：'+facets[key]);
 const text=bits.length?'適用中 — '+bits.join(' ／ '):'検索・絞り込み条件なし';
 if(activeText.textContent!==text)activeText.textContent=text;
 clearAll.hidden=!bits.length;expand.classList.toggle('movie96-filtering',!!bits.length);
}
for(const event of ['change','input']){adv.addEventListener(event,updateActive);input.addEventListener(event,updateActive);}
renderRank=window.Movie30RenderLifecycle.decorate(renderRank,{after(){updateActive()}});
updateActive();

// v95 had set top to the fixed header's bottom, overlooking the sticky ★ row.
// Use both ACTUAL visible edges and avoid jumping to the star bar before it becomes sticky.
const rootStyle=document.documentElement.style;
let lastTop=-1,frame=0;
function align(){
 frame=0;
 const header=document.querySelector('.top');
 const fixedEnd=header?Math.max(0,(header.getBoundingClientRect().height+(parseFloat(getComputedStyle(header).top)||0))):0;
 const bar=document.getElementById('starJumpBar');
 const end=fixedEnd+(bar&&getComputedStyle(bar).display!=='none'?bar.getBoundingClientRect().height:0);
 const target=Math.ceil(end+7);
 if(target!==lastTop){
  lastTop=target;rootStyle.setProperty('--movie96-score-top',target+'px');
 }
}
function queueAlign(){if(frame)return;frame=requestAnimationFrame(align);}

window.addEventListener('resize',queueAlign,{passive:true});
window.addEventListener('orientationchange',queueAlign,{passive:true});
if(typeof ResizeObserver==='function'){
 const resize=new ResizeObserver(queueAlign);
 const header=document.querySelector('.top');if(header)resize.observe(header);
 if(nav)resize.observe(nav);
}
align();

window.__movie30CompactSearch96={version:BUILD,restoreControls:attachPersistent,open:()=>openPanel(true),close:()=>openPanel(false),align};
const build=document.getElementById('movie30BuildV29');
if(build)build.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v97.js; original order retained. */
(() => {
'use strict';
// v97: Correct iPhone stacking and make the star heading and score label track together.
const BUILD='20261012g';
const style=document.createElement('style');
style.id='movie30-sticky-stack97';
style.textContent=[
  // Search scrolls behind the app header instead of floating above the title / tabs.
  '#page-rank>.tools.movie96-compact-tools{position:relative!important;z-index:1!important;isolation:auto!important;}',
  '#page-rank>.tools .movie92-search-wrap{z-index:auto!important;}',
  // Remove the stray strip of background between the sticky header and star-jump navigation.
  '#page-rank #movie96ViewBar{margin-bottom:0!important;}',
  '#page-rank #starJumpBar{position:sticky!important;top:var(--movie97-header-edge,0px)!important;margin-top:0!important;padding-top:5px!important;padding-bottom:5px!important;margin-bottom:7px!important;z-index:24!important;box-sizing:border-box!important;}',
  // Both the ★ category heading and current numeric score must remain visible.
  '#rankRoot .rank-star{overflow:visible!important;}',
  '#rankRoot .rank-star>.rank-star-head{position:-webkit-sticky!important;position:sticky!important;top:var(--movie97-star-edge,154px)!important;z-index:12!important;background:#111720!important;min-height:38px;box-shadow:0 2px 8px rgba(0,0,0,.3);}',
  '#rankRoot .score-bin>.score-label{position:-webkit-sticky!important;position:sticky!important;top:var(--movie97-score-edge,200px)!important;z-index:11!important;}',
  // Jumping between star groups should not put the heading behind the two sticky bars.
  '#rankRoot .rank-star,#rankRoot .uns-panel{scroll-margin-top:calc(var(--movie97-star-edge,154px) + 4px)!important;}',
  '#rankRoot .score-bin{scroll-margin-top:calc(var(--movie97-score-edge,200px) + 6px)!important;}',
  '@media(prefers-reduced-motion:reduce){#rankRoot .rank-star>.rank-star-head{transition:none!important;}}'
].join('\n');
document.head.appendChild(style);
const root=document.documentElement,head=document.querySelector('.top');
const nav=document.getElementById('starJumpBar');
const rank=document.getElementById('rankRoot');
let scheduled=false,prior='';
function alignStack(){
 scheduled=false;
 if(!head)return;
 const bottom=Math.max(0,Math.ceil((head.getBoundingClientRect().height+(parseFloat(getComputedStyle(head).top)||0))));
 const navHeight=nav&&nav.getBoundingClientRect().height>0
   ?Math.ceil(nav.getBoundingClientRect().height):0;
 // No fixed magic offsets: all three sticky elements share the same measurements.
 const starEdge=bottom+navHeight+1;
 const starHead=rank?.querySelector('.rank-star>.rank-star-head');
 const starHeight=starHead?Math.ceil(starHead.getBoundingClientRect().height):38;
 const scoreEdge=starEdge+starHeight+2;
 const current=[bottom,starEdge,scoreEdge].join(':');
 if(current!==prior){
  prior=current;
  root.style.setProperty('--movie97-header-edge',bottom+'px');
  root.style.setProperty('--movie97-star-edge',starEdge+'px');
  root.style.setProperty('--movie97-score-edge',scoreEdge+'px');
 }
 // The v22 script assigned an inline top based on an initial header height.
 // Remove it so the actual measured bottom always controls the jump navigation.
 if(nav&&nav.style.top)nav.style.removeProperty('top');
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(alignStack);}
if(head&&typeof ResizeObserver==='function'){
 const obs=new ResizeObserver(schedule);
 obs.observe(head);
 if(nav)obs.observe(nav);
}

window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
if(rank)new MutationObserver(changes=>{
 if(changes.some(x=>x.addedNodes.length||x.removedNodes.length))schedule();
}).observe(rank,{childList:true,subtree:true});
schedule();
window.__movie30StickyStack97={version:BUILD,align:alignStack};
const build=document.getElementById('movie30BuildV29');if(build)build.textContent='app build '+BUILD;
})();

/* Consolidated from patch-v98.js; original order retained. */
(() => {
'use strict';
// v98: flush sticky headings and protect manually-entered exact scores during LB refresh.
const BUILD='20261012h';
const css=document.createElement('style');css.id='movie30-score-sync98';
css.textContent=[
 // The navigation and its current star section form a continuous sticky stack.
 '#page-rank #starJumpBar{margin-bottom:0!important;border-bottom:0!important;padding-bottom:4px!important;}',
 '#rankRoot .rank-star{margin-top:0!important;border-top:0!important;}',
 '#rankRoot .rank-star>.rank-star-head{top:var(--movie98-star-top,150px)!important;margin-top:0!important;border-top:1px solid #283541!important;border-radius:0!important;}',
 '#rankRoot .score-bin>.score-label{top:var(--movie98-score-top,190px)!important;}',
 '#rankRoot .rank-star,#rankRoot .uns-panel{scroll-margin-top:calc(var(--movie98-star-top,150px) + 2px)!important;}',
 '#rankRoot .score-bin{scroll-margin-top:calc(var(--movie98-score-top,190px) + 2px)!important;}'
].join('\n');document.head.append(css);
let ticking=false,last='';
function align(){
 ticking=false;
 const header=document.querySelector('.top'),jump=document.getElementById('starJumpBar');
 if(!header||!jump)return;
 const headerBottom=Math.max(0,Math.ceil((header.getBoundingClientRect().height+(parseFloat(getComputedStyle(header).top)||0))));
 const h=Math.ceil(jump.getBoundingClientRect().height);
 const heading=document.querySelector('#rankRoot .rank-star>.rank-star-head');
 const headingHeight=Math.ceil(heading?.getBoundingClientRect().height||38);
 // Share actual measurements. One pixel of overlap joins the borders on iOS.
 const a=Math.max(headerBottom,headerBottom+h-1);
 const b=a+headingHeight-1;
 const key=a+':'+b;
 if(last!==key){
  last=key;document.documentElement.style.setProperty('--movie98-star-top',a+'px');
  document.documentElement.style.setProperty('--movie98-score-top',b+'px');
 }
}
function queue(){if(ticking)return;ticking=true;requestAnimationFrame(align);}

window.addEventListener('resize',queue,{passive:true});
if(typeof ResizeObserver==='function'){
 const ro=new ResizeObserver(queue);
 const head=document.querySelector('.top'),bar=document.getElementById('starJumpBar');
 if(head)ro.observe(head);if(bar)ro.observe(bar);
}
queue();

const episodeKeys=[
 ['hang','blackmirrorhangthedj','black-mirror-hang-the-dj'],
 ['uss','blackmirrorusscallister','black-mirror-uss-callister']
];
const normalize=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const uri=x=>String(x||'').replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();
const validScore=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=100;
function keyFor(f){
 if(!f)return '';
 const info=titleInfo(f),names=[info.title,info.originalTitle,info.englishTitle,
  f.title,f.originalTitle,f.englishTitle,f.lbTitle].map(normalize);
 const path=uri(f.uri);
 for(const [key,title,slug] of episodeKeys){
  if(names.includes(title)||path.includes('/film/'+slug))return key;
 }
 return '';
}
function snapshot(){
 const result=new Map();
 for(const f of allFilms()){
  if(!Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id))continue;
  const score=state.exactScores[f.id];
  if(!validScore(score))continue;
  const ref={id:f.id,key:keyFor(f),score:Number(score),star:scoreToStar(score)};
  result.set(f.id,ref);
 }
 return result;
}
// Restore only exact scores actually entered in this browser, never estimate a
// numerical score from Letterboxd stars. Preserve the same-score rank list.
function restoreScored(before){
 let restored=0,corrected=0;
 state.exactScores=state.exactScores||{};
 state.starOverrides=state.starOverrides||{};
 for(const item of before.values()){
  let film=filmById(item.id);
  if(!film&&item.key){
   const matching=allFilms().filter(f=>keyFor(f)===item.key);
   if(matching.length===1)film=matching[0];
  }
  if(!film)continue;
  if(!validScore(state.exactScores[film.id])){
   state.exactScores[film.id]=item.score;
   restored++;
  }
  // The app's numeric score is authoritative; LB's ★ must never reclassify it.
  if(Number(state.starOverrides[film.id]??film.star)!==scoreToStar(state.exactScores[film.id])){
   state.starOverrides[film.id]=scoreToStar(state.exactScores[film.id]);
   corrected++;
  }
  if(film.id!==item.id&&item.key){
   for(const [score,ids] of Object.entries(state.rankOrder||{})){
    if(!Array.isArray(ids))continue;
    const ix=ids.indexOf(item.id);
    if(ix<0||ids.includes(film.id))continue;
    ids[ix]=film.id;
   }
  }
 }
 return {restored,corrected};
}
// Explicit same-episode identification: duplicate TV records can otherwise fool
// older "find existing film" handlers and make an unrated copy appear.
const previousFind=findExistingFilm;
findExistingFilm=function(raw){
 const previous=previousFind(raw);
 const pseudo={
  uri:raw?.link||raw?.uri||'',title:raw?.title||'',
  englishTitle:raw?.englishTitle||raw?.title||'',
  originalTitle:raw?.originalTitle||''
 };
 const key=keyFor(pseudo);
 if(!key)return previous;
 const candidates=allFilms().filter(f=>keyFor(f)===key&&(!raw.year||!f.year||Number(raw.year)===Number(f.year)));
 if(!candidates.length)return previous;
 // The already-scored exact episode wins even if an older importer first found
 // the unrated duplicate by URL. Distinct episodes have distinct keys.
 const scored=candidates.filter(f=>validScore(state.exactScores?.[f.id]));
 if(scored.length===1)return scored[0];
 if(previous)return previous;
 const matched=candidates.filter(f=>uri(f.uri)&&uri(f.uri)===uri(pseudo.uri));
 const pool=matched.length?matched:candidates;
 return pool[0];
};

// Keep a separate read-only recovery source in the browser's existing backups.
// This targets only the two reported episodes, never creates guessed ratings.
function backupRepair(){
 const missing=new Map();
 for(const [key] of episodeKeys) {
  const matches=allFilms().filter(f=>keyFor(f)===key);
  if(matches.length&&!matches.some(f=>validScore(state.exactScores?.[f.id])))missing.set(key,matches);
 }
 if(!missing.size)return 0;
 const backups=[];
 for(const k of [...BACKUP_KEYS,...LEGACY_KEYS]){
  try{
   const v=JSON.parse(localStorage.getItem(k)||'null');
   if(v?.exactScores&&Array.isArray(v.customFilms))backups.push(v);
  }catch(_){}
 }
 backups.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
 let restored=0;
 for(const [key,films] of missing){
  const values=[];
  for(const b of backups){
   for(const f of b.customFilms||[]){
    const names=[f.title,f.originalTitle,f.englishTitle,f.lbTitle,
       b.titleOverrides?.[f.id]?.title,b.titleOverrides?.[f.id]?.englishTitle].map(normalize);
    const identified=episodeKeys.find(([k,n,slug])=>k===key&&
       (names.includes(n)||uri(f.uri).includes('/film/'+slug)));
    if(!identified)continue;
    const score=b.exactScores?.[f.id];
    if(validScore(score))values.push({id:f.id,score:Number(score),updatedAt:b.updatedAt||0});
   }
  }
  // Refuse conflicting backups; score choices are the user's, not ours.
  const numbers=[...new Set(values.map(v=>v.score))];
  if(numbers.length!==1)continue;
  const exact=films.find(f=>values.some(v=>v.id===f.id));
  // Never guess between two distinct records of the same TV episode.
  const target=exact||(films.length===1?films[0]:null);
  if(!target)continue;
  state.exactScores[target.id]=numbers[0];
  state.starOverrides[target.id]=scoreToStar(numbers[0]);
  restored++;
 }
 return restored;
}
// Preserve scores throughout all nested sync wrappers, including metadata updates.
const oldSync=syncLetterboxd;
let inProgress=null;
syncLetterboxd=async function(...args){
 if(inProgress)return inProgress;
 const scoresBefore=snapshot();
 inProgress=(async()=>{
  try{return await oldSync.apply(this,args);}
  finally{
   const change=restoreScored(scoresBefore);
   if(change.restored||change.corrected){
    save();render();
    const status=document.getElementById('lbStatus');
    if(status)status.textContent+=' · アプリ内採点を保護 '+(change.restored+change.corrected)+'件';
   }
  }
 })();
 try{return await inProgress;}finally{inProgress=null;}
};
const syncButton=document.getElementById('syncLetterboxd');
if(syncButton)syncButton.onclick=()=>syncLetterboxd(false);
const topSync=document.getElementById('topLbSyncV73');
// The upper shortcut invokes the lexical syncLetterboxd binding at click time;
// it already uses the new wrapper, so no need to replace its handler.
// Do not display a stray unrated duplicate of an already-scored identical
// episode. Its record is retained in saved state; only a disposable,
 // note-free duplicate is removed from read-only list output.
const originalAllFilms=allFilms;
// Cache the duplicate-episode result. Calling the expensive matching pass on
// EVERY allFilms() call made rendering O(N^2) with many Unicode normalizations;
// hundreds of rank rows then blocked the main thread and disabled all taps.
let movie98ListCache=null, movie98CacheState=null, movie98CacheFilms=null;
let movie98CacheUpdatedAt=null, movie98CacheLength=-1;
allFilms=function(...args){
 const items=originalAllFilms.apply(this,args);
 if(movie98ListCache && movie98CacheState===state &&
    movie98CacheFilms===state.customFilms &&
    movie98CacheUpdatedAt===state.updatedAt &&
    movie98CacheLength===items.length) return movie98ListCache.slice();
 const scored=new Map();
 for(const f of items){
  const k=keyFor(f);
  if(k&&validScore(state.exactScores?.[f.id])&&!scored.has(k))scored.set(k,f);
 }
 const filtered=!scored.size?items:items.filter(f=>{
  const k=keyFor(f),keeper=k?scored.get(k):null;
  if(!keeper||keeper.id===f.id||validScore(state.exactScores?.[f.id]))return true;
  const note=state.letterboxdMeta?.[f.id]||{};
  if(note.note||note.watchHistory?.length||note.rssReviewRecords&&Object.keys(note.rssReviewRecords).length)return true;
  if(Number(f.year||0)!==Number(keeper.year||0))return true;
  const sameUri=uri(f.uri)&&uri(f.uri)===uri(keeper.uri);
  const englishA=normalize(titleInfo(f).englishTitle||f.lbTitle);
  const englishB=normalize(titleInfo(keeper).englishTitle||keeper.lbTitle);
  const sameEnglish=!!englishA&&englishA===englishB;
  return !(sameUri||sameEnglish);
 });
 movie98ListCache=filtered;
 movie98CacheState=state;
 movie98CacheFilms=state.customFilms;
 movie98CacheUpdatedAt=state.updatedAt;
 movie98CacheLength=items.length;
 return filtered.slice();
};
// Old backups cannot distinguish a missing score from an intentional clear.
const backfilled=0;
if(backfilled){save();render();}
window.__movie30SyncGuard98={version:BUILD,restoreFromBackupCount:backfilled};
const label=document.getElementById('movie30BuildV29');
if(label)label.textContent='app build '+BUILD;
})();

/* v99: Search result must jump to the SAME film inside the unfiltered rank,
   and a focused search suggestion must stay above sticky navigation. */
(() => {
'use strict';
const style=document.createElement('style');
style.id='movie30-rank-search-layer99';
style.textContent=[
 '.top{z-index:120!important;background:#07090c!important;}',
 '#page-rank>.tools.movie96-compact-tools{position:relative!important;z-index:1!important;}',
 '#page-rank>.tools.movie96-compact-tools:focus-within{z-index:80!important;}',
 '#page-rank>.tools.movie96-compact-tools:has(.movie92-suggestions:not([hidden])){z-index:80!important;}',
 '#page-rank>.tools .movie92-search-wrap{isolation:isolate;}',
 '#page-rank .movie92-suggestions{z-index:90!important;position:absolute!important;}',
 '#page-rank #starJumpBar{z-index:55!important;isolation:isolate;background:#0a0e14!important;}',
 '#rankRoot .rank-star>.rank-star-head{z-index:32!important;background:#111720!important;isolation:isolate;}',
 '#rankRoot .score-bin>.score-label{z-index:28!important;background:#132031!important;}',
 '#rankRoot .rank-star{overflow:visible!important;}',
 '#rankRoot .rank-card .drag-handle.movie99-jump{cursor:pointer;color:#bcffe0!important;background:#173528!important;border:1px solid #3e8c65!important;font-size:18px!important;}',
 '#rankRoot .rank-card.movie30-jump-highlight{outline:2px solid #61eca4!important;box-shadow:0 0 0 5px rgba(65,235,145,.21)!important;transition:outline-color .25s,box-shadow .25s;}',
 '.movie30-swap-ghost{border:1px solid #78e5aa!important;border-radius:10px!important;overflow:hidden!important;background:#202e3b!important;}'
].join('\n');
document.head.appendChild(style);
function jumpBindings(){
 const isFiltered=window.__movie30IsRankFiltered?.();
 for(const card of document.querySelectorAll('#rankRoot .rank-card[data-id]')){
  const handle=card.querySelector('.drag-handle');
  if(!handle)continue;
  handle.classList.toggle('movie99-jump',Boolean(isFiltered));
  if(!isFiltered)continue;
  const id=decodeURIComponent(card.dataset.id||'');
  handle.disabled=false;
  handle.textContent='↗';
  handle.title='検索を解除し、全体ランキング内のこの映画へ移動';
  handle.setAttribute('aria-label','全体ランキングで'+(card.querySelector('.rank-title')?.textContent||'この作品')+'の位置へ移動');
  // Safari can lose the synthesized click when the keyboard collapses.
  // Pointerdown is the primary action; click is the keyboard/AT fallback.
  let triggered=false;
  const activate=event=>{
   event.preventDefault();
   event.stopPropagation();
   if(triggered)return;
   if(event.type==='click'&&event.detail!==0&&Date.now()<(window.__movie30SuppressRankJumpClickUntil||0)){
    triggered=true;return;
   }
   triggered=true;
   if(event.type==='pointerdown')window.__movie30SuppressRankJumpClickUntil=Date.now()+1200;
   window.__movie30JumpToGlobalRank?.(id,event);
  };
  handle.onpointerdown=activate;
  handle.onclick=activate;
 }
}
renderRank=window.Movie30RenderLifecycle.decorate(renderRank,{after(){
 if(!window.__movie30BulkBoot)jumpBindings();
}});
// Older input handlers capture a pre-wrapper renderRank reference. Apply the
// navigation action after those handlers finish, and after root replacements.
const search=document.getElementById('searchRank');
const rankRoot=document.getElementById('rankRoot');
let scheduled=false;
function keepJumpLocation(){
 const pending=window.__movie30PendingJump99;
 if(!pending||Date.now()>pending.until)return;
 try{window.__movie30RefocusRank99?.()}catch(e){console.warn('Restore full-rank target',e)}
}
function scheduleJumpBindings(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;jumpBindings();keepJumpLocation();});
}
search?.addEventListener('input',scheduleJumpBindings);
search?.addEventListener('change',scheduleJumpBindings);
if(rankRoot&&typeof MutationObserver==='function'){
 new MutationObserver(changes=>{
  if(changes.some(m=>m.target===rankRoot&&m.type==='childList'))scheduleJumpBindings();
 }).observe(rankRoot,{childList:true});
}
// Cover layout shifts from metadata, poster loads and dismissal of the iOS keyboard.
const originalJump=window.__movie30JumpToGlobalRank;
if(typeof originalJump==='function'){
 window.__movie30JumpToGlobalRank=function(id,pointerEvent){
  const result=originalJump(id,pointerEvent);
  for(const delay of [100,420,850,1400,2300,3400]){
   setTimeout(()=>{keepJumpLocation();scheduleJumpBindings()},delay);
  }
  return result;
 };
}
scheduleJumpBindings();
window.__movie30SearchJump99={version:'20261012q',bind:jumpBindings};
})();

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
 const words=String(q).normalize('NFKC').toLowerCase().trim();
 const m=meta(f.id),c=m.crew84||{};
 return [...(c.directors||[]),...(c.creators||[])].join(' ').normalize('NFKC').toLowerCase().includes(words);
};
if(wildlife.length)try{renderRank()}catch(_){}
window.__movie30V87={build:BUILD,wildlifeCount:wildlife.length,fetchDirectors:run};
const label=document.getElementById('movie30BuildV29');if(label)label.textContent='app build '+BUILD;
})();
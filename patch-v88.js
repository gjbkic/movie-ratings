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
 const r=catalog[f.id];
 return !!r&&allNames(r).join(' ').normalize('NFKC').toLowerCase().includes(norm(q.trim()));
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
async function loadCloud(){
 if(fetching)return;
 fetching=true;reload.disabled=true;
 status.textContent='GitHubのメタデータを確認中…';
 try{
  const response=await fetch('./tmdb-metadata.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('データファイルがまだ公開されていません (HTTP '+response.status+')');
  const data=await response.json();
  const result=applyCatalog(data);
  status.textContent='反映済み：監督・製作者 '+result.directors+'作品／ポスター '+result.posters+'作品（照合 '+result.recognized+'作品）。データ更新：'+String(data.updatedAt||'').slice(0,10)+'。';
 }catch(e){
  status.textContent='未反映：'+String(e?.message||e)+'。GitHub Actionsが成功したあと「データを再読み込み」を押してください。';
 }finally{fetching=false;reload.disabled=false}
}
reload.onclick=()=>loadCloud();
loadCloud();
// Make runtime debugging possible without exposing secret data.
window.__movie30CloudCredits88={reload:loadCloud,stats:()=>({total:Object.keys(catalog).length,withDirectors:Object.values(catalog).filter(x=>x.directors?.length||x.creators?.length).length})};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
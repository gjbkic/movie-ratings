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
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
 heading.textContent='監督・出演者・TMDbジャンル';
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
const beforeRank=renderRank;
renderRank=function(...args){
 const result=beforeRank.apply(this,args);
 if(flagActive()){
  for(const handle of document.querySelectorAll('#rankRoot .rank-card .drag-handle')){
   handle.disabled=true;
   handle.onpointerdown=null;
   handle.title='絞り込みを解除すると順位を変更できます';
   handle.textContent='—';
   handle.style.opacity='.35';
  }
 }
 return result;
};
flagActive();

// Compute the actual bottom of the existing sticky page header.
// Fixed pixel top values overlap on iPhone when its header wraps into 2-3 rows.
let raf=0,previous=-1;
function alignLabel(){
 raf=0;
 const header=document.querySelector('.top');
 if(!header)return;
 const bottom=header.getBoundingClientRect().bottom;
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
window.addEventListener('scroll',scheduleAlign,{passive:true});
if(typeof ResizeObserver==='function'){
 const header=document.querySelector('.top');
 if(header)new ResizeObserver(scheduleAlign).observe(header);
}
window.__movie30Layout95={version:BUILD,refresh:scheduleAlign};
const marker=document.getElementById('movie30BuildV29');
if(marker)marker.textContent='app build '+BUILD;
})();
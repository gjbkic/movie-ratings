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
 const bottom=Math.max(0,Math.ceil(head.getBoundingClientRect().bottom));
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
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
if(rank)new MutationObserver(changes=>{
 if(changes.some(x=>x.addedNodes.length||x.removedNodes.length))schedule();
}).observe(rank,{childList:true,subtree:true});
schedule();
window.__movie30StickyStack97={version:BUILD,align:alignStack};
const build=document.getElementById('movie30BuildV29');if(build)build.textContent='app build '+BUILD;
})();
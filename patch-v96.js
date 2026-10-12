(() => {
'use strict';
// v96: one compact search field, expandable full filters and score labels below sticky star nav.
const BUILD='20261012f';
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
 '#page-rank>.tools #searchRank{width:100%!important;min-width:0!important;padding-right:59px!important;min-height:43px!important;}',
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
 '.movie96-basegrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}',
 '.movie96-basicfield{display:flex;flex-direction:column;gap:5px;min-width:0;}',
 '.movie96-basicfield label{font-size:10.5px;font-weight:750;color:#b1c4d7;}',
 '.movie96-basicfield select,.movie96-basicfield .field{width:100%;min-height:40px;max-width:100%;min-width:0;font-size:13px;}',
 '.movie96-basicfield .genre-combo{width:100%;flex:0 1 auto;}',
 '.movie96-filteroptions{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0 4px;}',
 '.movie96-filteroptions button{min-height:36px;}',
 '.movie96-extras{margin:11px 0 0;display:flex;flex-wrap:wrap;gap:8px;}',
 '.movie96-viewbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:7px 0 6px;}',
 '.movie96-viewbar>select{flex:1 1 170px;min-width:0;max-width:320px;}',
 '.movie96-viewbar>.btn{flex:0 0 auto;}',
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
const basicHeading=document.createElement('h3');basicHeading.textContent='ジャンル・種別・制作区分など';
const basicGrid=document.createElement('div');basicGrid.className='movie96-basegrid';
basic.append(basicHeading,basicGrid);
const opts=document.createElement('div');opts.className='movie96-filteroptions';
basic.append(opts);

const controlNames=[
 ['genreFilterRank','ジャンル（複数選択可）'],
 ['mediaFilterRank','種別'],
 ['tvSubtypeFilterRank','TV区分'],
 ['originFilterRank','制作区分'],
 ['formatFilterRank','形式'],
 ['decadeFilterRank','年代'],
 ['runtimeFilterRank','上映時間'],
 ['categoryFilterRank','カテゴリ']
];
for(const [id,label] of controlNames){
 const node=document.getElementById(id);if(!node)continue;
 const wrap=document.createElement('div');wrap.className='movie96-basicfield';
 const lbl=document.createElement('label');lbl.setAttribute('for',id);lbl.textContent=label;
 wrap.append(lbl,node);basicGrid.append(wrap);
 if(id==='genreFilterRank'){
  const chips=document.getElementById('genreComboRank');if(chips)wrap.append(chips);
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

function attachPersistent(){
 // v66's redrawing and v95's own facet observer both rearrange the panel.
 // Reestablish a deterministic header -> TMDb facets -> classic filters -> actions order.
 if(adv.firstElementChild!==title)adv.prepend(title);
 const facet=document.getElementById('movie95FacetGroup');
 if(facet&&facet.parentElement===adv&&title.nextElementSibling!==facet)
  title.insertAdjacentElement('afterend',facet);
 const anchor=facet?.parentElement===adv?facet:title;
 if(basic.previousElementSibling!==anchor)anchor.insertAdjacentElement('afterend',basic);
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
expand.textContent='⌄';expand.title='詳細絞り込みを開閉';expand.setAttribute('aria-label','詳細絞り込みを開閉する');
searchShell.append(expand);
tools.classList.add('movie96-compact-tools');
// Original "詳細絞込" button is superseded by the arrow inside the search field.
if(quickToggle)quickToggle.hidden=true;
const badge=document.getElementById('advBadge66');
if(badge){badge.hidden=true;badge.style.setProperty('display','none','important');}

function openPanel(open){
 adv.classList.toggle('movie96-is-open',Boolean(open));
 adv.classList.toggle('open',Boolean(open));
 expand.textContent=open?'⌃':'⌄';
 expand.setAttribute('aria-expanded',String(Boolean(open)));
 expand.setAttribute('aria-controls','advBox66');
 input.setAttribute('aria-expanded',String(Boolean(open)));
}
openPanel(false);
input.setAttribute('aria-controls','advBox66');
input.addEventListener('focus',()=>openPanel(true));
input.addEventListener('pointerdown',()=>openPanel(true));
expand.addEventListener('pointerdown',e=>e.preventDefault());
expand.addEventListener('click',()=>openPanel(!adv.classList.contains('movie96-is-open')));
close.addEventListener('click',()=>{openPanel(false);input.blur();});
function updateActive(){
 const selected=Boolean(window.__movie30AdvancedFilter93?.hasActive?.());
 const other=['genreFilterRank','mediaFilterRank','originFilterRank','formatFilterRank','decadeFilterRank','runtimeFilterRank'].some(id=>Boolean(document.getElementById(id)?.value));
 expand.classList.toggle('movie96-filtering',selected||other);
}
for(const node of [basicGrid,adv]){
 node.addEventListener('change',updateActive);
 node.addEventListener('input',updateActive);
}
updateActive();

// v95 had set top to the fixed header's bottom, overlooking the sticky ★ row.
// Use both ACTUAL visible edges and avoid jumping to the star bar before it becomes sticky.
const rootStyle=document.documentElement.style;
let lastTop=-1,frame=0;
function align(){
 frame=0;
 const header=document.querySelector('.top');
 const fixedEnd=header?Math.max(0,header.getBoundingClientRect().bottom):0;
 const bar=document.getElementById('starJumpBar');
 let end=fixedEnd;
 if(bar&&getComputedStyle(bar).display!=='none'){
  const r=bar.getBoundingClientRect();
  // Only count the star menu when the menu is currently stuck below the top header.
  if(r.height>0&&r.top<=fixedEnd+17&&r.bottom>fixedEnd){
   end=Math.max(end,r.bottom);
  }
  // The older jump navigation uses a hardcoded header height; realign after rotation.
  if(header&&r.top<=fixedEnd+17){
   const expected=Math.max(0,Math.ceil(fixedEnd));
   if(Math.abs(parseFloat(bar.style.top||'0')-expected)>1)bar.style.top=expected+'px';
  }
 }
 const target=Math.ceil(end+7);
 if(target!==lastTop){
  lastTop=target;rootStyle.setProperty('--movie96-score-top',target+'px');
 }
}
function queueAlign(){if(frame)return;frame=requestAnimationFrame(align);}
window.addEventListener('scroll',queueAlign,{passive:true});
window.addEventListener('resize',queueAlign,{passive:true});
window.addEventListener('orientationchange',queueAlign,{passive:true});
if(typeof ResizeObserver==='function'){
 const resize=new ResizeObserver(queueAlign);
 const header=document.querySelector('.top');if(header)resize.observe(header);
 if(nav)resize.observe(nav);
}
align();

window.__movie30CompactSearch96={version:BUILD,open:()=>openPanel(true),close:()=>openPanel(false),align};
const build=document.getElementById('movie30BuildV29');
if(build)build.textContent='app build '+BUILD;
})();
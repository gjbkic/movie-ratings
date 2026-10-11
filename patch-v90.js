(() => {
'use strict';
// v90: Search results reuse posters in every view; details open a full-screen cover viewer.
const VERSION='20261011v';
const WILD='custom-1791664055006-96rv';
const WILD_COVER='https://www.sonymusic.co.jp/Music/Info/utadahikaru/en/music/img/dvd/img_music_dvd_14.jpg';
const css=document.createElement('style');css.id='movie30-search-posters-lightbox90';
css.textContent=[
'.movie90-result-with-art{position:relative!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;min-height:76px!important;box-sizing:border-box!important;overflow:hidden!important}',
'.movie90-result-with-art .movie90-result-art{display:block!important;position:static!important;flex:none!important;width:42px!important;height:63px!important;object-fit:contain!important;border-radius:5px;border:1px solid #405169;background:#15202e}',
'.movie90-result-text{display:flex;flex-direction:column;min-width:0;flex:1;align-items:flex-start}',
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
 const src=posterFor(id,'w185');if(!src)return;
 card.classList.add('movie90-result-with-art');
 const img=document.createElement('img');
 img.className='movie90-result-art';img.src=src;img.alt='';img.loading='lazy';img.decoding='async';
 const wrapper=document.createElement('span');wrapper.className='movie90-result-text';
 while(card.firstChild)wrapper.appendChild(card.firstChild);
 card.append(img,wrapper);
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
  if(wanted&&img&&img.getAttribute('src')!==wanted)img.src=wanted;
 }
 const detail=document.getElementById('movie30PosterDetail84');
 const img=detail?.querySelector('img.movie30-poster84[data-poster-id]');
 if(img&&selectedId){
  const src=posterFor(selectedId,'w342');
  if(src&&img.getAttribute('src')!==src)img.src=src;
  if(!img.hasAttribute('tabindex'))img.tabIndex=0;
  img.setAttribute('role','button');
  img.setAttribute('aria-label','ポスターを大きく表示');
  if(!detail.querySelector('.movie90-expand-note')){
   const note=document.createElement('small');note.className='movie90-expand-note';
   note.textContent='ポスターをタップして拡大表示';
   detail.appendChild(note);
  }
 }
}
let queued=false;
function scheduleRefresh(){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;refreshPosters();});
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
if(posterPanel)new MutationObserver(scheduleRefresh).observe(posterPanel,{childList:true,subtree:true});

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
window.__movie30SearchPosters90={refresh:scheduleRefresh,openViewer,closeViewer};
scheduleRefresh();
const build=document.getElementById('movie30BuildV29');if(build)build.textContent='app build '+VERSION;
})();
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
(() => {
  // v79: pull-down dismissal and stable iOS sheet scrolling.
  // Does not mutate movie data, rankings, scores or notes.
  const overlay=document.getElementById('sheetBg');
  const sheet=overlay?.querySelector('.sheet');
  if(!overlay||!sheet)return;
  const rules=document.createElement('style');
  rules.textContent=[
    '#sheetBg{overscroll-behavior:contain;overflow:hidden}',
    '#sheetBg.open{touch-action:pan-y}',
    '#sheetBg > .sheet{position:relative;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;max-height:88dvh;will-change:transform}',
    '#sheetBg .v79-pull-bar{position:sticky;top:-14px;z-index:25;margin:-14px -14px 8px;min-height:42px;padding:13px 14px 9px;display:flex;align-items:center;justify-content:center;background:#11161d;border-radius:20px 20px 0 0;touch-action:none;user-select:none;-webkit-user-select:none}',
    '#sheetBg .v79-pull-bar .handle{margin:0;pointer-events:none}',
    '#sheetBg .v79-close{position:absolute;right:13px;top:5px;min-width:66px;min-height:32px;border-radius:999px;border:1px solid #354356;background:#19222e;color:#e4ebf5;font-size:12px;font-weight:650;cursor:pointer;touch-action:manipulation}',
    '#sheetBg .v79-pull-bar:active .handle{background:#99a9bc}',
    '#sheetBg .v79-pull-bar .v79-hint{position:absolute;left:12px;font-size:9px;color:#8793a5}',
    '@media (prefers-reduced-motion:reduce){#sheetBg > .sheet{scroll-behavior:auto!important}}'
  ].join('');
  document.head.appendChild(rules);
  const bar=document.createElement('div');
  bar.className='v79-pull-bar';
  bar.setAttribute('aria-label','下に引っ張ると閉じます');
  bar.innerHTML='<span class="v79-hint">↓ 引っ張って閉じる</span><button class="v79-close" type="button" aria-label="映画の詳細を閉じる">閉じる</button>';
  const handle=sheet.querySelector(':scope > .handle');
  if(handle)bar.insertBefore(handle,bar.firstChild);
  else{
    const h=document.createElement('div');h.className='handle';
    bar.insertBefore(h,bar.firstChild);
  }
  sheet.insertBefore(bar,sheet.firstChild);

  const previousOpen=openSheet, previousClose=closeSheet;
  let pageLocked=false,priorOverflowHtml='',priorOverflowBody='';
  let gesture=null,closeTimer=0;
  function lockBehind(){
    if(pageLocked)return;
    pageLocked=true;
    priorOverflowHtml=document.documentElement.style.overflow;
    priorOverflowBody=document.body.style.overflow;
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
  }
  function unlockBehind(){
    if(!pageLocked)return;
    pageLocked=false;
    document.documentElement.style.overflow=priorOverflowHtml;
    document.body.style.overflow=priorOverflowBody;
  }
  function resetSheetVisual(){
    if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
    sheet.style.transition='';
    sheet.style.transform='';
    gesture=null;
  }
  openSheet=function(...args){
    resetSheetVisual();
    const result=previousOpen.apply(this,args);
    if(overlay.classList.contains('open')){
      sheet.scrollTop=0;
      lockBehind();
    }
    return result;
  };
  closeSheet=function(...args){
    resetSheetVisual();
    let result;
    try{result=previousClose.apply(this,args)}
    finally{unlockBehind();}
    return result;
  };
  bar.querySelector('.v79-close').onclick=e=>{
    e.preventDefault();e.stopPropagation();closeSheet();
  };
  function scrollableChild(target){
    let node=target;
    while(node&&node!==sheet&&node!==overlay){
      if(node instanceof HTMLElement){
        const style=getComputedStyle(node);
        if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+2)return node;
      }
      node=node.parentElement;
    }
    return null;
  }
  sheet.addEventListener('touchstart',event=>{
    gesture=null;
    if(!overlay.classList.contains('open')||event.touches.length!==1)return;
    const target=event.target;
    if(!(target instanceof Element))return;
    if(target.closest('button,input,select,[contenteditable="true"],[role="button"]'))return;
    if(target.closest('textarea')&&!target.closest('#note66'))return;
    const fromHandle=bar.contains(target);
    const child=scrollableChild(target);
    if(child&&child.scrollTop>1)return;
    if(!fromHandle&&sheet.scrollTop>1)return;
    const t=event.touches[0];
    gesture={y:t.clientY,x:t.clientX,fromHandle,dragging:false,dy:0,started:performance.now()};
  },{passive:true});
  sheet.addEventListener('touchmove',event=>{
    const g=gesture;
    if(!g||event.touches.length!==1||!overlay.classList.contains('open'))return;
    const t=event.touches[0],dy=t.clientY-g.y,dx=t.clientX-g.x;
    if(!g.dragging){
      if(dy<0||(Math.abs(dx)>11&&Math.abs(dx)>Math.abs(dy))){gesture=null;return;}
      if(dy<7)return;
      if(dy<Math.abs(dx)*1.1)return;
      if(!g.fromHandle&&sheet.scrollTop>1){gesture=null;return;}
      g.dragging=true;
    }
    if(event.cancelable)event.preventDefault();
    g.dy=Math.max(0,dy);
    sheet.style.transition='none';
    sheet.style.transform='translate3d(0,'+Math.min(320,Math.round(g.dy*0.85))+'px,0)';
  },{passive:false});
  function finishTouch(cancelled){
    const g=gesture;gesture=null;
    if(!g||!g.dragging)return;
    const fast=g.dy>55&&(g.dy/Math.max(1,performance.now()-g.started))>0.7;
    if(!cancelled&&(g.dy>=105||fast)){
      sheet.style.transition='transform 150ms ease-out';
      sheet.style.transform='translate3d(0,100dvh,0)';
      closeTimer=setTimeout(()=>{
        closeTimer=0;
        if(overlay.classList.contains('open'))closeSheet();
        else resetSheetVisual();
      },155);
    }else{
      sheet.style.transition='transform 160ms ease-out';
      sheet.style.transform='';
      closeTimer=setTimeout(()=>{closeTimer=0;sheet.style.transition='';},180);
    }
  }
  sheet.addEventListener('touchend',()=>finishTouch(false),{passive:true});
  sheet.addEventListener('touchcancel',()=>finishTouch(true),{passive:true});
  overlay.addEventListener('touchmove',event=>{
    if(event.target===overlay&&event.cancelable)event.preventDefault();
  },{passive:false});
  const observer=new MutationObserver(()=>{
    if(overlay.classList.contains('open'))lockBehind();
    else unlockBehind();
  });
  observer.observe(overlay,{attributes:true,attributeFilter:['class']});
})();
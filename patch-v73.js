(() => {
  // v73: rank TOC search shortcut + always-near Letterboxd sync shortcut.
  const BUILD='20261008c';

  const style=document.createElement('style');
  style.textContent=`
    #starJumpBar [data-jump-search]{border-color:#355b77;color:#cbe8ff}
    .top-lb-sync-v73{border:1px solid #355b77;background:#101820;color:#cbe8ff;border-radius:10px;padding:8px 9px;font-size:10px;font-weight:850;white-space:nowrap}
    .top-lb-sync-v73:disabled{opacity:.55}
    @media(max-width:560px){
      .top-lb-sync-v73{padding:7px 8px;font-size:9.5px}
      .topactions{gap:4px}
    }
  `;
  document.head.appendChild(style);

  function enhanceJumpBar(){
    const bar=document.getElementById('starJumpBar');
    if(!bar)return;
    if(!bar.querySelector('[data-jump-search]')){
      const b=document.createElement('button');
      b.type='button';
      b.dataset.jumpSearch='1';
      b.textContent='検索';
      b.onclick=()=>{
        const q=document.getElementById('searchRank');
        if(!q)return;
        q.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>{try{q.focus({preventScroll:true})}catch(_){q.focus()}},260);
      };
      bar.insertBefore(b,bar.firstChild);
    }
  }

  function addQuickSync(){
    const actions=document.querySelector('.topactions');
    if(!actions||document.getElementById('topLbSyncV73'))return;
    const b=document.createElement('button');
    b.type='button';
    b.id='topLbSyncV73';
    b.className='top-lb-sync-v73';
    b.textContent='LB同期';
    b.title='Letterboxd同期';
    const add=document.getElementById('quickAdd');
    if(add)actions.insertBefore(b,add);else actions.appendChild(b);
    b.onclick=async()=>{
      if(b.disabled)return;
      const old=b.textContent;
      b.disabled=true;b.textContent='同期中…';
      try{
        if(typeof syncLetterboxd!=='function')throw new Error('同期機能が見つかりません');
        await syncLetterboxd(false);
      }catch(e){
        try{toast('Letterboxd同期に失敗しました')}catch(_){}
      }finally{
        b.disabled=false;b.textContent=old;
      }
    };
  }

  const renderRankPrev=renderRank;
  renderRank=function(...args){
    const out=renderRankPrev.apply(this,args);
    enhanceJumpBar();
    return out;
  };

  enhanceJumpBar();
  addQuickSync();

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();
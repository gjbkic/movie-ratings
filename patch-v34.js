(() => {
  // v34: keep card media badges in sync with the v33 authoritative media taxonomy.
  const BUILD34='20260925w';

  function mediaLabel34(f){
    const v=String(state.mediaTypeOverrides?.[f?.id] || f?.mediaType || 'movie');
    if(v==='drama'||v==='series') return 'TVシリーズ';
    if(v==='other') return 'その他';
    return '映画';
  }

  function fixBadges34(root=document){
    root.querySelectorAll?.('[data-id]').forEach(card=>{
      const pill=card.querySelector?.('.media-pill');
      if(!pill) return;
      const raw=card.dataset.id||'';
      let id=raw;
      try{id=decodeURIComponent(raw)}catch(_){}
      const f=filmById(id);
      if(!f) return;
      pill.textContent=mediaLabel34(f);
    });
  }

  const renderRankPrev=renderRank;
  renderRank=function(){
    const out=renderRankPrev();
    fixBadges34(document.getElementById('rankRoot')||document);
    return out;
  };

  const renderClassifyPrev=renderClassify;
  renderClassify=function(){
    const out=renderClassifyPrev();
    fixBadges34(document.getElementById('classifyRoot')||document);
    return out;
  };

  const rankRoot=document.getElementById('rankRoot');
  const classifyRoot=document.getElementById('classifyRoot');
  const observer=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='childList'&&m.addedNodes.length){
        fixBadges34(m.target.closest?.('#rankRoot,#classifyRoot')||m.target);
      }
    }
  });
  if(rankRoot)observer.observe(rankRoot,{childList:true,subtree:true});
  if(classifyRoot)observer.observe(classifyRoot,{childList:true,subtree:true});

  fixBadges34();
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD34;
})();

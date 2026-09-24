(() => {
  // v34: keep card media badges in sync with the v33 authoritative media taxonomy.
  // IMPORTANT: no MutationObserver here. The previous observer rescanned all 600+ cards
  // after every text mutation and could create an update loop on iPhone.
  const BUILD34='20260925x';

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
      const label=mediaLabel34(f);
      if(pill.textContent!==label) pill.textContent=label;
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

  // One initial pass is enough; subsequent changes are handled by the render wrappers above.
  fixBadges34();
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD34;
})();

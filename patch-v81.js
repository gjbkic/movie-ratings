(() => {
  'use strict';
  // v81: English original titles for Black Mirror; no score/rank/review changes.
  const BUILD='20261010j';
  const known={
    'custom-1791447953969-ah3e':'Black Mirror: The National Anthem',
    'custom-1791449338315-twqr':'Black Mirror: Fifteen Million Merits',
    'custom-1791469824035-6gcd':'Black Mirror: The Entire History of You',
    'custom-1791469823654-dpbh':'Black Mirror: Be Right Back'
  };
  const jp={
    '国歌':'The National Anthem','1500万メリット':'Fifteen Million Merits',
    '人生の軌跡のすべて':'The Entire History of You','ずっと側にいて':'Be Right Back',
    'シロクマ':'White Bear','ホワイト・ベア':'White Bear','ホワイトベア':'White Bear'
  };
  function englishName(f){
    if(known[f.id])return known[f.id];
    const x=titleInfo(f);
    const aliases=[x.title,x.originalTitle,x.englishTitle,f.lbTitle,f.title,f.originalTitle,f.englishTitle];
    for(const v of aliases){
      const t=String(v||'').trim();
      const m=t.match(/^Black\s+Mirror\s*[:：–—-]\s*(.+)$/i);
      if(m&&m[1].trim())return 'Black Mirror: '+m[1].trim();
    }
    for(const v of aliases){
      const t=String(v||'').trim();
      const m=t.match(/^ブラック\s*[・･]?\s*ミラー\s*[「『（(]?\s*(.*?)\s*[」』）)]?$/);
      if(m&&jp[m[1]])return 'Black Mirror: '+jp[m[1]];
    }
    return null;
  }
  function unify(){
    state.titleOverrides=state.titleOverrides||{};
    let changed=0;
    for(const f of allFilms()){
      const title=englishName(f);
      if(!title||titleInfo(f).title===title)continue;
      state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),title};
      changed++;
    }
    if(changed)save(false);
  }
  const oldRender=render,oldRank=renderRank;
  render=function(...a){unify();return oldRender.apply(this,a);};
  renderRank=function(...a){unify();return oldRank.apply(this,a);};
  unify();render();
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

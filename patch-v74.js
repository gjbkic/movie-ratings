(() => {
  // v74: normalize Black Mirror episode display titles.
  const BUILD='20261008d';
  const FIXES=[
    ['custom-1791469824035-6gcd','Black Mirror: The Entire History of You','ブラック・ミラー「人生の軌跡のすべて」'],
    ['custom-1791469823654-dpbh','Black Mirror: Be Right Back','ブラック・ミラー「ずっと側にいて」']
  ];
  let changed=0;
  state.titleOverrides=state.titleOverrides||{};
  for(const [id,oldTitle,newTitle] of FIXES){
    const f=filmById(id);
    if(!f||displayTitle(f)!==oldTitle) continue;
    state.titleOverrides[id]={...(state.titleOverrides[id]||{}),title:newTitle};
    changed++;
  }
  if(changed){
    save();
    render();
    try{toast('ブラック・ミラーの表記を統一しました')}catch(_){}
  }
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();
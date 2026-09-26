(() => {
  // v43: undo the assistant-added watched-TV seed from v42 only.
  // Existing user data / Letterboxd entries are not removed.
  const BUILD='20260926f';
  const IDS=new Set([
    'seed-tv-hanzawa-2013','seed-tv-legalhigh-2012','seed-tv-legalhigh2-2013',
    'seed-tv-trick-2000','seed-tv-trick2-2002','seed-tv-trick3-2003',
    'seed-tv-hero-2001','seed-tv-hero-2014','seed-tv-999-2016','seed-tv-9992-2018',
    'seed-tv-spec-2010','seed-tv-strawberrynight-2012','seed-tv-galileo-2007',
    'seed-tv-liargame-2007','seed-tv-codeblue-2008','seed-tv-boss-2009'
  ]);
  const CLEAN_KEY='movie30_undo_tv_seed_v43_20260926f';
  let done=false;try{done=localStorage.getItem(CLEAN_KEY)==='1'}catch(_){}
  if(!done){
    const before=(state.customFilms||[]).length;
    state.customFilms=(state.customFilms||[]).filter(f=>!IDS.has(f.id));
    for(const key of ['assignments','starOverrides','exactScores','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides']){
      if(!state[key])continue;
      for(const id of IDS)delete state[key][id];
    }
    for(const k of Object.keys(state.rankOrder||{}))state.rankOrder[k]=(state.rankOrder[k]||[]).filter(id=>!IDS.has(id));
    const cleanObjKey=k=>{try{const o=JSON.parse(localStorage.getItem(k)||'{}');if(o&&typeof o==='object'&&!Array.isArray(o)){for(const id of IDS)delete o[id];localStorage.setItem(k,JSON.stringify(o));}}catch(_){}};
    cleanObjKey('movie30_media_v33_v1');
    cleanObjKey('movie30_origin_v33_v1');
    try{
      const arr=JSON.parse(localStorage.getItem('movie30_media_drama_ids_v1')||'[]');
      if(Array.isArray(arr))localStorage.setItem('movie30_media_drama_ids_v1',JSON.stringify(arr.filter(id=>!IDS.has(id))));
      localStorage.setItem(CLEAN_KEY,'1');
    }catch(_){}
    if((state.customFilms||[]).length!==before){save();render();toast('今回追加したTV作品を取り消しました');}
  }
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

(() => {
  // v46: remove the unwatched 2018 TV series "チア☆ダン / We Are Rockets!" only.
  // Keep the 2017 theatrical film. Prevent the TV entry from being re-imported from Letterboxd.
  const BUILD='20260927c';
  const ID='lb-386-wbAi';
  const KEY='movie30_remove_we_are_rockets_tv_v46_20260927c';

  function isTvChiad(meta){
    const y=String(meta?.year||'');
    const t=String(meta?.title||meta?.lbTitle||meta?.englishTitle||'');
    return y==='2018' && /(?:チア\s*[☆★・]?\s*ダン|we\s+are\s+rockets!?)/i.test(t);
  }

  // Hide the base entry everywhere in the app.
  if(typeof allFilms==='function'){
    const prevAllFilms=allFilms;
    allFilms=function(){return prevAllFilms().filter(f=>f?.id!==ID);};
  }

  // Do not let a later Letterboxd sync add the same 2018 TV series back.
  if(typeof parseLbRss==='function'){
    const prevParse=parseLbRss;
    parseLbRss=function(xml){return prevParse(xml).filter(x=>!isTvChiad(x));};
  }
  if(typeof addLbFilm==='function'){
    const prevAdd=addLbFilm;
    addLbFilm=function(meta){if(isTvChiad(meta))return null;return prevAdd(meta);};
  }

  let done=false;try{done=localStorage.getItem(KEY)==='1'}catch(_){}
  if(!done){
    // Remove only this title's watch/rating/metadata state.
    for(const k of ['assignments','starOverrides','exactScores','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides']){
      if(state[k])delete state[k][ID];
    }
    state.customFilms=(state.customFilms||[]).filter(f=>f?.id!==ID&&!isTvChiad(f));
    for(const score of Object.keys(state.rankOrder||{})){
      state.rankOrder[score]=(state.rankOrder[score]||[]).filter(id=>id!==ID);
    }

    // Clean structural caches used by later patches.
    for(const storageKey of ['movie30_media_v33_v1','movie30_origin_v33_v1']){
      try{
        const o=JSON.parse(localStorage.getItem(storageKey)||'{}');
        if(o&&typeof o==='object'&&!Array.isArray(o)){delete o[ID];localStorage.setItem(storageKey,JSON.stringify(o));}
      }catch(_){}
    }
    try{
      const a=JSON.parse(localStorage.getItem('movie30_media_drama_ids_v1')||'[]');
      if(Array.isArray(a))localStorage.setItem('movie30_media_drama_ids_v1',JSON.stringify(a.filter(id=>id!==ID)));
    }catch(_){}

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('チア☆ダン（2018）TV版を削除しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

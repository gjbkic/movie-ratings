(() => {
  // v71: one-time repair for the Tales of the Bizarre logging shift caused by
  // the skipped-special sequence in October 2026.
  const BUILD='20261008a';
  const tmdbOf=f=>String((state.titleOverrides?.[f?.id]?.tmdbId ?? f?.tmdbId ?? ''));
  const byTmdb=id=>allFilms().find(f=>tmdbOf(f)===String(id));

  const a=byTmdb(1308067); // 2024 Summer (stale mislogged entry)
  const b=byTmdb(1203652); // 2023 Fall
  const c=byTmdb(1142085); // 2023 Summer
  const d=byTmdb(1048225); // 2022 Fall
  const e=byTmdb(989763);  // 2022 Summer
  const f=byTmdb(845788);  // 2021 Summer

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
  if(!a||!b||!c||!d||!e||!f)return;

  const score=id=>Object.prototype.hasOwnProperty.call(state.exactScores||{},id)
    ? Number(state.exactScores[id]) : null;

  // Only migrate the exact known broken state. This makes the patch idempotent
  // and prevents touching later manual edits.
  const broken =
    score(a.id)===77 &&
    score(b.id)===73 &&
    score(c.id)===76 &&
    score(d.id)===80 &&
    score(e.id)===85 &&
    score(f.id)==null;
  if(!broken)return;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const genres={
    a:clone(state.genreOverrides?.[a.id]||[]),
    b:clone(state.genreOverrides?.[b.id]||[]),
    c:clone(state.genreOverrides?.[c.id]||[]),
    d:clone(state.genreOverrides?.[d.id]||[]),
    e:clone(state.genreOverrides?.[e.id]||[])
  };
  const mapping={
    [a.id]:b.id,
    [b.id]:c.id,
    [c.id]:d.id,
    [d.id]:e.id,
    [e.id]:f.id
  };

  // Move saved same-score positions together with the score.
  const nextRank={};
  for(const [k,list] of Object.entries(state.rankOrder||{})){
    const seen=new Set();
    nextRank[k]=(list||[]).map(id=>mapping[id]||id).filter(id=>{
      if(id===a.id||seen.has(id))return false;
      seen.add(id);return true;
    });
  }
  state.rankOrder=nextRank;

  for(const id of [a.id,b.id,c.id,d.id,e.id,f.id]){
    delete state.exactScores?.[id];
    delete state.starOverrides?.[id];
    delete state.assignments?.[id];
  }

  const setScore=(film,sc,star)=>{
    state.exactScores=state.exactScores||{};
    state.starOverrides=state.starOverrides||{};
    state.exactScores[film.id]=sc;
    state.starOverrides[film.id]=star;
    film.star=star;
  };
  setScore(b,77,2.5);
  setScore(c,73,2);
  setScore(d,76,2);
  setScore(e,80,2.5);
  setScore(f,85,3.5);

  state.genreOverrides=state.genreOverrides||{};
  state.genreOverrides[b.id]=genres.a;
  state.genreOverrides[c.id]=genres.b;
  state.genreOverrides[d.id]=genres.c;
  state.genreOverrides[e.id]=genres.d;
  state.genreOverrides[f.id]=genres.e;
  delete state.genreOverrides[a.id];

  state.mediaTypeOverrides=state.mediaTypeOverrides||{};
  state.formatOverrides=state.formatOverrides||{};
  for(const x of [b,c,d,e,f]){
    state.mediaTypeOverrides[x.id]='drama';
    state.formatOverrides[x.id]='live';
  }

  // 2024 Summer was the stale Letterboxd item that has now been deleted/
  // corrected on Letterboxd. Remove that stale app entry entirely.
  state.customFilms=(state.customFilms||[]).filter(x=>x.id!==a.id);
  for(const key of [
    'assignments','starOverrides','exactScores','titleOverrides','categoryOverrides',
    'mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides',
    'runtimeOverrides','letterboxdMeta'
  ]){
    if(state[key])delete state[key][a.id];
  }
  for(const k of Object.keys(state.rankOrder||{})){
    state.rankOrder[k]=(state.rankOrder[k]||[]).filter(id=>id!==a.id);
  }

  save();
  render();
  try{toast('世にも奇妙な物語のズレを修正しました')}catch(_){}
})();
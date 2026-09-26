(() => {
  // v50: confirmed genre refinements after criteria calibration.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927g';
  const KEY='movie30_genre_audit_v50_20260927g';
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function editId(id,{add=[],remove=[]}={}){
    const f=allFilms().find(x=>x?.id===id);
    if(!f)return;
    state.genreOverrides=state.genreOverrides||{};
    const current=uniq(state.genreOverrides[id]||[]);
    const rm=new Set(remove), s=new Set(current.filter(g=>!rm.has(g)));
    for(const g of add)s.add(g);
    state.genreOverrides[id]=[...s];
  }

  let done=false;try{done=localStorage.getItem(KEY)==='1'}catch(_){}
  if(!done){
    editId('lb-370-ham',{add:['時間'],remove:['歴史']}); // Looper
    editId('lb-326-4hka',{add:['戦争']}); // Mockingjay Part 1
    editId('lb-99-4hk0',{add:['戦争']}); // Mockingjay Part 2
    editId('lb-262-29Du',{add:['世界観']}); // Gattaca
    editId('lb-344-5YPM',{add:['サスペンス']}); // The Maze Runner

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

(() => {
  // v61: confirmed genre refinements after criteria calibration.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927r';
  const KEY='movie30_genre_audit_v61_20260927r';
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
    editId('lb-264-FPS',{add:['ファンタジー']}); // In Time
    editId('lb-418-2a1w',{add:['ファンタジー']}); // Independence Day
    editId('lb-142-2bde',{add:['ファンタジー']}); // War of the Worlds
    editId('lb-267-29u8',{add:['ファンタジー']}); // Close Encounters of the Third Kind
    editId('lb-495-Msm',{add:['大作']}); // Incendies

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

(() => {
  // v62: final SF/fantasy boundary refinements after calibration.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927s';
  const KEY='movie30_genre_audit_v62_20260927s';
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
    editId('lb-4-jUk4',{remove:['SF']}); // Everything Everywhere All at Once
    editId('lb-27-2b2A',{add:['ファンタジー']}); // Donnie Darko
    editId('lb-111-4pD0',{add:['ファンタジー']}); // Edge of Tomorrow
    editId('lb-264-FPS',{remove:['ファンタジー']}); // In Time

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

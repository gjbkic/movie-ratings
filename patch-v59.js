(() => {
  // v59: confirmed genre refinements after criteria calibration.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927p';
  const KEY='movie30_genre_audit_v59_20260927p';
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
    editId('lb-2-2a9q',{add:['社会問題・生活']}); // Fight Club
    editId('lb-106-29Ik',{add:['差別・人権']}); // V for Vendetta
    editId('lb-77-2aNq',{add:['歴史']}); // The Godfather Part II
    editId('lb-479-2a1Q',{add:['社会問題・生活','心理・内面']}); // Full Metal Jacket

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

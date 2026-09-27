(() => {
  // v65: confirmed superhero/SF genre refinements.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927v';
  const KEY='movie30_genre_audit_v65_20260927v';
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
    // Thor trilogy: fantasy/superhero, but no SF.
    for(const id of ['lb-529-1WQU','lb-351-2DqA','lb-408-8MHi']){
      editId(id,{remove:['SF']});
    }

    // All registered Spider-Man films: keep/restore SF.
    for(const id of [
      'lb-432-2a8i','lb-60-2a88','lb-95-2a7Y',
      'lb-79-27PI','lb-562-3utM',
      'lb-40-aboM','lb-407-fegG','lb-519-nwRw','lb-563-ACJE',
      'lb-310-azpY','lb-10-kSz4'
    ]){
      editId(id,{add:['SF']});
    }
    editId('lb-519-nwRw',{add:['ファンタジー']}); // No Way Home

    // Ant-Man 1 & 2: SF yes, fantasy no.
    editId('lb-528-3vmW',{add:['SF'],remove:['ファンタジー']});
    editId('lb-452-cqUW',{add:['SF'],remove:['ファンタジー']});

    // Arrival: explicitly keep/add SF.
    editId('lb-354-aNGk',{add:['SF']});

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

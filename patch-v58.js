(() => {
  // v58: confirmed genre refinements after criteria calibration.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927o';
  const KEY='movie30_genre_audit_v58_20260927o';
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
    editId('lb-36-29FA',{remove:['アクション']}); // GoodFellas
    editId('lb-332-28MA',{add:['サスペンス'],remove:['アクション']}); // The Departed
    editId('lb-425-zu4c',{add:['歴史']}); // Godzilla Minus One

    // Star Wars films in the current library: keep SF, add 戦争 under the broad fictional-war criterion.
    for(const id of [
      'lb-73-27Vc', // Episode I
      'lb-87-27V2', // Episode II
      'lb-49-27US', // Episode III
      'lb-37-72s',  // Episode IV
      'lb-48-27Vw', // Episode V
      'lb-71-27Vm', // Episode VI
      'lb-76-4vru', // Episode VII
      'lb-508-5xme',// Episode VIII
      'lb-433-5xlK',// Episode IX
      'lb-132-aPvy' // Rogue One
    ]) editId(id,{add:['戦争']});

    editId('lb-300-28Vs',{add:['コメディ','社会問題・生活']}); // American Psycho

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('確認済みジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

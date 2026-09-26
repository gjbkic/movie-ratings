(() => {
  // v45: apply the user's first-pass audit corrections only.
  // Genre/media metadata only; scores and ranking are untouched.
  const BUILD='20260927b';
  const KEY='movie30_genre_audit_v45_20260927b';

  function genres(id){
    const g=state.genreOverrides?.[id];
    return Array.isArray(g)?[...new Set(g.filter(Boolean))]:[];
  }
  function setGenres(id,next){
    state.genreOverrides=state.genreOverrides||{};
    state.genreOverrides[id]=[...new Set((next||[]).filter(Boolean))];
  }
  function add(id,...tags){
    const cur=genres(id), s=new Set(cur);
    for(const t of tags)if(t)s.add(t);
    setGenres(id,[...s]);
  }
  function remove(id,...tags){
    const rm=new Set(tags);
    setGenres(id,genres(id).filter(g=>!rm.has(g)));
  }

  let done=false;
  try{done=localStorage.getItem(KEY)==='1'}catch(_){}
  if(!done){
    // 時間・特殊構造
    add('lb-64-leq4','時間','特殊構造');                       // TENET
    add('lb-160-2b8e','時間');                                  // BTTF 1
    add('lb-163-2aYI','時間');                                  // BTTF 2
    add('lb-428-2aTS','時間');                                  // BTTF 3
    add('lb-303-2aQY','SF','時間');                              // Terminator
    add('lb-349-2aGY','時間');                                  // Terminator 2
    add('lb-111-4pD0','時間');                                  // Edge of Tomorrow
    add('lb-164-2b3e','時間');                                  // Groundhog Day
    add('lb-265-fdo','時間','特殊構造');                         // Source Code
    add('lb-439-1OPa','時間');                                  // The Girl Who Leapt Through Time
    add('lb-86-cUqs','時間');                                   // Your Name.
    add('lb-401-9vE4','時間');                                  // Avengers: Endgame
    add('lb-124-103U','時間');                                  // Men in Black 3
    add('lb-259-N7ZC','時間');                                  // A Samurai in Time
    add('custom-1790322768630-3s2i','時間');                    // Kiss that Kills

    // バイオレンス・特殊構造・思想/心理
    add('lb-457-IG','バイオレンス');                            // Drive
    add('lb-61-297o','特殊構造');                               // Mulholland Drive
    add('lb-8-6YK','特殊構造');                                 // Eternal Sunshine
    add('lb-58-293w','特殊構造');                               // The Prestige
    add('lb-438-2ahu','哲学・思想','心理・内面','特殊構造');      // Being John Malkovich
    remove('lb-269-1dE0','時間');                               // The NeverEnding Story

    // スポーツ: Forrest Gump only removed. User explicitly keeps Animatrix and Whiplash.
    remove('lb-12-728','スポーツ');                             // Forrest Gump
    add('lb-336-qH0','スポーツ');                               // The Animatrix
    add('lb-524-7bQA','スポーツ');                              // Whiplash

    // Clear classification omissions from the highlighted audit block.
    add('lb-239-kidw','ミステリー','サスペンス','ドラマ','娯楽'); // Masquerade Hotel
    add('lb-386-wbAi','ドラマ','スポーツ','青春・若者');           // We Are Rockets! TV
    add('custom-1790322764890-2w6w','TV本編','サスペンス','アクション','娯楽'); // VIVANT
    add('custom-1790322766063-ab5l','TV本編','恋愛');             // First Love

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('分類の監査修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

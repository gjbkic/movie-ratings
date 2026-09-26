(() => {
  // v47: correct known media-type and live/animation classification mistakes.
  // Scores/ranks are never changed.
  const BUILD='20260927d';
  const MEDIA_KEY='movie30_media_v33_v1';
  const LEGACY_TV_KEY='movie30_media_drama_ids_v1';
  const TV_MAIN='TV本編', TV_SP='TV特番・SP';
  const TV_TAGS=new Set([TV_MAIN,TV_SP]);

  const readObj=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}};
  const writeObj=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const writeSet=(k,s)=>{try{localStorage.setItem(k,JSON.stringify([...s]))}catch(_){}};
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const rawGenres=f=>uniq(state.genreOverrides?.[f?.id]||[]);
  const textOf=f=>{const x=titleInfo(f)||{};return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f?.lbTitle].filter(Boolean).join(' ')};
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();

  const mediaMap=readObj(MEDIA_KEY);
  let mediaChanged=false,stateChanged=false,formatChanged=false;

  function setMedia(f,v){
    if(!f)return;
    state.mediaTypeOverrides=state.mediaTypeOverrides||{};
    if(state.mediaTypeOverrides[f.id]!==v){state.mediaTypeOverrides[f.id]=v;stateChanged=true;}
    if(mediaMap[f.id]!==v){mediaMap[f.id]=v;mediaChanged=true;}
  }
  function setGenres(f,next){
    if(!f)return;
    state.genreOverrides=state.genreOverrides||{};
    const prev=rawGenres(f),n=uniq(next);
    if(prev.length!==n.length||prev.some((x,i)=>x!==n[i])){state.genreOverrides[f.id]=n;stateChanged=true;}
  }
  function setTvSubtype(f,sp,{removeSeriesMovie=false}={}){
    let g=rawGenres(f).filter(x=>!TV_TAGS.has(x));
    if(removeSeriesMovie)g=g.filter(x=>x!=='シリーズ劇場版');
    g.push(sp?TV_SP:TV_MAIN);setGenres(f,g);
  }
  function removeTvSubtype(f){setGenres(f,rawGenres(f).filter(x=>!TV_TAGS.has(x)));}
  function setFormat(f,v){
    if(!f)return;
    state.formatOverrides=state.formatOverrides||{};
    if(state.formatOverrides[f.id]!==v){state.formatOverrides[f.id]=v;formatChanged=true;}
  }

  const films=allFilms();
  const byId=new Map(films.map(f=>[f.id,f]));

  // TV specials that were stored as films/main-series.
  for(const id of ['lb-250-bAcS','lb-254-6ZCG']){
    const f=byId.get(id);if(f){setMedia(f,'drama');setTvSubtype(f,true,{removeSeriesMovie:true});}
  }
  {
    const f=byId.get('lb-475-F1U6'); // そして誰もいなくなった (2017), two-night TV special
    if(f){setMedia(f,'drama');setTvSubtype(f,true);}
  }

  // The theatrical Bayside Shakedown entries are films, not TV-main entries.
  for(const id of ['custom-1789385860847-w7kt','custom-1789385860756-dujj','custom-1789385860718-itqh']){
    const f=byId.get(id);if(f){setMedia(f,'movie');removeTvSubtype(f);}
  }

  // Ani*Kuri15 is a collection of animated shorts: keep it out of the TV-drama bucket.
  for(const f of films){
    const t=norm(textOf(f)),y=Number(f.year)||0;
    if(y===2007&&/(?:ani\*?kuri\s*15|アニ.?クリ\s*15|ネコの集会|\bgood morning\b)/i.test(t)){
      setMedia(f,'other');removeTvSubtype(f);setFormat(f,'animation');
    }
  }

  // Definite animation items that had been marked live action.
  for(const f of films){
    const t=norm(textOf(f)),y=Number(f.year)||0;
    if(
      /(?:spider.?man.*(?:into|across).*spider.?verse|スパイダーマン.*スパイダーバース)/i.test(t) ||
      /(?:the animatrix|アニマトリックス)/i.test(t) ||
      /(?:fantastic mr\.? fox|ファンタスティック mr\.?fox)/i.test(t) ||
      /jojo's bizarre adventure: (?:stone ocean|stardust crusaders|golden wind|diamond is unbreakable)/i.test(t) ||
      (y===2002&&/(?:lilo\s*&\s*stitch|リロ(?:・|＆|&)?スティッチ)/i.test(t)) ||
      (y===1950&&/(?:^| )cinderella(?: |$)|シンデレラ/i.test(t)) ||
      (y===1984&&/(?:ドラえもん.*のび太の魔界大冒険|doraemon: nobita's great adventure in the world of magic)/i.test(t)) ||
      (y===1972&&/(?:ユキの太陽|yuki's sun)/i.test(t))
    ) setFormat(f,'animation');
  }

  // Definite live/hybrid items that had been marked animation.
  for(const f of films){
    const t=norm(textOf(f)),y=Number(f.year)||0;
    if(y===2017&&/(?:beauty and the beast|美女と野獣)/i.test(t))setFormat(f,'live');
    if(y===2010&&/(?:alice in wonderland|不思議の国のアリス)/i.test(t))setFormat(f,'live');
    if(y===1964&&/(?:mary poppins|メリー.?ポピンズ)/i.test(t))setFormat(f,'hybrid');
  }

  if(mediaChanged){
    writeObj(MEDIA_KEY,mediaMap);
    writeSet(LEGACY_TV_KEY,new Set(Object.entries(mediaMap).filter(([,v])=>v==='drama').map(([id])=>id)));
  }
  if(stateChanged||formatChanged){try{save(false)}catch(_){try{save()}catch(__){}}}

  // v33 keeps mediaMap in a closure, so one reload is needed after the first correction pass.
  if(mediaChanged){
    let reloaded=false;try{reloaded=sessionStorage.getItem('movie30_mediafix_reload_v47')===BUILD}catch(_){}
    if(!reloaded){
      try{sessionStorage.setItem('movie30_mediafix_reload_v47',BUILD)}catch(_){}
      setTimeout(()=>location.reload(),120);return;
    }
  }

  try{render()}catch(_){}
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

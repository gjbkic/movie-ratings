(() => {
  const VALID_MEDIA = new Set(['movie','documentary','other']);
  const VALID_ORIGIN = new Set(['邦画','ハリウッド','その他外国語映画']);
  const VALID_FORMAT = new Set(['live','animation','hybrid']);
  const TMDB_GENRE_MAP = {
    'Science Fiction':'SF','Action':'アクション','Mystery':'ミステリー','Thriller':'スリラー',
    'Horror':'ホラー','Crime':'クライム','Drama':'ドラマ','Comedy':'コメディ','Romance':'恋愛',
    'Music':'ミュージカル','War':'戦争','History':'歴史','Fantasy':'ファンタジー','Adventure':'アドベンチャー'
  };

  state.mediaTypeOverrides = state.mediaTypeOverrides || {};
  state.originOverrides = state.originOverrides || {};
  state.formatOverrides = state.formatOverrides || {};
  state.genreOverrides = state.genreOverrides || {};
  state.runtimeOverrides = state.runtimeOverrides || {};

  function titleBlob(f){
    const x=titleInfo(f);
    return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f.lbTitle||''].filter(Boolean).join(' ');
  }
  function isHybridTitle(fOrTitle){
    const s=typeof fOrTitle==='string'?fOrTitle:titleBlob(fOrTitle);
    return /(?:kill\s*bill\s*(?::|-)?\s*(?:vol\.?\s*)?1\b|キル[・\s]?ビル\s*(?:vol\.?\s*)?1\b)/i.test(s);
  }
  function isIwoJima(f){ return /(?:硫黄島からの手紙|letters\s+from\s+iwo\s+jima)/i.test(titleBlob(f)); }
  function formatValue(f){
    const v=state.formatOverrides[f.id];
    if(VALID_FORMAT.has(v)) return v;
    return 'live';
  }
  function formatMatches(f,wanted){
    const v=formatValue(f);
    return !wanted || v===wanted || v==='hybrid';
  }
  function formatLabel(f){const v=formatValue(f);return v==='animation'?'アニメ':v==='hybrid'?'実写・アニメ':'実写';}
  function mediaLabel(f){const v=state.mediaTypeOverrides[f.id]||'movie';return v==='documentary'?'ドキュメンタリー':v==='other'?'その他':'映画';}
  function originValue(f){const v=state.originOverrides[f.id];return VALID_ORIGIN.has(v)?v:'ハリウッド';}
  function runtimeValue(f){const n=Number(state.runtimeOverrides[f.id]??f.runtime);return Number.isFinite(n)&&n>0?n:null;}

  function inferExisting(){
    for(const f of allFilms()){
      let mt=state.mediaTypeOverrides[f.id];
      if(mt==='series') mt='other';
      if(!VALID_MEDIA.has(mt)){
        const b=titleBlob(f);
        if(/(?:lecture\s*series|講座|making\s+of|メイキング)/i.test(b)) mt='other';
        else if(/(?:miss\s+americana)/i.test(b)) mt='documentary';
        else mt='movie';
      }
      if(mt==='movie') delete state.mediaTypeOverrides[f.id]; else state.mediaTypeOverrides[f.id]=mt;

      if(isIwoJima(f)) state.originOverrides[f.id]='ハリウッド';
      else if(!VALID_ORIGIN.has(state.originOverrides[f.id])){
        const x=titleInfo(f),orig=String(x.originalTitle||''),cat=String(filmCategory(f)||'');
        if(cat==='邦画'||cat.includes('ジブリ')||cat.includes('コナン')||/[\u3040-\u30ff]/.test(orig)) state.originOverrides[f.id]='邦画';
        else if(/[\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/.test(orig)) state.originOverrides[f.id]='その他外国語映画';
        else state.originOverrides[f.id]='ハリウッド';
      }

      if(isHybridTitle(f)) state.formatOverrides[f.id]='hybrid';
      else if(!VALID_FORMAT.has(state.formatOverrides[f.id])){
        const cat=String(filmCategory(f)||''),gs=state.genreOverrides[f.id]||[];
        state.formatOverrides[f.id]=(cat.includes('アニメ')||cat.includes('ジブリ')||cat.includes('コナン')||gs.includes('アニメ'))?'animation':'live';
      }
    }
    save(false);
  }
  inferExisting();

  function classifyTmdbDetail(d, fallbackTitle=''){
    const countries=(d.production_countries||[]).map(x=>x.iso_3166_1);
    const lang=String(d.original_language||'');
    // Production takes priority over language: US production = Hollywood, including Japanese-language US films.
    const origin=countries.includes('US')?'ハリウッド':(countries.includes('JP')?'邦画':(lang==='en'?'ハリウッド':'その他外国語映画'));
    const names=(d.genres||[]).map(g=>g.name);
    const documentary=names.includes('Documentary');
    const animation=names.includes('Animation');
    const hybrid=isHybridTitle(String(d.title||d.name||fallbackTitle));
    const genres=[...new Set(names.map(n=>TMDB_GENRE_MAP[n]).filter(Boolean))];
    const runtime=Number(d.runtime||(Array.isArray(d.episode_run_time)?d.episode_run_time[0]:null))||null;
    return {origin,media:documentary?'documentary':'movie',format:hybrid?'hybrid':(animation?'animation':'live'),genres,runtime};
  }

  // TMDB quick-add: automatically select type/origin/format. Existing v19 handlers are triggered by clicking their chips.
  function clickStruct(wrap,rowIndex,value){
    if(!wrap)return;
    const row=wrap.querySelectorAll('.struct-row')[rowIndex]; if(!row)return;
    const b=[...row.querySelectorAll('.struct-chip')].find(x=>x.dataset.structValue===value);
    if(b&&!b.classList.contains('on')) b.click();
  }
  const selectTmdb21=selectTmdb;
  selectTmdb=async function(id){
    await selectTmdb21(id);
    try{
      const d=await tmdbFetch('/movie/'+id,{language:'en-US'});
      const c=classifyTmdbDetail(d,document.getElementById('qTitle')?.value||'');
      const wrap=document.getElementById('qGenrePicker');
      clickStruct(wrap,0,c.media);
      clickStruct(wrap,1,c.origin);
      clickStruct(wrap,2,c.format==='animation'?'animation':'live');
      if(wrap)wrap.dataset.autoHybrid=c.format==='hybrid'?'1':'';
    }catch(_){ }
  };

  // Preserve the hybrid exception after the v19 add handler has applied its normal single-format value.
  function wrapAddButton(id,titleId,yearId){
    const b=document.getElementById(id); if(!b||!b.onclick)return;
    const old=b.onclick;
    b.onclick=(e)=>{
      const title=document.getElementById(titleId)?.value||'';
      const year=document.getElementById(yearId)?.value||'';
      const hybrid=isHybridTitle(title)||(id==='qAdd'&&document.getElementById('qGenrePicker')?.dataset.autoHybrid==='1');
      old.call(b,e);
      if(hybrid){
        const candidates=allFilms().filter(f=>String(f.year||'')===String(year||f.year||'')&&normKey(displayTitle(f))===normKey(title));
        const f=candidates[candidates.length-1]||state.customFilms[state.customFilms.length-1];
        if(f){state.formatOverrides[f.id]='hybrid';save();render();}
      }
    };
  }
  wrapAddButton('qAdd','qTitle','qYear');
  wrapAddButton('addMovie','newTitle','newYear');

  // Letterboxd RSS may contain either a movieId or tvId. Use TMDB details to auto-classify newly imported items.
  parseLbRss=function(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Letterboxd RSSを解析できませんでした');
    return [...doc.querySelectorAll('item')].map(it=>{
      const movieId=childTextByLocal(it,'movieId'),tvId=childTextByLocal(it,'tvId');
      return {title:childTextByLocal(it,'filmTitle'),year:childTextByLocal(it,'filmYear'),rating:childTextByLocal(it,'memberRating'),tmdbId:movieId||tvId,tmdbType:tvId?'tv':'movie',watchedDate:childTextByLocal(it,'watchedDate'),link:childTextByLocal(it,'link')};
    }).filter(x=>x.title&&x.year);
  };

  const enrich21=enrichFromTmdb;
  enrichFromTmdb=async function(meta){
    let out=await enrich21(meta);
    if(!meta.tmdbId||!getTmdbCredential())return out;
    try{
      const type=meta.tmdbType==='tv'?'tv':'movie';
      const d=await tmdbFetch('/'+type+'/'+meta.tmdbId,{language:'en-US'});
      const c=classifyTmdbDetail(d,meta.title);
      if(type==='tv')c.media='other';
      out={...out,_autoClass:c,tmdbType:type};
    }catch(_){ }
    return out;
  };
  const addLb21=addLbFilm;
  addLbFilm=function(meta){
    const f=addLb21(meta); if(!f)return f;
    const c=meta._autoClass;
    if(c){
      if(c.media==='movie')delete state.mediaTypeOverrides[f.id];else state.mediaTypeOverrides[f.id]=c.media;
      state.originOverrides[f.id]=c.origin;
      state.formatOverrides[f.id]=c.format;
      state.genreOverrides[f.id]=c.genres;
      if(c.runtime)state.runtimeOverrides[f.id]=c.runtime;
    }
    if(isHybridTitle(f))state.formatOverrides[f.id]='hybrid';
    save();
    return f;
  };

  // Edit sheet: format is normally exclusive, but hybrid works as a genuine two-value selection.
  function bindHybridFormatEditor(f){
    const wrap=document.getElementById('editGenrePicker'); if(!wrap)return;
    const row=wrap.querySelectorAll('.struct-row')[2]; if(!row)return;
    let selected=new Set(formatValue(f)==='hybrid'?['live','animation']:[formatValue(f)]);
    function paint(){row.querySelectorAll('.struct-chip').forEach(b=>b.classList.toggle('on',selected.has(b.dataset.structValue)));}
    paint();
    row.querySelectorAll('.struct-chip').forEach(b=>b.onclick=()=>{
      const v=b.dataset.structValue;
      if(selected.has(v)){if(selected.size>1)selected.delete(v);}else selected.add(v);
      state.formatOverrides[f.id]=selected.size>1?'hybrid':[...selected][0];
      paint();save();render();updateSheetMeta(f);
    });
  }
  function updateSheetMeta(f){
    const el=document.getElementById('sheetMeta');if(!el)return;
    const rt=runtimeValue(f);
    el.textContent=`${f.year||''} · ${mediaLabel(f)} · ${originValue(f)} · ${formatLabel(f)}${rt?' · '+rt+'分':''}`;
  }
  const open21=openSheet;
  openSheet=function(id){open21(id);const f=filmById(id);if(f){bindHybridFormatEditor(f);updateSheetMeta(f);}};

  // v19's format filter is single-valued. Temporarily bypass it, then apply hybrid-aware matching.
  function applyFormatFilter(root,cardSel,sectionSel,suffix){
    const wanted=document.getElementById('formatFilter'+suffix)?.value||''; if(!wanted)return;
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||'')); if(f&&!formatMatches(f,wanted))card.remove();
    });
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none';});
    if(suffix==='Rank')document.querySelectorAll(`${root} .score-bin`).forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none';});
  }
  const renderRank21=renderRank;
  renderRank=function(){
    const s=document.getElementById('formatFilterRank'),v=s?.value||''; if(s&&v)s.value='';
    renderRank21(); if(s)s.value=v; applyFormatFilter('#rankRoot','.rank-card','.rank-star','Rank');
  };
  const renderClassify21=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('formatFilterClassify'),v=s?.value||''; if(s&&v)s.value='';
    renderClassify21(); if(s)s.value=v; applyFormatFilter('#classifyRoot','.card','.section','Classify');
  };
  const fr=document.getElementById('formatFilterRank');if(fr)fr.onchange=renderRank;
  const fc=document.getElementById('formatFilterClassify');if(fc)fc.onchange=renderClassify;

  const match21=match;
  match=function(f,q){if(match21(f,q))return true;if(!q)return true;return formatLabel(f).toLowerCase().includes(String(q).toLowerCase());};

  render();
})();
(() => {
  // v36: Letterboxd TV ids must use /tv/{id}, not /movie/{id}.
  // Also repair the current unscored Letterboxd batch from the verified RSS and prefer ja-JP titles.
  const BUILD36='20260925z';
  const BAD_CLEANUP_KEY='movie30_lb_bad_batch_cleanup_v35';
  try{localStorage.setItem(BAD_CLEANUP_KEY,'1')}catch(_){}

  const GENRE_ID_MAP={
    878:'SF',28:'アクション',9648:'ミステリー',53:'スリラー',27:'ホラー',80:'クライム',18:'ドラマ',
    35:'コメディ',10749:'恋愛',10402:'ミュージカル',10752:'戦争',36:'歴史',14:'ファンタジー',12:'アドベンチャー'
  };

  function localText(el,name){
    for(const c of el?.children||[])if(c.localName===name)return (c.textContent||'').trim();
    return '';
  }
  function normalizeUri(v){return String(v||'').trim().replace(/\/$/,'');}
  function parseLb36(xml){
    const doc=new DOMParser().parseFromString(String(xml||''),'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Letterboxd RSSを解析できませんでした');
    return [...doc.querySelectorAll('item')].map(it=>{
      const movieId=localText(it,'movieId'),tvId=localText(it,'tvId'),link=localText(it,'link');
      return {
        title:localText(it,'filmTitle'),year:localText(it,'filmYear'),rating:localText(it,'memberRating'),
        tmdbId:tvId||movieId,tmdbType:tvId?'tv':'movie',watchedDate:localText(it,'watchedDate'),
        link,uri:link
      };
    }).filter(x=>x.title&&x.year);
  }
  parseLbRss=parseLb36;

  function classify36(d,type){
    const countryCodes=type==='tv'
      ? (d.origin_country||[]).filter(Boolean)
      : (d.production_countries||[]).map(x=>x.iso_3166_1).filter(Boolean);
    const lang=String(d.original_language||'');
    const origin=countryCodes.includes('US')?'ハリウッド':(countryCodes.includes('JP')?'邦画':(lang==='ja'?'邦画':'その他'));
    const ids=(d.genres||[]).map(g=>Number(g.id));
    const genres=[...new Set(ids.map(id=>GENRE_ID_MAP[id]).filter(Boolean))];
    const animation=ids.includes(16);
    const documentary=ids.includes(99);
    const runtime=Number(type==='tv'?(Array.isArray(d.episode_run_time)?d.episode_run_time[0]:null):d.runtime)||null;
    return {origin,media:type==='tv'?'other':(documentary?'documentary':'movie'),format:animation?'animation':'live',genres,runtime};
  }

  // Replace v21's wrapper: it called the old movie-only enrichment first, which is exactly what caused
  // tvId 88570 (Your Turn to Kill) to become movieId 88570 (Cat Food).
  enrichFromTmdb=async function(meta){
    const type=meta?.tmdbType==='tv'?'tv':'movie';
    const id=meta?.tmdbId;
    const fallback={...meta,englishTitle:meta?.englishTitle||meta?.title||'',tmdbType:type};
    if(!id||!getTmdbCredential())return fallback;
    try{
      const d=await tmdbFetch(`/${type}/${id}`,{language:'ja-JP'});
      const title=String(type==='tv'?(d.name||meta.title||''):(d.title||meta.title||'')).trim();
      const original=String(type==='tv'?(d.original_name||''):(d.original_title||'')).trim();
      return {
        ...meta,
        title:title||meta.title,
        originalTitle:original,
        englishTitle:meta.title||meta.englishTitle||title,
        year:String(type==='tv'?(d.first_air_date||meta.year||''):(d.release_date||meta.year||'')).slice(0,4)||meta.year,
        tmdbId:Number(id),tmdbType:type,_autoClass:classify36(d,type)
      };
    }catch(_){
      return fallback;
    }
  };

  function readObj(key){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}}
  function writeObj(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch(_){}}
  function readArr(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(_){return []}}
  function persistMediaOrigin36(id,media,origin){
    if(media){const m=readObj('movie30_media_v33_v1');m[id]=media;writeObj('movie30_media_v33_v1',m);state.mediaTypeOverrides[id]=media;}
    if(origin){const o=readObj('movie30_origin_v33_v1');o[id]=origin;writeObj('movie30_origin_v33_v1',o);state.originOverrides[id]=origin;}
    const tv=new Set(readArr('movie30_media_drama_ids_v1'));
    if(media==='drama')tv.add(id);else tv.delete(id);
    try{localStorage.setItem('movie30_media_drama_ids_v1',JSON.stringify([...tv]))}catch(_){}
  }

  function applyBaseline36(f,item){
    const rating=Number(item.rating);
    f.title=item.title;
    f.originalTitle='';
    f.englishTitle=item.title;
    f.lbTitle=item.title;
    f.year=item.year?Number(item.year)||item.year:f.year;
    f.uri=item.link||f.uri;
    f.tmdbId=item.tmdbId?Number(item.tmdbId):null;
    f.tmdbType=item.tmdbType;
    if(Number.isFinite(rating)&&rating>=.5){f.star=rating;state.starOverrides[f.id]=rating;}
    state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),title:item.title,originalTitle:'',englishTitle:item.title,tmdbId:f.tmdbId};
    if(item.tmdbType==='tv')persistMediaOrigin36(f.id,'drama',null);
  }

  async function enrichExisting36(f,item){
    if(!item.tmdbId||!getTmdbCredential())return false;
    try{
      const type=item.tmdbType==='tv'?'tv':'movie';
      const d=await tmdbFetch(`/${type}/${item.tmdbId}`,{language:'ja-JP'});
      const c=classify36(d,type);
      const localTitle=String(type==='tv'?(d.name||item.title):(d.title||item.title)).trim()||item.title;
      const original=String(type==='tv'?(d.original_name||''):(d.original_title||'')).trim();
      const jpTitle=(c.origin==='邦画'&&localTitle)?localTitle:item.title;
      f.title=jpTitle;
      f.originalTitle=original;
      f.englishTitle=item.title;
      f.lbTitle=item.title;
      f.tmdbId=Number(item.tmdbId);
      f.tmdbType=type;
      const y=String(type==='tv'?(d.first_air_date||item.year||''):(d.release_date||item.year||'')).slice(0,4);
      if(y)f.year=Number(y)||y;
      state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),title:jpTitle,originalTitle:original,englishTitle:item.title,tmdbId:Number(item.tmdbId)};
      persistMediaOrigin36(f.id,type==='tv'?'drama':(c.media==='documentary'?'other':'movie'),c.origin);
      state.formatOverrides[f.id]=c.format;
      if(c.genres.length)state.genreOverrides[f.id]=c.genres;
      if(c.runtime)state.runtimeOverrides[f.id]=c.runtime;
      f._lbMetaFixedV36=true;
      return true;
    }catch(_){return false;}
  }

  async function mapLimit36(items,limit,fn){
    let i=0;
    async function worker(){while(i<items.length){const n=i++;await fn(items[n],n)}}
    await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  }

  async function repairCurrentBatch36(){
    try{
      const r=await fetch('./letterboxd-gjbkic.xml?v='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      const xml=await r.text();
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const channel=(doc.querySelector('channel > title')?.textContent||'').toLowerCase();
      if(!channel.includes('letterboxd - gjbkic'))return;
      const items=parseLb36(xml),byUri=new Map(items.map(x=>[normalizeUri(x.link),x]));
      const targets=(state.customFilms||[]).filter(f=>{
        if(f.source!=='letterboxd')return false;
        if(Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id))return false;
        return byUri.has(normalizeUri(f.uri));
      });
      if(!targets.length)return;

      let baseline=0;
      for(const f of targets){
        const item=byUri.get(normalizeUri(f.uri));
        if(!item)continue;
        applyBaseline36(f,item);baseline++;
      }
      if(baseline){save(false);render();}

      let enriched=0;
      await mapLimit36(targets,4,async f=>{
        const item=byUri.get(normalizeUri(f.uri));
        if(item&&await enrichExisting36(f,item))enriched++;
      });
      if(baseline||enriched){
        save();render();
        toast(`Letterboxdの作品情報を${baseline}本修正しました`);
      }
    }catch(_){}
  }

  // Run after the rest of the current synchronous patch stack has settled.
  setTimeout(repairCurrentBatch36,350);
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD36;
})();

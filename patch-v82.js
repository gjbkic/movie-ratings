(() => {
  'use strict';
  // v82: type-aware Letterboxd identity, TV season/episode localization, and safe backfill.
  // Never change exactScores, rankOrder, assignments, starOverrides or review text here.
  const BUILD='20261010l', TV_CACHE='movie30_tv_catalog_v82';
  const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const canonicalUri=v=>String(v||'').replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();
  const BM_PREFIX=/^Black\s+Mirror\s*[:：]\s*(.+)$/i;
  // Japanese episode titles already checked against Japanese distribution listings.
  const bmKnown=[
    ['The National Anthem','国歌',1,1],
    ['Fifteen Million Merits','1500万メリット',1,2],
    ['The Entire History of You','人生の軌跡のすべて',1,3],
    ['Be Right Back','ずっと側にいて',2,1],
    ['White Bear','シロクマ',2,2],
    ['The Waldo Moment','時の“クマ”ウォルドー',2,3],
    ['White Christmas','ホワイトクリスマス',2,4],
    ['Nosedive','ランク社会',3,1],
    ['Playtest','拡張現実ゲーム',3,2],
    ['Shut Up and Dance','秘密',3,3],
    ['San Junipero','サン・ジュニペロ',3,4],
    ['Men Against Fire','虫けら掃討作戦',3,5],
    ['Hated in the Nation','殺意の追跡',3,6]
  ];
  const bmMap=new Map(bmKnown.map(([en,ja,s,e])=>[norm(en),{en,ja,s,e}]));
  const bmOldIds={
    'custom-1791447953969-ah3e':'The National Anthem',
    'custom-1791449338315-twqr':'Fifteen Million Merits',
    'custom-1791469824035-6gcd':'The Entire History of You',
    'custom-1791469823654-dpbh':'Be Right Back'
  };
  const tvRequests=new Map(),searchRequests=new Map(),episodeMetaByUri=new Map();
  let parsedLast=[];
  let statusEl=null;
  function episodeParts(title){
    const m=String(title||'').trim().match(/^(.{2,75}?)\s*[:：]\s*(.{2,})$/);
    return m?{series:m[1].trim(),episode:m[2].trim()}:null;
  }
  function englishOf(f){
    if(bmOldIds[f.id])return 'Black Mirror: '+bmOldIds[f.id];
    const i=titleInfo(f);
    for(const v of [i.englishTitle,i.originalTitle,f.lbTitle,f.englishTitle,f.title,i.title]){
      if(BM_PREFIX.test(String(v||'')))return 'Black Mirror: '+String(v).match(BM_PREFIX)[1].trim();
    }
    for(const v of [i.title,f.title]){
      const m=String(v||'').match(/^ブラック[・･]ミラー[「『](.+)[」』]$/);
      if(m){const k=bmKnown.find(x=>x[1]===m[1]);if(k)return 'Black Mirror: '+k[0];}
    }
    return '';
  }
  function kind(raw){
    const t=String(raw?.title||'');
    if(BM_PREFIX.test(t))return 'tv_episode';
    if(raw?.tmdbType==='tv'||raw?.tvId)return episodeParts(t)?'tv_episode':'tv_series';
    return episodeParts(t)?'candidate_episode':'movie';
  }
  // Make RSS deduplication key title+year for episode candidates, not the untrusted
  // movieId: Letterboxd can attach the same TMDb movieId to different episodes.
  const parseBefore=parseLbRss;
  parseLbRss=function(xml){
    const items=parseBefore(xml);
    parsedLast=items.map(raw=>{
      const out={...raw};
      const k=kind(out);
      if(k!=='movie'){
        out.letterboxdMovieId=out.tmdbType==='movie'?out.tmdbId:null;
        out.tvId=out.tmdbType==='tv'?out.tmdbId:null;
        out.tmdbId=null;
        out.tmdbType=k;
      }
      return out;
    });
    return parsedLast;
  };
  function aliases(f){
    const x=titleInfo(f);
    const values=[x.title,x.originalTitle,x.englishTitle,f.title,f.lbTitle,f.originalTitle,f.englishTitle];
    if(englishOf(f))values.push(englishOf(f));
    return new Set(values.map(norm).filter(Boolean));
  }
  findExistingFilm=function(raw){
    if(!raw)return null;
    const available=allFilms();
    const uri=canonicalUri(raw.link||raw.uri);
    if(uri){
      const exact=available.filter(f=>canonicalUri(f.uri)===uri);
      if(exact.length===1)return exact[0];
    }
    const title=norm(raw.title||raw.englishTitle||raw.originalTitle);
    const year=Number(raw.year)||0;
    if(title){
      const same=available.filter(f=>aliases(f).has(title)&&(!year||!Number(f.year)||Math.abs(Number(f.year)-year)<=2));
      if(same.length===1)return same[0];
      if(same.length>1){
        const byUri=same.filter(f=>uri&&canonicalUri(f.uri)===uri);
        return byUri.length===1?byUri[0]:null;
      }
    }
    // A bare TMDb ID is never an episode identifier. For films, require a
    // compatible release year, a single match and no existing TV episode metadata.
    if(kind(raw)!=='movie'||!raw.tmdbId)return null;
    const matches=available.filter(f=>{
      const m=state.letterboxdMeta?.[f.id]||{};
      if(m.contentType==='tv_episode'||m.contentType==='tv_series')return false;
      const id=titleInfo(f).tmdbId||f.tmdbId;
      return id&&String(id)===String(raw.tmdbId)&&(!year||!Number(f.year)||Math.abs(year-Number(f.year))<=1);
    });
    return !title&&matches.length===1?matches[0]:null;
  };

  const readCache=()=>{try{return JSON.parse(localStorage.getItem(TV_CACHE)||'{}')||{}}catch(_){return {}}};
  let tvCache=readCache();
  const saveCache=()=>{try{localStorage.setItem(TV_CACHE,JSON.stringify(tvCache))}catch(_){}};
  const cached=(key)=>{const x=tvCache[key];return x&&Date.now()-x.at<21*86400000?x.data:null;};
  const cache=(key,data)=>{tvCache[key]={at:Date.now(),data};saveCache();return data;};
  const credential=()=>{try{return !!getTmdbCredential()}catch(_){return false}};
  async function tvInfo(id){
    const key='show:'+id,old=cached(key);if(old)return old;
    if(!credential())return null;
    if(!tvRequests.has(key))tvRequests.set(key,(async()=>{
      const [en,ja]=await Promise.all([
        tmdbFetch('/tv/'+id,{language:'en-US'}),
        tmdbFetch('/tv/'+id,{language:'ja-JP'}).catch(()=>null)
      ]);
      return cache(key,{enName:en.name||'',jaName:ja?.name||'',seasons:(en.seasons||[]).filter(s=>s.season_number>=0).map(s=>({n:s.season_number,year:Number((s.air_date||'').slice(0,4))||0}))});
    })().catch(()=>null).finally(()=>tvRequests.delete(key)));
    return tvRequests.get(key);
  }
  async function seasonInfo(id,n){
    const key='season:'+id+':'+n,old=cached(key);if(old)return old;
    if(!credential())return null;
    if(!tvRequests.has(key))tvRequests.set(key,(async()=>{
      const [en,ja]=await Promise.all([
        tmdbFetch('/tv/'+id+'/season/'+n,{language:'en-US'}),
        tmdbFetch('/tv/'+id+'/season/'+n,{language:'ja-JP'}).catch(()=>null)
      ]);
      const localized=new Map((ja?.episodes||[]).map(e=>[e.episode_number,String(e.name||'').trim()]));
      return cache(key,(en.episodes||[]).map(e=>({
        s:Number(e.season_number??n),e:Number(e.episode_number),id:e.id,
        en:String(e.name||'').trim(),ja:localized.get(e.episode_number)||'',
        year:Number((e.air_date||'').slice(0,4))||0,runtime:e.runtime||null
      })));
    })().catch(()=>null).finally(()=>tvRequests.delete(key)));
    return tvRequests.get(key);
  }
  async function seriesIdFor(name){
    if(norm(name)===norm('Black Mirror'))return 42009;
    if(!credential())return null;
    const key=norm(name);
    if(!searchRequests.has(key))searchRequests.set(key,(async()=>{
      const result=await tmdbFetch('/search/tv',{query:name,language:'en-US'});
      const exact=(result.results||[]).filter(x=>norm(x.name)===key||norm(x.original_name)===key);
      return exact.length===1?exact[0].id:null;
    })().catch(()=>null).finally(()=>searchRequests.delete(key)));
    return searchRequests.get(key);
  }
  async function findEpisode(sid,episode,year){
    const series=await tvInfo(sid);if(!series)return null;
    const y=Number(year)||0;
    const all=series.seasons.filter(x=>x.n>=0);
    const near=y?all.filter(x=>x.year&&Math.abs(x.year-y)<=2):all;
    const first=near.length?near:all;
    async function inspect(seasons){
      // No fuzzy matching: do not ever bind a review to an adjacent episode.
      const batches=await Promise.all(seasons.slice(0,18).map(async x=>seasonInfo(sid,x.n)));
      const found=batches.flatMap(a=>a||[]).filter(e=>norm(e.en)===norm(episode)&&(!y||!e.year||Math.abs(y-e.year)<=2));
      return found.length===1?found[0]:null;
    }
    return (await inspect(first))||(near.length&&near.length!==all.length?await inspect(all.filter(x=>!near.includes(x))):null);
  }
  function japaneseEpisode(en,ja){return ja&&norm(ja)!==norm(en)?ja:'';}
  const enrichBefore=enrichFromTmdb;
  enrichFromTmdb=async function(meta){
    const k=kind(meta);
    if(k==='tv_series'){
      const sid=Number(meta.tvId)||0;
      if(!sid)return {...meta,tmdbId:null};
      const details=await tvInfo(sid);
      const localized=details?.jaName&&norm(details.jaName)!==norm(details.enName)?details.jaName:meta.title;
      return {...meta,title:localized,englishTitle:details?.enName||meta.title,
        tmdbId:null,tmdbType:'tv_series',tmdbSeriesId:sid};
    }
    if(k==='tv_episode'||k==='candidate_episode'){
      const parts=episodeParts(meta.title);
      const bm=parts&&norm(parts.series)===norm('Black Mirror');
      const known=bm&&bmMap.get(norm(parts.episode));
      let sid=Number(meta.tvId)||0;
      if(!sid&&parts)sid=await seriesIdFor(parts.series)||0;
      const hit=sid&&parts&&credential()?await findEpisode(sid,parts.episode,meta.year):null;
      if(hit||bm){
        const details=sid?await tvInfo(sid):null;
        const enSeries=details?.enName||parts?.series||'';
        const jpSeries=bm?'ブラック・ミラー':(details?.jaName&&norm(details.jaName)!==norm(enSeries)?details.jaName:enSeries);
        const jaTitle=japaneseEpisode(hit?.en,hit?.ja)||(known?.ja||'');
        const title=jaTitle?jpSeries+'「'+jaTitle+'」':meta.title;
        const enriched={...meta,title,englishTitle:meta.title,originalTitle:meta.title,
          tmdbId:null,tmdbType:'tv_episode',tmdbSeriesId:sid||42009,
          seasonNumber:hit?.s??known?.s??null,episodeNumber:hit?.e??known?.e??null,
          episodeTmdbId:hit?.id||null};
        if(meta.link||meta.uri)episodeMetaByUri.set(canonicalUri(meta.link||meta.uri),enriched);
        return enriched;
      }
    }
    // The title was not verified as a TV episode. Preserve the film path,
    // including the original Letterboxd movieId for colon-titled movies.
    return enrichBefore({...meta,tmdbId:meta.tmdbId||meta.letterboxdMovieId||null,
      tmdbType:meta.tmdbType==='tv_series'?'tv':'movie'});
  };
  function setMedia(f,k){
    if(k!=='tv_episode'&&k!=='tv_series')return;
    state.mediaTypeOverrides[f.id]='drama';
    // Keep the older v33 media-filter store in sync for subsequent reloads.
    try{
      const key='movie30_media_v33_v1',data=JSON.parse(localStorage.getItem(key)||'{}')||{};
      if(data[f.id]!=='drama'){data[f.id]='drama';localStorage.setItem(key,JSON.stringify(data));}
      const tvKey='movie30_media_drama_ids_v1',list=JSON.parse(localStorage.getItem(tvKey)||'[]')||[];
      if(!list.includes(f.id)){list.push(f.id);localStorage.setItem(tvKey,JSON.stringify(list));}
    }catch(_){}
  }
  function storeTv(f,meta){
    if(!f||!meta||!['tv_episode','tv_series'].includes(meta.tmdbType))return false;
    const original=state.letterboxdMeta?.[f.id]||{};
    state.letterboxdMeta=state.letterboxdMeta||{};
    const newMeta={...original,contentType:meta.tmdbType,
      tmdbSeriesId:meta.tmdbSeriesId||null,
      seasonNumber:meta.seasonNumber??null,
      episodeNumber:meta.episodeNumber??null,
      episodeTmdbId:meta.episodeTmdbId||null,
      letterboxdMovieId:meta.letterboxdMovieId||original.letterboxdMovieId||null};
    state.letterboxdMeta[f.id]=newMeta;
    setMedia(f,meta.tmdbType);
    if(meta.tmdbType==='tv_episode'){
      // Do not interpret a Letterboxd standalone movie ID as a series/episode ID.
      if(f.source==='letterboxd'&&f.tmdbId){newMeta.legacyMovieId=f.tmdbId;f.tmdbId=null;}
      const override=state.titleOverrides[f.id]||{};
      if(override.tmdbId){newMeta.legacyMovieId=override.tmdbId;delete override.tmdbId;}
      const wanted=String(meta.title||'');
      const current=displayTitle(f),en=String(meta.englishTitle||'');
      if(wanted&&wanted!==current&&
        (norm(current)===norm(en)||norm(current)===norm(f.title)||englishOf(f)||original.titleSource==='tmdb-tv')){
        state.titleOverrides[f.id]={...override,title:wanted,englishTitle:en||override.englishTitle||f.englishTitle||''};
        newMeta.titleSource='tmdb-tv';
      }
    }else if(meta.title&&displayTitle(f)===f.title&&meta.title!==f.title){
      state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),title:meta.title,englishTitle:meta.englishTitle||''};
      newMeta.titleSource='tmdb-tv';
    }
    return true;
  }
  const oldAddLb=addLbFilm;
  addLbFilm=function(meta){
    const f=oldAddLb(meta);
    if(f&&['tv_episode','tv_series'].includes(meta?.tmdbType)){storeTv(f,meta);save(false);}
    return f;
  };
  function backfillBlackMirror(){
    let n=0;
    for(const f of allFilms()){
      const en=englishOf(f),match=en.match(BM_PREFIX);
      if(!match)continue;
      const known=bmMap.get(norm(match[1]));
      const old=state.letterboxdMeta?.[f.id]||{};
      const m={...old,contentType:'tv_episode',tmdbSeriesId:42009,
        seasonNumber:known?.s??old.seasonNumber??null,episodeNumber:known?.e??old.episodeNumber??null};
      state.letterboxdMeta=state.letterboxdMeta||{};
      if(JSON.stringify(old)!==JSON.stringify(m))n++;
      state.letterboxdMeta[f.id]=m;
      if(state.mediaTypeOverrides[f.id]!=='drama')n++;
      setMedia(f,'tv_episode');
      const wanted=known?'ブラック・ミラー「'+known.ja+'」':'';
      if(wanted&&displayTitle(f)!==wanted){
        state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),title:wanted,englishTitle:en};
        n++;
      }
      if(state.titleOverrides[f.id]?.tmdbId){
        m.legacyMovieId=state.titleOverrides[f.id].tmdbId;
        delete state.titleOverrides[f.id].tmdbId;
        n++;
      }
      if(f.source==='letterboxd'&&f.tmdbId){
        m.legacyMovieId=m.legacyMovieId||f.tmdbId;
        m.letterboxdMovieId=m.letterboxdMovieId||f.tmdbId;f.tmdbId=null;n++;
      }
    }
    if(n)save(false);
    return n;
  }
  const oldRender=render,oldRank=renderRank,oldOpen=openSheet;
  render=function(...a){backfillBlackMirror();return oldRender.apply(this,a);};
  renderRank=function(...a){backfillBlackMirror();return oldRank.apply(this,a);};
  openSheet=function(...a){
    const out=oldOpen.apply(this,a);
    const id=a[0],m=state.letterboxdMeta?.[id];
    const metaEl=document.getElementById('sheetMeta');
    if(metaEl&&m?.contentType==='tv_episode'){
      const label='ドラマ・各話'+(m.seasonNumber!=null&&m.episodeNumber!=null?' · S'+m.seasonNumber+'E'+m.episodeNumber:'');
      if(!metaEl.textContent.includes(label))metaEl.textContent+=' · '+label;
    }
    return out;
  };

  const oldSync=syncLetterboxd;
  syncLetterboxd=async function(...a){
    parsedLast=[];
    const result=await oldSync.apply(this,a);
    if(result===false)return result;
    let changed=0;
    for(const raw of parsedLast){
      const meta=episodeMetaByUri.get(canonicalUri(raw.link||raw.uri));
      if(!meta)continue;
      const f=findExistingFilm(raw);
      if(f&&storeTv(f,meta))changed++;
    }
    if(changed){save(false);render();}
    backfillBlackMirror();
    return result;
  };
  const syncBtn=document.getElementById('syncLetterboxd');
  if(syncBtn)syncBtn.onclick=()=>syncLetterboxd(false);

  async function refreshTvTitles(force=false){
    if(!credential()){
      if(statusEl)statusEl.textContent='TMDbキー未設定：確認済みの邦題は表示済み。その他の作品はキー設定後に取得できます。';
      return;
    }
    if(force){tvCache={};saveCache();}
    let updated=0,checked=0,fail=0;
    const targets=allFilms().filter(f=>englishOf(f)||state.letterboxdMeta?.[f.id]?.contentType==='tv_episode');
    for(const f of targets){
      const en=englishOf(f)||titleInfo(f).englishTitle||f.lbTitle||'';
      if(!episodeParts(en))continue;
      const prior=state.letterboxdMeta?.[f.id]||{};
      try{
        const enriched=await enrichFromTmdb({title:en,englishTitle:en,year:f.year,
          link:f.uri,tmdbType:'tv_episode',tvId:prior.tmdbSeriesId||undefined,
          letterboxdMovieId:prior.letterboxdMovieId||null});
        if(enriched.tmdbType==='tv_episode'){
          const before=displayTitle(f);
          storeTv(f,enriched);
          if(before!==displayTitle(f))updated++;
          checked++;
        }
      }catch(_){fail++;}
    }
    if(checked){save(false);render();}
    if(statusEl)statusEl.textContent='ドラマ各話照合：'+checked+'話、邦題更新 '+updated+'話'+(fail?'、取得失敗 '+fail+'話':'')+'。点数・順位・レビューは維持。';
  }
  const page=document.getElementById('page-data');
  if(page&&!document.getElementById('tvEpisodePanel82')){
    const panel=document.createElement('div');
    panel.className='panel';panel.id='tvEpisodePanel82';
    panel.innerHTML='<h2>ドラマ・各話の照合</h2><p class="tip">LetterboxdのURLとシーズン・話数で作品を区別。TMDbの日本語タイトルを利用し、翻訳がない場合は原題を維持します。</p>'
      +'<div class="tools"><button type="button" class="btn" id="refreshTvTitles82">ドラマの日本語タイトルを再取得</button></div>'
      +'<div class="sync-status" id="tvStatus82"></div>';
    page.insertBefore(panel,page.firstChild);
    statusEl=document.getElementById('tvStatus82');
    document.getElementById('refreshTvTitles82').onclick=async()=>{
      const b=document.getElementById('refreshTvTitles82');
      b.disabled=true;statusEl.textContent='ドラマ各話を照合中…';
      try{await refreshTvTitles(true)}finally{b.disabled=false;}
    };
  }
  backfillBlackMirror();
  render();
  // Check cached/current TMDb credentials for the user's existing episodes too.
  if(credential())setTimeout(()=>refreshTvTitles(false),250);
  window.__movie30TvEpisodeV82={version:BUILD,knownBlackMirrorEpisodes:bmKnown.length};
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();

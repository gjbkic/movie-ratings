(() => {
  // v63: persist Letterboxd registration metadata separately from actual viewing history.
  const BUILD='20260927t';
  const TOKEN_KEY='movie30_github_sync_token_v1';
  const LIVE_PATH='live-state.json';
  const REPO='gjbkic/movie-ratings';
  const META_FP_KEY='movie30_lb_meta_fp_v63';
  const HIST_GZ_B64='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';

  state.letterboxdMeta=state.letterboxdMeta||{};
  const norm=(v)=>typeof normKey==='function'?normKey(v):String(v||'').toLowerCase().normalize('NFKC').replace(/[\s・:：\/\\\-_.!?！？'"“”‘’（）()\[\]]+/g,'');
  const key=(v,y)=>norm(v)+'|'+String(y||'');
  function metaFor(f){return state.letterboxdMeta?.[f?.id]||{}}
  window.letterboxdMetaFor=metaFor;
  function aliases(f){const x=titleInfo(f)||{};return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f?.lbTitle].filter(Boolean)}
  function patchMeta(f,patch){
    if(!f||!patch)return false;
    state.letterboxdMeta=state.letterboxdMeta||{};
    const prev=state.letterboxdMeta[f.id]||{},next={...prev,...patch};
    for(const k of Object.keys(next))if(next[k]==null||next[k]==='')delete next[k];
    if(JSON.stringify(prev)===JSON.stringify(next))return false;
    state.letterboxdMeta[f.id]=next;return true;
  }
  function tokyoDateFromPub(v){
    if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch(_){return d.toISOString().slice(0,10)}
  }
  async function historicRows(){
    if(typeof DecompressionStream!=='function')return [];
    const bin=atob(HIST_GZ_B64),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const text=await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }

  const openPrev=openSheet;
  openSheet=function(id){
    openPrev(id);const f=filmById(id),m=metaFor(f),el=document.getElementById('sheetMeta');
    if(el&&m.addedDate&&!el.textContent.includes('LB追加'))el.textContent+=` · LB追加 ${m.addedDate}`;
  };

  parseLbRss=function(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Letterboxd RSSを解析できませんでした');
    return [...doc.querySelectorAll('item')].map(it=>({
      title:childTextByLocal(it,'filmTitle'),year:childTextByLocal(it,'filmYear'),
      rating:childTextByLocal(it,'memberRating'),tmdbId:childTextByLocal(it,'movieId'),
      watchedDate:childTextByLocal(it,'watchedDate'),publishedAt:childTextByLocal(it,'pubDate'),
      link:childTextByLocal(it,'link')
    })).filter(x=>x.title&&x.year);
  };
  const findPrev=findExistingFilm;
  findExistingFilm=function(meta){
    const f=findPrev(meta);
    if(f){const p={};if(meta?.publishedAt)p.publishedAt=meta.publishedAt;if(meta?.watchedDate)p.reportedWatchedDate=meta.watchedDate;patchMeta(f,p)}
    return f;
  };
  const addLbPrev=addLbFilm;
  addLbFilm=function(meta){
    const f=addLbPrev(meta);
    if(f){
      const p={};
      if(meta?.publishedAt){p.publishedAt=meta.publishedAt;p.addedDate=tokyoDateFromPub(meta.publishedAt);p.addedDateSource='rss-first-seen'}
      if(meta?.watchedDate)p.reportedWatchedDate=meta.watchedDate;patchMeta(f,p);
    }
    return f;
  };

  importLetterboxdCsv=async function(text){
    const rows=parseCsvText(text);if(rows.length<2)throw new Error('CSVが空です');
    const heads=rows[0].map(x=>x.trim().toLowerCase()),idx=(...names)=>{for(const n of names){const i=heads.indexOf(n.toLowerCase());if(i>=0)return i}return -1};
    const ni=idx('name','title'),yi=idx('year'),ri=idx('rating'),ui=idx('letterboxd uri','letterboxduri','url'),di=idx('date');
    if(ni<0||ri<0)throw new Error('ratings.csvではないようです（Name/Rating列が必要）');
    let added=0,found=0,metaChanged=0;
    for(const r of rows.slice(1)){
      const title=(r[ni]||'').trim(),year=yi>=0?(r[yi]||'').trim():'',rating=Number(r[ri]),uri=ui>=0?(r[ui]||'').trim():'',date=di>=0?(r[di]||'').trim():'';
      if(!title||!Number.isFinite(rating)||rating<.5)continue;
      const meta={title,englishTitle:title,year,rating,uri};let f=findExistingFilm(meta);
      if(f){found++;if(filmStar(f)!==rating)state.starOverrides[f.id]=rating}else{f=addLbFilm(meta);added++}
      if(f&&date&&patchMeta(f,{addedDate:date,addedDateSource:'letterboxd-csv'}))metaChanged++;
    }
    save();render();return {added,found,metaChanged};
  };

  function liveRow(f,score,overallRank,sameScoreRank){
    const x=titleInfo(f),m=metaFor(f);
    return {
      id:f.id,title:displayTitle(f),originalTitle:x.originalTitle||'',englishTitle:x.englishTitle||'',year:f.year||'',
      score:score==null?null:Number(score),star:Number(filmStar(f)),overallRank:overallRank||null,sameScoreRank:sameScoreRank||null,
      category:filmCategory(f)||'',mediaType:state.mediaTypeOverrides?.[f.id]||f.mediaType||'movie',
      genre:state.genreOverrides?.[f.id]||'',origin:state.originOverrides?.[f.id]||'',format:state.formatOverrides?.[f.id]||'',
      runtime:state.runtimeOverrides?.[f.id]||null,exact:Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id),
      letterboxdAddedDate:m.addedDate||null,letterboxdPublishedAt:m.publishedAt||null,
      letterboxdReportedWatchedDate:m.reportedWatchedDate||null
    };
  }
  function livePayload(){
    const scored=new Map(),unrated=[];
    for(const f of allFilms()){const sc=effectiveScore(f);if(sc==null||!Number.isFinite(Number(sc)))unrated.push(f);else{const k=String(Number(sc));if(!scored.has(k))scored.set(k,[]);scored.get(k).push(f)}}
    const ranked=[];let overall=0;
    for(const score of [...scored.keys()].map(Number).sort((a,b)=>b-a)){const arr=rankSorted(scored.get(String(score))||[],score);arr.forEach((f,i)=>ranked.push(liveRow(f,score,++overall,i+1)))}
    return {app:'movie30-live',schema:2,sourceUpdatedAt:Number(state.updatedAt||0),sourceUpdatedIso:state.updatedAt?new Date(Number(state.updatedAt)).toISOString():null,
      ranked,unrated:unrated.map(f=>liveRow(f,null,null,null)),
      state:{exactScores:state.exactScores||{},rankOrder:state.rankOrder||{},customFilms:state.customFilms||[],starOverrides:state.starOverrides||{},
        titleOverrides:state.titleOverrides||{},categoryOverrides:state.categoryOverrides||{},mediaTypeOverrides:state.mediaTypeOverrides||{},
        genreOverrides:state.genreOverrides||{},originOverrides:state.originOverrides||{},formatOverrides:state.formatOverrides||{},
        runtimeOverrides:state.runtimeOverrides||{},letterboxdMeta:state.letterboxdMeta||{}}
    };
  }
  function headers(token){return {Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}}
  function b64(text){const bytes=new TextEncoder().encode(text);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
  function status(msg,kind=''){const el=document.getElementById('gptSyncStatus');if(!el)return;el.className='gpt-sync-status'+(kind?' '+kind:'');el.textContent=msg}
  let cloudBusy=false;
  async function syncMetaCloud(manual=false){
    if(cloudBusy)return;let token='';try{token=localStorage.getItem(TOKEN_KEY)||''}catch(_){}token=token.trim();
    if(!token){if(manual)status('トークンが未設定です。','bad');return}cloudBusy=true;if(manual)status('GitHubへ同期中…');
    try{
      const url=`https://api.github.com/repos/${REPO}/contents/${LIVE_PATH}`;let sha=null,r=await fetch(url,{headers:headers(token),cache:'no-store'});
      if(r.ok)sha=(await r.json()).sha||null;else if(r.status!==404)throw new Error(`GitHub確認に失敗 (${r.status})`);
      const body={message:`Sync live movie ratings + Letterboxd metadata (${Date.now()})`,content:b64(JSON.stringify(livePayload(),null,2))};if(sha)body.sha=sha;
      r=await fetch(url,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(r.status===409){const rr=await fetch(url,{headers:headers(token),cache:'no-store'});sha=rr.ok?(await rr.json()).sha:null;if(sha)body.sha=sha;else delete body.sha;r=await fetch(url,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify(body)})}
      if(!r.ok)throw new Error(`GitHub書き込みに失敗 (${r.status})`);
      try{localStorage.setItem('movie30_github_sync_last_v1',JSON.stringify({sourceUpdatedAt:Number(state.updatedAt||0),at:Date.now()}))}catch(_){}
      status('同期しました。Letterboxd追加日も保存されています。','ok');
    }catch(e){status('同期できませんでした：'+(e?.message||e),'bad')}finally{cloudBusy=false}
  }
  const syncBtn=document.getElementById('gptSyncNow');if(syncBtn)syncBtn.onclick=()=>syncMetaCloud(true);

  function metaFp(){const str=JSON.stringify(state.letterboxdMeta||{});let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)+':'+str.length}
  let metaTimer=0;
  function scheduleMetaSync(){
    const cur=metaFp();let prev='';try{prev=localStorage.getItem(META_FP_KEY)||''}catch(_){}if(cur===prev)return;
    clearTimeout(metaTimer);metaTimer=setTimeout(()=>{try{localStorage.setItem(META_FP_KEY,cur)}catch(_){}
      let auto=true;try{auto=localStorage.getItem('movie30_github_stable_auto_v1')!=='0'}catch(_){}if(auto)syncMetaCloud(false)},3000);
  }
  const savePrev=save;save=function(...args){const out=savePrev(...args);scheduleMetaSync();return out};

  (async()=>{
    let seeded=0;
    try{
      const rows=await historicRows(),byKey=new Map(rows.map(([d,n,y])=>[key(n,y),d]));
      for(const f of allFilms()){if(metaFor(f).addedDate)continue;let d='';for(const a of aliases(f)){d=byKey.get(key(a,f.year));if(d)break}if(d&&patchMeta(f,{addedDate:d,addedDateSource:'letterboxd-export-2026-09-27'}))seeded++}
    }catch(e){console.warn('Letterboxd historical metadata seed failed',e)}
    if(seeded){try{save(false)}catch(_){try{save()}catch(__){}}scheduleMetaSync();render()}
  })();

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

(() => {
  // v69: restore verified/manual Letterboxd refresh after v68 accidentally bypassed it.
  // Keep v68 behavior that imports recent RSS items without stars as pending/unrated.
  const BUILD='20261003a';
  const GH_OWNER='gjbkic', GH_REPO='movie-ratings', GH_BRANCH='main';
  const GH_TOKEN_KEY='movie30_gpt_sync_token_v1';
  const TRIGGER_PATH='letterboxd-sync-trigger.txt';
  const RESULT_PATH='letterboxd-sync-result.json';
  const RSS_PATH='letterboxd-gjbkic.xml';
  const DAY=86400000;
  const cachedSyncV68=syncLetterboxd;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function ghToken(){try{return localStorage.getItem(GH_TOKEN_KEY)||''}catch(_){return ''}}
  function decodeB64Utf8(b64){
    const bin=atob(String(b64||'').replace(/\s/g,'')),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeB64Utf8(text){
    const bytes=new TextEncoder().encode(String(text||''));let bin='';
    for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(bin);
  }
  async function gh(path,opt={}){
    const token=ghToken();if(!token)throw new Error('GitHub同期トークンがありません');
    const r=await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?t=${Date.now()}`,{
      ...opt,cache:'no-store',headers:{
        Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(opt.headers||{})
      }
    });
    if(!r.ok){let msg=`GitHub HTTP ${r.status}`;try{const j=await r.json();if(j?.message)msg+=': '+j.message}catch(_){}throw new Error(msg)}
    return await r.json();
  }
  async function ghText(path){const j=await gh(path);return {text:decodeB64Utf8(j.content||''),sha:j.sha||''}}
  async function putTrigger(value){
    let cur=await ghText(TRIGGER_PATH);
    const url=`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${TRIGGER_PATH}`;
    let body={message:'Trigger Letterboxd RSS refresh',content:encodeB64Utf8(value+'\n'),branch:GH_BRANCH,sha:cur.sha};
    const send=async()=>{
      const r=await fetch(url,{method:'PUT',cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${ghToken()}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok){let msg=`GitHub HTTP ${r.status}`;try{const j=await r.json();if(j?.message)msg+=': '+j.message}catch(_){}throw new Error(msg)}
    };
    try{await send()}catch(_){cur=await ghText(TRIGGER_PATH);body.sha=cur.sha;await send()}
  }
  async function serverFetchRss(){
    const trigger=`movie30-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await putTrigger(trigger);
    const started=Date.now();let result=null;
    while(Date.now()-started<70000){
      await sleep(2200);
      try{const r=JSON.parse((await ghText(RESULT_PATH)).text);if(r?.trigger===trigger){result=r;break}}catch(_){}
    }
    if(!result)throw new Error('サーバー側のLetterboxd確認が70秒以内に完了しませんでした');
    if(result.status!=='ok')throw new Error(result.error||'サーバー側でLetterboxd RSSを取得できませんでした');
    const xml=(await ghText(RSS_PATH)).text;
    if(!/<(?:rss|item)[\s>]/i.test(xml))throw new Error('取得したRSSが不正です');
    return {xml,result};
  }
  async function browserFetchFresh(username){
    const url=`https://letterboxd.com/${encodeURIComponent(username)}/rss/?movie30=${Date.now()}`;
    const targets=[url,'https://api.allorigins.win/raw?url='+encodeURIComponent(url),'https://corsproxy.io/?url='+encodeURIComponent(url),'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(url)];
    let errs=[];
    for(const target of targets){
      try{const r=await fetch(target,{cache:'no-store',headers:{Accept:'application/rss+xml,application/xml,text/xml,text/plain,*/*'}});if(!r.ok)throw new Error('HTTP '+r.status);const t=await r.text();if(!/<(?:rss|item)[\s>]/i.test(t))throw new Error('RSS形式ではありません');return t}catch(e){errs.push(e?.message||String(e))}
    }
    if(String(username).toLowerCase()==='gjbkic'){
      const r=await fetch('./letterboxd-gjbkic.xml?v='+Date.now(),{cache:'no-store'});if(r.ok){const t=await r.text();if(/<(?:rss|item)[\s>]/i.test(t))return t}
    }
    throw new Error('Letterboxd RSSを取得できませんでした'+(errs.length?' ('+errs.join(' / ')+')':''));
  }
  function isRecentUnrated(raw){
    const s=String(raw?.watchedDate||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&Math.abs(Date.now()-t)<=14*DAY;
  }
  function tokyoDate(v){
    if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch(_){return d.toISOString().slice(0,10)}
  }
  function addPending(meta){
    const now=Date.now(),id='custom-'+now+'-'+Math.random().toString(36).slice(2,6),title=String(meta?.title||meta?.englishTitle||meta?.originalTitle||'').trim();if(!title)return null;
    const f={id,title,originalTitle:String(meta?.originalTitle||'').trim(),englishTitle:String(meta?.englishTitle||meta?.title||'').trim(),lbTitle:String(meta?.englishTitle||meta?.title||'').trim(),tmdbId:meta?.tmdbId||null,year:meta?.year?parseInt(meta.year,10)||meta.year:'',uri:meta?.link||meta?.uri||'',category:'Letterboxd',order:999999,star:0,oldScore:null,added:true,_seq:now,source:'letterboxd'};
    state.customFilms=state.customFilms||[];state.customFilms.push(f);
    state.genreOverrides=state.genreOverrides||{};state.genreOverrides[id]=state.genreOverrides[id]||[];
    state.mediaTypeOverrides=state.mediaTypeOverrides||{};state.mediaTypeOverrides[id]='movie';
    state.formatOverrides=state.formatOverrides||{};state.formatOverrides[id]='live';
    state.letterboxdMeta=state.letterboxdMeta||{};state.letterboxdMeta[id]={...(state.letterboxdMeta[id]||{}),...(meta?.publishedAt?{publishedAt:meta.publishedAt,addedDate:tokyoDate(meta.publishedAt),addedDateSource:'rss-first-seen'}:{}),...(meta?.watchedDate?{reportedWatchedDate:meta.watchedDate}:{})};
    return f;
  }
  async function applyFreshRss(xml){
    const items=parseLbRss(xml);let ratedAdded=0,pendingAdded=0,updated=0,skipped=0;const seen=new Set();
    for(const raw of items){
      const sig=(raw.tmdbId||normKey(raw.title)+raw.year);if(seen.has(sig))continue;seen.add(sig);
      const rating=parseFloat(raw.rating),hasRating=Number.isFinite(rating)&&rating>=0.5;
      let existing=findExistingFilm(raw);
      if(existing){
        if(hasRating&&filmStar(existing)!==rating){state.starOverrides[existing.id]=rating;updated++}
        if(raw.tmdbId&&!titleInfo(existing).tmdbId)state.titleOverrides[existing.id]={...(state.titleOverrides[existing.id]||{}),tmdbId:Number(raw.tmdbId)};
        continue;
      }
      const meta=await enrichFromTmdb({...raw,tmdbId:raw.tmdbId?Number(raw.tmdbId):null,englishTitle:raw.title});
      if(hasRating){meta.rating=rating;if(addLbFilm(meta))ratedAdded++;continue}
      if(isRecentUnrated(raw)){if(addPending(meta))pendingAdded++}else skipped++;
    }
    save();render();
    return {items,ratedAdded,pendingAdded,totalAdded:ratedAdded+pendingAdded,updated,skipped};
  }

  syncLetterboxd=async function(silent=false){
    if(silent)return cachedSyncV68(true);
    const st=getLbSettings(),username=(document.getElementById('lbUsername')?.value||st.username||'gjbkic').trim();if(!username)return false;
    saveLbSettings({username,auto:document.getElementById('lbAutoSync')?.checked??st.auto});
    const btn=document.getElementById('syncLetterboxd'),old=btn?.textContent||'今すぐ同期';if(btn){btn.disabled=true;btn.textContent='実取得中…'}
    try{
      let xml='',verified=null,source='';
      if(username.toLowerCase()==='gjbkic'&&ghToken()){
        setLbStatus('GitHubサーバーからLetterboxdを実取得しています…（通常10〜30秒）');
        try{const z=await serverFetchRss();xml=z.xml;verified=z.result;source='GitHub実取得'}catch(serverErr){
          setLbStatus('サーバー確認に失敗したためLetterboxdへ直接確認中…');xml=await browserFetchFresh(username);source='直接確認';window.__movie30LbServerErrorV69=serverErr?.message||String(serverErr);
        }
      }else{
        setLbStatus('Letterboxd RSSを直接確認中…');xml=await browserFetchFresh(username);source='直接確認';
      }
      const z=await applyFreshRss(xml),latest=z.items[0]||{},count=verified?.itemCount??z.items.length,latestTitle=verified?.latestTitle||latest.title||'',latestDate=verified?.latestWatchedDate||latest.watchedDate||'';
      let msg=`同期完了：新規 ${z.totalAdded}本`;
      if(z.totalAdded)msg+=`（採点済み ${z.ratedAdded}／未採点 ${z.pendingAdded}）`;
      if(z.updated)msg+=`／★更新 ${z.updated}本`;
      if(z.skipped)msg+=`／古い未評価 ${z.skipped}件は保留`;
      msg+=` · ${source}でRSS ${count}件を確認`;
      if(latestTitle)msg+=` · 最新「${latestTitle}」${latestDate?` (${latestDate})`:''}`;
      if(source==='直接確認'&&window.__movie30LbServerErrorV69)msg+=` · GitHub確認失敗: ${window.__movie30LbServerErrorV69}`;
      setLbStatus(msg,source==='GitHub実取得'?'ok':'');return true;
    }catch(e){setLbStatus('同期できませんでした：'+(e?.message||String(e)),'bad');return false}
    finally{if(btn){btn.disabled=false;btn.textContent=old}}
  };
  const btn=document.getElementById('syncLetterboxd');if(btn)btn.onclick=()=>syncLetterboxd(false);
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
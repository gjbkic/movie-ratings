(() => {
  // v26: manual Letterboxd sync is server-verified through GitHub Actions when the saved PAT is available.
  const GH_OWNER='gjbkic', GH_REPO='movie-ratings', GH_BRANCH='main';
  const GH_TOKEN_KEY='movie30_gpt_sync_token_v1';
  const TRIGGER_PATH='letterboxd-sync-trigger.txt';
  const RESULT_PATH='letterboxd-sync-result.json';
  const RSS_PATH='letterboxd-gjbkic.xml';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function ghToken(){ try{return localStorage.getItem(GH_TOKEN_KEY)||''}catch(_){return ''} }
  function decodeB64Utf8(b64){
    const bin=atob(String(b64||'').replace(/\s/g,''));
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeB64Utf8(text){
    const bytes=new TextEncoder().encode(String(text||''));
    let bin='';
    for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(bin);
  }
  async function gh(path,opt={}){
    const token=ghToken();
    if(!token)throw new Error('GitHub同期トークンがありません');
    const r=await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`,{
      ...opt,
      cache:'no-store',
      headers:{
        'Accept':'application/vnd.github+json',
        'Authorization':`Bearer ${token}`,
        'X-GitHub-Api-Version':'2022-11-28',
        ...(opt.headers||{})
      }
    });
    if(!r.ok){let msg=`GitHub HTTP ${r.status}`;try{const j=await r.json();if(j?.message)msg+=': '+j.message}catch(_){}throw new Error(msg)}
    return await r.json();
  }
  async function ghText(path){
    const j=await gh(path);
    return {text:decodeB64Utf8(j.content||''),sha:j.sha||''};
  }
  async function putTrigger(value){
    let cur=await ghText(TRIGGER_PATH);
    const body={message:'Trigger Letterboxd RSS refresh',content:encodeB64Utf8(value+'\n'),branch:GH_BRANCH,sha:cur.sha};
    try{
      return await gh(TRIGGER_PATH,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
    }catch(e){
      // One retry protects against a simultaneous live-state commit / stale blob SHA.
      cur=await ghText(TRIGGER_PATH);
      body.sha=cur.sha;
      return await gh(TRIGGER_PATH,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
    }
  }
  async function serverFetchRss(){
    const trigger=`movie30-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await putTrigger(trigger);
    const started=Date.now();
    let result=null;
    while(Date.now()-started<70000){
      await sleep(2200);
      try{
        const r=JSON.parse((await ghText(RESULT_PATH)).text);
        if(r?.trigger===trigger){ result=r; break; }
      }catch(_){}
    }
    if(!result)throw new Error('サーバー側のLetterboxd確認が70秒以内に完了しませんでした');
    if(result.status!=='ok')throw new Error(result.error||'サーバー側でLetterboxd RSSを取得できませんでした');
    const xml=(await ghText(RSS_PATH)).text;
    if(!/<(?:rss|item)[\s>]/i.test(xml))throw new Error('取得したRSSが不正です');
    return {xml,result};
  }

  async function applyRss(xml){
    const items=parseLbRss(xml);
    let added=0,updated=0,skipped=0;
    const seen=new Set();
    for(const raw of items){
      const sig=(raw.tmdbId||normKey(raw.title)+raw.year);
      if(seen.has(sig))continue;
      seen.add(sig);
      const rating=Number(raw.rating);
      if(!Number.isFinite(rating)||rating<.5){skipped++;continue}
      const existing=findExistingFilm(raw);
      if(existing){
        if(filmStar(existing)!==rating){state.starOverrides[existing.id]=rating;updated++}
        if(raw.tmdbId&&!titleInfo(existing).tmdbId)state.titleOverrides[existing.id]={...(state.titleOverrides[existing.id]||{}),tmdbId:Number(raw.tmdbId)};
        continue;
      }
      const meta=await enrichFromTmdb({...raw,tmdbId:raw.tmdbId?Number(raw.tmdbId):null,englishTitle:raw.title});
      if(addLbFilm(meta))added++;
    }
    save();render();
    return {items,added,updated,skipped};
  }

  const proxyFetchV20=fetchLbRss;
  syncLetterboxd=async function(silent=false){
    if(silent)return;
    const st=getLbSettings(),username=(document.getElementById('lbUsername')?.value||st.username||'gjbkic').trim();
    if(!username)return;
    saveLbSettings({username,auto:false});
    const btn=document.getElementById('syncLetterboxd');
    const old=btn?.textContent||'今すぐ同期';
    if(btn){btn.disabled=true;btn.textContent='確認中…'}
    let verified=null,source='';
    try{
      let xml='';
      if(username.toLowerCase()==='gjbkic'&&ghToken()){
        setLbStatus('GitHubサーバーからLetterboxdを実取得しています…（通常10〜30秒）');
        try{
          const z=await serverFetchRss(); xml=z.xml; verified=z.result; source='GitHub実取得';
        }catch(serverErr){
          setLbStatus('サーバー確認に失敗したため予備経路を確認中…');
          xml=await proxyFetchV20(username); source='予備経路';
          window.__movie30LbServerError=serverErr?.message||String(serverErr);
        }
      }else{
        setLbStatus('Letterboxd RSSを確認中…');
        xml=await proxyFetchV20(username); source='予備経路';
      }
      const z=await applyRss(xml);
      const parsedLatest=z.items[0]||{};
      const count=verified?.itemCount??z.items.length;
      const latestTitle=verified?.latestTitle||parsedLatest.title||'';
      const latestDate=verified?.latestWatchedDate||parsedLatest.watchedDate||'';
      let msg=`同期完了：新規 ${z.added}本${z.updated?`／★更新 ${z.updated}本`:''}${z.skipped?`／未評価 ${z.skipped}件`:''}`;
      msg+=` · ${source}でRSS ${count}件を確認`;
      if(latestTitle)msg+=` · 最新「${latestTitle}」${latestDate?` (${latestDate})`:''}`;
      if(source==='予備経路'&&window.__movie30LbServerError)msg+=` · サーバー確認失敗: ${window.__movie30LbServerError}`;
      setLbStatus(msg,source==='GitHub実取得'?'ok':'');
    }catch(e){
      setLbStatus('同期できませんでした：'+(e?.message||String(e)),'bad');
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old}
    }
  };

  const btn=document.getElementById('syncLetterboxd');
  if(btn)btn.onclick=()=>syncLetterboxd(false);
  const panel=btn?.closest('.panel');
  if(panel){
    const tips=panel.querySelectorAll('.tip');
    if(tips[0])tips[0].textContent='「今すぐ同期」でLetterboxdを実際に確認します。GitHub同期トークン設定済みならサーバー側でRSSを取り直し、取得件数・最新作品まで表示して確認します。';
  }
})();

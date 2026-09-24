(() => {
  // v35: remove the accidental 30-item Letterboxd bulk import and never trust proxy RSS for gjbkic.
  const BUILD='20260925y';
  const BASE_TOTAL=623;
  const CLEANUP_KEY='movie30_lb_bad_batch_cleanup_v35';
  const GH_OWNER='gjbkic', GH_REPO='movie-ratings', GH_BRANCH='main';
  const TOKEN_KEY='movie30_github_sync_token_v1';
  const TRIGGER_PATH='letterboxd-sync-trigger.txt';
  const RESULT_PATH='letterboxd-sync-result.json';
  const RSS_PATH='letterboxd-gjbkic.xml';

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const token=()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch(_){return ''}};
  function b64decode(s){const bin=atob(String(s||'').replace(/\s/g,'')),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new TextDecoder().decode(a)}
  function b64encode(s){const a=new TextEncoder().encode(String(s||''));let bin='';for(let i=0;i<a.length;i+=0x8000)bin+=String.fromCharCode(...a.subarray(i,i+0x8000));return btoa(bin)}
  async function gh(path,opt={}){
    const t=token(); if(!t)throw new Error('GitHub同期トークンがありません');
    const r=await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`,{...opt,cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28',...(opt.headers||{})}});
    if(!r.ok){let m=`GitHub HTTP ${r.status}`;try{const j=await r.json();if(j?.message)m+=': '+j.message}catch(_){}throw new Error(m)}
    return await r.json();
  }
  async function ghText(path){const j=await gh(path);return {text:b64decode(j.content||''),sha:j.sha||''}}
  async function putTrigger(v){
    let cur=await ghText(TRIGGER_PATH);
    let body={message:'Trigger Letterboxd RSS refresh',content:b64encode(v+'\n'),branch:GH_BRANCH,sha:cur.sha};
    try{return await gh(TRIGGER_PATH,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})}catch(_){cur=await ghText(TRIGGER_PATH);body.sha=cur.sha;return await gh(TRIGGER_PATH,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})}
  }
  function validateOwnRss(xml){
    const doc=new DOMParser().parseFromString(String(xml||''),'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('RSS形式が不正です');
    const channelTitle=(doc.querySelector('channel > title')?.textContent||'').trim().toLowerCase();
    const creators=[...doc.querySelectorAll('item')].slice(0,10).map(it=>[...it.children].find(c=>c.localName==='creator')?.textContent?.trim().toLowerCase()||'').filter(Boolean);
    if(!channelTitle.includes('letterboxd - gjbkic'))throw new Error('gjbkic本人のRSSと確認できませんでした');
    if(creators.length&&creators.some(x=>x!=='gjbkic'))throw new Error('RSS作成者がgjbkicと一致しません');
    return true;
  }
  async function serverRss(){
    const trigger=`movie30-safe-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await putTrigger(trigger);
    const started=Date.now();let result=null;
    while(Date.now()-started<70000){await sleep(2200);try{const r=JSON.parse((await ghText(RESULT_PATH)).text);if(r?.trigger===trigger){result=r;break}}catch(_){}}
    if(!result)throw new Error('サーバー側の確認が70秒以内に完了しませんでした');
    if(result.status!=='ok')throw new Error(result.error||'Letterboxd RSS取得失敗');
    const xml=(await ghText(RSS_PATH)).text;validateOwnRss(xml);return {xml,result};
  }
  async function verifiedSnapshot(){
    const r=await fetch('./letterboxd-gjbkic.xml?v='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('保存済み本人RSSを取得できませんでした');
    const xml=await r.text();validateOwnRss(xml);return xml;
  }

  function removeFilmCompletely(id){
    state.customFilms=(state.customFilms||[]).filter(f=>f.id!==id);
    for(const k of ['assignments','starOverrides','exactScores','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides']){
      if(state[k]&&typeof state[k]==='object')delete state[k][id];
    }
    for(const k of Object.keys(state.rankOrder||{}))state.rankOrder[k]=(state.rankOrder[k]||[]).filter(x=>x!==id);
  }
  function cleanupBadBatch(){
    try{if(localStorage.getItem(CLEANUP_KEY)==='1')return 0}catch(_){}
    const excess=Math.max(0,allFilms().length-BASE_TOTAL);
    if(!excess){try{localStorage.setItem(CLEANUP_KEY,'1')}catch(_){}return 0}
    const candidates=(state.customFilms||[]).filter(f=>f.source==='letterboxd'&&!Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id)).sort((a,b)=>Number(b._seq||0)-Number(a._seq||0));
    const doomed=candidates.slice(0,excess);
    for(const f of doomed)removeFilmCompletely(f.id);
    if(doomed.length){save(false);render()}
    // Mark complete only if the app is back at the known-good total; otherwise leave it retryable and do not delete unrelated entries.
    if(allFilms().length<=BASE_TOTAL){try{localStorage.setItem(CLEANUP_KEY,'1')}catch(_){}}
    return doomed.length;
  }

  async function applyVerified(xml){
    validateOwnRss(xml);
    const items=parseLbRss(xml),seen=new Set();let added=0,updated=0,skipped=0;
    for(const raw of items){
      const sig=raw.tmdbId||normKey(raw.title)+raw.year;if(seen.has(sig))continue;seen.add(sig);
      const rating=Number(raw.rating);if(!Number.isFinite(rating)||rating<.5){skipped++;continue}
      const existing=findExistingFilm(raw);
      if(existing){
        if(filmStar(existing)!==rating){state.starOverrides[existing.id]=rating;updated++}
        if(raw.tmdbId&&!titleInfo(existing).tmdbId)state.titleOverrides[existing.id]={...(state.titleOverrides[existing.id]||{}),tmdbId:Number(raw.tmdbId)};
        continue;
      }
      const meta=await enrichFromTmdb({...raw,tmdbId:raw.tmdbId?Number(raw.tmdbId):null,englishTitle:raw.title});
      if(addLbFilm(meta))added++;
    }
    save();render();return {items,added,updated,skipped};
  }

  const removed=cleanupBadBatch();
  if(removed)toast(`誤同期の${removed}本を取り消しました`);

  syncLetterboxd=async function(silent=false){
    if(silent)return;
    const st=getLbSettings(),username=(document.getElementById('lbUsername')?.value||st.username||'gjbkic').trim();
    if(!username)return;
    saveLbSettings({username,auto:false});
    const btn=document.getElementById('syncLetterboxd'),old=btn?.textContent||'今すぐ同期';
    if(btn){btn.disabled=true;btn.textContent='本人RSS確認中…'}
    try{
      let xml,result=null,source='';
      if(username.toLowerCase()==='gjbkic'){
        if(token()){
          setLbStatus('GitHubサーバーでgjbkic本人のLetterboxd RSSを確認しています…');
          const z=await serverRss();xml=z.xml;result=z.result;source='GitHub本人確認済み';
        }else{
          setLbStatus('GitHub同期トークンがないため、最後にサーバー確認済みのRSSだけを使用します…');
          xml=await verifiedSnapshot();source='保存済み本人RSS';
        }
      }else{
        throw new Error('安全のため自動同期はgjbkicアカウントだけに限定しました');
      }
      const z=await applyVerified(xml),latest=z.items[0]||{},count=result?.itemCount??z.items.length;
      let msg=`同期完了：新規 ${z.added}本${z.updated?`／★更新 ${z.updated}本`:''}${z.skipped?`／未評価 ${z.skipped}件`:''} · ${source}でRSS ${count}件を確認`;
      if(latest.title)msg+=` · 最新「${latest.title}」${latest.watchedDate?` (${latest.watchedDate})`:''}`;
      setLbStatus(msg,'ok');
    }catch(e){setLbStatus('同期を中止しました：'+(e?.message||String(e)),'bad')}
    finally{if(btn){btn.disabled=false;btn.textContent=old}}
  };
  const btn=document.getElementById('syncLetterboxd');if(btn)btn.onclick=()=>syncLetterboxd(false);
  const panel=btn?.closest('.panel');if(panel){const tip=panel.querySelector('.tip');if(tip)tip.textContent='誤取り込み防止のため、gjbkic本人と確認できたRSSだけを反映します。プロキシ取得に失敗しても別経路の内容を自動登録しません。';}

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

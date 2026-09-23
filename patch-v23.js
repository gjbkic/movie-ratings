(() => {
  // v23: two-stage exact-score placement + optional GitHub live-state sync for GPT.
  const style = document.createElement('style');
  style.textContent = `
    .compare-stage-score{width:100%;text-align:left;border:1px solid var(--line);background:#0b0f14;color:#f5f7fa;border-radius:12px;padding:0;margin:9px 0;overflow:hidden}
    .compare-stage-score:active{background:#111923}.compare-stage-score-head{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:#121923;border-bottom:1px solid var(--line)}
    .compare-stage-score-head strong{font-size:18px}.compare-stage-score-head small{font-size:9px;color:var(--muted)}
    .compare-edge{padding:8px 10px;border-top:1px solid rgba(255,255,255,.05)}.compare-edge:first-of-type{border-top:0}.compare-edge span{display:block;font-size:9px;color:var(--muted);margin-bottom:2px}.compare-edge b{font-size:11px}
    .compare-stage-empty{padding:10px;font-size:10px;color:var(--muted)}.compare-stage-cta{padding:7px 10px;text-align:center;font-size:10px;font-weight:900;color:#a9e8bd;border-top:1px dashed #35513f;background:rgba(67,209,125,.055)}
    .gpt-sync-grid{display:grid;gap:8px}.gpt-sync-line{display:flex;gap:7px;align-items:center}.gpt-sync-line .field{flex:1;min-width:0}.gpt-sync-note{font-size:10px;line-height:1.55;color:var(--muted)}
    .gpt-sync-status{font-size:10px;line-height:1.45;color:var(--muted);padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:#0b0f14}.gpt-sync-status.ok{color:#a9e8bd;border-color:#31553d}.gpt-sync-status.bad{color:#ffb5b5;border-color:#613636}
    .gpt-sync-toggle{display:flex;gap:7px;align-items:center;font-size:11px}
  `;
  document.head.appendChild(style);

  const compareBg = document.getElementById('compareBg');
  const compareBody = document.getElementById('compareBody');
  const compareTitle = document.getElementById('compareTitle');
  const compareSub = document.getElementById('compareSub');
  const compareUp = document.getElementById('compareUp');
  const compareDown = document.getElementById('compareDown');
  const compareClose = document.getElementById('compareClose');

  let pendingCompareId = null;
  let stageCtx = null;

  function orderedAt(score, exceptId) {
    const arr = allFilms().filter(f => f.id !== exceptId && Number(effectiveScore(f)) === Number(score));
    return rankSorted(arr, Number(score));
  }
  function initialScoreBounds(f) {
    const star = Number(filmStar(f));
    const r = STAR_RANGES?.[sk(star)];
    let lo, hi;
    if (r && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1]))) {
      lo = Number(r[0]); hi = Number(r[1]);
    } else {
      const m = state.scoreMap?.[sk(star)] || DEFAULT_MAP?.[sk(star)] || {low:0, high:100};
      lo = Number(m.low ?? 0); hi = Number(m.high ?? 100);
    }
    const cur = effectiveScore(f);
    if (cur != null && Number.isFinite(Number(cur))) {
      lo = Math.min(lo, Number(cur)); hi = Math.max(hi, Number(cur));
    }
    return [Math.max(0, lo), Math.min(100, hi)];
  }
  function edgeHtml(f, label, score) {
    if (!f) return '';
    return `<div class="compare-edge"><span>${label}</span><b>${esc(displayTitle(f))}</b><span>${esc(f.year||'')} · ${score}点</span></div>`;
  }
  function scoreChoiceHtml(score, id) {
    const arr = orderedAt(score, id);
    let inside = '';
    if (!arr.length) {
      inside = `<div class="compare-stage-empty">この点数の作品はまだありません</div>`;
    } else if (arr.length === 1) {
      inside = edgeHtml(arr[0], 'この点数の作品', score);
    } else {
      inside = edgeHtml(arr[0], 'いちばん上', score) + edgeHtml(arr[arr.length-1], 'いちばん下', score);
    }
    return `<button type="button" class="compare-stage-score" data-stage-score="${score}">
      <div class="compare-stage-score-head"><strong>${score}点</strong><small>${arr.length}本</small></div>
      ${inside}<div class="compare-stage-cta">${score}点を選ぶ</div>
    </button>`;
  }
  function renderStageOne() {
    if (!stageCtx) return;
    const f = filmById(stageCtx.id); if (!f) return;
    stageCtx.stage = 'score';
    compareTitle.textContent = `${displayTitle(f)} — 点数を選ぶ`;
    compareSub.textContent = 'まず各点の「いちばん上」と「いちばん下」だけ表示しています。近い点数を選ぶと、次にその点数の中だけで正確な位置を決めます。';
    const blocks = [];
    for (let s = stageCtx.hi; s >= stageCtx.lo; s--) blocks.push(scoreChoiceHtml(s, f.id));
    compareBody.innerHTML = blocks.join('');
    compareBody.querySelectorAll('[data-stage-score]').forEach(b => {
      b.onclick = () => renderStageTwo(Number(b.dataset.stageScore));
    });
    compareUp.style.display = '';
    compareDown.style.display = '';
    compareUp.textContent = 'さらに上の点数';
    compareDown.textContent = 'さらに下の点数';
    compareUp.disabled = stageCtx.hi >= 100;
    compareDown.disabled = stageCtx.lo <= 0;
  }
  function stageTwoRows(score, id) {
    const arr = orderedAt(score, id), out = [];
    for (let i = 0; i <= arr.length; i++) {
      const label = !arr.length ? 'この点数に入れる' :
        i === 0 ? 'ここに入れる（先頭）' :
        i === arr.length ? 'ここに入れる（末尾）' : 'ここに入れる';
      out.push(`<button class="compare-slot" type="button" data-final-score="${score}" data-final-index="${i}">${label}</button>`);
      if (i < arr.length) {
        const x = arr[i];
        out.push(`<div class="compare-film"><strong>${esc(displayTitle(x))}</strong><small>${esc(x.year||'')} · ${score}点</small></div>`);
      }
    }
    return out.join('');
  }
  function renderStageTwo(score) {
    if (!stageCtx) return;
    const f = filmById(stageCtx.id); if (!f) return;
    stageCtx.stage = 'position'; stageCtx.score = score;
    compareTitle.textContent = `${displayTitle(f)} — ${score}点のどこに入れる？`;
    compareSub.textContent = '次はこの点数の作品だけを全部表示しています。入れたい境目を選ぶと、点数と同点内順位が確定します。';
    compareBody.innerHTML = `<section class="compare-score"><div class="compare-score-head"><strong>${score}点</strong><small>${orderedAt(score, f.id).length}本</small></div>${stageTwoRows(score, f.id)}</section>`;
    compareBody.querySelectorAll('[data-final-score]').forEach(b => {
      b.onclick = () => placeFinal(f.id, Number(b.dataset.finalScore), Number(b.dataset.finalIndex));
    });
    compareUp.style.display = '';
    compareDown.style.display = 'none';
    compareUp.textContent = '← 点数選択に戻る';
    compareUp.disabled = false;
  }
  function focusPlaced(id) {
    let card = document.querySelector(`.rank-card[data-id="${encodeURIComponent(id)}"]`);
    if (!card) {
      const search = document.getElementById('searchRank'); if (search) search.value = '';
      for (const p of ['genreFilterRank','mediaFilterRank','originFilterRank','formatFilterRank','decadeFilterRank','runtimeFilterRank']) {
        const e = document.getElementById(p); if (e) e.value = '';
      }
      renderRank();
      card = document.querySelector(`.rank-card[data-id="${encodeURIComponent(id)}"]`);
    }
    if (!card) return;
    card.scrollIntoView({behavior:'smooth', block:'center'});
    card.classList.add('just-placed');
    setTimeout(() => card?.classList.remove('just-placed'), 2600);
  }
  function placeFinal(id, score, index) {
    const f = filmById(id); if (!f) return;
    for (const k of Object.keys(state.rankOrder || {})) state.rankOrder[k] = (state.rankOrder[k] || []).filter(x => x !== id);
    state.exactScores[id] = score;
    const st = scoreToStar(score);
    state.starOverrides[id] = st;
    state.assignments[id] = nearestTier(st, score);
    const ids = orderedAt(score, id).map(x => x.id);
    ids.splice(Math.max(0, Math.min(ids.length, index)), 0, id);
    state.rankOrder[String(score)] = ids;
    save();
    compareClose?.click();
    view.page = 'rank';
    save();
    render();
    setTimeout(() => focusPlaced(id), 80);
    toast(`${score}点に確定しました`);
  }
  function startTwoStage(id) {
    const f = filmById(id); if (!f) return;
    const [lo, hi] = initialScoreBounds(f);
    stageCtx = {id, lo, hi, stage:'score', score:null};
    renderStageOne();
    compareBg?.querySelector('.compare-sheet')?.scrollTo({top:0});
  }

  document.addEventListener('click', e => {
    const uns = e.target.closest?.('[data-uns]');
    if (uns) pendingCompareId = decodeURIComponent(uns.dataset.uns);
    if (e.target.closest?.('#compareCurrent')) pendingCompareId = selectedId;
  }, true);

  if (compareBg) {
    new MutationObserver(() => {
      if (compareBg.classList.contains('open')) {
        if (pendingCompareId) {
          const id = pendingCompareId; pendingCompareId = null;
          setTimeout(() => startTwoStage(id), 0);
        }
      } else {
        stageCtx = null;
      }
    }).observe(compareBg, {attributes:true, attributeFilter:['class']});
  }
  if (compareUp) compareUp.onclick = () => {
    if (!stageCtx) return;
    if (stageCtx.stage === 'position') {
      renderStageOne();
      compareBg?.querySelector('.compare-sheet')?.scrollTo({top:0, behavior:'smooth'});
    } else {
      stageCtx.hi = Math.min(100, stageCtx.hi + 5);
      renderStageOne();
    }
  };
  if (compareDown) compareDown.onclick = () => {
    if (!stageCtx || stageCtx.stage !== 'score') return;
    stageCtx.lo = Math.max(0, stageCtx.lo - 5);
    renderStageOne();
  };

  const REPO = 'gjbkic/movie-ratings';
  const LIVE_PATH = 'live-state.json';
  const TOKEN_KEY = 'movie30_github_sync_token_v1';
  const SETTINGS_KEY = 'movie30_github_sync_settings_v1';
  const LAST_KEY = 'movie30_github_sync_last_v1';
  let syncTimer = 0, syncBusy = false;

  function getToken(){ try{return localStorage.getItem(TOKEN_KEY)||''}catch(_){return ''} }
  function getSyncSettings(){ try{return {auto:true,...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null')||{})}}catch(_){return {auto:true}} }
  function setSyncSettings(v){ try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(v))}catch(_){} }
  function getLastSync(){ try{return JSON.parse(localStorage.getItem(LAST_KEY)||'null')||{}}catch(_){return {}} }
  function setLastSync(v){ try{localStorage.setItem(LAST_KEY,JSON.stringify(v))}catch(_){} }
  function syncHeaders(token){ return {Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}; }
  function utf8Base64(text){
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode(...bytes.subarray(i, i+0x8000));
    return btoa(bin);
  }
  function liveFilmRow(f, score, overallRank, sameScoreRank){
    const x = titleInfo(f);
    return {
      id:f.id,
      title:displayTitle(f),
      originalTitle:x.originalTitle||'',
      englishTitle:x.englishTitle||'',
      year:f.year||'',
      score:score==null?null:Number(score),
      star:Number(filmStar(f)),
      overallRank:overallRank||null,
      sameScoreRank:sameScoreRank||null,
      category:filmCategory(f)||'',
      mediaType:state.mediaTypeOverrides?.[f.id]||f.mediaType||'movie',
      genre:state.genreOverrides?.[f.id]||'',
      origin:state.originOverrides?.[f.id]||'',
      format:state.formatOverrides?.[f.id]||'',
      runtime:state.runtimeOverrides?.[f.id]||null,
      exact:Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id)
    };
  }
  function makeLivePayload(){
    const films = allFilms();
    const scored = new Map(), unrated = [];
    for(const f of films){
      const sc = effectiveScore(f);
      if(sc==null || !Number.isFinite(Number(sc))) unrated.push(f);
      else {
        const k=String(Number(sc));
        if(!scored.has(k))scored.set(k,[]);
        scored.get(k).push(f);
      }
    }
    const ranked=[]; let overall=0;
    const scores=[...scored.keys()].map(Number).sort((a,b)=>b-a);
    for(const score of scores){
      const arr=rankSorted(scored.get(String(score))||[],score);
      arr.forEach((f,i)=>ranked.push(liveFilmRow(f,score,++overall,i+1)));
    }
    return {
      app:'movie30-live',
      schema:1,
      sourceUpdatedAt:Number(state.updatedAt||0),
      sourceUpdatedIso:state.updatedAt?new Date(Number(state.updatedAt)).toISOString():null,
      ranked,
      unrated:unrated.map(f=>liveFilmRow(f,null,null,null)),
      state:{
        exactScores:state.exactScores||{},
        rankOrder:state.rankOrder||{},
        customFilms:state.customFilms||[],
        starOverrides:state.starOverrides||{},
        titleOverrides:state.titleOverrides||{},
        categoryOverrides:state.categoryOverrides||{},
        mediaTypeOverrides:state.mediaTypeOverrides||{},
        genreOverrides:state.genreOverrides||{},
        originOverrides:state.originOverrides||{},
        formatOverrides:state.formatOverrides||{},
        runtimeOverrides:state.runtimeOverrides||{}
      }
    };
  }

  const dataPage = document.getElementById('page-data');
  let syncStatus = null, tokenInput = null, autoInput = null;
  if (dataPage && !document.getElementById('gptSyncPanel')) {
    const panel=document.createElement('div');
    panel.id='gptSyncPanel'; panel.className='panel';
    panel.innerHTML=`<h2>GPT用 最新ランキング同期</h2>
      <div class="gpt-sync-grid">
        <div class="gpt-sync-note">一度設定すると、採点や順位変更のあとに <b>live-state.json</b> を自動更新します。以後このチャットで「次なに見る？」のように言えば、GPT側からGitHubの最新データを取得できます。</div>
        <div class="gpt-sync-note">GitHubの <b>fine-grained personal access token</b> をこのリポジトリだけに限定し、Contents: Read and write を付けて使います。トークンはこの端末のブラウザ内だけに保存され、バックアップやGitHubには書き出しません。</div>
        <div class="gpt-sync-note" style="color:#ffd58a">※ このリポジトリ自体が公開なので、同期した採点・順位データも公開されます。</div>
        <div class="gpt-sync-line"><input class="field" id="gptSyncToken" type="password" autocomplete="off" placeholder="github_pat_…"><button class="btn" id="gptSyncSave">設定</button></div>
        <label class="gpt-sync-toggle"><input id="gptSyncAuto" type="checkbox"> 変更後に自動同期</label>
        <div class="tools"><button class="btn" id="gptSyncNow">今すぐ同期</button><button class="btn" id="gptSyncClear">トークン削除</button></div>
        <div class="gpt-sync-status" id="gptSyncStatus"></div>
      </div>`;
    const backup=[...dataPage.querySelectorAll('.panel')].find(p=>p.textContent.includes('バックアップ・書き出し'));
    if(backup)dataPage.insertBefore(panel,backup); else dataPage.appendChild(panel);
    syncStatus=panel.querySelector('#gptSyncStatus');
    tokenInput=panel.querySelector('#gptSyncToken');
    autoInput=panel.querySelector('#gptSyncAuto');
    const settings=getSyncSettings();
    autoInput.checked=settings.auto!==false;
    tokenInput.value=getToken();
    panel.querySelector('#gptSyncSave').onclick=async()=>{
      const v=tokenInput.value.trim();
      if(!v){ setSyncUi('トークンを入力してください。','bad'); return; }
      try{localStorage.setItem(TOKEN_KEY,v)}catch(_){}
      setSyncSettings({auto:autoInput.checked});
      setSyncUi('設定しました。最初の同期を実行します…');
      await syncToGithub(true);
    };
    autoInput.onchange=()=>{setSyncSettings({auto:autoInput.checked}); if(autoInput.checked)scheduleSync(200);};
    panel.querySelector('#gptSyncNow').onclick=()=>syncToGithub(true);
    panel.querySelector('#gptSyncClear').onclick=()=>{
      try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(LAST_KEY)}catch(_){}
      tokenInput.value=''; setSyncUi('トークンを削除しました。');
    };
  }
  function setSyncUi(msg,kind=''){
    if(!syncStatus)return;
    syncStatus.className='gpt-sync-status'+(kind?' '+kind:'');
    syncStatus.textContent=msg;
  }
  function refreshSyncUi(){
    const token=getToken(), last=getLastSync();
    if(!token){setSyncUi('未設定。同期を使う場合だけトークンを設定してください。');return;}
    if(last.at){
      const d=new Date(last.at);
      setSyncUi(`設定済み · 最終同期 ${d.toLocaleString('ja-JP')}`,'ok');
    }else setSyncUi('トークン設定済み。まだ同期していません。');
  }
  async function remoteSha(token){
    const url=`https://api.github.com/repos/${REPO}/contents/${LIVE_PATH}`;
    const r=await fetch(url,{headers:syncHeaders(token),cache:'no-store'});
    if(r.status===404)return null;
    if(!r.ok)throw new Error(`GitHub確認に失敗 (${r.status})`);
    return (await r.json()).sha||null;
  }
  async function syncToGithub(manual=false){
    if(syncBusy)return;
    const token=getToken().trim();
    if(!token){if(manual)setSyncUi('トークンが未設定です。','bad');return;}
    const last=getLastSync();
    const sourceUpdatedAt=Number(state.updatedAt||0);
    if(!manual && Number(last.sourceUpdatedAt||0)===sourceUpdatedAt)return;
    syncBusy=true; if(syncTimer){clearTimeout(syncTimer);syncTimer=0;}
    setSyncUi('GitHubへ同期中…');
    try{
      const payload=makeLivePayload(), text=JSON.stringify(payload,null,2), content=utf8Base64(text);
      let sha=await remoteSha(token);
      const body={message:`Sync live movie ratings (${sourceUpdatedAt||Date.now()})`,content};
      if(sha)body.sha=sha;
      const url=`https://api.github.com/repos/${REPO}/contents/${LIVE_PATH}`;
      let r=await fetch(url,{method:'PUT',headers:{...syncHeaders(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(r.status===409){
        sha=await remoteSha(token);
        if(sha)body.sha=sha; else delete body.sha;
        r=await fetch(url,{method:'PUT',headers:{...syncHeaders(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
      }
      if(!r.ok){
        let detail=''; try{detail=(await r.json())?.message||''}catch(_){}
        throw new Error(`同期失敗 (${r.status})${detail?': '+detail:''}`);
      }
      setLastSync({at:Date.now(),sourceUpdatedAt});
      refreshSyncUi();
    }catch(e){
      setSyncUi(e?.message||String(e),'bad');
    }finally{syncBusy=false;}
  }
  function scheduleSync(delay=2200){
    const settings=getSyncSettings();
    if(!settings.auto||!getToken())return;
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{syncTimer=0;syncToGithub(false);},delay);
  }
  const saveV22=save;
  save=function(...args){
    const out=saveV22(...args);
    scheduleSync();
    return out;
  };

  refreshSyncUi();
  scheduleSync(1000);
})();
/* Cast search and compact IndexedDB-only cast cache. No movie scores or ranks are written here. */
(() => {
  'use strict';
  const DB_NAME = 'movie30_cast_cache_v1';
  const STORE = 'films';
  const casts = new Map();
  const pending = new Map();
  const fold = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  let databasePromise = null, bulkRunning = false, stopBulk = false;
  let sheetFilmId = '';
  function database() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath: 'filmId'});
          if (!req.result.objectStoreNames.contains('reports')) req.result.createObjectStore('reports', {keyPath:'id'});
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = req.onblocked = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return databasePromise;
  }
  async function loadCache() {
    const db = await database();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          for (const item of req.result || []) {
            if (item && item.filmId && Array.isArray(item.cast)) casts.set(item.filmId, item);
          }
          resolve(true);
        };
        req.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  async function persist(item) {
    const db = await database();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  function namesForFilm(id) {
    const entry = casts.get(id);
    if (!entry) return [];
    return [...new Set(entry.cast.flatMap(p => [p.name, p.originalName]).filter(Boolean))];
  }
  function matchesFilm(id, query) {
    return window.Movie30SearchQueries.castNames(id,query,namesForFilm,fold);
  }
  const beforeMatch = match;
  match = function(f, q) { return beforeMatch(f, q) || matchesFilm(f.id, q); };

  function updateSearch() {
    if (document.getElementById('searchRank')?.value.trim()) renderRank();
    if (document.getElementById('searchClassify')?.value.trim()) renderClassify();
    window.__movie30AutoComplete92?.refresh?.();
  }
  function updateCounts() {
    const status = document.getElementById('movieCastStatus');
    if (!status || bulkRunning) return;
    const films=allFilms(),positive=films.filter(f=>casts.get(f.id)?.cast.length).length;
    status.textContent = '出演者情報あり：' + positive + '/' + films.length + '作品。空の取得結果・古いキャッシュは一括取得で再確認します。';
  }
  async function retrieve(f, force = false) {
    if (!f) throw new Error('作品が見つかりません');
    await ready;
    const previous=casts.get(f.id),published=window.__movie30CastSource.catalog()[f.id];
    if (!force && previous?.cast.length && previous.resolverVersion===2 && !(Date.parse(published?.castCheckedAt||'')>Date.parse(previous.fetchedAt||''))) return previous;
    if (pending.has(f.id)) return pending.get(f.id);
    const promise = (async () => {
      const entry=await window.__movie30CastSource.retrieve(f,{force});
      const saved=await persist(entry);
      if(!saved)throw Object.assign(new Error('出演者キャッシュの保存失敗。映画データ・既存キャッシュは保持しています'),{type:'storage'});
      casts.set(f.id,entry);
      if(!bulkRunning){updateSearch();updateCounts();}
      return entry;
    })();
    pending.set(f.id, promise);
    try { return await promise; } finally { pending.delete(f.id); }
  }

  const style = document.createElement('style');
  style.textContent = [
    '.movie-cast-panel{padding:11px 0;border-top:1px solid #344150;margin:12px 0;}',
    '.movie-cast-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;}',
    '.movie-cast-head strong{font-size:13px;}',
    '.movie-cast-status{font-size:11px;color:#bbc8d8;margin:4px 0 10px;line-height:1.6;}',
    '.movie-cast-list{display:flex;flex-wrap:wrap;gap:6px;}',
    '.movie-cast-person{border:1px solid #405064;background:#182532;border-radius:8px;padding:6px 8px;font-size:11px;color:#e1ecf7;text-align:left;cursor:pointer;}',
    '.movie-cast-person small{display:block;color:#aebecf;font-size:10px;margin-top:2px;}',
    '.movie-cast-data{padding:10px 0;}',
    '.movie-cast-data .tools{display:flex;gap:8px;flex-wrap:wrap;}'
  ].join('\n');
  document.head.appendChild(style);

  const sheet = document.querySelector('#sheetBg .sheet');
  const sheetPanel = document.createElement('section');
  sheetPanel.className = 'movie-cast-panel';
  sheetPanel.innerHTML = '<div class="movie-cast-head"><strong>出演者（上位15人）</strong><button type="button" class="btn" id="movieCastRefresh">取得・更新</button></div>' +
    '<div class="movie-cast-status" id="movieCastSheetStatus"></div><div class="movie-cast-list" id="movieCastList"></div>';
  const crewPanel=document.getElementById('directorPanel84');
  if(crewPanel){crewPanel.className='movie-cast-panel';crewPanel.after(sheetPanel);}
  else sheet?.insertBefore(sheetPanel, document.getElementById('closeSheet'));
  function displaySheet(f, error = '') {
    if (!f || sheetFilmId !== f.id) return;
    const container = document.getElementById('movieCastList');
    const status = document.getElementById('movieCastSheetStatus');
    if (!container || !status) return;
    container.textContent = '';
    const entry = casts.get(f.id);
    status.textContent = error || (entry
      ? (entry.cast.length ? '名前をタップすると、その出演者の作品を検索できます。' : '出演者情報が登録されていません。')
      : (getTmdbCredential() ? 'TMDBから出演者を取得できます。' : '取得には「追加・保存」でTMDB APIキーを設定してください。'));
    if (!entry) return;
    for (const p of entry.cast) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'movie-cast-person';
      button.textContent = p.name;
      if (p.role) { const small = document.createElement('small'); small.textContent = p.role; button.appendChild(small); }
      button.addEventListener('click', () => {
        if (window.__movie30People) { window.__movie30People.open({id:p.id,name:p.name,role:'出演',filmId:f.id}); return; }
        document.getElementById('closeSheet')?.click();
        view.page = 'rank'; render();
        const input = document.getElementById('searchRank');
        if (!input) return;
        input.value = p.name;
        input.dispatchEvent(new Event('input', {bubbles: true}));
        try { input.scrollIntoView({block: 'center'}); } catch (_) {}
      });
      container.appendChild(button);
    }
  }
  const previousOpenSheet = openSheet;
  openSheet = function(id, ...rest) {
    const result = previousOpenSheet.call(this, id, ...rest);
    const f = filmById(id);
    sheetFilmId = id;
    displaySheet(f);
    if (f && !casts.get(id)?.cast.length) {
      document.getElementById('movieCastSheetStatus').textContent = '出演者を取得中…';
      retrieve(f).then(() => displaySheet(f)).catch(error => displaySheet(f, String(error.message || error)));
    }
    return result;
  };
  document.getElementById('movieCastRefresh')?.addEventListener('click', async () => {
    const f = filmById(sheetFilmId);
    if (!f) return;
    const status = document.getElementById('movieCastSheetStatus');
    if (status) status.textContent = '出演者を取得中…';
    try { await retrieve(f, true); displaySheet(f); }
    catch (error) { displaySheet(f, String(error.message || error)); }
  });

  const data = document.getElementById('page-data');
  const panel = document.createElement('div');
  panel.className = 'panel movie-cast-data';
  panel.innerHTML = '<h2>出演者を取得（TMDB）</h2><div class="tip">作品の出演者・役名を上位15人まで取得し、検索候補と作品詳細に表示します。キャッシュは映画の順位・レビューとは別のIndexedDBに保存し、画像データは保存しません。</div>' +
    '<div class="tools"><button class="btn" type="button" id="movieCastBulk">全作品の出演者を取得</button><button class="btn" type="button" id="movieCastRetry">未取得作品を再確認</button></div>' +
    '<div class="movie-cast-status" id="movieCastStatus" role="status"></div><details id="movieCastReport" hidden><summary>未解決作品と理由</summary><div id="movieCastFailures"></div><button type="button" class="btn" id="movieCastReportDownload">取得結果をJSON保存</button></details>';
  document.getElementById('tmdbCredential')?.closest('.panel')?.after(panel);
  const runButton = document.getElementById('movieCastBulk');
  const retryButton = document.getElementById('movieCastRetry');
  let lastReport=null;
  function showReport(report){
    lastReport=report;
    const s=report.counts,status=document.getElementById('movieCastStatus');
    if(status)status.textContent=(report.source==='github'?'GitHubでの再確認結果 · ':'')+'全作品 '+s.total+' · 確認済み '+s.checked+' · 取得成功 '+s.success+' · 出演者情報なし '+s.empty+' · TMDB照合不可 '+s.unmatched+' · APIエラー '+s.api+' · 保存エラー '+s.storage+' · 未処理 '+s.pending+(report.stopped?'（一時停止）':'（全作品の確認終了）');
    const details=document.getElementById('movieCastReport'),list=document.getElementById('movieCastFailures');
    if(!details||!list)return;details.hidden=false;list.textContent='';
    for(const row of report.results.filter(r=>r.status!=='success')){
      const p=document.createElement('p');p.textContent=row.title+' — '+row.reason;list.append(p);
    }
    if(!list.children.length)list.textContent='未解決作品はありません。';
  }
  async function storeReport(report){const db=await database();if(!db)return;
    return new Promise(resolve=>{try{const tx=db.transaction('reports','readwrite');tx.objectStore('reports').put({id:'latest',report});tx.oncomplete=tx.onabort=tx.onerror=()=>resolve();}catch(_){resolve();}});
  }
  document.getElementById('movieCastReportDownload')?.addEventListener('click',()=>{
    if(lastReport)download('cast-report-'+Date.now()+'.json',JSON.stringify(lastReport,null,2),'application/json');
  });
  async function runBulk() {
    if(bulkRunning){stopBulk=true;if(runButton)runButton.textContent='停止しています…';return;}
    await ready;await window.__movie30CastSource.ready;window.__movie30CastSource.reset();
    bulkRunning=true;stopBulk=false;runButton.textContent='一時停止';retryButton.disabled=true;
    const films=[...allFilms()],results=[],counts={total:films.length,checked:0,success:0,empty:0,unmatched:0,api:0,storage:0,pending:films.length};
    try{
      for(const f of films){
        if(stopBulk)break;
        let status='success',reason='',entry;
        try{entry=await retrieve(f);if(!entry.cast.length){status='empty';reason='既存ID・別名と日本語／英語のクレジットを再確認しましたが出演者情報なし';}}
        catch(e){status=['unmatched','storage'].includes(e.type)?e.type:'api';reason=String(e.message||e);}
        results.push({id:f.id,title:displayTitle(f),status,reason,tmdbType:entry?.tmdbType,tmdbId:entry?.tmdbId,castCount:entry?.cast.length||0});
        counts[status]++;counts.checked++;counts.pending--;
        const el=document.getElementById('movieCastStatus');if(el)el.textContent='確認 '+counts.checked+'/'+counts.total+' · 成功 '+counts.success+' · 情報なし '+counts.empty+' · 照合不可 '+counts.unmatched+' · APIエラー '+counts.api+' · '+displayTitle(f);
        if(counts.checked%25===0){await storeReport({at:new Date().toISOString(),counts:{...counts},results:[...results],stopped:true});updateSearch();}
        // Existing cache/catalog entries need no artificial per-film API delay.
        if(entry?.source==='tmdb')await new Promise(r=>setTimeout(r,120));
      }
    }finally{
      for(const f of films.slice(counts.checked))results.push({id:f.id,title:displayTitle(f),status:'pending',reason:'ユーザーによる一時停止のため未処理'});
      const report={at:new Date().toISOString(),counts,results,stopped:stopBulk};
      bulkRunning=false;updateSearch();runButton.textContent='全作品の出演者を取得';retryButton.disabled=false;
      showReport(report);await storeReport(report);
    }
  }
  runButton?.addEventListener('click', runBulk);
  retryButton?.addEventListener('click', runBulk);

  for (const id of ['searchRank', 'searchClassify']) {
    const input = document.getElementById(id);
    if (!input) continue;
    const menu = () => input.closest('.movie92-search-wrap')?.querySelector('.movie92-suggestions');
    input.addEventListener('pointerdown', event => {
      if (document.activeElement !== input) return;
      // A second tap hides both the keyboard and the autocomplete, leaving the query intact.
      event.preventDefault();
      event.stopImmediatePropagation();
      input.blur();
      if (menu()) menu().hidden = true;
    }, true);
    input.addEventListener('blur', () => { if (menu()) menu().hidden = true; });
    input.addEventListener('focus', () => {
      // A third tap focuses the field and restores suggestions for the existing query.
      if (input.value.trim()) input.dispatchEvent(new Event('input', {bubbles: true}));
    });
  }
  const ready = Promise.all([loadCache(), window.__movie30CastSource.ready]).then(() => {
    // Cached cast from a different TMDB title must never override the corrected catalog ID.
    const published = window.__movie30CastSource.catalog();
    for (const [filmId, entry] of casts) {
      const canonicalId = Number(published[filmId]?.tmdbId) || 0;
      const cachedId = Number(entry.tmdbId) || 0;
      if (canonicalId && cachedId && canonicalId !== cachedId) casts.delete(filmId);
    }
    updateCounts();
    if (document.documentElement.classList.contains('movie30-ready')) updateSearch();
    else window.__movie30StorageReady?.then(() => {
      if (document.documentElement.classList.contains('movie30-ready')) updateSearch();
    });
  });
  database().then(db=>{if(!db)return;try{const req=db.transaction('reports','readonly').objectStore('reports').get('latest');req.onsuccess=()=>{if(req.result?.report&&!bulkRunning)showReport(req.result.report);};}catch(_){} });
  fetch('./cast-fetch-report.json?cast=20261013c',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(report=>{
    if(report?.counts&&Array.isArray(report.results)&&!lastReport&&!bulkRunning)showReport({...report,source:'github',counts:{...report.counts,checked:report.counts.total,storage:0,pending:0}});
  }).catch(()=>{});
  window.__movie30Cast = {ready, namesForFilm, matchesFilm,
    get: filmId => casts.get(filmId), retrieve, runBulk, report:()=>lastReport,
    stats: () => ({cached: casts.size, total: allFilms().length})};
})();

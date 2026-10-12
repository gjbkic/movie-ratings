/* Cast search and compact IndexedDB-only cast cache. No movie scores or ranks are written here. */
(() => {
  'use strict';
  const DB_NAME = 'movie30_cast_cache_v1';
  const STORE = 'films';
  const LIMIT = 15;
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
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath: 'filmId'});
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
    const needle = fold(query);
    return !!needle && namesForFilm(id).some(name => fold(name).includes(needle));
  }
  const beforeMatch = match;
  match = function(f, q) { return beforeMatch(f, q) || matchesFilm(f.id, q); };

  function filmKind(f, m) {
    const contentType = String(m.contentType || '');
    const override = String(state.mediaTypeOverrides?.[f.id] || '');
    if (contentType === 'tv_episode') return 'episode';
    if (contentType === 'tv_series' || override === 'drama') return 'tv';
    return 'movie';
  }
  function identities(f) {
    const info = titleInfo(f);
    return [...new Set([info.englishTitle, info.originalTitle, info.title, f.lbTitle]
      .map(x => String(x || '').trim()).filter(Boolean))];
  }
  async function lookupId(f, kind) {
    const tv = kind !== 'movie';
    const path = tv ? '/search/tv' : '/search/movie';
    const year = Number(f.year) || 0, names = identities(f);
    const matchNames = new Set(names.map(fold));
    for (const name of names.slice(0, 4)) {
      const options = {query: name, language: 'en-US'};
      if (!tv) options.include_adult = 'false';
      const result = await tmdbFetch(path, options);
      const candidates = (result.results || []).filter(x => {
        const releaseYear = Number(String(x.release_date || x.first_air_date || '').slice(0, 4));
        if (year && releaseYear && Math.abs(year - releaseYear) > 1) return false;
        return [x.title, x.name, x.original_title, x.original_name].some(n => matchNames.has(fold(n)));
      });
      if (candidates.length) {
        candidates.sort((a, b) => {
          const ya = Number(String(a.release_date || a.first_air_date || '').slice(0, 4));
          const yb = Number(String(b.release_date || b.first_air_date || '').slice(0, 4));
          return (Math.abs(year - ya) || 0) - (Math.abs(year - yb) || 0);
        });
        return Number(candidates[0].id);
      }
    }
    throw new Error('TMDBの作品IDを特定できません（誤作品への紐付けを防止）');
  }
  function castPeople(payload, kind) {
    const raw = kind === 'episode'
      ? [...(payload.cast || []), ...(payload.guest_stars || [])]
      : (payload.cast || []);
    const seen = new Set(), result = [];
    for (const p of raw) {
      const id = Number(p.id) || 0, name = String(p.name || p.original_name || '').trim();
      if (!name || (id && seen.has(id))) continue;
      if (id) seen.add(id);
      const role = String(p.character || p.roles?.[0]?.character || '').trim();
      const originalName = String(p.original_name || '').trim();
      result.push({id, name, originalName: originalName !== name ? originalName : '',
        role, order: Number(p.order) || 0});
      if (result.length >= LIMIT) break;
    }
    return result;
  }
  function updateSearch() {
    if (document.getElementById('searchRank')?.value.trim()) renderRank();
    if (document.getElementById('searchClassify')?.value.trim()) renderClassify();
    window.__movie30AutoComplete92?.refresh?.();
  }
  function updateCounts() {
    const status = document.getElementById('movieCastStatus');
    if (!status || bulkRunning) return;
    status.textContent = '出演者データ取得済み：' + casts.size + '/' + allFilms().length + '作品。取得済みデータはこの端末のIndexedDBに保存します。';
  }
  async function retrieve(f, force = false) {
    if (!f) throw new Error('作品が見つかりません');
    await ready;
    if (!force && casts.has(f.id)) return casts.get(f.id);
    if (pending.has(f.id)) return pending.get(f.id);
    if (!getTmdbCredential()) throw new Error('「追加・保存」でTMDB APIキーを設定してください');
    const promise = (async () => {
      const m = state.letterboxdMeta?.[f.id] || {};
      const info = titleInfo(f), kind = filmKind(f, m);
      let id = Number((kind === 'movie'
        ? (info.tmdbId || m.poster84?.tmdbId || f.tmdbId)
        : (m.tmdbSeriesId || info.tmdbId || m.poster84?.tmdbId)) || 0);
      if (!id) id = await lookupId(f, kind);
      let path;
      if (kind === 'episode' && m.seasonNumber != null && m.episodeNumber != null)
        path = '/tv/' + id + '/season/' + m.seasonNumber + '/episode/' + m.episodeNumber + '/credits';
      else if (kind !== 'movie') path = '/tv/' + id + '/aggregate_credits';
      else path = '/movie/' + id + '/credits';
      const credits = await tmdbFetch(path, {language: 'ja-JP'});
      const entry = {filmId: f.id, tmdbType: kind, tmdbId: id,
        cast: castPeople(credits, kind), fetchedAt: new Date().toISOString()};
      const saved = await persist(entry);
      if (!saved) throw new Error('出演者情報をIndexedDBに保存できません。既存の映画データは変更していません');
      casts.set(f.id, entry);
      if (!bulkRunning) { updateSearch(); updateCounts(); }
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
  sheet?.insertBefore(sheetPanel, document.getElementById('closeSheet'));
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
    if (f && !casts.has(id) && getTmdbCredential()) {
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
    '<div class="movie-cast-status" id="movieCastStatus" role="status"></div>';
  document.getElementById('tmdbCredential')?.closest('.panel')?.after(panel);
  const runButton = document.getElementById('movieCastBulk');
  const retryButton = document.getElementById('movieCastRetry');
  async function runBulk() {
    if (bulkRunning) { stopBulk = true; if (runButton) runButton.textContent = '停止しています…'; return; }
    if (!getTmdbCredential()) { document.getElementById('movieCastStatus').textContent = 'まずTMDB APIキーを設定してください。'; return; }
    await ready;
    bulkRunning = true; stopBulk = false;
    if (runButton) runButton.textContent = '一時停止';
    if (retryButton) retryButton.disabled = true;
    const films = allFilms().filter(f => !casts.has(f.id));
    let done = 0, ok = 0, failed = 0, errorsInARow = 0;
    const failures = [];
    try {
      for (const f of films) {
        if (stopBulk) break;
        try {
          await retrieve(f);
          ok++; errorsInARow = 0;
        } catch (error) {
          failed++; errorsInARow++;
          failures.push(displayTitle(f) + ': ' + String(error.message || error));
        }
        done++;
        if (done % 10 === 0) updateSearch();
        const status = document.getElementById('movieCastStatus');
        if (status && (done % 3 === 0 || done === films.length || errorsInARow >= 4))
          status.textContent = '取得 ' + done + '/' + films.length + ' · 成功 ' + ok + ' · 失敗 ' + failed +
            (errorsInARow >= 4 ? ' · 連続失敗のため停止' : '') +
            (failures.length ? ' · 直近の失敗: ' + failures[failures.length - 1] : '');
        if (errorsInARow >= 4) break;
        await new Promise(resolve => setTimeout(resolve, 240));
      }
    } finally {
      bulkRunning = false;
      updateSearch();
      if (runButton) runButton.textContent = '全作品の出演者を取得';
      if (retryButton) retryButton.disabled = false;
      const status = document.getElementById('movieCastStatus');
      if (status) status.textContent = '取得済み ' + casts.size + '/' + allFilms().length +
        '作品 · この操作で成功 ' + ok + '件、失敗 ' + failed + '件' +
        (stopBulk ? '（一時停止しました）' : errorsInARow >= 4 ? '（連続失敗で中断）' : '（処理終了）') +
        (failures.length ? ' · 最後のエラー: ' + failures[failures.length - 1] : '');
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
  const ready = loadCache().then(() => {
    updateCounts();
    if (document.documentElement.classList.contains('movie30-ready')) updateSearch();
    else window.__movie30StorageReady?.then(() => {
      if (document.documentElement.classList.contains('movie30-ready')) updateSearch();
    });
  });
  window.__movie30Cast = {ready, namesForFilm, matchesFilm,
    get: filmId => casts.get(filmId), retrieve,
    stats: () => ({cached: casts.size, total: allFilms().length})};
})();
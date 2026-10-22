/* Merge Attack on Titan Final Chapters Special 1/2 into THE LAST ATTACK.
 * Runs after saved-state restoration and before app boot persistence.
 * Also aliases future Letterboxd imports so the two specials do not reappear. */
(() => {
  'use strict';

  const TARGET_TMDB = 1333100;
  const SOURCE_TMDB = new Set([1200954, 1201102]);
  const PLACEHOLDER_NOTES = new Set([
    'the last attackのとこに書いた',
    'the last attack のとこに書いた'
  ]);

  function key(v) {
    return String(v || '').toLowerCase().normalize('NFKC').replace(/[\s・:：\/\\\-_.!?！？'"“”‘’（）()\[\]]+/g, '');
  }
  function tmdbOf(f) {
    if (!f) return 0;
    try { return Number(titleInfo(f)?.tmdbId || f.tmdbId || 0); } catch (_) { return Number(f.tmdbId || 0); }
  }
  function isTargetFilm(f) {
    return tmdbOf(f) === TARGET_TMDB || key(f?.title).includes('thelastattack') || key(f?.englishTitle).includes('thelastattack') || key(f?.lbTitle).includes('thelastattack');
  }
  function isSourceFilm(f) {
    const id = tmdbOf(f);
    if (SOURCE_TMDB.has(id)) return true;
    const t = [f?.title, f?.englishTitle, f?.lbTitle].map(key).join(' ');
    return t.includes('attackontitanthefinalchaptersspecial1') ||
      t.includes('attackontitanthefinalchaptersspecial2') ||
      t.includes('進撃の巨人thefinalseason完結編前編') ||
      t.includes('進撃の巨人thefinalseason完結編後編');
  }
  function isSourceMeta(meta) {
    const id = Number(meta?.tmdbId || 0);
    if (SOURCE_TMDB.has(id)) return true;
    const t = [meta?.title, meta?.originalTitle, meta?.englishTitle].map(key).join(' ');
    return t.includes('attackontitanthefinalchaptersspecial1') ||
      t.includes('attackontitanthefinalchaptersspecial2') ||
      t.includes('進撃の巨人thefinalseason完結編前編') ||
      t.includes('進撃の巨人thefinalseason完結編後編');
  }
  function targetFilm() {
    try { return allFilms().find(isTargetFilm) || null; } catch (_) { return null; }
  }
  function meaningfulText(v) {
    const raw = String(v || '').trim();
    if (!raw) return '';
    if (PLACEHOLDER_NOTES.has(raw.toLowerCase().replace(/\s+/g, ' '))) return '';
    return raw;
  }
  function mergeText(primary, extras) {
    const base = meaningfulText(primary);
    const add = [...new Set((extras || []).map(meaningfulText).filter(Boolean).filter(x => x !== base))];
    return [base, ...add].filter(Boolean).join('\n\n');
  }
  function historyKey(h) {
    return [h?.date || '', !!h?.rewatch, !!h?.retroactive].join('|');
  }

  function mergeSavedState() {
    if (window.__movie30RecoveryBlocked || !state || !Array.isArray(state.customFilms)) return false;
    const target = state.customFilms.find(isTargetFilm);
    const sources = state.customFilms.filter(isSourceFilm);
    if (!target || !sources.length) return false;

    const targetId = target.id;
    const sourceIds = sources.map(f => f.id);
    const sourceSet = new Set(sourceIds);
    const sourceMeta = sourceIds.map(id => state.letterboxdMeta?.[id] || {});

    const score = state.exactScores?.[targetId] ?? sourceIds.map(id => state.exactScores?.[id]).find(v => v != null);
    if (score != null) state.exactScores[targetId] = score;

    const star = state.starOverrides?.[targetId] ?? sourceIds.map(id => state.starOverrides?.[id]).find(v => v != null) ?? target.star;
    if (star != null) {
      state.starOverrides[targetId] = star;
      target.star = star;
    }

    if (state.assignments?.[targetId] == null) {
      const v = sourceIds.map(id => state.assignments?.[id]).find(v => v != null);
      if (v != null) state.assignments[targetId] = v;
    }

    for (const field of ['categoryOverrides', 'mediaTypeOverrides', 'originOverrides', 'formatOverrides', 'runtimeOverrides']) {
      if (state[field]?.[targetId] == null) {
        const v = sourceIds.map(id => state[field]?.[id]).find(v => v != null);
        if (v != null) {
          state[field] ||= {};
          state[field][targetId] = v;
        }
      }
    }

    if (!Array.isArray(state.genreOverrides?.[targetId]) || !state.genreOverrides[targetId].length) {
      const v = sourceIds.map(id => state.genreOverrides?.[id]).find(v => Array.isArray(v) && v.length);
      if (v) {
        state.genreOverrides ||= {};
        state.genreOverrides[targetId] = [...v];
      }
    }

    state.letterboxdMeta ||= {};
    const tm = state.letterboxdMeta[targetId] ||= {};
    tm.note = mergeText(tm.note, sourceMeta.map(m => m.note));
    tm.review = mergeText(tm.review, sourceMeta.map(m => m.review));
    tm.watchedFlag = !!(tm.watchedFlag || sourceMeta.some(m => m.watchedFlag));

    for (const field of ['addedDate', 'reportedWatchedDate', 'watchedAddedDate']) {
      if (!tm[field]) tm[field] = sourceMeta.map(m => m[field]).filter(Boolean).sort()[0] || tm[field];
    }
    for (const field of ['crew84', 'poster84']) {
      if (!tm[field]) tm[field] = sourceMeta.map(m => m[field]).find(Boolean) || tm[field];
    }

    const histories = [...(tm.watchHistory || [])];
    const seenHistory = new Set(histories.map(historyKey));
    for (const m of sourceMeta) {
      for (const h of (m.watchHistory || [])) {
        const hk = historyKey(h);
        if (!seenHistory.has(hk)) {
          histories.push(h);
          seenHistory.add(hk);
        }
      }
    }
    tm.watchHistory = histories;

    const involved = new Set([targetId, ...sourceIds]);
    let placed = false;
    for (const [band, order0] of Object.entries(state.rankOrder || {})) {
      const order = order0 || [];
      const positions = order.map((id, i) => involved.has(id) ? i : -1).filter(i => i >= 0);
      const cleaned = order.filter(id => !involved.has(id));
      if (String(score) === String(band) && positions.length) {
        cleaned.splice(Math.min(...positions), 0, targetId);
        placed = true;
      }
      state.rankOrder[band] = cleaned;
    }
    if (score != null && !placed) (state.rankOrder[String(score)] ||= []).push(targetId);

    state.customFilms = state.customFilms.filter(f => !sourceSet.has(f.id));
    for (const field of ['assignments', 'starOverrides', 'exactScores', 'titleOverrides', 'categoryOverrides', 'mediaTypeOverrides', 'genreOverrides', 'originOverrides', 'formatOverrides', 'runtimeOverrides', 'letterboxdMeta']) {
      if (!state[field] || typeof state[field] !== 'object') continue;
      for (const id of sourceIds) delete state[field][id];
    }

    delete state.storageIntegrity;
    state.updatedAt = Math.max(Date.now(), Number(state.updatedAt || 0) + 1);
    window.__movie30LastAttackMerge = { targetId, removedIds: sourceIds, at: new Date().toISOString() };
    console.info('THE LAST ATTACK merged', window.__movie30LastAttackMerge);
    return true;
  }

  const originalFindExistingFilm = findExistingFilm;
  findExistingFilm = function(meta) {
    if (isSourceMeta(meta)) {
      const target = targetFilm();
      if (target) return target;
    }
    return originalFindExistingFilm(meta);
  };

  const originalLooksDuplicate = looksDuplicate;
  looksDuplicate = function(meta) {
    if (isSourceMeta(meta) && targetFilm()) return true;
    return originalLooksDuplicate(meta);
  };

  window.__movie30StorageReady = Promise.resolve(window.__movie30StorageReady).then(ok => {
    if (ok === false) return false;
    try { mergeSavedState(); }
    catch (error) { console.error('THE LAST ATTACK merge failed; original state kept', error); }
    return ok;
  });
})();

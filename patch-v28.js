(() => {
  // v28: make all genre toggles use one persistence path, and bridge the actual v23 GitHub token key to v26.
  const ALL_EXTRA_V28 = new Set([
    '青春・若者','子供向け','差別・人権','精神・哲学','社会問題・生活',
    'スポーツ','胸糞','感動','切ない','どんでん返し'
  ]);

  // v23 saved the PAT under this key. v26 accidentally looked under a different key.
  // Mirror it locally so v26's server-verified Letterboxd path is actually used.
  try {
    const real = localStorage.getItem('movie30_github_sync_token_v1') || '';
    const mistaken = localStorage.getItem('movie30_gpt_sync_token_v1') || '';
    if (real && !mistaken) localStorage.setItem('movie30_gpt_sync_token_v1', real);
  } catch (_) {}

  function rawGenresV28(f){
    const g = state.genreOverrides?.[f.id];
    return Array.isArray(g) ? [...new Set(g.filter(Boolean))] : [];
  }
  function genreNameV28(b){
    return b?.dataset?.genre || b?.dataset?.structValue || (b?.textContent||'').trim();
  }
  function isGenreButtonV28(b){
    if (!b) return false;
    if (b.classList.contains('genre-chip')) return true;
    return b.classList.contains('struct-chip') && b.dataset.multi === '1';
  }
  function normalizeEditGenreHandlersV28(f){
    const wrap = document.getElementById('editGenrePicker');
    if (!wrap || !f) return;
    const selected = new Set(rawGenresV28(f));
    const buttons = [...wrap.querySelectorAll('.genre-chip, .struct-chip[data-multi="1"]')]
      .filter(isGenreButtonV28);
    for (const b of buttons){
      const g = genreNameV28(b);
      if (!g) continue;
      b.classList.toggle('on', selected.has(g));
      b.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const now = new Set(rawGenresV28(f));
        if (now.has(g)) now.delete(g); else now.add(g);
        state.genreOverrides[f.id] = [...now];
        b.classList.toggle('on', now.has(g));
        save();
      };
    }
  }

  const openSheetV27 = openSheet;
  openSheet = function(id){
    openSheetV27(id);
    const f = filmById(id);
    if (!f) return;
    // Run after every older openSheet wrapper has finished rebinding its buttons.
    normalizeEditGenreHandlersV28(f);
  };

  // Guard against an older handler rewriting only the original genre whitelist.
  // If the picker is rebuilt while the sheet is open, rebind the unified handlers again.
  const editWrap = document.getElementById('editGenrePicker');
  if (editWrap) {
    new MutationObserver(() => {
      const f = filmById(selectedId);
      if (f) normalizeEditGenreHandlersV28(f);
    }).observe(editWrap, {childList:true, subtree:true});
  }

  // Make the sync status explicit if the correct GitHub token is present.
  const syncBtn = document.getElementById('syncLetterboxd');
  const panel = syncBtn?.closest('.panel');
  if (panel) {
    const tip = panel.querySelector('.tip');
    try {
      if (tip && localStorage.getItem('movie30_github_sync_token_v1')) {
        tip.textContent = '「今すぐ同期」でGitHubサーバーからLetterboxd RSSを実取得します。完了まで通常10〜60秒ほどかかり、取得件数と最新作品を表示します。';
      }
    } catch (_) {}
  }
})();

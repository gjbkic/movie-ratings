(() => {
  const SERIES_VALUE = "series";
  const SERIES_LABEL = "ドラマ・シリーズ";

  function mediaTypeOf(f){ return String((state.mediaTypeOverrides || {})[f.id] || f.mediaType || "movie"); }
  function mediaLabelV15(f){
    const t = mediaTypeOf(f);
    return t === "series" ? SERIES_LABEL : t === "documentary" ? "ドキュメンタリー" : t === "other" ? "その他" : "映画";
  }

  for (const id of ["newMediaType","qMediaType","editMediaType"]) {
    const s = document.getElementById(id);
    if (s && ![...s.options].some(o => o.value === SERIES_VALUE)) {
      const o = document.createElement("option");
      o.value = SERIES_VALUE;
      o.textContent = SERIES_LABEL;
      s.insertBefore(o, [...s.options].find(x => x.value === "documentary") || null);
    }
  }

  const obviousSeries = new Set([
    "イカゲーム",
    "チェルノブイリ",
    "新世紀エヴァンゲリオン",
    "SPEC",
    "The Decagon House Murders"
  ]);
  for (const f of allFilms()) {
    if (!state.mediaTypeOverrides[f.id] && obviousSeries.has(displayTitle(f))) {
      state.mediaTypeOverrides[f.id] = SERIES_VALUE;
    }
  }
  save(false);

  function fixSeriesPills(){
    document.querySelectorAll(".rank-card").forEach(card => {
      const id = decodeURIComponent(card.dataset.id || "");
      const f = filmById(id);
      if (!f || mediaTypeOf(f) !== SERIES_VALUE) return;
      const meta = card.querySelector(".rank-meta");
      if (!meta) return;
      meta.querySelectorAll(".media-pill").forEach(x => x.remove());
      meta.insertAdjacentHTML("afterbegin", `<span class="media-pill">${SERIES_LABEL}</span>`);
    });
  }

  function fixSheetMedia(){
    const f = filmById(selectedId);
    if (!f) return;
    const s = document.getElementById("editMediaType");
    if (s) s.value = mediaTypeOf(f);
    const meta = document.getElementById("sheetMeta");
    if (meta) meta.textContent = `${f.year||""}${mediaTypeOf(f)!=="movie"?" · "+mediaLabelV15(f):""}${filmCategory(f)?" · "+filmCategory(f):""}`;
  }

  const renderRankV14 = renderRank;
  renderRank = function(){ renderRankV14(); fixSeriesPills(); };
  const openSheetV14 = openSheet;
  openSheet = function(id){ openSheetV14(id); fixSheetMedia(); };
  const editMedia = document.getElementById("editMediaType");
  if (editMedia) editMedia.addEventListener("change", () => setTimeout(fixSheetMedia, 0));

  function closestScoreList(x, y){
    const hiddenGhost = dragCtx?.ghost;
    if (hiddenGhost) hiddenGhost.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (hiddenGhost) hiddenGhost.style.display = "";
    const direct = el?.closest?.(".score-list");
    if (direct) return direct;
    let best = null, bestD = Infinity;
    for (const list of document.querySelectorAll(".score-list")) {
      const r = list.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = dy * 3 + dx;
      if (d < bestD) { bestD = d; best = list; }
    }
    return best;
  }

  function placeAtNearest(e){
    if (!dragCtx) return null;
    const list = closestScoreList(e.clientX, e.clientY);
    if (!list) return null;
    document.querySelectorAll(".drop-hot").forEach(x => x.classList.remove("drop-hot"));
    list.classList.add("drop-hot");
    const card = dragCtx.card;
    const others = [...list.querySelectorAll(".rank-card")].filter(c => c !== card);
    if (!others.length) { list.appendChild(card); return list; }
    let nearest = others[0], best = Infinity;
    for (const c of others) {
      const r = c.getBoundingClientRect(), cy = r.top + r.height / 2;
      const d = Math.abs(e.clientY - cy);
      if (d < best) { best = d; nearest = c; }
    }
    const r = nearest.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) list.insertBefore(card, nearest);
    else list.insertBefore(card, nearest.nextSibling);
    return list;
  }

  moveDrag = function(e){
    if (!dragCtx) return;
    e.preventDefault();
    moveGhost(e);
    const topEdge = (document.querySelector(".top")?.getBoundingClientRect().bottom || 90) + 24;
    if (e.clientY < topEdge) window.scrollBy(0,-12);
    else if (e.clientY > window.innerHeight-70) window.scrollBy(0,12);
    placeAtNearest(e);
  };

  endDrag = function(e){
    if (!dragCtx) return;
    try { e?.preventDefault?.(); } catch(_) {}
    placeAtNearest(e);
    const ctx = dragCtx;
    dragCtx = null;
    const list = ctx.card?.closest(".score-list");
    const newScore = Number(list?.dataset.score ?? ctx.fromScore);
    const f = filmById(ctx.id);
    if (f) {
      state.exactScores[f.id] = newScore;
      const newStar = scoreToStar(newScore);
      state.starOverrides[f.id] = newStar;
      state.assignments[f.id] = nearestTier(newStar,newScore);
    }
    document.querySelectorAll(".score-list").forEach(l => {
      const score = l.dataset.score;
      state.rankOrder[score] = [...l.querySelectorAll(".rank-card")].map(c => decodeURIComponent(c.dataset.id));
    });
    finishDragUi(ctx);
    save();
    render();
    toast(newScore===ctx.fromScore ? "同点内の順位を保存" : `${newScore}点へ移動`);
  };

  render();
})();

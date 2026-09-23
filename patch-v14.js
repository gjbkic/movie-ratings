(() => {
  const MEDIA_LABELS = { movie: "映画", documentary: "ドキュメンタリー", other: "その他" };
  const MEDIA_OPTIONS = Object.entries(MEDIA_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join("");
  const LB_LAST_SYNC_KEY = "movie30_lb_last_success_v2";

  if (!state.mediaTypeOverrides || typeof state.mediaTypeOverrides !== "object") state.mediaTypeOverrides = {};

  function filmMediaType(f){ return String((state.mediaTypeOverrides || {})[f.id] || f.mediaType || "movie"); }
  function mediaLabel(f){ return MEDIA_LABELS[filmMediaType(f)] || MEDIA_LABELS.movie; }
  function setMediaType(id, type){
    if (!id) return;
    if (!type || type === "movie") delete state.mediaTypeOverrides[id];
    else state.mediaTypeOverrides[id] = type;
    save();
  }

  for (const f of allFilms()) {
    const t = displayTitle(f);
    if (!state.mediaTypeOverrides[f.id] && t === "Miss Americana") state.mediaTypeOverrides[f.id] = "documentary";
    if (!state.mediaTypeOverrides[f.id] && t === "パーフェクトブルー講座") state.mediaTypeOverrides[f.id] = "other";
  }
  save(false);

  const style = document.createElement("style");
  style.textContent = `.media-pill{display:inline-block;margin-right:5px;padding:1px 5px;border:1px solid rgba(255,255,255,.16);border-radius:999px;font-size:8px;color:#aeb8c6;vertical-align:1px}.media-field-label{font-size:10px;color:var(--muted)}@media(min-width:801px){#page-data .formgrid{grid-template-columns:1fr 1fr 1fr 1fr 1fr auto}}`;
  document.head.appendChild(style);

  function makeSelect(id, value="movie"){
    const s = document.createElement("select"); s.className = "field"; s.id = id; s.innerHTML = MEDIA_OPTIONS; s.value = value || "movie"; return s;
  }

  const newCategory = document.getElementById("newCategory");
  if (newCategory && !document.getElementById("newMediaType")) {
    const s = makeSelect("newMediaType"); newCategory.parentNode.insertBefore(s, newCategory);
  }

  const qCategory = document.getElementById("qCategory");
  if (qCategory && !document.getElementById("qMediaType")) {
    const label = document.createElement("label"); label.className = "media-field-label"; label.textContent = "種別";
    const s = makeSelect("qMediaType"); s.style.width = "100%"; label.appendChild(s);
    qCategory.closest("label").parentNode.insertBefore(label, qCategory.closest("label"));
  }

  const editCategory = document.getElementById("editCategory");
  if (editCategory && !document.getElementById("editMediaType")) {
    const label = document.createElement("label"); label.className = "media-field-label"; label.textContent = "種別";
    const s = makeSelect("editMediaType"); s.style.width = "100%"; label.appendChild(s);
    editCategory.closest("label").parentNode.insertBefore(label, editCategory.closest("label"));
  }

  const quickAdd = document.getElementById("quickAdd"); if (quickAdd) quickAdd.textContent = "＋ 作品";
  document.querySelectorAll("#page-data .panel h2").forEach(h => { if (h.textContent.trim() === "映画を追加") h.textContent = "作品を追加"; });
  const addSheetTitle = document.querySelector("#addSheetBg .sheet-title"); if (addSheetTitle) addSheetTitle.textContent = "作品を追加";

  const baseAddFilm = addFilm;
  addFilm = function(title, year, category, star, score, meta={}){
    const f = baseAddFilm(title, year, category, star, score, meta);
    if (f && meta && meta.mediaType && meta.mediaType !== "movie") { state.mediaTypeOverrides[f.id] = meta.mediaType; save(); render(); }
    return f;
  };

  const addBtn = document.getElementById("addMovie");
  if (addBtn) addBtn.onclick = () => {
    const f = addFilm(document.getElementById("newTitle").value,document.getElementById("newYear").value,document.getElementById("newCategory").value,document.getElementById("newStar").value,document.getElementById("newScore").value,{originalTitle:document.getElementById("newOriginalTitle").value,englishTitle:document.getElementById("newEnglishTitle").value,mediaType:document.getElementById("newMediaType")?.value || "movie"});
    if (f) { ["newTitle","newOriginalTitle","newEnglishTitle","newYear","newScore"].forEach(id => document.getElementById(id).value = ""); document.getElementById("newMediaType").value = "movie"; toast("作品を追加しました"); }
  };

  const qAddBtn = document.getElementById("qAdd");
  if (qAddBtn) qAddBtn.onclick = () => {
    const f = addFilm(document.getElementById("qTitle").value,document.getElementById("qYear").value,document.getElementById("qCategory").value,document.getElementById("qStar").value,document.getElementById("qScore").value,{originalTitle:document.getElementById("qOriginalTitle").value,englishTitle:document.getElementById("qEnglishTitle").value,tmdbId:selectedTmdbId,mediaType:document.getElementById("qMediaType")?.value || "movie"});
    if (f) { ["qLookup","qTitle","qOriginalTitle","qEnglishTitle","qYear","qCategory","qScore"].forEach(id => document.getElementById(id).value = ""); if (document.getElementById("qMediaType")) document.getElementById("qMediaType").value = "movie"; selectedTmdbId = null; document.getElementById("addSheetBg").classList.remove("open"); view.page = "rank"; save(); render(); document.getElementById("searchRank").value = displayTitle(f); renderRank(); toast("追加しました。検索で表示中"); }
  };

  function refreshSheetMeta(){
    const f = filmById(selectedId); if (!f) return; const type = filmMediaType(f);
    document.getElementById("sheetMeta").textContent = `${f.year||""}${type!=="movie"?" · "+mediaLabel(f):""}${filmCategory(f)?" · "+filmCategory(f):""}`;
  }

  const baseOpenSheet = openSheet;
  openSheet = function(id){ baseOpenSheet(id); const f = filmById(id); if (!f) return; const s = document.getElementById("editMediaType"); if (s) s.value = filmMediaType(f); refreshSheetMeta(); };
  const editMediaType = document.getElementById("editMediaType"); if (editMediaType) editMediaType.onchange = e => { setMediaType(selectedId, e.target.value); refreshSheetMeta(); render(); };
  if (editCategory) editCategory.addEventListener("change", () => setTimeout(refreshSheetMeta, 0));

  function annotateTypes(){
    document.querySelectorAll(".rank-card").forEach(card => { const id = decodeURIComponent(card.dataset.id || ""); const f = filmById(id); if (!f) return; const meta = card.querySelector(".rank-meta"); if (!meta) return; meta.querySelectorAll(".media-pill").forEach(x => x.remove()); if (filmMediaType(f) !== "movie") meta.insertAdjacentHTML("afterbegin", `<span class="media-pill">${esc(mediaLabel(f))}</span>`); });
  }
  const baseRenderRank = renderRank; renderRank = function(){ baseRenderRank(); annotateTypes(); };

  const baseExportRows = exportRows;
  exportRows = function(){ return baseExportRows().map((row, i) => ({...row, media_type: mediaLabel(allFilms()[i])})); };
  const csvBtn = document.getElementById("downloadCsv");
  if (csvBtn) csvBtn.onclick = () => { const rows = exportRows(), head = ["邦題／表示名","原題","英題","年","種別","星","星内","点数","カテゴリ","追加映画","TMDB ID"]; const csv = [head, ...rows.map(x => [x.title,x.original_title,x.english_title,x.year,x.media_type,x.star,x.tier,x.score,x.category,x.added,x.tmdb_id])].map(r => r.map(csvCell).join(",")).join("\r\n"); download("movie30_scores_v14.csv", "\ufeff"+csv, "text/csv;charset=utf-8"); };

  const baseSyncLetterboxd = syncLetterboxd;
  syncLetterboxd = async function(silent=false){
    if (silent) { try { const last = Number(localStorage.getItem(LB_LAST_SYNC_KEY) || 0); if (last && Date.now() - last < 6*60*60*1000) return; } catch(_) {} }
    await baseSyncLetterboxd(silent);
    const st = document.getElementById("lbStatus");
    if (!st || !st.classList.contains("bad")) { try { localStorage.setItem(LB_LAST_SYNC_KEY, String(Date.now())); } catch(_) {} }
  };

  render();
})();

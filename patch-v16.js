(() => {
  const GENRES = ["SF","アクション","サスペンス","ミステリー","スリラー","ホラー","クライム","ドラマ","コメディ","恋愛","ミュージカル","戦争","歴史","ファンタジー","アドベンチャー","アニメ"];

  if (!state.genreOverrides || typeof state.genreOverrides !== "object") state.genreOverrides = {};

  const titleFixes = new Map([
    ["The Decagon House Murders", "十角館の殺人"],
    ["99.9 Criminal Lawyer: The Movie", "99.9-刑事専門弁護士-THE MOVIE"],
    ["Kaiji: Final Game", "カイジ ファイナルゲーム"],
    ["Kaiji 2: The Ultimate Gambler", "カイジ2 人生奪回ゲーム"],
    ["Kaiji: The Ultimate Gambler", "カイジ 人生逆転ゲーム"],
    ["Bayside Shakedown 3: Set the Guys Loose", "踊る大捜査線 THE MOVIE3 ヤツらを解放せよ!"],
    ["Bayside Shakedown 2", "踊る大捜査線 THE MOVIE 2 レインボーブリッジを封鎖せよ!"],
    ["Bayside Shakedown", "踊る大捜査線 THE MOVIE"],
    ["Doraemon: Nobita's Great Adventure in the World of Magic", "ドラえもん のび太の魔界大冒険"]
  ]);
  for (const f of allFilms()) {
    const cur = displayTitle(f);
    const fixed = titleFixes.get(cur);
    if (fixed && cur !== fixed) state.titleOverrides[f.id] = { ...(state.titleOverrides[f.id] || {}), title: fixed };
    if ((cur === "Hero" || cur === "HERO") && (String(f.year) === "2007" || String(f.year) === "2015")) state.titleOverrides[f.id] = { ...(state.titleOverrides[f.id] || {}), title: "HERO" };
  }

  function legacyGenres(f){
    const c = String(filmCategory(f) || "").trim();
    const map = {
      "SF":["SF"], "アクション":["アクション"], "ドラマ":["ドラマ"], "コメディ":["コメディ"],
      "サスペンス、ミステリー":["サスペンス","ミステリー"],
      "スリラー、ホラー":["スリラー","ホラー"],
      "マフィア、クライム":["クライム"],
      "恋愛、ミュージカル":["恋愛","ミュージカル"],
      "戦争、歴史":["戦争","歴史"],
      "ファンタジー、アドベンチャー":["ファンタジー","アドベンチャー"],
      "ほかアニメ":["アニメ"], "スタジオジブリ系作品":["アニメ"], "ピクサー・ディズニー作品":["アニメ"], "コナン映画":["アニメ","ミステリー"],
      "MCU作品":["アクション","SF"], "スパイダーマン作品":["アクション","SF"],
      "スターウォーズシリーズ":["SF","ファンタジー","アドベンチャー"], "ハリーポッター シリーズ":["ファンタジー","アドベンチャー"]
    };
    return map[c] ? [...map[c]] : (GENRES.includes(c) ? [c] : []);
  }
  function filmGenres(f){
    const g = state.genreOverrides[f.id];
    if (Array.isArray(g)) return g.filter(x => GENRES.includes(x));
    return legacyGenres(f);
  }
  function setGenres(id, arr){
    const clean = [...new Set((arr || []).filter(x => GENRES.includes(x)))];
    state.genreOverrides[id] = clean;
    save();
  }
  function genreText(f){ return filmGenres(f).join("・"); }

  // Seed only movies that have no explicit genre override; rankOrder and scores are untouched.
  for (const f of allFilms()) if (!Object.prototype.hasOwnProperty.call(state.genreOverrides, f.id)) state.genreOverrides[f.id] = legacyGenres(f);
  save(false);

  const style = document.createElement("style");
  style.textContent = `
    .genre-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
    .genre-chip{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:999px;padding:6px 9px;font-size:11px}
    .genre-chip.on{border-color:var(--accent);color:#fff;box-shadow:0 0 0 1px var(--accent) inset}
    .genre-filter{min-width:145px}
    .genre-line{font-size:9px;color:#aeb8c6;margin-top:3px;line-height:1.35}
  `;
  document.head.appendChild(style);

  function pickerHtml(selected=[]){
    const s = new Set(selected);
    return `<div class="genre-picker">${GENRES.map(g=>`<button type="button" class="genre-chip${s.has(g)?" on":""}" data-genre="${esc(g)}">${esc(g)}</button>`).join("")}</div>`;
  }
  function attachPicker(container, initial=[], onChange=()=>{}){
    container.innerHTML = pickerHtml(initial);
    const selected = new Set(initial);
    container.querySelectorAll("[data-genre]").forEach(b => b.onclick = () => {
      const g = b.dataset.genre;
      if (selected.has(g)) selected.delete(g); else selected.add(g);
      b.classList.toggle("on", selected.has(g));
      onChange([...selected]);
    });
    return selected;
  }

  function insertPickerAfter(el, id, initial=[], onChange=()=>{}){
    if (!el || document.getElementById(id)) return null;
    const wrap = document.createElement("div"); wrap.id = id;
    el.insertAdjacentElement("afterend", wrap);
    attachPicker(wrap, initial, onChange);
    return wrap;
  }

  // Add/edit forms: keep legacy category for series/franchise metadata, but add true multi-genre selection.
  let newGenres = [];
  const newCat = document.getElementById("newCategory");
  if (newCat) {
    const lbl = document.createElement("div"); lbl.className="tip"; lbl.textContent="ジャンル（複数選択可）";
    newCat.closest(".formgrid")?.insertAdjacentElement("afterend", lbl);
    const wrap = document.createElement("div"); wrap.id="newGenrePicker"; lbl.insertAdjacentElement("afterend", wrap);
    attachPicker(wrap, [], a => newGenres = a);
  }
  let qGenres = [];
  const qGrid = document.querySelector("#addSheetBg .sheetgrid");
  if (qGrid) {
    const lbl = document.createElement("div"); lbl.className="tip"; lbl.textContent="ジャンル（複数選択可）"; qGrid.insertAdjacentElement("afterend", lbl);
    const wrap = document.createElement("div"); wrap.id="qGenrePicker"; lbl.insertAdjacentElement("afterend", wrap);
    attachPicker(wrap, [], a => qGenres = a);
  }
  const editGrid = document.querySelector("#sheetBg .sheetgrid");
  if (editGrid) {
    const lbl = document.createElement("div"); lbl.className="tip"; lbl.textContent="ジャンル（複数選択可）"; editGrid.insertAdjacentElement("afterend", lbl);
    const wrap = document.createElement("div"); wrap.id="editGenrePicker"; lbl.insertAdjacentElement("afterend", wrap);
  }

  const prevOpenSheet = openSheet;
  openSheet = function(id){
    prevOpenSheet(id);
    const f = filmById(id); if (!f) return;
    const wrap = document.getElementById("editGenrePicker");
    if (wrap) attachPicker(wrap, filmGenres(f), a => { setGenres(f.id,a); render(); });
  };

  const prevAdd = addFilm;
  addFilm = function(title, year, category, star, score, meta={}){
    const f = prevAdd(title, year, category, star, score, meta);
    if (f) {
      const gs = Array.isArray(meta.genres) ? meta.genres : [];
      if (gs.length) state.genreOverrides[f.id] = [...new Set(gs.filter(x=>GENRES.includes(x)))];
      save();
    }
    return f;
  };

  const addBtn = document.getElementById("addMovie");
  if (addBtn) addBtn.onclick = () => {
    const f = addFilm(document.getElementById("newTitle").value,document.getElementById("newYear").value,document.getElementById("newCategory").value,document.getElementById("newStar").value,document.getElementById("newScore").value,{originalTitle:document.getElementById("newOriginalTitle").value,englishTitle:document.getElementById("newEnglishTitle").value,mediaType:document.getElementById("newMediaType")?.value||"movie",genres:newGenres});
    if(f){["newTitle","newOriginalTitle","newEnglishTitle","newYear","newScore"].forEach(id=>document.getElementById(id).value="");newGenres=[];const w=document.getElementById("newGenrePicker");if(w)attachPicker(w,[],a=>newGenres=a);toast("作品を追加しました")}
  };
  const qAdd = document.getElementById("qAdd");
  if (qAdd) qAdd.onclick = () => {
    const f=addFilm(document.getElementById("qTitle").value,document.getElementById("qYear").value,document.getElementById("qCategory").value,document.getElementById("qStar").value,document.getElementById("qScore").value,{originalTitle:document.getElementById("qOriginalTitle").value,englishTitle:document.getElementById("qEnglishTitle").value,tmdbId:selectedTmdbId,mediaType:document.getElementById("qMediaType")?.value||"movie",genres:qGenres});
    if(f){["qLookup","qTitle","qOriginalTitle","qEnglishTitle","qYear","qCategory","qScore"].forEach(id=>document.getElementById(id).value="");qGenres=[];const w=document.getElementById("qGenrePicker");if(w)attachPicker(w,[],a=>qGenres=a);selectedTmdbId=null;document.getElementById("addSheetBg").classList.remove("open");view.page="rank";save();render();document.getElementById("searchRank").value=displayTitle(f);renderRank();toast("追加しました。検索で表示中")}
  };

  function replaceFilter(oldId,newId){
    const old=document.getElementById(oldId); if(!old) return null;
    const s=document.createElement("select"); s.id=newId; s.className="field genre-filter";
    s.innerHTML='<option value="">すべてのジャンル</option>'+GENRES.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("");
    old.replaceWith(s); return s;
  }
  const rankGenre = replaceFilter("categoryFilterRank","genreFilterRank");
  const classGenre = replaceFilter("categoryFilterClassify","genreFilterClassify");

  const oldMatch = match;
  match = function(f,q){ if(oldMatch(f,q)) return true; if(!q) return true; return filmGenres(f).join(" ").toLowerCase().includes(String(q).toLowerCase()); };

  function filterByGenre(f, id){ const v=document.getElementById(id)?.value||""; return !v || filmGenres(f).includes(v); }

  // Re-render ranking with genre-aware filtering, preserving the original ranking/order logic.
  const baseRenderRank = renderRank;
  renderRank = function(){
    const old = document.getElementById("genreFilterRank")?.value || "";
    baseRenderRank();
    if (old) {
      document.querySelectorAll(".rank-card").forEach(card=>{const f=filmById(decodeURIComponent(card.dataset.id||""));if(f&&!filmGenres(f).includes(old))card.remove()});
      document.querySelectorAll(".score-bin").forEach(bin=>{const list=bin.querySelector(".score-list");if(list&&!list.querySelector(".rank-card"))bin.style.display="none"});
      document.querySelectorAll(".rank-star").forEach(sec=>{if(!sec.querySelector('.rank-card'))sec.style.display='none'});
    }
    document.querySelectorAll(".rank-card").forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||"")); if(!f) return;
      const meta=card.querySelector(".rank-meta"); if(!meta) return;
      const typePill=meta.querySelector(".media-pill")?.outerHTML||"";
      meta.innerHTML=typePill+esc(f.year||"")+(filmGenres(f).length?`<div class="genre-line">${esc(genreText(f))}</div>`:"");
    });
  };

  const baseRenderClassify = renderClassify;
  renderClassify = function(){
    baseRenderClassify();
    const g=document.getElementById("genreFilterClassify")?.value||"";
    if(g){document.querySelectorAll("#classifyRoot .card").forEach(card=>{const f=filmById(decodeURIComponent(card.dataset.id||""));if(f&&!filmGenres(f).includes(g))card.remove()});document.querySelectorAll("#classifyRoot .section").forEach(sec=>{if(!sec.querySelector('.card'))sec.style.display='none'})}
  };
  if(rankGenre) rankGenre.onchange=renderRank;
  if(classGenre) classGenre.onchange=renderClassify;

  // CSV now exports true multi-genres without changing ranking data.
  const prevExportRows = exportRows;
  exportRows = function(){ return prevExportRows().map((r,i)=>({...r,genres:filmGenres(allFilms()[i]).join("|")})); };
  const csvBtn=document.getElementById("downloadCsv");
  if(csvBtn) csvBtn.onclick=()=>{const rows=exportRows(),head=["邦題／表示名","原題","英題","年","種別","ジャンル","星","星内","点数","カテゴリ","追加映画","TMDB ID"];const csv=[head,...rows.map(x=>[x.title,x.original_title,x.english_title,x.year,x.media_type,x.genres,x.star,x.tier,x.score,x.category,x.added,x.tmdb_id])].map(r=>r.map(csvCell).join(",")).join("\r\n");download("movie30_scores_v16.csv","\ufeff"+csv,"text/csv;charset=utf-8")};

  render();
})();

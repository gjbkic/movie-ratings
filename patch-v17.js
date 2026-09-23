(() => {
  const EXTRA_GENRES = ["シリーズ劇場版","ヒーロー"];
  const RENAMED_GENRES = {"テレビ映画":"シリーズ劇場版","ヒーロー映画":"ヒーロー"};

  function rawGenres(f){
    const g = state.genreOverrides?.[f.id];
    return Array.isArray(g) ? [...new Set(g)] : [];
  }
  function setRawGenres(id, genres){
    state.genreOverrides[id] = [...new Set((genres || []).filter(Boolean))];
    save();
  }

  // Migrate any already-saved selections from the old labels.
  if (state.genreOverrides && typeof state.genreOverrides === "object") {
    for (const id of Object.keys(state.genreOverrides)) {
      const g = state.genreOverrides[id];
      if (!Array.isArray(g)) continue;
      state.genreOverrides[id] = [...new Set(g.map(x => RENAMED_GENRES[x] || x))];
    }
    save(false);
  }

  function selectedFromPicker(id){
    const el = document.getElementById(id);
    if (!el) return [];
    return [...el.querySelectorAll('.genre-chip.on')].map(b => b.dataset.genre || b.textContent.trim()).filter(Boolean);
  }
  function appendExtraChips(id, selected=[]){
    const wrap = document.getElementById(id);
    if (!wrap) return;
    let picker = wrap.querySelector('.genre-picker') || wrap;
    const chosen = new Set(selected);
    for (const g of EXTRA_GENRES) {
      if (picker.querySelector(`[data-genre="${g}"]`)) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'genre-chip' + (chosen.has(g) ? ' on' : ''); b.dataset.genre = g; b.textContent = g;
      b.onclick = () => b.classList.toggle('on');
      picker.appendChild(b);
    }
  }

  appendExtraChips('newGenrePicker');
  appendExtraChips('qGenrePicker');

  // Edit picker: use one unified handler so changing a normal genre never drops the two added genres.
  function refreshEditGenres(){
    const f = filmById(selectedId); if (!f) return;
    const wrap = document.getElementById('editGenrePicker'); if (!wrap) return;
    appendExtraChips('editGenrePicker', rawGenres(f));
    const selected = new Set(rawGenres(f));
    wrap.querySelectorAll('.genre-chip').forEach(b => {
      const g = b.dataset.genre || b.textContent.trim();
      b.classList.toggle('on', selected.has(g));
      b.onclick = () => {
        if (selected.has(g)) selected.delete(g); else selected.add(g);
        b.classList.toggle('on', selected.has(g));
        setRawGenres(f.id, [...selected]);
        render();
      };
    });
  }
  const openSheetV16 = openSheet;
  openSheet = function(id){ openSheetV16(id); refreshEditGenres(); };

  // Add forms: derive genres from the visible chips, including the two added genres.
  const addBtn = document.getElementById('addMovie');
  if (addBtn) addBtn.onclick = () => {
    const picked = selectedFromPicker('newGenrePicker');
    const f = addFilm(document.getElementById('newTitle').value,document.getElementById('newYear').value,document.getElementById('newCategory').value,document.getElementById('newStar').value,document.getElementById('newScore').value,{originalTitle:document.getElementById('newOriginalTitle').value,englishTitle:document.getElementById('newEnglishTitle').value,mediaType:document.getElementById('newMediaType')?.value||'movie',genres:picked});
    if(f){setRawGenres(f.id,picked);['newTitle','newOriginalTitle','newEnglishTitle','newYear','newScore'].forEach(id=>document.getElementById(id).value='');document.querySelectorAll('#newGenrePicker .genre-chip').forEach(b=>b.classList.remove('on'));toast('作品を追加しました');render();}
  };
  const qAdd = document.getElementById('qAdd');
  if (qAdd) qAdd.onclick = () => {
    const picked = selectedFromPicker('qGenrePicker');
    const f=addFilm(document.getElementById('qTitle').value,document.getElementById('qYear').value,document.getElementById('qCategory').value,document.getElementById('qStar').value,document.getElementById('qScore').value,{originalTitle:document.getElementById('qOriginalTitle').value,englishTitle:document.getElementById('qEnglishTitle').value,tmdbId:selectedTmdbId,mediaType:document.getElementById('qMediaType')?.value||'movie',genres:picked});
    if(f){setRawGenres(f.id,picked);['qLookup','qTitle','qOriginalTitle','qEnglishTitle','qYear','qCategory','qScore'].forEach(id=>document.getElementById(id).value='');document.querySelectorAll('#qGenrePicker .genre-chip').forEach(b=>b.classList.remove('on'));selectedTmdbId=null;document.getElementById('addSheetBg').classList.remove('open');view.page='rank';save();render();document.getElementById('searchRank').value=displayTitle(f);renderRank();toast('追加しました。検索で表示中');}
  };

  for (const id of ['genreFilterRank','genreFilterClassify']) {
    const s = document.getElementById(id);
    if (s) for (const g of EXTRA_GENRES) if (![...s.options].some(o=>o.value===g)) s.add(new Option(g,g));
  }

  const matchV16 = match;
  match = function(f,q){
    if (matchV16(f,q)) return true;
    if (!q) return true;
    return rawGenres(f).join(' ').toLowerCase().includes(String(q).toLowerCase());
  };

  function annotateRawGenres(){
    document.querySelectorAll('.rank-card').forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||'')); if(!f) return;
      const meta=card.querySelector('.rank-meta'); if(!meta) return;
      const gs=rawGenres(f);
      let line=meta.querySelector('.genre-line');
      if(gs.length){if(!line){line=document.createElement('div');line.className='genre-line';meta.appendChild(line);}line.textContent=gs.join('・');}
      else if(line) line.remove();
    });
  }
  function applyExtraFilter(rootSelector, cardSelector, sectionSelector, value){
    if (!EXTRA_GENRES.includes(value)) return;
    document.querySelectorAll(`${rootSelector} ${cardSelector}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f && !rawGenres(f).includes(value)) card.remove();
    });
    document.querySelectorAll(`${rootSelector} ${sectionSelector}`).forEach(sec=>{if(!sec.querySelector(cardSelector))sec.style.display='none'});
  }

  const renderRankV16 = renderRank;
  renderRank = function(){
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s && EXTRA_GENRES.includes(v)) s.value='';
    renderRankV16();
    if(s) s.value=v;
    applyExtraFilter('#rankRoot','.rank-card','.rank-star',v);
    if(EXTRA_GENRES.includes(v)) document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none'});
    annotateRawGenres();
  };
  const renderClassifyV16 = renderClassify;
  renderClassify = function(){
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s && EXTRA_GENRES.includes(v)) s.value='';
    renderClassifyV16();
    if(s) s.value=v;
    applyExtraFilter('#classifyRoot','.card','.section',v);
  };
  const rankFilter=document.getElementById('genreFilterRank'); if(rankFilter) rankFilter.onchange=renderRank;
  const classFilter=document.getElementById('genreFilterClassify'); if(classFilter) classFilter.onchange=renderClassify;

  const exportRowsV16 = exportRows;
  exportRows = function(){return exportRowsV16().map((r,i)=>({...r,genres:rawGenres(allFilms()[i]).join('|')}));};

  render();
})();

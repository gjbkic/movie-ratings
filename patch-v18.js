(() => {
  const ORIGIN_GENRES = ["邦画","ハリウッド","その他外国語映画"];
  const ALL_EXTRA = ["シリーズ劇場版","ヒーロー",...ORIGIN_GENRES];

  function rawGenres(f){
    const g = state.genreOverrides?.[f.id];
    return Array.isArray(g) ? [...new Set(g)] : [];
  }
  function setRawGenres(id, genres){
    state.genreOverrides[id] = [...new Set((genres || []).filter(Boolean))];
    save();
  }
  function mediaTypeOf(f){ return String((state.mediaTypeOverrides || {})[f.id] || f.mediaType || "movie"); }
  function mediaLabelOf(f){
    const t=mediaTypeOf(f);
    return t==="series"?"ドラマ・シリーズ":t==="documentary"?"ドキュメンタリー":t==="other"?"その他":"映画";
  }

  // Categories are now legacy-only data. Remove them from every visible editing UI.
  function hideCategoryUi(){
    const n=document.getElementById("newCategory"); if(n) n.style.display="none";
    for(const id of ["qCategory","editCategory"]){
      const el=document.getElementById(id); if(!el) continue;
      const label=el.closest("label"); if(label) label.style.display="none"; else el.style.display="none";
    }
  }
  hideCategoryUi();

  const knownJapanese = /(?:十角館|カイジ|踊る大捜査線|新世紀エヴァンゲリオン|エヴァンゲリオン|パーフェクトブルー|東京ゴッドファーザーズ|君の名は|天気の子|すずめの戸締まり|もののけ姫|千と千尋|風の谷のナウシカ|火垂るの墓|紅の豚|となりのトトロ|魔女の宅急便|ハウルの動く城|天空の城ラピュタ|崖の上のポニョ|耳をすませば|AKIRA|バトル・ロワイアル|七人の侍|羅生門|用心棒|生きる|万引き家族|ドライブ・マイ・カー|ゴジラ|リング|呪怨|告白|悪人|怪物|HERO|SPEC|ドラえもん|名探偵コナン)/i;
  const knownForeign = /(?:パラサイト|オールドボーイ|殺人の追憶|お嬢さん|母なる証明|スノーピアサー|別れる決心|The Guilty|Funny Games|Anatomy of a Fall|Incendies|La Haine|Am[eé]lie|The Lives of Others|Das Leben der Anderen|City of God|Cidade de Deus|Pan's Labyrinth|El laberinto del fauno|The Invisible Guest|Contratiempo)/i;
  function normalized(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  function classifyOrigin(f){
    const x=titleInfo(f), title=displayTitle(f), orig=String(x.originalTitle||"").trim(), eng=String(x.englishTitle||f.lbTitle||"").trim(), cat=String(filmCategory(f)||"");
    if(["邦画","スタジオジブリ系作品","コナン映画"].includes(cat) || knownJapanese.test(title+" "+orig+" "+eng)) return "邦画";
    if(/[\u3040-\u30ff]/.test(orig)) return "邦画";
    if(knownForeign.test(title+" "+orig+" "+eng)) return "その他外国語映画";
    if(/[\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/.test(orig)) return "その他外国語映画";
    if(/[\u4e00-\u9fff]/.test(orig) && !/[\u3040-\u30ff]/.test(orig)) return "その他外国語映画";
    if(orig && eng && normalized(orig)!==normalized(eng)){
      if(/[^\x00-\x7f]/.test(orig) || /\b(?:le|les|la|une|un|des|du|el|los|las|una|uno|der|die|das|ein|eine|il|lo|gli|una|de|da|do|dos|das)\b/i.test(orig)) return "その他外国語映画";
    }
    return "ハリウッド";
  }

  if(!state.originSeeded){
    for(const f of allFilms()){
      const gs=rawGenres(f).filter(g=>!ORIGIN_GENRES.includes(g));
      gs.push(classifyOrigin(f));
      state.genreOverrides[f.id]=[...new Set(gs)];
    }
    state.originSeeded=true;
    save(false);
  }

  function selectedFromPicker(id){
    const el=document.getElementById(id); if(!el) return [];
    return [...el.querySelectorAll('.genre-chip.on')].map(b=>b.dataset.genre||b.textContent.trim()).filter(Boolean);
  }
  function enforceOriginExclusive(wrap, clicked){
    if(!ORIGIN_GENRES.includes(clicked)) return;
    wrap.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();
      if(ORIGIN_GENRES.includes(g) && g!==clicked) b.classList.remove('on');
    });
  }
  function appendOriginChips(id, selected=[]){
    const wrap=document.getElementById(id); if(!wrap) return;
    const picker=wrap.querySelector('.genre-picker')||wrap, chosen=new Set(selected);
    for(const g of ORIGIN_GENRES){
      if(picker.querySelector(`[data-genre="${g}"]`)) continue;
      const b=document.createElement('button');
      b.type='button'; b.className='genre-chip'+(chosen.has(g)?' on':''); b.dataset.genre=g; b.textContent=g;
      b.onclick=()=>{const turningOn=!b.classList.contains('on'); if(turningOn) enforceOriginExclusive(wrap,g); b.classList.toggle('on',turningOn);};
      picker.appendChild(b);
    }
  }
  appendOriginChips('newGenrePicker');
  appendOriginChips('qGenrePicker');

  function refreshEditGenres(){
    const f=filmById(selectedId); if(!f) return;
    const wrap=document.getElementById('editGenrePicker'); if(!wrap) return;
    appendOriginChips('editGenrePicker',rawGenres(f));
    const selected=new Set(rawGenres(f));
    wrap.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();
      b.classList.toggle('on',selected.has(g));
      b.onclick=()=>{
        if(ORIGIN_GENRES.includes(g) && !selected.has(g)){
          for(const x of ORIGIN_GENRES) if(x!==g) selected.delete(x);
        }
        if(selected.has(g)) selected.delete(g); else selected.add(g);
        wrap.querySelectorAll('.genre-chip').forEach(x=>{const k=x.dataset.genre||x.textContent.trim();x.classList.toggle('on',selected.has(k));});
        setRawGenres(f.id,[...selected]);
        render();
      };
    });
    const meta=document.getElementById('sheetMeta');
    if(meta) meta.textContent=`${f.year||""}${mediaTypeOf(f)!=="movie"?" · "+mediaLabelOf(f):""}`;
  }
  const openSheetV17=openSheet;
  openSheet=function(id){openSheetV17(id);hideCategoryUi();refreshEditGenres();};

  // Rebind add buttons so the hidden legacy category is no longer part of the workflow.
  const addBtn=document.getElementById('addMovie');
  if(addBtn) addBtn.onclick=()=>{
    let picked=selectedFromPicker('newGenrePicker');
    if(!picked.some(g=>ORIGIN_GENRES.includes(g))) picked.push('ハリウッド');
    const f=addFilm(document.getElementById('newTitle').value,document.getElementById('newYear').value,'',document.getElementById('newStar').value,document.getElementById('newScore').value,{originalTitle:document.getElementById('newOriginalTitle').value,englishTitle:document.getElementById('newEnglishTitle').value,mediaType:document.getElementById('newMediaType')?.value||'movie',genres:picked});
    if(f){setRawGenres(f.id,picked);['newTitle','newOriginalTitle','newEnglishTitle','newYear','newScore'].forEach(id=>document.getElementById(id).value='');document.querySelectorAll('#newGenrePicker .genre-chip').forEach(b=>b.classList.remove('on'));toast('作品を追加しました');render();}
  };
  const qAdd=document.getElementById('qAdd');
  if(qAdd) qAdd.onclick=()=>{
    let picked=selectedFromPicker('qGenrePicker');
    if(!picked.some(g=>ORIGIN_GENRES.includes(g))) picked.push('ハリウッド');
    const f=addFilm(document.getElementById('qTitle').value,document.getElementById('qYear').value,'',document.getElementById('qStar').value,document.getElementById('qScore').value,{originalTitle:document.getElementById('qOriginalTitle').value,englishTitle:document.getElementById('qEnglishTitle').value,tmdbId:selectedTmdbId,mediaType:document.getElementById('qMediaType')?.value||'movie',genres:picked});
    if(f){setRawGenres(f.id,picked);['qLookup','qTitle','qOriginalTitle','qEnglishTitle','qYear','qScore'].forEach(id=>document.getElementById(id).value='');document.querySelectorAll('#qGenrePicker .genre-chip').forEach(b=>b.classList.remove('on'));selectedTmdbId=null;document.getElementById('addSheetBg').classList.remove('open');view.page='rank';save();render();document.getElementById('searchRank').value=displayTitle(f);renderRank();toast('追加しました。検索で表示中');}
  };

  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id); if(!s) continue;
    for(const g of ORIGIN_GENRES) if(![...s.options].some(o=>o.value===g)) s.add(new Option(g,g));
  }

  // Category is no longer part of search; titles, year and genres are.
  match=function(f,q){
    if(!q) return true;
    q=String(q).toLowerCase();
    const x=titleInfo(f);
    return [x.title,x.originalTitle,x.englishTitle,f.lbTitle||'',f.year||'',rawGenres(f).join(' ')].join(' ').toLowerCase().includes(q);
  };

  function applyOriginFilter(rootSelector,cardSelector,sectionSelector,value){
    if(!ORIGIN_GENRES.includes(value)) return;
    document.querySelectorAll(`${rootSelector} ${cardSelector}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f&&!rawGenres(f).includes(value)) card.remove();
    });
    document.querySelectorAll(`${rootSelector} ${sectionSelector}`).forEach(sec=>{if(!sec.querySelector(cardSelector))sec.style.display='none';});
  }

  const renderRankV17=renderRank;
  renderRank=function(){
    hideCategoryUi();
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s&&ORIGIN_GENRES.includes(v)) s.value='';
    renderRankV17();
    if(s) s.value=v;
    applyOriginFilter('#rankRoot','.rank-card','.rank-star',v);
    if(ORIGIN_GENRES.includes(v)) document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none';});
  };
  const renderClassifyV17=renderClassify;
  renderClassify=function(){
    hideCategoryUi();
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s&&ORIGIN_GENRES.includes(v)) s.value='';
    renderClassifyV17();
    if(s) s.value=v;
    applyOriginFilter('#classifyRoot','.card','.section',v);
  };
  const rf=document.getElementById('genreFilterRank'); if(rf) rf.onchange=renderRank;
  const cf=document.getElementById('genreFilterClassify'); if(cf) cf.onchange=renderClassify;

  // CSV also drops the retired category column.
  const csvBtn=document.getElementById('downloadCsv');
  if(csvBtn) csvBtn.onclick=()=>{
    const rows=exportRows();
    const head=['邦題／表示名','原題','英題','年','種別','ジャンル','星','星内','点数','追加映画','TMDB ID'];
    const csv=[head,...rows.map((x,i)=>[x.title,x.original_title,x.english_title,x.year,x.media_type||mediaLabelOf(allFilms()[i]),rawGenres(allFilms()[i]).join('|'),x.star,x.tier,x.score,x.added,x.tmdb_id])].map(r=>r.map(csvCell).join(',')).join('\r\n');
    download('movie30_scores_v18.csv','\ufeff'+csv,'text/csv;charset=utf-8');
  };

  render();
})();
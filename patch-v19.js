(() => {
  const MEDIA = [["movie","映画"],["documentary","ドキュメンタリー"],["other","その他"]];
  const ORIGINS = ["邦画","ハリウッド","その他外国語映画"];
  const FORMATS = [["live","実写"],["animation","アニメ"]];
  const GENRES19 = ["SF","アクション","サスペンス","ミステリー","スリラー","ホラー","クライム","ドラマ","コメディ","恋愛","ミュージカル","戦争","歴史","ファンタジー","アドベンチャー","シリーズ劇場版","ヒーロー"];
  const ORIGIN_SET = new Set(ORIGINS);

  state.originOverrides = state.originOverrides && typeof state.originOverrides === "object" ? state.originOverrides : {};
  state.formatOverrides = state.formatOverrides && typeof state.formatOverrides === "object" ? state.formatOverrides : {};
  state.runtimeOverrides = state.runtimeOverrides && typeof state.runtimeOverrides === "object" ? state.runtimeOverrides : {};

  const rawGenres = f => Array.isArray(state.genreOverrides?.[f.id]) ? [...new Set(state.genreOverrides[f.id])] : [];
  const setGenres19 = (id, arr) => { state.genreOverrides[id] = [...new Set((arr||[]).filter(g=>GENRES19.includes(g)))]; };
  const mediaType19 = f => {
    const v=String((state.mediaTypeOverrides||{})[f.id] || f.mediaType || "movie");
    return v === "series" ? "other" : (MEDIA.some(x=>x[0]===v) ? v : "movie");
  };
  const mediaLabel19 = f => (MEDIA.find(x=>x[0]===mediaType19(f))||MEDIA[0])[1];
  const origin19 = f => state.originOverrides[f.id] || "ハリウッド";
  const format19 = f => state.formatOverrides[f.id] || "live";
  const formatLabel19 = f => format19(f)==="animation" ? "アニメ" : "実写";
  const runtime19 = f => {
    const v=state.runtimeOverrides[f.id] ?? f.runtime ?? null;
    const n=Number(v); return Number.isFinite(n)&&n>0 ? n : null;
  };

  function classifyOrigin19(f){
    const x=titleInfo(f), title=displayTitle(f), orig=String(x.originalTitle||"").trim(), eng=String(x.englishTitle||f.lbTitle||"").trim(), cat=String(filmCategory(f)||"");
    if(["邦画","スタジオジブリ系作品","コナン映画"].includes(cat)) return "邦画";
    if(/[\u3040-\u30ff]/.test(orig)) return "邦画";
    if(/[\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/.test(orig)) return "その他外国語映画";
    if(/[\u4e00-\u9fff]/.test(orig) && !/[\u3040-\u30ff]/.test(orig)) return "その他外国語映画";
    const blob=(title+" "+orig+" "+eng).toLowerCase();
    if(/(?:十角館|カイジ|踊る大捜査線|エヴァンゲリオン|パーフェクトブルー|東京ゴッドファーザーズ|君の名は|天気の子|すずめの戸締まり|もののけ姫|千と千尋|ナウシカ|火垂るの墓|紅の豚|トトロ|魔女の宅急便|ハウル|ラピュタ|ポニョ|akira|バトル・ロワイアル|七人の侍|羅生門|用心棒|万引き家族|ドライブ・マイ・カー|ゴジラ|リング|呪怨|告白|怪物|hero|spec|ドラえもん|名探偵コナン)/i.test(blob)) return "邦画";
    if(/(?:parasite|oldboy|memories of murder|handmaiden|mother|snowpiercer|decision to leave|guilty|funny games|anatomy of a fall|incendies|la haine|am[eé]lie|lives of others|cidade de deus|city of god|pan's labyrinth|contratiempo)/i.test(blob)) return "その他外国語映画";
    return "ハリウッド";
  }

  if(!state.structuredSeeded){
    for(const f of allFilms()){
      let gs=rawGenres(f);
      const savedOrigin=gs.find(g=>ORIGIN_SET.has(g));
      state.originOverrides[f.id]=state.originOverrides[f.id]||savedOrigin||classifyOrigin19(f);
      state.formatOverrides[f.id]=state.formatOverrides[f.id]||(gs.includes("アニメ")?"animation":"live");
      setGenres19(f.id,gs.filter(g=>!ORIGIN_SET.has(g)&&g!=="アニメ"));
      if((state.mediaTypeOverrides||{})[f.id]==="series") state.mediaTypeOverrides[f.id]="other";
    }
    state.structuredSeeded=true;
    save(false);
  }

  // Only three top-level media types are shown from now on.
  for(const id of ["newMediaType","qMediaType","editMediaType"]){
    const s=document.getElementById(id); if(!s) continue;
    s.innerHTML=MEDIA.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
    s.style.display="none";
  }

  // Retired category fields stay hidden as legacy data only.
  for(const id of ["newCategory","qCategory","editCategory"]){
    const el=document.getElementById(id); if(!el) continue;
    const label=el.closest("label"); if(label) label.style.display="none"; else el.style.display="none";
  }

  const style=document.createElement("style");
  style.textContent=`
    .struct-picker{margin:10px 0 4px}.struct-row{margin:9px 0}.struct-label{font-size:10px;color:var(--muted);margin-bottom:6px;font-weight:700}.struct-options{display:flex;gap:6px;flex-wrap:wrap}.struct-chip{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:999px;padding:7px 10px;font-size:11px}.struct-chip.on{border-color:var(--accent);color:#fff;box-shadow:0 0 0 1px var(--accent) inset}.filter-select{min-width:116px}.filter-wrap{display:flex;gap:6px;flex-wrap:wrap;width:100%}.runtime-line{font-size:9px;color:var(--muted);margin-top:2px}.runtime-input{width:100%}
    @media(max-width:560px){.struct-chip{padding:7px 9px}.filter-select{min-width:calc(50% - 3px);flex:1}.filter-wrap .search{min-width:100%}}
  `;
  document.head.appendChild(style);

  function chipRow(label,values,selected,multi=false){
    const arr=values.map(x=>Array.isArray(x)?x:[x,x]);
    const set=new Set(Array.isArray(selected)?selected:[selected]);
    return `<div class="struct-row"><div class="struct-label">${esc(label)}</div><div class="struct-options">${arr.map(([v,l])=>`<button type="button" class="struct-chip${set.has(v)?" on":""}" data-struct-value="${esc(v)}" data-multi="${multi?1:0}">${esc(l)}</button>`).join("")}</div></div>`;
  }
  function structuredHtml({media="movie",origin="ハリウッド",format="live",genres=[]}={}){
    return `<div class="struct-picker">${chipRow("種別",MEDIA,media,false)}${chipRow("制作区分",ORIGINS,origin,false)}${chipRow("形式",FORMATS,format,false)}${chipRow("ジャンル（複数選択可）",GENRES19,genres,true)}</div>`;
  }
  function bindStructured(wrap,initial,onChange){
    let cur={media:initial.media||"movie",origin:initial.origin||"ハリウッド",format:initial.format||"live",genres:[...(initial.genres||[])]};
    wrap.innerHTML=structuredHtml(cur);
    const rows=[...wrap.querySelectorAll('.struct-row')];
    rows.forEach((row,idx)=>row.querySelectorAll('.struct-chip').forEach(b=>b.onclick=()=>{
      const v=b.dataset.structValue, multi=b.dataset.multi==="1";
      if(multi){
        const s=new Set(cur.genres); s.has(v)?s.delete(v):s.add(v); cur.genres=[...s]; b.classList.toggle('on',s.has(v));
      }else{
        row.querySelectorAll('.struct-chip').forEach(x=>x.classList.remove('on')); b.classList.add('on');
        if(idx===0)cur.media=v; else if(idx===1)cur.origin=v; else if(idx===2)cur.format=v;
      }
      onChange?.({...cur,genres:[...cur.genres]});
    }));
    return cur;
  }

  let newStruct={media:"movie",origin:"ハリウッド",format:"live",genres:[]};
  let qStruct={media:"movie",origin:"ハリウッド",format:"live",genres:[]};
  const newWrap=document.getElementById("newGenrePicker"); if(newWrap) newStruct=bindStructured(newWrap,newStruct,v=>newStruct=v);
  const qWrap=document.getElementById("qGenrePicker"); if(qWrap) qStruct=bindStructured(qWrap,qStruct,v=>qStruct=v);

  // Runtime fields for add/edit.
  function addRuntimeField(anchor,id,label="上映時間（分）"){
    if(document.getElementById(id)||!anchor)return;
    const l=document.createElement("label"); l.className="media-field-label"; l.textContent=label;
    const input=document.createElement("input"); input.id=id; input.className="field runtime-input"; input.type="number"; input.min="1"; input.max="999"; input.step="1"; input.placeholder="例：136";
    l.appendChild(input); anchor.appendChild(l);
  }
  addRuntimeField(document.querySelector("#sheetBg .sheetgrid"),"editRuntime");
  addRuntimeField(document.querySelector("#addSheetBg .sheetgrid"),"qRuntime");
  if(!document.getElementById("newRuntime")){
    const fg=document.getElementById("newYear")?.closest(".formgrid");
    if(fg){const i=document.createElement("input");i.id="newRuntime";i.className="field";i.type="number";i.min="1";i.max="999";i.placeholder="上映時間（分）";fg.insertBefore(i,document.getElementById("newStar")||null);}
  }

  function editStructuredFor(f){return {media:mediaType19(f),origin:origin19(f),format:format19(f),genres:rawGenres(f).filter(g=>GENRES19.includes(g))};}
  const openSheet19=openSheet;
  openSheet=function(id){
    openSheet19(id); const f=filmById(id); if(!f)return;
    const wrap=document.getElementById("editGenrePicker");
    if(wrap) bindStructured(wrap,editStructuredFor(f),v=>{
      state.mediaTypeOverrides[f.id]=v.media;
      state.originOverrides[f.id]=v.origin;
      state.formatOverrides[f.id]=v.format;
      setGenres19(f.id,v.genres);
      save(); render();
    });
    const rt=document.getElementById("editRuntime"); if(rt)rt.value=runtime19(f)||"";
    const meta=document.getElementById("sheetMeta"); if(meta)meta.textContent=`${f.year||""} · ${mediaLabel19(f)} · ${origin19(f)} · ${formatLabel19(f)}${runtime19(f)?" · "+runtime19(f)+"分":""}`;
  };
  const editRt=document.getElementById("editRuntime"); if(editRt)editRt.onchange=()=>{const f=filmById(selectedId);if(!f)return;const n=parseInt(editRt.value,10);if(Number.isFinite(n)&&n>0)state.runtimeOverrides[f.id]=n;else delete state.runtimeOverrides[f.id];save();render();};

  function applyStructToFilm(f,s,rt){
    if(!f)return;
    state.mediaTypeOverrides[f.id]=s.media;
    state.originOverrides[f.id]=s.origin;
    state.formatOverrides[f.id]=s.format;
    setGenres19(f.id,s.genres);
    const n=parseInt(rt,10); if(Number.isFinite(n)&&n>0)state.runtimeOverrides[f.id]=n; else delete state.runtimeOverrides[f.id];
    save();
  }

  const addBtn=document.getElementById("addMovie"); if(addBtn)addBtn.onclick=()=>{
    const f=addFilm(document.getElementById("newTitle").value,document.getElementById("newYear").value,"",document.getElementById("newStar").value,document.getElementById("newScore").value,{originalTitle:document.getElementById("newOriginalTitle").value,englishTitle:document.getElementById("newEnglishTitle").value,mediaType:newStruct.media,genres:newStruct.genres});
    if(f){applyStructToFilm(f,newStruct,document.getElementById("newRuntime")?.value);["newTitle","newOriginalTitle","newEnglishTitle","newYear","newRuntime","newScore"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=""});newStruct={media:"movie",origin:"ハリウッド",format:"live",genres:[]};if(newWrap)newStruct=bindStructured(newWrap,newStruct,v=>newStruct=v);toast("作品を追加しました");render();}
  };
  const qAdd=document.getElementById("qAdd"); if(qAdd)qAdd.onclick=()=>{
    const f=addFilm(document.getElementById("qTitle").value,document.getElementById("qYear").value,"",document.getElementById("qStar").value,document.getElementById("qScore").value,{originalTitle:document.getElementById("qOriginalTitle").value,englishTitle:document.getElementById("qEnglishTitle").value,tmdbId:selectedTmdbId,mediaType:qStruct.media,genres:qStruct.genres});
    if(f){applyStructToFilm(f,qStruct,document.getElementById("qRuntime")?.value);["qLookup","qTitle","qOriginalTitle","qEnglishTitle","qYear","qRuntime","qScore"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=""});qStruct={media:"movie",origin:"ハリウッド",format:"live",genres:[]};if(qWrap)qStruct=bindStructured(qWrap,qStruct,v=>qStruct=v);selectedTmdbId=null;document.getElementById("addSheetBg").classList.remove("open");view.page="rank";save();render();document.getElementById("searchRank").value=displayTitle(f);renderRank();toast("追加しました。検索で表示中");}
  };

  // TMDB selection also fills runtime, production grouping and animation/live-action.
  const selectTmdb19=selectTmdb;
  selectTmdb=async function(id){
    await selectTmdb19(id);
    try{
      const d=await tmdbFetch("/movie/"+id,{language:"en-US"});
      const rt=document.getElementById("qRuntime"); if(rt&&d.runtime)rt.value=d.runtime;
      const countries=(d.production_countries||[]).map(x=>x.iso_3166_1), lang=String(d.original_language||"");
      let origin=countries.includes("JP")?"邦画":((countries.includes("US")||lang==="en")?"ハリウッド":"その他外国語映画");
      const animation=(d.genres||[]).some(g=>g.name==="Animation");
      const tmdbMap={"Science Fiction":"SF","Action":"アクション","Mystery":"ミステリー","Thriller":"スリラー","Horror":"ホラー","Crime":"クライム","Drama":"ドラマ","Comedy":"コメディ","Romance":"恋愛","Music":"ミュージカル","War":"戦争","History":"歴史","Fantasy":"ファンタジー","Adventure":"アドベンチャー"};
      const gs=(d.genres||[]).map(g=>tmdbMap[g.name]).filter(Boolean);
      qStruct={...qStruct,origin,format:animation?"animation":"live",genres:[...new Set(gs)]}; if(qWrap)qStruct=bindStructured(qWrap,qStruct,v=>qStruct=v);
    }catch(_){ }
  };

  // Search includes structured filters + decade + runtime.
  function decadeOptions(){
    const ys=allFilms().map(f=>parseInt(f.year,10)).filter(Number.isFinite); if(!ys.length)return [];
    const lo=Math.floor(Math.min(...ys)/10)*10, hi=Math.floor(Math.max(...ys)/10)*10, out=[];
    for(let y=hi;y>=lo;y-=10)out.push(y); return out;
  }
  function selectHtml(id,label,options){return `<select class="field filter-select" id="${id}" aria-label="${esc(label)}"><option value="">${esc(label)}: すべて</option>${options.map(x=>Array.isArray(x)?`<option value="${esc(x[0])}">${esc(x[1])}</option>`:`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select>`;}
  function setupFilters(searchId,genreId,suffix){
    const search=document.getElementById(searchId), genre=document.getElementById(genreId); if(!search||!genre)return;
    genre.innerHTML='<option value="">ジャンル: すべて</option>'+GENRES19.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("");
    const tools=search.closest('.tools'); if(!tools)return; tools.classList.add('filter-wrap');
    tools.querySelectorAll('[data-v19-filter]').forEach(x=>x.remove());
    const box=document.createElement('span');box.setAttribute('data-v19-filter','1');box.style.display='contents';
    box.innerHTML=selectHtml('mediaFilter'+suffix,'種別',MEDIA)+selectHtml('originFilter'+suffix,'制作区分',ORIGINS)+selectHtml('formatFilter'+suffix,'形式',FORMATS)+selectHtml('decadeFilter'+suffix,'年代',decadeOptions().map(y=>[String(y),`${y}年代`]))+selectHtml('runtimeFilter'+suffix,'上映時間',[["lt90","90分未満"],["90-119","90〜119分"],["120-149","120〜149分"],["150plus","150分以上"],["unknown","不明"]]);
    genre.insertAdjacentElement('afterend',box);
  }
  setupFilters('searchRank','genreFilterRank','Rank');
  setupFilters('searchClassify','genreFilterClassify','Classify');

  function passesFilters(f,suffix){
    const val=id=>document.getElementById(id+suffix)?.value||"";
    const media=val('mediaFilter'),origin=val('originFilter'),format=val('formatFilter'),genre=document.getElementById('genreFilter'+suffix)?.value||"",dec=val('decadeFilter'),rtf=val('runtimeFilter');
    if(media&&mediaType19(f)!==media)return false;
    if(origin&&origin19(f)!==origin)return false;
    if(format&&format19(f)!==format)return false;
    if(genre&&!rawGenres(f).includes(genre))return false;
    if(dec){const y=parseInt(f.year,10);if(!Number.isFinite(y)||Math.floor(y/10)*10!==Number(dec))return false;}
    if(rtf){const r=runtime19(f);if(rtf==='unknown'){if(r!=null)return false;}else{if(r==null)return false;if(rtf==='lt90'&&!(r<90))return false;if(rtf==='90-119'&&!(r>=90&&r<=119))return false;if(rtf==='120-149'&&!(r>=120&&r<=149))return false;if(rtf==='150plus'&&!(r>=150))return false;}}
    return true;
  }
  function prune(rootSel,cardSel,sectionSel,suffix){
    document.querySelectorAll(`${rootSel} ${cardSel}`).forEach(card=>{const f=filmById(decodeURIComponent(card.dataset.id||''));if(f&&!passesFilters(f,suffix))card.remove();});
    document.querySelectorAll(`${rootSel} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none';});
    if(rootSel==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none';});
  }
  function annotateStructured(){
    document.querySelectorAll('.rank-card').forEach(card=>{const f=filmById(decodeURIComponent(card.dataset.id||''));if(!f)return;const meta=card.querySelector('.rank-meta');if(!meta)return;const pill=meta.querySelector('.media-pill')?.outerHTML||'';meta.innerHTML=pill+esc(f.year||'')+(runtime19(f)?` · ${runtime19(f)}分`:"")+(rawGenres(f).length?`<div class="genre-line">${esc(rawGenres(f).join('・'))}</div>`:"");});
  }

  const renderRank19=renderRank; renderRank=function(){renderRank19();prune('#rankRoot','.rank-card','.rank-star','Rank');annotateStructured();};
  const renderClassify19=renderClassify; renderClassify=function(){renderClassify19();prune('#classifyRoot','.card','.section','Classify');};
  for(const suffix of ['Rank','Classify'])for(const p of ['mediaFilter','originFilter','formatFilter','decadeFilter','runtimeFilter']){const e=document.getElementById(p+suffix);if(e)e.onchange=suffix==='Rank'?renderRank:renderClassify;}
  const gr=document.getElementById('genreFilterRank');if(gr)gr.onchange=renderRank;const gc=document.getElementById('genreFilterClassify');if(gc)gc.onchange=renderClassify;

  match=function(f,q){if(!q)return true;q=String(q).toLowerCase();const x=titleInfo(f);return [x.title,x.originalTitle,x.englishTitle,f.lbTitle||'',f.year||'',mediaLabel19(f),origin19(f),formatLabel19(f),rawGenres(f).join(' '),runtime19(f)||''].join(' ').toLowerCase().includes(q);};

  // Prefer same-origin cached RSS generated by GitHub Actions; browser proxies are only fallback now.
  const oldFetchLbRss19=fetchLbRss;
  fetchLbRss=async function(username){
    if(String(username).toLowerCase()==='gjbkic'){
      try{const r=await fetch('./letterboxd-gjbkic.xml?v='+Date.now(),{cache:'no-store'});if(r.ok){const t=await r.text();if(/<(?:rss|item)[\s>]/i.test(t))return t;}}catch(_){ }
    }
    return oldFetchLbRss19(username);
  };
  try{if(!localStorage.getItem('movie30_v19_lb_reset')){localStorage.removeItem('movie30_lb_last_success_v2');localStorage.setItem('movie30_v19_lb_reset','1');}}catch(_){ }

  // CSV uses the structured fields and no retired category.
  const csvBtn=document.getElementById('downloadCsv');if(csvBtn)csvBtn.onclick=()=>{const rows=exportRows(),head=['邦題／表示名','原題','英題','年','種別','制作区分','形式','ジャンル','上映時間(分)','星','星内','点数','追加映画','TMDB ID'];const csv=[head,...rows.map((x,i)=>{const f=allFilms()[i];return [x.title,x.original_title,x.english_title,x.year,mediaLabel19(f),origin19(f),formatLabel19(f),rawGenres(f).join('|'),runtime19(f)||'',x.star,x.tier,x.score,x.added,x.tmdb_id]})].map(r=>r.map(csvCell).join(',')).join('\r\n');download('movie30_scores_v19.csv','\ufeff'+csv,'text/csv;charset=utf-8');};

  render();
})();

/* TMDB search-result preview and direct registration; no existing ratings are modified. */
(() => {
  'use strict';
  const repoNorm = v => String(v || '').normalize('NFKC').toLowerCase().replace(/[\s・_\-:：.!?！？'’]/g, '');
  const safePoster = p => typeof p === 'string' && /^\/[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(p);
  const modal = document.createElement('section');
  modal.id = 'movie30RemotePreview';
  modal.hidden = true;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','TMDB作品情報・追加');
  modal.innerHTML =
    '<div class="remote-add-sheet">' +
      '<div class="remote-add-top"><strong>TMDB作品情報</strong><button type="button" class="btn" id="remoteAddClose">閉じる</button></div>' +
      '<div class="remote-add-hero"><img id="remoteAddPoster" alt="" hidden><div><h2 id="remoteAddTitle"></h2><p id="remoteAddMeta"></p><p id="remoteAddOverview"></p></div></div>' +
      '<div class="remote-add-form"><label>登録名<input class="field" id="remoteAddName" type="text" maxlength="240"></label>' +
      '<div class="remote-add-fields"><label>全体の点数（任意）<input class="field" id="remoteAddScore" inputmode="numeric" type="number" min="0" max="100" step="1" placeholder="未採点"></label>' +
      '<label>カテゴリ<select class="field" id="remoteAddCategory"></select></label></div>' +
      '<p class="remote-add-note">点数を空欄のままでも登録できます。ドラマはシリーズ全体を1作品として登録し、シーズン別の点数は登録後の詳細画面で入力できます。</p>' +
      '<div class="remote-add-buttons"><button type="button" class="btn" id="remoteAddSave">この作品を追加する</button>' +
      '<a class="btn" id="remoteAddTMDB" rel="noopener noreferrer" target="_blank">TMDBで見る ↗</a></div>' +
      '<p id="remoteAddStatus" role="status" class="remote-add-status"></p></div>' +
    '</div>';
  const css=document.createElement('style');css.id='movie30-remote-add-style';
  css.textContent=[
    '#movie30RemotePreview{position:fixed;inset:0;z-index:4800;background:rgba(4,8,13,.74);color:#edf4fc;overflow-y:auto;overscroll-behavior:contain;padding:env(safe-area-inset-top) 10px env(safe-area-inset-bottom);display:flex;align-items:flex-start;justify-content:center}',
    '#movie30RemotePreview[hidden]{display:none!important}',
    '.remote-add-sheet{background:#101926;border:1px solid #41536b;box-shadow:0 16px 45px #000b;border-radius:16px;width:min(670px,100%);margin:20px 0;overflow:hidden}',
    '.remote-add-top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #364455}',
    '.remote-add-top strong{font-size:13px;color:#bdcfe3}',
    '.remote-add-hero{display:flex;gap:16px;padding:17px 16px 10px;align-items:flex-start}',
    '.remote-add-hero img{width:120px;max-width:34%;aspect-ratio:2/3;object-fit:contain;border-radius:9px;background:#1c2a3b}',
    '.remote-add-hero h2{font-size:21px;line-height:1.35;margin:0 0 7px}',
    '.remote-add-hero p{color:#bac9d9;font-size:12px;line-height:1.65;margin:0 0 9px}',
    '#remoteAddOverview{white-space:pre-line;max-height:180px;overflow:auto}',
    '.remote-add-form{padding:0 16px 20px}',
    '.remote-add-form label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#b6c6d8}',
    '.remote-add-form input,.remote-add-form select{font-size:16px;width:100%;min-height:41px}',
    '.remote-add-fields{display:grid;grid-template-columns:110px minmax(0,1fr);gap:12px;margin-top:12px}',
    '.remote-add-note{color:#a9b9cd;font-size:11px;line-height:1.65;margin:13px 0}',
    '.remote-add-buttons{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.remote-add-buttons>.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;text-decoration:none;font-size:13px}',
    '#remoteAddSave{background:#22875d;color:white;border-color:#3fae7e;flex:1}',
    '#remoteAddSave:disabled{opacity:.6;cursor:default}',
    '.remote-add-status{font-size:12px;color:#bbd7ea;line-height:1.5;min-height:18px;margin-top:12px}',
    '@media(max-width:480px){.remote-add-sheet{margin:8px 0}.remote-add-hero{gap:12px}.remote-add-hero img{width:95px}.remote-add-hero h2{font-size:18px}.remote-add-fields{grid-template-columns:95px minmax(0,1fr)}}'
  ].join('\n');
  document.head.appendChild(css);document.body.appendChild(modal);
  const $=id=>modal.querySelector('#'+id);
  const closeButton=$('remoteAddClose'),saveButton=$('remoteAddSave'),status=$('remoteAddStatus');
  let current=null,seq=0,priorOverflow='',priorHtmlOverflow='',priorFocus=null;
  function close(){
    seq++;current=null;modal.hidden=true;
    document.body.style.overflow=priorOverflow;
    document.documentElement.style.overflow=priorHtmlOverflow;
    priorFocus?.focus?.({preventScroll:true});
  }
  closeButton.addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',e=>{
    if(modal.hidden)return;
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){
      const items=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')];
      if(!items.length)return;
      if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus();}
      if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus();}
    }
  });
  const metaFor=f=>state.letterboxdMeta?.[f.id]||{};
  function matchesMedia(f,media){
    const m=metaFor(f),kind=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'').toLowerCase();
    const tv=kind==='tvseries'||kind==='drama'||kind==='series'||m.tmdbType==='tv'||f.tmdbType==='tv'||['tv_series','tv_season','tv_episode'].includes(m.contentType);
    return media==='tv'?tv:!tv;
  }
  function existing(item,year){
    const id=Number(item.tmdbId);
    for(const f of allFilms()){
      if(!matchesMedia(f,item.media))continue;
      const m=metaFor(f),r=window.__movie30Cast?.get(f.id)||{},ti=titleInfo(f);
      const ids=item.media==='tv'?[m.tmdbSeriesId,m.poster84?.tmdbId,ti.tmdbId,r.tmdbId]:
        [m.poster84?.tmdbId,ti.tmdbId,r.tmdbId];
      if(id>0&&ids.some(x=>Number(x)===id))return f;
    }
    if(!year)return null;
    const names=[item.label,item.original,current?.detail?.title,current?.detail?.original_title,current?.detail?.original_name]
      .filter(Boolean).map(repoNorm);
    return allFilms().find(f=>matchesMedia(f,item.media)&&Number(f.year)===year&&
      [displayTitle(f),titleInfo(f).originalTitle,titleInfo(f).englishTitle,f.lbTitle].some(x=>names.includes(repoNorm(x))))||null;
  }
  function setStatus(message){status.textContent=message;}
  function updatePoster(path,fallback){
    const img=$('remoteAddPoster'),src=safePoster(path)?'https://image.tmdb.org/t/p/w342'+path:fallback;
    if(src){img.src=src;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}
  }
  function categoryFor(detail,media){
    if(typeof tmdbSuggestedCategory==='function'){
      const suggested=tmdbSuggestedCategory(detail);
      if(suggested)return suggested;
    }
    return media==='tv'?'ドラマ':'追加映画';
  }
  function setupCategories(value){
    const select=$('remoteAddCategory');select.replaceChildren();
    const categories=typeof categoryOptions==='function'?categoryOptions():['ドラマ','追加映画'];
    for(const v of [...new Set([value,...categories])]){
      const option=document.createElement('option');option.value=v;option.textContent=v;select.append(option);
    }
    select.value=value;
  }
  async function loadDetails(record,number){
    const kind=record.media,id=record.tmdbId;
    let detail,english;
    try{
      const jaResult=await Promise.allSettled([
        tmdbFetch('/'+kind+'/'+id,{language:'ja-JP'}),
        tmdbFetch('/'+kind+'/'+id,{language:'en-US'})
      ]);
      detail=jaResult[0].status==='fulfilled'?jaResult[0].value:null;
      english=jaResult[1].status==='fulfilled'?jaResult[1].value:null;
      if(!detail&&!english)throw new Error('作品情報を取得できません');
      if(number!==seq||current!==record)return;
      record.detail=detail||english;
      record.englishDetail=english||detail;
      const d=record.detail,e=record.englishDetail;
      const title=(d.title||d.name||e.title||e.name||record.label).trim();
      const year=Number(String(d.release_date||d.first_air_date||e.release_date||e.first_air_date||'').slice(0,4))||0;
      record.year=year;record.posterPath=d.poster_path||e.poster_path||'';
      $('remoteAddTitle').textContent=title;
      $('remoteAddName').value=title;
      $('remoteAddMeta').textContent=(kind==='tv'?'TVシリーズ':'映画')+(year?' · '+year:'')+
        (d.number_of_seasons&&kind==='tv'?' · 全'+d.number_of_seasons+'シーズン':'');
      $('remoteAddOverview').textContent=d.overview||e.overview||'あらすじは登録されていません。';
      updatePoster(record.posterPath,record.image);
      setupCategories(categoryFor(e,kind));
    }catch(error){
      if(number!==seq||current!==record)return;
      setStatus('詳細情報を取得できませんでした。検索結果のタイトルで登録できます。');
    }finally{
      if(number===seq&&current===record){
        saveButton.disabled=false;
        const found=existing(record,record.year);
        if(found){record.registeredId=found.id;saveButton.textContent='登録済み · 詳細を開く';setStatus('この作品は既に登録されています。重複追加はしません。');}
      }
    }
  }
  function open(item){
    if(!item||!['movie','tv'].includes(item.media)||!Number(item.tmdbId))return;
    if(!modal.hidden)close();
    priorOverflow=document.body.style.overflow;
    priorHtmlOverflow=document.documentElement.style.overflow;
    priorFocus=document.activeElement;
    current={...item,year:Number(String(item.detail||'').slice(0,4))||0,detail:null,englishDetail:null,posterPath:''};
    const record=current,number=++seq;
    modal.hidden=false;
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
    modal.scrollTop=0;
    $('remoteAddTitle').textContent=record.label;
    $('remoteAddMeta').textContent=record.media==='tv'?'TVシリーズ':'映画';
    $('remoteAddOverview').textContent='TMDBから作品情報を取得中…';
    $('remoteAddName').value=record.label;
    $('remoteAddScore').value='';
    setupCategories(record.media==='tv'?'ドラマ':'追加映画');
    updatePoster('',record.image);
    $('remoteAddTMDB').href='https://www.themoviedb.org/'+record.media+'/'+encodeURIComponent(record.tmdbId);
    saveButton.textContent='この作品を追加する';saveButton.disabled=true;
    setStatus('');
    closeButton.focus({preventScroll:true});
    loadDetails(record,number);
  }
  saveButton.addEventListener('click',async()=>{
    const record=current;
    if(!record||saveButton.disabled)return;
    if(record.registeredId){
      const id=record.registeredId;
      close();
      openSheet(id);
      return;
    }
    const found=existing(record,record.year);
    if(found){
      record.registeredId=found.id;
      saveButton.textContent='登録済み · 詳細を開く';
      setStatus('既に登録済みのため追加しませんでした。');
      return;
    }
    const title=$('remoteAddName').value.trim();
    if(!title){setStatus('作品名を入力してください。');$('remoteAddName').focus();return;}
    const raw=$('remoteAddScore').value.trim(),score=Number(raw);
    if(raw!==''&&(!Number.isInteger(score)||score<0||score>100)){
      setStatus('点数は0〜100の整数で入力してください。');$('remoteAddScore').focus();return;
    }
    saveButton.disabled=true;setStatus('登録・保存しています…');
    try{
      const d=record.detail||{},en=record.englishDetail||d;
      const original=(d.original_title||d.original_name||record.original||title).trim();
      const english=(en.title||en.name||record.original||title).trim();
      const category=$('remoteAddCategory').value||(record.media==='tv'?'ドラマ':'追加映画');
      const f=addFilm(title,record.year||'',category,raw===''?0:scoreToStar(score),raw===''?'':score,{
        originalTitle:original,englishTitle:english,tmdbId:record.tmdbId,
        mediaType:record.media==='tv'?'tvseries':(d.genres||[]).some(g=>g.id===99)?'documentary':'movie',
        keepUnscored:raw===''
      });
      if(!f)throw Error('追加処理が完了しませんでした');
      f.tmdbType=record.media;
      if(raw===''){f.star=0;state.starOverrides[f.id]=0;}
      state.mediaTypeOverrides[f.id]=record.media==='tv'?'tvseries':(d.genres||[]).some(g=>g.id===99)?'documentary':'movie';
      state.letterboxdMeta=state.letterboxdMeta||{};
      const meta=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
      meta.contentType=record.media==='tv'?'tv_series':'movie';
      meta.tmdbType=record.media;
      meta.poster84={path:record.posterPath||'',tmdbId:record.tmdbId,provider:'tmdb',checkedAt:new Date().toISOString()};
      if(record.media==='tv'){
        meta.tmdbSeriesId=record.tmdbId;
        const seasons=(d.seasons||en.seasons||[]).filter(x=>Number.isInteger(x.season_number)&&x.season_number>=1&&x.season_number<=99);
        if(seasons.length){
          meta.seasonCatalogV1=seasons.map(x=>({number:x.season_number,year:String(x.air_date||'').slice(0,4)}));
          meta.seasonCountV1=Math.max(...seasons.map(x=>x.season_number));
        }
      }
      const saved=await save();
      render();
      if(current!==record)return;
      record.registeredId=f.id;
      saveButton.disabled=false;
      saveButton.textContent='登録済み · 詳細を開く';
      setStatus(saved?(raw===''?'未採点で登録・保存しました。':'点数付きで登録・保存しました。'):'保存できませんでした。アプリを閉じずにJSONバックアップを保存してください。');
    }catch(error){
      if(current!==record)return;
      saveButton.disabled=false;
      setStatus('追加できませんでした：'+String(error.message||error));
    }
  });
  window.__movie30RemoteAdd={open};
})();
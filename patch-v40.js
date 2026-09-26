(() => {
  // v40: TV-series-only subtype (main series / special) stored as internal genre tags.
  // This avoids any score/rank changes and keeps the value in existing live-state sync.
  const BUILD='20260926b';
  const TAG_MAIN='TV本編';
  const TAG_SP='TV特番・SP';
  const TV_TAGS=new Set([TAG_MAIN,TAG_SP]);

  const style=document.createElement('style');
  style.textContent=`
    .tv-subtype-row-v40{margin-top:7px}
    .tv-subtype-filter-v40[hidden]{display:none!important}
  `;
  document.head.appendChild(style);

  function rawGenres(f){
    const g=state.genreOverrides?.[f?.id];
    return Array.isArray(g)?[...new Set(g)]:[];
  }
  function setGenres(f,arr){
    if(!f)return false;
    state.genreOverrides=state.genreOverrides||{};
    const next=[...new Set((arr||[]).filter(Boolean))];
    const prev=rawGenres(f);
    if(prev.length===next.length&&prev.every((x,i)=>x===next[i]))return false;
    state.genreOverrides[f.id]=next;
    return true;
  }
  function mediaOf(f){
    const v=String(state.mediaTypeOverrides?.[f?.id]||f?.mediaType||'movie');
    return (v==='drama'||v==='series'||f?.tmdbType==='tv')?'drama':v;
  }
  function subtypeOf(f){
    if(mediaOf(f)!=='drama')return '';
    const gs=rawGenres(f);
    return gs.includes(TAG_SP)?'sp':'main';
  }
  function setSubtype(f,subtype){
    if(!f)return false;
    const base=rawGenres(f).filter(g=>!TV_TAGS.has(g));
    if(mediaOf(f)==='drama')base.push(subtype==='sp'?TAG_SP:TAG_MAIN);
    return setGenres(f,base);
  }
  function clearSubtype(f){
    if(!f)return false;
    return setGenres(f,rawGenres(f).filter(g=>!TV_TAGS.has(g)));
  }

  // Existing TV works default to 本編. No scores/ranks/ordinary genres are touched.
  let seeded=false;
  for(const f of allFilms()){
    if(mediaOf(f)==='drama'){
      const gs=rawGenres(f);
      if(!gs.some(g=>TV_TAGS.has(g))){setGenres(f,[...gs,TAG_MAIN]);seeded=true;}
    }else if(rawGenres(f).some(g=>TV_TAGS.has(g))){clearSubtype(f);seeded=true;}
  }
  if(seeded)save(false);

  function pickerMedia(wrap){
    if(!wrap)return 'movie';
    const rows=[...wrap.querySelectorAll('.struct-row')];
    const mediaRow=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('種別'))||rows[0];
    return mediaRow?.querySelector('.struct-chip.on')?.dataset.structValue||'movie';
  }
  function selectedSubtype(wrap){
    return wrap?.querySelector('.tv-subtype-row-v40 .struct-chip.on')?.dataset.tvSubtype||'main';
  }
  function ensureTvRow(id,selected='main'){
    const wrap=document.getElementById(id);if(!wrap)return null;
    let row=wrap.querySelector('.tv-subtype-row-v40');
    if(!row){
      row=document.createElement('div');
      row.className='struct-row tv-subtype-row-v40';
      row.innerHTML='<div class="struct-label">TV区分</div><div class="struct-options"><button type="button" class="struct-chip" data-tv-subtype="main">本編</button><button type="button" class="struct-chip" data-tv-subtype="sp">特番・SP</button></div>';
      const rows=[...wrap.querySelectorAll('.struct-row')];
      const mediaRow=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('種別'))||rows[0];
      if(mediaRow)mediaRow.insertAdjacentElement('afterend',row);else wrap.appendChild(row);
    }
    const media=pickerMedia(wrap);
    row.style.display=media==='drama'?'':'none';
    const cur=selected==='sp'?'sp':'main';
    row.querySelectorAll('[data-tv-subtype]').forEach(b=>{
      b.classList.toggle('on',b.dataset.tvSubtype===cur);
      b.onclick=e=>{
        e.preventDefault();
        row.querySelectorAll('[data-tv-subtype]').forEach(x=>x.classList.toggle('on',x===b));
        wrap.dataset.tvSubtypeV40=b.dataset.tvSubtype;
        if(id==='editGenrePicker'){
          const f=filmById(selectedId);if(!f)return;
          if(mediaOf(f)==='drama'&&setSubtype(f,b.dataset.tvSubtype)){save();render();}
        }
      };
    });
    wrap.dataset.tvSubtypeV40=cur;
    return row;
  }
  function refreshPicker(id,f=null){
    const wrap=document.getElementById(id);if(!wrap)return;
    const media=pickerMedia(wrap);
    let sub=f?subtypeOf(f):(wrap.dataset.tvSubtypeV40||'main');
    ensureTvRow(id,sub||'main');
    const row=wrap.querySelector('.tv-subtype-row-v40');if(row)row.style.display=media==='drama'?'':'none';
  }
  function bindPickerWatch(id){
    const wrap=document.getElementById(id);if(!wrap||wrap.dataset.tvWatchV40)return;
    wrap.dataset.tvWatchV40='1';
    wrap.addEventListener('click',()=>setTimeout(()=>{
      const media=pickerMedia(wrap);
      if(id==='editGenrePicker'){
        const f=filmById(selectedId);if(!f)return;
        let changed=false;
        if(media==='drama'){
          // v33 has already written the media override by this point.
          if(!rawGenres(f).some(g=>TV_TAGS.has(g)))changed=setSubtype(f,wrap.dataset.tvSubtypeV40||'main')||changed;
        }else if(rawGenres(f).some(g=>TV_TAGS.has(g)))changed=clearSubtype(f)||changed;
        refreshPicker(id,f);
        if(changed)save();
      }else refreshPicker(id,null);
    },0));
  }

  for(const id of ['newGenrePicker','qGenrePicker']){ensureTvRow(id,'main');bindPickerWatch(id);}

  // Quick TMDB selection can rebuild the picker, so restore the dependent row afterward.
  if(typeof selectTmdb==='function'){
    const selectTmdbPrev=selectTmdb;
    selectTmdb=async function(...args){const out=await selectTmdbPrev.apply(this,args);refreshPicker('qGenrePicker');return out;};
  }

  // Preserve TV subtype when adding a work, even though older genre handlers only know ordinary genres.
  for(const [buttonId,pickerId] of [['addMovie','newGenrePicker'],['qAdd','qGenrePicker']]){
    const btn=document.getElementById(buttonId);if(!btn||!btn.onclick)continue;
    const prev=btn.onclick;
    btn.onclick=async function(ev){
      const wrap=document.getElementById(pickerId);
      const media=pickerMedia(wrap),sub=selectedSubtype(wrap);
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=prev.call(this,ev);if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created){
        let changed=false;
        if(media==='drama')changed=setSubtype(created,sub)||changed;
        else changed=clearSubtype(created)||changed;
        if(changed){save();render();}
      }
      refreshPicker(pickerId);
      return out;
    };
  }

  // Letterboxd TV imports default to 本編 unless the user later changes them.
  if(typeof addLbFilm==='function'){
    const addLbPrev=addLbFilm;
    addLbFilm=function(meta){
      const f=addLbPrev(meta);if(!f)return f;
      if(meta?.tmdbType==='tv'||mediaOf(f)==='drama')setSubtype(f,'main');
      return f;
    };
  }

  const openPrev=openSheet;
  openSheet=function(id){
    openPrev(id);
    const f=filmById(id);if(!f)return;
    refreshPicker('editGenrePicker',f);bindPickerWatch('editGenrePicker');
    const meta=document.getElementById('sheetMeta');
    if(meta&&mediaOf(f)==='drama'&&!/\b(?:本編|特番・SP)$/.test(meta.textContent||''))meta.textContent+=` · ${subtypeOf(f)==='sp'?'特番・SP':'本編'}`;
  };

  function makeTvFilter(suffix){
    const media=document.getElementById('mediaFilter'+suffix);if(!media)return null;
    const id='tvSubtypeFilter'+suffix;
    let s=document.getElementById(id);
    if(!s){
      s=document.createElement('select');s.id=id;s.className=(media.className||'filter-select')+' tv-subtype-filter-v40';
      s.innerHTML='<option value="">TV区分: すべて</option><option value="main">本編</option><option value="sp">特番・SP</option>';
      media.insertAdjacentElement('afterend',s);
    }
    const refresh=()=>{
      const show=media.value==='drama';
      s.hidden=!show;
      if(!show)s.value='';
    };
    refresh();
    s.onchange=()=>suffix==='Rank'?renderRank():renderClassify();
    return {media,s,refresh};
  }
  const tvFilters={Rank:makeTvFilter('Rank'),Classify:makeTvFilter('Classify')};

  function applyTvFilter(root,cardSel,sectionSel,suffix){
    const x=tvFilters[suffix];if(!x)return;
    x.refresh();
    const wanted=x.s.value;if(!wanted||x.media.value!=='drama')return;
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      let id=card.dataset.id||'';try{id=decodeURIComponent(id)}catch(_){}
      const f=filmById(id);if(f&&subtypeOf(f)!==wanted)card.remove();
    });
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none';});
    if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none';});
  }

  const renderRankPrev=renderRank;
  renderRank=function(){const out=renderRankPrev();applyTvFilter('#rankRoot','.rank-card','.rank-star','Rank');return out;};
  const renderClassPrev=renderClassify;
  renderClassify=function(){const out=renderClassPrev();applyTvFilter('#classifyRoot','.card','.section','Classify');return out;};

  // Older patches captured previous render functions in controls; point them at the final wrappers.
  const sr=document.getElementById('searchRank');if(sr)sr.oninput=renderRank;
  const sc=document.getElementById('searchClassify');if(sc)sc.oninput=renderClassify;
  for(const id of ['mediaFilterRank','originFilterRank','formatFilterRank','decadeFilterRank','runtimeFilterRank']){const e=document.getElementById(id);if(e)e.onchange=()=>{tvFilters.Rank?.refresh();renderRank();};}
  for(const id of ['mediaFilterClassify','originFilterClassify','formatFilterClassify','decadeFilterClassify','runtimeFilterClassify']){const e=document.getElementById(id);if(e)e.onchange=()=>{tvFilters.Classify?.refresh();renderClassify();};}

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  render();
})();

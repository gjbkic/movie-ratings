(() => {
  const EXTRA_GENRES_V25 = ["差別・人権","精神・哲学","社会問題・生活"];

  function rawGenresV25(f){
    const g = state.genreOverrides?.[f.id];
    return Array.isArray(g) ? [...new Set(g)] : [];
  }
  function setRawGenresV25(id, genres){
    state.genreOverrides[id] = [...new Set((genres || []).filter(Boolean))];
    save();
  }
  function appendV25Chips(id, selected=[]){
    const wrap=document.getElementById(id); if(!wrap)return;
    const picker=wrap.querySelector('.genre-picker')||wrap;
    const chosen=new Set(selected);
    for(const g of EXTRA_GENRES_V25){
      if(picker.querySelector(`[data-genre="${g}"]`))continue;
      const b=document.createElement('button');
      b.type='button'; b.className='genre-chip'+(chosen.has(g)?' on':''); b.dataset.genre=g; b.textContent=g;
      b.onclick=()=>b.classList.toggle('on');
      picker.appendChild(b);
    }
  }

  appendV25Chips('newGenrePicker');
  appendV25Chips('qGenrePicker');

  const openSheetV24=openSheet;
  openSheet=function(id){
    openSheetV24(id);
    const f=filmById(id); if(!f)return;
    const wrap=document.getElementById('editGenrePicker'); if(!wrap)return;
    appendV25Chips('editGenrePicker', rawGenresV25(f));
    const selected=new Set(rawGenresV25(f));
    wrap.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();
      b.classList.toggle('on',selected.has(g));
      b.onclick=()=>{
        if(selected.has(g))selected.delete(g); else selected.add(g);
        b.classList.toggle('on',selected.has(g));
        setRawGenresV25(f.id,[...selected]);
        render();
      };
    });
  };

  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id); if(!s)continue;
    for(const g of EXTRA_GENRES_V25) if(![...s.options].some(o=>o.value===g)) s.add(new Option(g,g));
  }

  function filterExtraV25(rootSelector,cardSelector,sectionSelector,value){
    if(!EXTRA_GENRES_V25.includes(value))return;
    document.querySelectorAll(`${rootSelector} ${cardSelector}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f&&!rawGenresV25(f).includes(value))card.remove();
    });
    document.querySelectorAll(`${rootSelector} ${sectionSelector}`).forEach(sec=>{if(!sec.querySelector(cardSelector))sec.style.display='none'});
  }

  const renderRankV24=renderRank;
  renderRank=function(){
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s&&EXTRA_GENRES_V25.includes(v))s.value='';
    renderRankV24();
    if(s)s.value=v;
    filterExtraV25('#rankRoot','.rank-card','.rank-star',v);
    if(EXTRA_GENRES_V25.includes(v))document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none'});
  };
  const renderClassifyV24=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s&&EXTRA_GENRES_V25.includes(v))s.value='';
    renderClassifyV24();
    if(s)s.value=v;
    filterExtraV25('#classifyRoot','.card','.section',v);
  };
  const rf=document.getElementById('genreFilterRank'); if(rf)rf.onchange=renderRank;
  const cf=document.getElementById('genreFilterClassify'); if(cf)cf.onchange=renderClassify;

  render();
})();

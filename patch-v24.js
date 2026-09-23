(() => {
  const EXTRA_GENRES_V24 = ["青春・若者","子供向け"];

  function rawGenresV24(f){
    const g = state.genreOverrides?.[f.id];
    return Array.isArray(g) ? [...new Set(g)] : [];
  }
  function setRawGenresV24(id, genres){
    state.genreOverrides[id] = [...new Set((genres || []).filter(Boolean))];
    save();
  }
  function appendV24Chips(id, selected=[]){
    const wrap=document.getElementById(id); if(!wrap)return;
    const picker=wrap.querySelector('.genre-picker')||wrap;
    const chosen=new Set(selected);
    for(const g of EXTRA_GENRES_V24){
      if(picker.querySelector(`[data-genre="${g}"]`))continue;
      const b=document.createElement('button');
      b.type='button'; b.className='genre-chip'+(chosen.has(g)?' on':''); b.dataset.genre=g; b.textContent=g;
      b.onclick=()=>b.classList.toggle('on');
      picker.appendChild(b);
    }
  }

  appendV24Chips('newGenrePicker');
  appendV24Chips('qGenrePicker');

  const openSheetV23=openSheet;
  openSheet=function(id){
    openSheetV23(id);
    const f=filmById(id); if(!f)return;
    const wrap=document.getElementById('editGenrePicker'); if(!wrap)return;
    appendV24Chips('editGenrePicker', rawGenresV24(f));
    const selected=new Set(rawGenresV24(f));
    wrap.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();
      b.classList.toggle('on',selected.has(g));
      b.onclick=()=>{
        if(selected.has(g))selected.delete(g); else selected.add(g);
        b.classList.toggle('on',selected.has(g));
        setRawGenresV24(f.id,[...selected]);
        render();
      };
    });
  };

  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id); if(!s)continue;
    for(const g of EXTRA_GENRES_V24) if(![...s.options].some(o=>o.value===g)) s.add(new Option(g,g));
  }

  function filterExtra(rootSelector,cardSelector,sectionSelector,value){
    if(!EXTRA_GENRES_V24.includes(value))return;
    document.querySelectorAll(`${rootSelector} ${cardSelector}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f&&!rawGenresV24(f).includes(value))card.remove();
    });
    document.querySelectorAll(`${rootSelector} ${sectionSelector}`).forEach(sec=>{if(!sec.querySelector(cardSelector))sec.style.display='none'});
  }

  const renderRankV23=renderRank;
  renderRank=function(){
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s&&EXTRA_GENRES_V24.includes(v))s.value='';
    renderRankV23();
    if(s)s.value=v;
    filterExtra('#rankRoot','.rank-card','.rank-star',v);
    if(EXTRA_GENRES_V24.includes(v))document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none'});
  };
  const renderClassifyV23=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s&&EXTRA_GENRES_V24.includes(v))s.value='';
    renderClassifyV23();
    if(s)s.value=v;
    filterExtra('#classifyRoot','.card','.section',v);
  };
  const rf=document.getElementById('genreFilterRank'); if(rf)rf.onchange=renderRank;
  const cf=document.getElementById('genreFilterClassify'); if(cf)cf.onchange=renderClassify;

  render();
})();

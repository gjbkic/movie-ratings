(() => {
  // v37: add two user-defined genre/theme tags without touching score/rank data.
  const BUILD='20260925za';
  const EXTRA=['comfort','大作'];
  const SET=new Set(EXTRA);

  function rawGenres(f){
    const g=state.genreOverrides?.[f?.id];
    return Array.isArray(g)?[...new Set(g)]:[];
  }
  function setGenres(id,genres){
    state.genreOverrides=state.genreOverrides||{};
    state.genreOverrides[id]=[...new Set((genres||[]).filter(Boolean))];
  }
  function genreHost(wrap){
    if(!wrap)return null;
    const rows=[...wrap.querySelectorAll('.struct-row')];
    const row=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('ジャンル'))||rows[rows.length-1];
    return row?.querySelector('.struct-options')||wrap;
  }
  function ensure(id,selected=[]){
    const wrap=document.getElementById(id);if(!wrap)return;
    const host=genreHost(wrap),chosen=new Set(selected||[]);
    for(const g of EXTRA){
      let b=wrap.querySelector(`.genre-chip[data-genre="${g}"]`);
      if(!b){
        b=document.createElement('button');
        b.type='button';b.className='struct-chip genre-chip';b.dataset.genre=g;b.textContent=g;
        host?.appendChild(b);
      }
      b.classList.add('struct-chip','genre-chip');
      if(host&&b.parentElement!==host)host.appendChild(b);
      b.classList.toggle('on',chosen.has(g));
      b.onclick=()=>b.classList.toggle('on');
    }
  }
  function selected(id){
    const wrap=document.getElementById(id);if(!wrap)return [];
    return [...wrap.querySelectorAll('.genre-chip.on')]
      .map(b=>b.dataset.genre||b.textContent.trim())
      .filter(g=>SET.has(g));
  }

  ensure('newGenrePicker',[]);
  ensure('qGenrePicker',[]);

  // Preserve these tags on new/manual additions even though legacy genre code does not know them.
  for(const [buttonId,pickerId] of [['addMovie','newGenrePicker'],['qAdd','qGenrePicker']]){
    const btn=document.getElementById(buttonId);if(!btn||!btn.onclick)continue;
    const prev=btn.onclick;
    btn.onclick=async function(ev){
      const extras=selected(pickerId);
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=prev.call(this,ev);if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created&&extras.length){
        setGenres(created.id,[...rawGenres(created),...extras]);
        save();render();
      }
      ensure(pickerId,[]);
      return out;
    };
  }

  // Editing.
  const openPrev=openSheet;
  openSheet=function(id){
    openPrev(id);
    const f=filmById(id);if(!f)return;
    const chosen=new Set(rawGenres(f).filter(g=>SET.has(g)));
    ensure('editGenrePicker',[...chosen]);
    const wrap=document.getElementById('editGenrePicker');
    wrap?.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();if(!SET.has(g))return;
      b.classList.toggle('on',chosen.has(g));
      b.onclick=()=>{
        chosen.has(g)?chosen.delete(g):chosen.add(g);
        b.classList.toggle('on',chosen.has(g));
        const base=rawGenres(f).filter(x=>!SET.has(x));
        setGenres(f.id,[...base,...chosen]);save();render();
      };
    });
  };

  const editWrap=document.getElementById('editGenrePicker');
  if(editWrap&&!editWrap.dataset.v37Guard){
    editWrap.dataset.v37Guard='1';
    editWrap.addEventListener('click',()=>setTimeout(()=>{
      const f=filmById(selectedId);if(!f)return;
      const chosen=[...editWrap.querySelectorAll('.genre-chip.on')]
        .map(b=>b.dataset.genre||b.textContent.trim()).filter(g=>SET.has(g));
      const base=rawGenres(f).filter(x=>!SET.has(x));
      setGenres(f.id,[...base,...chosen]);save(false);
    },0));
  }

  // Filters.
  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id);if(!s)continue;
    for(const g of EXTRA)if(![...s.options].some(o=>o.value===g))s.add(new Option(g,g));
  }
  function postFilter(root,cardSel,sectionSel,value){
    if(!SET.has(value))return;
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      let id=card.dataset.id||'';try{id=decodeURIComponent(id)}catch(_){}
      const f=filmById(id);if(f&&!rawGenres(f).includes(value))card.remove();
    });
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none'});
    if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none'});
  }
  const renderRankPrev=renderRank;
  renderRank=function(){
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s&&SET.has(v))s.value='';
    const out=renderRankPrev();
    if(s)s.value=v;
    postFilter('#rankRoot','.rank-card','.rank-star',v);
    return out;
  };
  const renderClassPrev=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s&&SET.has(v))s.value='';
    const out=renderClassPrev();
    if(s)s.value=v;
    postFilter('#classifyRoot','.card','.section',v);
    return out;
  };
  const rf=document.getElementById('genreFilterRank');if(rf)rf.onchange=renderRank;
  const cf=document.getElementById('genreFilterClassify');if(cf)cf.onchange=renderClassify;

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  render();
})();

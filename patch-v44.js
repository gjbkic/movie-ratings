(() => {
  // v44: four cross-genre descriptive tags. No automatic assignment and no score/rank changes.
  const BUILD='20260927a';
  const EXTRA=['雰囲気・美学','時間','特殊構造','バイオレンス'];
  const SET=new Set(EXTRA);

  function rawGenres(f){
    const g=state.genreOverrides?.[f?.id];
    return Array.isArray(g)?[...new Set(g)]:[];
  }
  function setGenres(f,genres,touch=true){
    if(!f)return false;
    state.genreOverrides=state.genreOverrides||{};
    const next=[...new Set((genres||[]).filter(Boolean))];
    const prev=rawGenres(f);
    if(prev.length===next.length&&prev.every((x,i)=>x===next[i]))return false;
    state.genreOverrides[f.id]=next;
    save(touch);return true;
  }
  function genreHost(wrap){
    if(!wrap)return null;
    const rows=[...wrap.querySelectorAll('.struct-row')];
    const row=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('ジャンル'))||rows[rows.length-1];
    return row?.querySelector('.struct-options')||wrap;
  }
  function removeEditChips(){
    const wrap=document.getElementById('editGenrePicker');
    if(!wrap)return;
    wrap.querySelectorAll('.genre-chip[data-v44="1"]').forEach(b=>b.remove());
  }
  function ensure(id,selected=[]){
    const wrap=document.getElementById(id);if(!wrap)return;
    const host=genreHost(wrap),chosen=new Set(selected||[]);
    for(const g of EXTRA){
      let b=wrap.querySelector(`.genre-chip[data-v44="1"][data-genre="${g}"]`);
      if(!b){
        b=document.createElement('button');
        b.type='button';b.className='struct-chip genre-chip';b.dataset.genre=g;b.dataset.v44='1';b.textContent=g;
        host?.appendChild(b);
      }
      if(host&&b.parentElement!==host)host.appendChild(b);
      b.classList.toggle('on',chosen.has(g));
      b.onclick=e=>{e.preventDefault();b.classList.toggle('on');};
    }
  }
  function selected(id){
    const wrap=document.getElementById(id);if(!wrap)return [];
    return [...wrap.querySelectorAll('.genre-chip[data-v44="1"].on')]
      .map(b=>b.dataset.genre).filter(g=>SET.has(g));
  }

  ensure('newGenrePicker',[]);ensure('qGenrePicker',[]);

  // New/manual additions: capture these tags before older handlers rebuild the picker.
  for(const [buttonId,pickerId] of [['addMovie','newGenrePicker'],['qAdd','qGenrePicker']]){
    const btn=document.getElementById(buttonId);if(!btn||!btn.onclick)continue;
    const prev=btn.onclick;
    btn.onclick=async function(ev){
      const extras=selected(pickerId);
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=prev.call(this,ev);if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created&&extras.length){
        const base=rawGenres(created).filter(g=>!SET.has(g));
        setGenres(created,[...base,...extras]);render();
      }
      ensure(pickerId,[]);
      return out;
    };
  }

  // TMDB selection can rebuild the quick-add picker.
  if(typeof selectTmdb==='function'){
    const prevSelect=selectTmdb;
    selectTmdb=async function(...args){
      const keep=selected('qGenrePicker');
      const out=await prevSelect.apply(this,args);
      ensure('qGenrePicker',keep);return out;
    };
  }

  // Editing. Remove our prior buttons before older wrappers run so legacy extra-tag code never captures them.
  const openPrev=openSheet;
  openSheet=function(id){
    removeEditChips();
    openPrev(id);
    const f=filmById(id);if(!f)return;
    ensure('editGenrePicker',rawGenres(f).filter(g=>SET.has(g)));
    const wrap=document.getElementById('editGenrePicker');
    wrap?.querySelectorAll('.genre-chip[data-v44="1"]').forEach(b=>{
      b.onclick=e=>{
        e.preventDefault();
        b.classList.toggle('on');
        const chosen=selected('editGenrePicker');
        const base=rawGenres(f).filter(g=>!SET.has(g));
        if(setGenres(f,[...base,...chosen]))render();
      };
    });
  };

  // Base/older tag handlers may rewrite genreOverrides. Restore the four v44 selections after their click handlers finish.
  const editWrap=document.getElementById('editGenrePicker');
  if(editWrap&&!editWrap.dataset.v44Guard){
    editWrap.dataset.v44Guard='1';
    editWrap.addEventListener('click',()=>setTimeout(()=>{
      const f=filmById(selectedId);if(!f)return;
      const chosen=selected('editGenrePicker');
      const base=rawGenres(f).filter(g=>!SET.has(g));
      setGenres(f,[...base,...chosen],false);
    },0));
  }

  // v38 already provides the multi-genre AND filter; it only needs these options to exist.
  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id);if(!s)continue;
    for(const g of EXTRA)if(![...s.options].some(o=>o.value===g))s.add(new Option(g,g));
    const first=s.options?.[0];if(first&&first.value==='')first.textContent='ジャンル追加…';
  }

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  render();
})();

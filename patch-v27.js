(() => {
  const EXTRA_GENRES_V27 = [
    "世界観","青春・若者","子供向け","差別・人権","精神・哲学","社会問題・生活",
    "スポーツ","胸糞","感動","切ない","どんでん返し"
  ];
  const EXTRA_SET_V27 = new Set(EXTRA_GENRES_V27);

  function rawGenresV27(f){
    const g=state.genreOverrides?.[f.id];
    return Array.isArray(g)?[...new Set(g)]:[];
  }
  function setGenresPreserveV27(id, genres){
    state.genreOverrides[id]=[...new Set((genres||[]).filter(Boolean))];
  }
  function genreOptionsV27(wrap){
    if(!wrap)return null;
    const rows=[...wrap.querySelectorAll('.struct-row')];
    const row=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('ジャンル')) || rows[rows.length-1];
    return row?.querySelector('.struct-options') || wrap;
  }
  function placeWorldviewV27(host,b){
    if(!host||!b)return;
    const fantasy=host.querySelector('.struct-chip[data-struct-value="ファンタジー"]');
    const adventure=host.querySelector('.struct-chip[data-struct-value="アドベンチャー"]');
    if(fantasy){
      host.insertBefore(b,fantasy.nextSibling);
    }else if(adventure){
      host.insertBefore(b,adventure);
    }else if(b.parentElement!==host){
      host.appendChild(b);
    }
  }
  function ensureExtraChipsV27(id, selected=[]){
    const wrap=document.getElementById(id); if(!wrap)return;
    const host=genreOptionsV27(wrap), chosen=new Set(selected);
    // Move chips created by older patches into the actual genre row and normalize their appearance.
    for(const old of [...wrap.querySelectorAll('.genre-chip')]){
      old.classList.add('struct-chip');
      if(host && old.parentElement!==host)host.appendChild(old);
    }
    for(const g of EXTRA_GENRES_V27){
      let b=wrap.querySelector(`.genre-chip[data-genre="${g}"]`);
      if(!b){
        b=document.createElement('button');
        b.type='button'; b.className='struct-chip genre-chip'; b.dataset.genre=g; b.textContent=g;
        host?.appendChild(b);
      }
      if(g==='世界観') placeWorldviewV27(host,b);
      b.classList.toggle('on',chosen.has(g));
      b.onclick=()=>b.classList.toggle('on');
    }
  }
  function selectedExtrasV27(id){
    const wrap=document.getElementById(id); if(!wrap)return [];
    return [...wrap.querySelectorAll('.genre-chip.on')].map(b=>b.dataset.genre||b.textContent.trim()).filter(g=>EXTRA_SET_V27.has(g));
  }

  ensureExtraChipsV27('newGenrePicker',[]);
  ensureExtraChipsV27('qGenrePicker',[]);

  // New/manual additions: v19 only knows the original genre list, so merge extra tags after it creates the film.
  for(const [buttonId,pickerId] of [['addMovie','newGenrePicker'],['qAdd','qGenrePicker']]){
    const btn=document.getElementById(buttonId); if(!btn)continue;
    const previous=btn.onclick;
    btn.onclick=async function(ev){
      const extras=selectedExtrasV27(pickerId);
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=previous?.call(this,ev);
      if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created&&extras.length){
        setGenresPreserveV27(created.id,[...rawGenresV27(created),...extras]);
        save(); render();
      }
      // v19 rebuilds the picker after a successful add, so put the extra chips back.
      ensureExtraChipsV27(pickerId,[]);
      return out;
    };
  }

  // Editing: unify all extra tags and keep them when an original/base genre is toggled.
  const openSheetV26=openSheet;
  openSheet=function(id){
    openSheetV26(id);
    const f=filmById(id); if(!f)return;
    const wrap=document.getElementById('editGenrePicker'); if(!wrap)return;
    let extras=new Set(rawGenresV27(f).filter(g=>EXTRA_SET_V27.has(g)));
    ensureExtraChipsV27('editGenrePicker',[...extras]);

    wrap.querySelectorAll('.genre-chip').forEach(b=>{
      const g=b.dataset.genre||b.textContent.trim();
      b.classList.toggle('on',extras.has(g));
      b.onclick=()=>{
        extras.has(g)?extras.delete(g):extras.add(g);
        b.classList.toggle('on',extras.has(g));
        const currentBase=rawGenresV27(f).filter(x=>!EXTRA_SET_V27.has(x));
        setGenresPreserveV27(f.id,[...currentBase,...extras]);
        save(); render();
      };
    });

    // v19's base-genre handler rewrites genreOverrides using only its original list.
    // Restore currently selected extra tags immediately after a base genre click.
    wrap.addEventListener('click',e=>{
      const b=e.target.closest('.struct-chip[data-multi="1"]');
      if(!b || b.classList.contains('genre-chip'))return;
      const currentBase=rawGenresV27(f).filter(x=>!EXTRA_SET_V27.has(x));
      setGenresPreserveV27(f.id,[...currentBase,...extras]);
      save();
    });
  };

  // Filters: bypass older/base genre filtering for any extra tag, then filter the rendered cards ourselves.
  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id); if(!s)continue;
    for(const g of EXTRA_GENRES_V27){
      if([...s.options].some(o=>o.value===g))continue;
      const opt=new Option(g,g);
      if(g==='世界観'){
        const fantasy=[...s.options].find(o=>o.value==='ファンタジー');
        const adventure=[...s.options].find(o=>o.value==='アドベンチャー');
        if(fantasy) s.insertBefore(opt,fantasy.nextSibling);
        else if(adventure) s.insertBefore(opt,adventure);
        else s.add(opt);
      }else s.add(opt);
    }
  }
  function filterExtraV27(rootSelector,cardSelector,sectionSelector,value){
    if(!EXTRA_SET_V27.has(value))return;
    document.querySelectorAll(`${rootSelector} ${cardSelector}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f&&!rawGenresV27(f).includes(value))card.remove();
    });
    document.querySelectorAll(`${rootSelector} ${sectionSelector}`).forEach(sec=>{
      if(!sec.querySelector(cardSelector))sec.style.display='none';
    });
  }
  const renderRankV26=renderRank;
  renderRank=function(){
    const s=document.getElementById('genreFilterRank'),v=s?.value||'';
    if(s&&EXTRA_SET_V27.has(v))s.value='';
    renderRankV26();
    if(s)s.value=v;
    filterExtraV27('#rankRoot','.rank-card','.rank-star',v);
    if(EXTRA_SET_V27.has(v))document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none'});
  };
  const renderClassifyV26=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('genreFilterClassify'),v=s?.value||'';
    if(s&&EXTRA_SET_V27.has(v))s.value='';
    renderClassifyV26();
    if(s)s.value=v;
    filterExtraV27('#classifyRoot','.card','.section',v);
  };
  const rf=document.getElementById('genreFilterRank'); if(rf)rf.onchange=renderRank;
  const cf=document.getElementById('genreFilterClassify'); if(cf)cf.onchange=renderClassify;

  render();
})();

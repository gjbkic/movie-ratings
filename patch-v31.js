(() => {
  // v31: add TV/series drama as a top-level media type without disturbing movie-genre "ドラマ".
  const DRAMA_VALUE='drama';
  const DRAMA_LABEL='ドラマ';
  const DRAMA_STORE='movie30_media_drama_ids_v1';
  const VALID_MEDIA31=new Set(['movie','documentary','drama','other']);

  function readDramaIds(){
    try{
      const a=JSON.parse(localStorage.getItem(DRAMA_STORE)||'[]');
      return new Set(Array.isArray(a)?a:[]);
    }catch(_){return new Set();}
  }
  function writeDramaIds(set){
    try{localStorage.setItem(DRAMA_STORE,JSON.stringify([...set]))}catch(_){}
  }
  let dramaIds=readDramaIds();

  // v21 predates this type and normalizes unknown media values back to movie on load.
  // Restore the separately remembered drama ids after v21 has finished.
  for(const id of [...dramaIds]){
    if(filmById(id)) state.mediaTypeOverrides[id]=DRAMA_VALUE;
    else dramaIds.delete(id);
  }
  writeDramaIds(dramaIds);

  function rawMedia31(f){
    if(!f)return 'movie';
    if(dramaIds.has(f.id))return DRAMA_VALUE;
    const v=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'movie');
    if(v==='series')return 'other';
    return VALID_MEDIA31.has(v)?v:'movie';
  }
  function mediaLabel31(f){
    const v=rawMedia31(f);
    return v==='documentary'?'ドキュメンタリー':v==='drama'?'ドラマ':v==='other'?'その他':'映画';
  }
  function setMedia31(f,value){
    if(!f)return;
    if(value===DRAMA_VALUE){
      dramaIds.add(f.id);
      state.mediaTypeOverrides[f.id]=DRAMA_VALUE;
    }else{
      dramaIds.delete(f.id);
      if(value==='movie')delete state.mediaTypeOverrides[f.id];
      else state.mediaTypeOverrides[f.id]=value;
    }
    writeDramaIds(dramaIds);
  }

  // Hidden legacy selects are not shown, but keep their option lists coherent.
  for(const id of ['newMediaType','qMediaType','editMediaType']){
    const s=document.getElementById(id); if(!s)continue;
    if(![...s.options].some(o=>o.value===DRAMA_VALUE)){
      const opt=new Option(DRAMA_LABEL,DRAMA_VALUE);
      const other=[...s.options].find(o=>o.value==='other');
      if(other)s.insertBefore(opt,other);else s.add(opt);
    }
  }

  const addMediaChoice={newGenrePicker:'movie',qGenrePicker:'movie'};
  function mediaRow31(wrap){return wrap?.querySelectorAll('.struct-row')?.[0]||null;}
  function ensureDramaButton31(wrap){
    const row=mediaRow31(wrap); if(!row)return null;
    const host=row.querySelector('.struct-options')||row;
    let b=host.querySelector(`[data-struct-value="${DRAMA_VALUE}"]`);
    if(!b){
      b=document.createElement('button');
      b.type='button'; b.className='struct-chip'; b.dataset.structValue=DRAMA_VALUE; b.dataset.multi='0'; b.textContent=DRAMA_LABEL;
      const other=host.querySelector('[data-struct-value="other"]');
      if(other)host.insertBefore(b,other);else host.appendChild(b);
    }
    return b;
  }
  function paintMediaRow31(row,value){
    row?.querySelectorAll('.struct-chip').forEach(b=>b.classList.toggle('on',b.dataset.structValue===value));
  }
  function bindAddMedia31(id,value){
    const wrap=document.getElementById(id); if(!wrap)return;
    ensureDramaButton31(wrap);
    const row=mediaRow31(wrap); if(!row)return;
    const selected=VALID_MEDIA31.has(value)?value:'movie';
    addMediaChoice[id]=selected;
    paintMediaRow31(row,selected);
    row.querySelectorAll('.struct-chip').forEach(b=>{
      const v=b.dataset.structValue;
      if(!VALID_MEDIA31.has(v))return;
      b.onclick=(ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        addMediaChoice[id]=v;
        paintMediaRow31(row,v);
      };
    });
  }
  bindAddMedia31('newGenrePicker','movie');
  bindAddMedia31('qGenrePicker','movie');

  // TMDB selection can rebuild the quick-add picker; rebind our fourth media choice afterwards.
  const selectTmdbV30=selectTmdb;
  selectTmdb=async function(id){
    const out=await selectTmdbV30(id);
    const wrap=document.getElementById('qGenrePicker'),row=mediaRow31(wrap);
    const active=[...row?.querySelectorAll('.struct-chip.on')||[]].find(b=>VALID_MEDIA31.has(b.dataset.structValue));
    bindAddMedia31('qGenrePicker',active?.dataset.structValue||'movie');
    return out;
  };

  // v19 owns creation; overwrite only the chosen top-level media type after a successful add.
  function wrapAdd31(buttonId,pickerId){
    const btn=document.getElementById(buttonId); if(!btn||!btn.onclick)return;
    const previous=btn.onclick;
    btn.onclick=async function(ev){
      const chosen=addMediaChoice[pickerId]||'movie';
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=previous.call(this,ev);
      if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created){
        setMedia31(created,chosen);
        save(); render();
      }
      bindAddMedia31(pickerId,'movie');
      return out;
    };
  }
  wrapAdd31('addMovie','newGenrePicker');
  wrapAdd31('qAdd','qGenrePicker');

  function updateSheetMeta31(f){
    const el=document.getElementById('sheetMeta'); if(!el||!f)return;
    const origin=state.originOverrides?.[f.id]||'ハリウッド';
    const fv=state.formatOverrides?.[f.id]||'live';
    const format=fv==='animation'?'アニメ':fv==='hybrid'?'実写・アニメ':'実写';
    const rt=Number(state.runtimeOverrides?.[f.id]??f.runtime);
    el.textContent=`${f.year||''} · ${mediaLabel31(f)} · ${origin} · ${format}${Number.isFinite(rt)&&rt>0?' · '+rt+'分':''}`;
  }

  const openSheetV30=openSheet;
  openSheet=function(id){
    openSheetV30(id);
    const f=filmById(id); if(!f)return;
    const wrap=document.getElementById('editGenrePicker'); if(!wrap)return;
    ensureDramaButton31(wrap);
    const row=mediaRow31(wrap); if(!row)return;
    let current=rawMedia31(f);
    paintMediaRow31(row,current);
    row.querySelectorAll('.struct-chip').forEach(b=>{
      const v=b.dataset.structValue;
      if(!VALID_MEDIA31.has(v))return;
      b.onclick=(ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        current=v;
        setMedia31(f,v);
        paintMediaRow31(row,current);
        save();
        updateSheetMeta31(f);
      };
    });
    // Older origin/format callbacks carry an old media value in their closure; if this is a drama,
    // re-assert it after those clicks so changing another field cannot silently erase the type.
    [...wrap.querySelectorAll('.struct-row')].slice(1,3).forEach(r=>r.querySelectorAll('.struct-chip').forEach(b=>{
      const old=b.onclick;
      b.onclick=function(ev){
        const out=old?.call(this,ev);
        if(current===DRAMA_VALUE){setMedia31(f,DRAMA_VALUE);save();updateSheetMeta31(f);}
        return out;
      };
    }));
    updateSheetMeta31(f);
  };

  // Add the fourth type to ranking/classification filters.
  for(const id of ['mediaFilterRank','mediaFilterClassify']){
    const s=document.getElementById(id); if(!s)continue;
    if(![...s.options].some(o=>o.value===DRAMA_VALUE)){
      const opt=new Option(DRAMA_LABEL,DRAMA_VALUE);
      const other=[...s.options].find(o=>o.value==='other');
      if(other)s.insertBefore(opt,other);else s.add(opt);
    }
  }
  function filterDrama31(root,cardSel,sectionSel,value){
    if(value!==DRAMA_VALUE)return;
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));
      if(f&&rawMedia31(f)!==DRAMA_VALUE)card.remove();
    });
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none'});
    if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector('.rank-card'))bin.style.display='none'});
  }
  const renderRankV30=renderRank;
  renderRank=function(){
    const s=document.getElementById('mediaFilterRank'),v=s?.value||'';
    if(s&&v===DRAMA_VALUE)s.value='';
    renderRankV30();
    if(s)s.value=v;
    filterDrama31('#rankRoot','.rank-card','.rank-star',v);
  };
  const renderClassifyV30=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('mediaFilterClassify'),v=s?.value||'';
    if(s&&v===DRAMA_VALUE)s.value='';
    renderClassifyV30();
    if(s)s.value=v;
    filterDrama31('#classifyRoot','.card','.section',v);
  };
  const mr=document.getElementById('mediaFilterRank');if(mr)mr.onchange=renderRank;
  const mc=document.getElementById('mediaFilterClassify');if(mc)mc.onchange=renderClassify;

  // Search can also match the new top-level type label.
  const matchV30=match;
  match=function(f,q){
    if(matchV30(f,q))return true;
    if(!q)return true;
    return mediaLabel31(f).toLowerCase().includes(String(q).toLowerCase());
  };

  // Replace the old diagnostic build marker text; index/app-version remain the authority.
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build 20260924s';

  save(false);
  render();
})();

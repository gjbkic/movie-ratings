(() => {
  // v38: multi-genre combination search. Selected genres are ANDed together.
  const BUILD='20260925zb';
  const style=document.createElement('style');
  style.textContent=`
    .genre-combo{flex:1 0 100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:1px;min-height:0}
    .genre-combo:empty{display:none}
    .genre-combo-chip{border:1px solid var(--accent);background:rgba(67,209,125,.09);color:#eafff1;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:750}
    .genre-combo-chip span{opacity:.72;margin-left:4px}
    .genre-combo-clear{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:999px;padding:6px 9px;font-size:10px}
  `;
  document.head.appendChild(style);

  const chosen={Rank:new Set(),Classify:new Set()};

  function filmGenres38(f){
    const g=state.genreOverrides?.[f?.id];
    return Array.isArray(g)?g:[];
  }
  function cleanSections(root,cardSel,sectionSel){
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none';});
    if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none';});
  }
  function applyCombo(root,cardSel,sectionSel,set){
    if(!set.size)return;
    const wanted=[...set];
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      let id=card.dataset.id||'';try{id=decodeURIComponent(id)}catch(_){}
      const f=filmById(id);if(!f)return;
      const gs=filmGenres38(f);
      if(!wanted.every(g=>gs.includes(g)))card.remove();
    });
    cleanSections(root,cardSel,sectionSel);
  }

  function comboHost(suffix){
    const select=document.getElementById('genreFilter'+suffix);if(!select)return null;
    let host=document.getElementById('genreCombo'+suffix);
    if(!host){
      host=document.createElement('div');host.id='genreCombo'+suffix;host.className='genre-combo';
      select.insertAdjacentElement('afterend',host);
    }
    return host;
  }
  function paintCombo(suffix){
    const host=comboHost(suffix),set=chosen[suffix];if(!host)return;
    host.innerHTML='';
    for(const g of set){
      const b=document.createElement('button');b.type='button';b.className='genre-combo-chip';
      b.innerHTML=`${esc(g)}<span>×</span>`;
      b.onclick=()=>{set.delete(g);paintCombo(suffix);suffix==='Rank'?renderRank():renderClassify();};
      host.appendChild(b);
    }
    if(set.size){
      const c=document.createElement('button');c.type='button';c.className='genre-combo-clear';c.textContent='ジャンル解除';
      c.onclick=()=>{set.clear();paintCombo(suffix);suffix==='Rank'?renderRank():renderClassify();};
      host.appendChild(c);
    }
  }
  function prepareSelect(suffix){
    const s=document.getElementById('genreFilter'+suffix);if(!s)return;
    const first=s.options?.[0];if(first&&first.value==='')first.textContent='ジャンル追加…';
    s.value='';
    s.onchange=()=>{
      const v=s.value;
      if(v)chosen[suffix].add(v);
      s.value='';paintCombo(suffix);
      suffix==='Rank'?renderRank():renderClassify();
    };
    comboHost(suffix);paintCombo(suffix);
  }

  const rankPrev=renderRank;
  renderRank=function(){
    const s=document.getElementById('genreFilterRank');
    if(s)s.value=''; // bypass all legacy single-genre filters
    const out=rankPrev();
    if(s){s.value='';const first=s.options?.[0];if(first&&first.value==='')first.textContent='ジャンル追加…';}
    applyCombo('#rankRoot','.rank-card','.rank-star',chosen.Rank);
    paintCombo('Rank');
    return out;
  };
  const classPrev=renderClassify;
  renderClassify=function(){
    const s=document.getElementById('genreFilterClassify');
    if(s)s.value='';
    const out=classPrev();
    if(s){s.value='';const first=s.options?.[0];if(first&&first.value==='')first.textContent='ジャンル追加…';}
    applyCombo('#classifyRoot','.card','.section',chosen.Classify);
    paintCombo('Classify');
    return out;
  };

  prepareSelect('Rank');prepareSelect('Classify');

  // Several older patches attached concrete render function objects to controls.
  // Rebind them so combination filtering is always re-applied after any other filter/search changes.
  const sr=document.getElementById('searchRank');if(sr)sr.oninput=renderRank;
  const sc=document.getElementById('searchClassify');if(sc)sc.oninput=renderClassify;
  for(const id of ['mediaFilterRank','originFilterRank','formatFilterRank','decadeFilterRank','runtimeFilterRank']){const e=document.getElementById(id);if(e)e.onchange=renderRank;}
  for(const id of ['mediaFilterClassify','originFilterClassify','formatFilterClassify','decadeFilterClassify','runtimeFilterClassify']){const e=document.getElementById(id);if(e)e.onchange=renderClassify;}
  const gr=document.getElementById('genreFilterRank');if(gr)gr.onchange=()=>{const v=gr.value;if(v)chosen.Rank.add(v);gr.value='';paintCombo('Rank');renderRank();};
  const gc=document.getElementById('genreFilterClassify');if(gc)gc.onchange=()=>{const v=gc.value;if(v)chosen.Classify.add(v);gc.value='';paintCombo('Classify');renderClassify();};

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  render();
})();

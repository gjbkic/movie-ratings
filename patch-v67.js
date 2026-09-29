(() => {
  const BUILD='20260929b';
  const style=document.createElement('style');
  style.textContent=`
    .uns-card-v67{display:flex!important;flex-direction:column;gap:7px;cursor:default!important}
    .uns-main-v67{width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer}
    .uns-genres-v67{font-size:9px;line-height:1.35;color:#aeb7c4;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .uns-genres-v67.empty{color:#d8b45c}
    .uns-actions-v67{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:1px}
    .uns-action-v67{border:1px solid var(--line);background:#0b0f14;color:#dbe3ec;border-radius:7px;padding:6px 5px;font-size:9.5px;font-weight:800}
    .uns-action-v67.score{border-color:#35513f;color:#a9e8bd;background:rgba(67,209,125,.06)}
  `;
  document.head.appendChild(style);

  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  function decorateUnratedV67(){
    document.querySelectorAll('#rankRoot .uns-card[data-uns]').forEach(old=>{
      if(old.dataset.v67==='1')return;
      const encoded=old.dataset.uns||'';
      let id='';try{id=decodeURIComponent(encoded)}catch(_){id=encoded}
      const f=filmById(id);if(!f)return;
      const scoreAction=old.onclick;
      const genres=uniq(state.genreOverrides?.[id]||[]);
      const wrap=document.createElement('div');
      wrap.className=old.className+' uns-card-v67';
      wrap.dataset.uns=encoded;wrap.dataset.v67='1';
      wrap.innerHTML=`<button type="button" class="uns-main-v67"><strong>${esc(displayTitle(f))}${f.source==='letterboxd'?'<span class="source-pill">LB</span>':''}</strong><div class="uns-genres-v67${genres.length?'':' empty'}">${genres.length?esc(genres.join(' · ')):'ジャンル未設定'}</div><small>${stars(filmStar(f))}${f.year?' · '+esc(f.year):''}</small></button><div class="uns-actions-v67"><button type="button" class="uns-action-v67" data-edit-v67="1">ジャンル編集</button><button type="button" class="uns-action-v67 score" data-score-v67="1">採点</button></div>`;
      old.replaceWith(wrap);
      const openEdit=()=>openSheet(id);
      wrap.querySelector('.uns-main-v67').onclick=openEdit;
      wrap.querySelector('[data-edit-v67]').onclick=openEdit;
      wrap.querySelector('[data-score-v67]').onclick=()=>{
        if(typeof scoreAction==='function')scoreAction.call(old);
        else openEdit();
      };
    });
  }

  const renderRankV67=renderRank;
  renderRank=function(...args){
    const out=renderRankV67(...args);
    decorateUnratedV67();
    return out;
  };
  decorateUnratedV67();
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

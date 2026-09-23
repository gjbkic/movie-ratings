(() => {
  // v22: exact-score comparison workflow, faster rank navigation and continuous drag auto-scroll.
  const style = document.createElement('style');
  style.textContent = `
    .tabs{grid-template-columns:repeat(3,1fr)!important}
    .star-jump{position:sticky;z-index:24;display:flex;gap:5px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:7px 3px;margin:5px 0 8px;background:rgba(7,9,12,.96);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06);scrollbar-width:none}
    .star-jump::-webkit-scrollbar{display:none}.star-jump button{flex:0 0 auto;border:1px solid var(--line);background:#10151c;color:#d4dbe4;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800}.star-jump button.unrated{border-color:#8d7130;color:#ffe08a}.star-jump button:disabled{opacity:.3}
    .rank-star,.uns-panel{scroll-margin-top:150px}
    .compare-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:200;align-items:flex-end;justify-content:center}.compare-bg.open{display:flex}.compare-sheet{width:min(760px,100%);max-height:94vh;overflow:auto;background:#10151c;border:1px solid #2a323d;border-radius:20px 20px 0 0;padding:12px 10px calc(16px + env(safe-area-inset-bottom))}.compare-head{position:sticky;top:-12px;z-index:2;background:#10151c;padding:6px 2px 10px;border-bottom:1px solid var(--line)}.compare-title{font-size:18px;font-weight:900}.compare-sub{font-size:10px;color:var(--muted);line-height:1.45;margin-top:4px}.compare-nav{display:flex;gap:6px;margin-top:8px}.compare-nav .btn{flex:1}.compare-score{margin-top:10px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#0b0f14}.compare-score-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#121923;border-bottom:1px solid var(--line)}.compare-score-head strong{font-size:18px}.compare-score-head small{font-size:9px;color:var(--muted)}.compare-film{padding:8px 10px;border-top:1px solid rgba(255,255,255,.055)}.compare-film:first-of-type{border-top:0}.compare-film strong{font-size:11.5px}.compare-film small{display:block;font-size:9px;color:var(--muted);margin-top:2px}.compare-slot{width:100%;border:0;border-top:1px dashed #35513f;border-bottom:1px dashed #35513f;background:rgba(67,209,125,.06);color:#a9e8bd;padding:7px 8px;font-size:10px;font-weight:800}.compare-slot:active{background:rgba(67,209,125,.16)}.compare-empty{font-size:10px;color:var(--muted);padding:9px 10px}.compare-close{width:100%;margin-top:12px}.just-placed{animation:placedFlash 2.4s ease-out}@keyframes placedFlash{0%,30%{outline:3px solid var(--accent);box-shadow:0 0 0 5px rgba(67,209,125,.18)}100%{outline:0 solid transparent;box-shadow:none}}
    .uns-card{cursor:pointer}.uns-head small{color:#d8b45c!important}
    @media(max-width:560px){.star-jump button{padding:6px 8px}.compare-sheet{padding-left:7px;padding-right:7px}.compare-title{font-size:17px}}
  `;
  document.head.appendChild(style);

  // Retire the old high/mid/low workflow visually; keep legacy state for backward compatibility.
  const classifyTab = document.querySelector('.tab[data-page="classify"]');
  if (classifyTab) classifyTab.style.display = 'none';
  const classifyPage = document.getElementById('page-classify');
  if (classifyPage) classifyPage.style.display = 'none';
  if (view.page === 'classify') view.page = 'rank';
  const choiceGrid = document.querySelector('#sheetBg .choicegrid');
  if (choiceGrid) choiceGrid.style.display = 'none';
  document.querySelectorAll('#page-data .panel h2').forEach(h => {
    if (h.textContent.includes('星内の上・中・下')) h.closest('.panel')?.classList.add('hidden');
  });

  // A blank exact score means "unrated / pending comparison" from now on.
  const addFilmV21 = addFilm;
  addFilm = function(title, year, category, star, score, meta = {}) {
    const blank = score === '' || score == null;
    return addFilmV21(title, year, category, star, score, blank ? {...meta, keepUnscored:true} : meta);
  };

  // Comparison overlay.
  const compareBg = document.createElement('div');
  compareBg.id = 'compareBg';
  compareBg.className = 'compare-bg';
  compareBg.innerHTML = `<div class="compare-sheet"><div class="compare-head"><div class="compare-title" id="compareTitle"></div><div class="compare-sub" id="compareSub"></div><div class="compare-nav"><button class="btn" id="compareUp">もっと上を見る</button><button class="btn" id="compareDown">もっと下を見る</button></div></div><div id="compareBody"></div><button class="btn compare-close" id="compareClose">閉じる</button></div>`;
  document.body.appendChild(compareBg);
  let compareCtx = null;

  function starBounds(star) {
    const s = Number(star);
    const r = STAR_RANGES[sk(s)];
    if (r && Number.isFinite(r[0]) && Number.isFinite(r[1])) return [Number(r[0]), Number(r[1])];
    const map = state.scoreMap?.[sk(s)] || DEFAULT_MAP?.[sk(s)] || {low:0,mid:50,high:100};
    return [Number(map.low ?? 0), Number(map.high ?? 100)];
  }
  function suggestedScore(f) {
    const existing = effectiveScore(f);
    if (existing != null && Number.isFinite(Number(existing))) return Number(existing);
    const [lo, hi] = starBounds(filmStar(f));
    return Math.max(0, Math.min(100, Math.round((lo + hi) / 2)));
  }
  function orderedAtScore(score, exceptId) {
    const arr = allFilms().filter(f => f.id !== exceptId && Number(effectiveScore(f)) === Number(score));
    return rankSorted(arr, Number(score));
  }
  function scoreBlock(score, candidateId) {
    const films = orderedAtScore(score, candidateId);
    const rows = [];
    for (let i = 0; i <= films.length; i++) {
      let label = films.length ? (i === 0 ? 'ここに入れる（この点数の先頭）' : i === films.length ? 'ここに入れる（この点数の末尾）' : 'ここに入れる') : 'この点数に入れる';
      rows.push(`<button class="compare-slot" type="button" data-score="${score}" data-index="${i}">${label}</button>`);
      if (i < films.length) {
        const x = films[i];
        rows.push(`<div class="compare-film"><strong>${esc(displayTitle(x))}</strong><small>${esc(x.year||'')} · ${Number(score)}点</small></div>`);
      }
    }
    return `<section class="compare-score"><div class="compare-score-head"><strong>${score}点</strong><small>${films.length}本</small></div>${rows.join('')}</section>`;
  }
  function renderCompare() {
    if (!compareCtx) return;
    const f = filmById(compareCtx.id); if (!f) return;
    const hi = Math.min(100, compareCtx.center + 3), lo = Math.max(0, compareCtx.center - 3);
    document.getElementById('compareTitle').textContent = displayTitle(f);
    document.getElementById('compareSub').textContent = `★${filmStar(f)}を目安に${lo}〜${hi}点を表示中。既存作品と比べて、入れたい位置の「ここに入れる」を押すと点数と同点内順位を同時に確定します。`;
    const blocks = [];
    for (let s = hi; s >= lo; s--) blocks.push(scoreBlock(s, f.id));
    const body = document.getElementById('compareBody');
    body.innerHTML = blocks.join('');
    body.querySelectorAll('.compare-slot').forEach(b => b.onclick = () => placeCompared(f.id, Number(b.dataset.score), Number(b.dataset.index)));
    document.getElementById('compareUp').disabled = hi >= 100;
    document.getElementById('compareDown').disabled = lo <= 0;
  }
  function openCompare(id) {
    const f = filmById(id); if (!f) return;
    compareCtx = {id, center:suggestedScore(f)};
    renderCompare();
    compareBg.classList.add('open');
    compareBg.querySelector('.compare-sheet').scrollTop = 0;
  }
  function closeCompare() { compareBg.classList.remove('open'); compareCtx = null; }
  function placeCompared(id, score, index) {
    const f = filmById(id); if (!f) return;
    for (const k of Object.keys(state.rankOrder || {})) state.rankOrder[k] = (state.rankOrder[k] || []).filter(x => x !== id);
    state.exactScores[id] = score;
    const st = scoreToStar(score);
    state.starOverrides[id] = st;
    state.assignments[id] = nearestTier(st, score); // legacy-only compatibility
    const ids = orderedAtScore(score, id).map(x => x.id);
    ids.splice(Math.max(0, Math.min(ids.length, index)), 0, id);
    state.rankOrder[String(score)] = ids;
    save();
    closeCompare();
    view.page = 'rank';
    save();
    render();
    setTimeout(() => focusRankCard(id), 80);
    toast(`${score}点に確定しました`);
  }
  function focusRankCard(id) {
    let card = document.querySelector(`.rank-card[data-id="${encodeURIComponent(id)}"]`);
    if (!card) {
      // Filters can hide the just-rated film. Clear only ranking filters so it can be found.
      const search = document.getElementById('searchRank'); if (search) search.value = '';
      for (const p of ['genreFilterRank','mediaFilterRank','originFilterRank','formatFilterRank','decadeFilterRank','runtimeFilterRank']) { const e=document.getElementById(p); if(e)e.value=''; }
      renderRank();
      card = document.querySelector(`.rank-card[data-id="${encodeURIComponent(id)}"]`);
    }
    if (!card) return;
    card.scrollIntoView({behavior:'smooth', block:'center'});
    card.classList.add('just-placed');
    setTimeout(() => card?.classList.remove('just-placed'), 2600);
  }
  document.getElementById('compareClose').onclick = closeCompare;
  compareBg.onclick = e => { if (e.target === compareBg) closeCompare(); };
  document.getElementById('compareUp').onclick = () => { if(compareCtx){ compareCtx.center=Math.min(100,compareCtx.center+6); renderCompare(); } };
  document.getElementById('compareDown').onclick = () => { if(compareCtx){ compareCtx.center=Math.max(0,compareCtx.center-6); renderCompare(); } };

  // Editing an already-scored film can also jump straight into comparison mode.
  const sheetTools = document.querySelector('#sheetBg .tools');
  if (sheetTools && !document.getElementById('compareCurrent')) {
    const b = document.createElement('button'); b.id='compareCurrent'; b.className='btn'; b.type='button'; b.textContent='他作品と比較して位置調整';
    sheetTools.insertBefore(b, sheetTools.firstChild);
    b.onclick = () => { const id=selectedId; closeSheet(); if(id)openCompare(id); };
  }

  // Star table-of-contents for quick jumps.
  const rankRoot = document.getElementById('rankRoot');
  let jumpBar = document.getElementById('starJumpBar');
  if (!jumpBar && rankRoot) {
    jumpBar = document.createElement('nav'); jumpBar.id='starJumpBar'; jumpBar.className='star-jump'; rankRoot.insertAdjacentElement('beforebegin', jumpBar);
  }
  function compactStar(s) { return s === .5 ? '½' : (Number.isInteger(s) ? `${s}★` : `${Math.floor(s)}½★`); }
  function findStarSection(star) {
    const label = stars(star);
    return [...document.querySelectorAll('#rankRoot .rank-star')].find(sec => sec.querySelector('.rank-star-head strong')?.textContent?.trim() === label) || null;
  }
  function renderJumpBar() {
    if (!jumpBar) return;
    const uns = document.querySelector('#rankRoot .uns-panel');
    jumpBar.innerHTML = `${uns?'<button type="button" class="unrated" data-jump-uns="1">未確定</button>':''}` + STAR_ORDER.map(s => `<button type="button" data-jump-star="${s}">${compactStar(s)}</button>`).join('');
    jumpBar.querySelectorAll('[data-jump-star]').forEach(b => {
      const star=Number(b.dataset.jumpStar), target=findStarSection(star); b.disabled=!target;
      b.onclick=()=>{const t=findStarSection(star);if(t)t.scrollIntoView({behavior:'smooth',block:'start'});};
    });
    const ub=jumpBar.querySelector('[data-jump-uns]'); if(ub)ub.onclick=()=>document.querySelector('#rankRoot .uns-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    const h=document.querySelector('.top')?.getBoundingClientRect().height||96; jumpBar.style.top=`${Math.round(h)}px`;
  }
  window.addEventListener('resize',()=>{if(jumpBar){const h=document.querySelector('.top')?.getBoundingClientRect().height||96;jumpBar.style.top=`${Math.round(h)}px`;}});

  // Continuous drag auto-scroll. Holding near the top/bottom keeps moving the page even without more pointer events.
  let dragPoint = null, dragRaf = 0;
  function nearestScoreList(x,y) {
    if (dragCtx?.ghost) dragCtx.ghost.style.display='none';
    const el=document.elementFromPoint(x,y);
    if (dragCtx?.ghost) dragCtx.ghost.style.display='';
    const direct=el?.closest?.('.score-list'); if(direct&&direct.offsetParent!==null)return direct;
    let best=null,bestD=Infinity;
    for(const list of document.querySelectorAll('#rankRoot .score-list')){
      if(list.offsetParent===null)continue;
      const r=list.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight)continue;
      const dx=x<r.left?r.left-x:x>r.right?x-r.right:0;
      const dy=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;
      const d=dy*4+dx; if(d<bestD){bestD=d;best=list;}
    }
    return best;
  }
  function placeDragNearest(x,y){
    if(!dragCtx)return;
    const list=nearestScoreList(x,y); if(!list)return;
    document.querySelectorAll('.drop-hot').forEach(e=>e.classList.remove('drop-hot')); list.classList.add('drop-hot');
    const card=dragCtx.card, others=[...list.querySelectorAll('.rank-card')].filter(c=>c!==card);
    if(!others.length){list.appendChild(card);return;}
    let nearest=others[0],best=Infinity;
    for(const c of others){const r=c.getBoundingClientRect(),cy=r.top+r.height/2,d=Math.abs(y-cy);if(d<best){best=d;nearest=c;}}
    const r=nearest.getBoundingClientRect(); list.insertBefore(card,y<r.top+r.height/2?nearest:nearest.nextSibling);
  }
  function stopDragAuto(){if(dragRaf)cancelAnimationFrame(dragRaf);dragRaf=0;dragPoint=null;}
  function dragAutoFrame(){
    dragRaf=0; if(!dragCtx||!dragPoint)return;
    const y=dragPoint.y, top=(document.querySelector('.top')?.getBoundingClientRect().bottom||90), upper=Math.min(innerHeight*.38,top+150), lower=Math.max(innerHeight*.62,innerHeight-145);
    let dy=0;
    if(y<upper){const p=Math.max(0,Math.min(1,(upper-y)/Math.max(70,upper-top+70)));dy=-(5+36*p*p);}
    else if(y>lower){const p=Math.max(0,Math.min(1,(y-lower)/Math.max(70,innerHeight-lower)));dy=5+36*p*p;}
    if(dy){window.scrollBy(0,dy);placeDragNearest(dragPoint.x,dragPoint.y);}
    dragRaf=requestAnimationFrame(dragAutoFrame);
  }
  function ensureDragAuto(){if(!dragRaf)dragRaf=requestAnimationFrame(dragAutoFrame);}
  const startDragV21=startDrag, endDragV21=endDrag, cancelDragV21=cancelDrag;
  startDrag=function(e){startDragV21(e);if(dragCtx){dragPoint={x:e.clientX,y:e.clientY};ensureDragAuto();}};
  moveDrag=function(e){if(!dragCtx)return;e.preventDefault();dragPoint={x:e.clientX,y:e.clientY};moveGhost(e);placeDragNearest(e.clientX,e.clientY);ensureDragAuto();};
  endDrag=function(e){stopDragAuto();endDragV21(e);};
  cancelDrag=function(){stopDragAuto();cancelDragV21();};

  const renderRankV21 = renderRank;
  renderRank = function(){
    renderRankV21();
    const uns = document.querySelector('#rankRoot .uns-panel');
    if (uns) {
      const head=uns.querySelector('.uns-head');
      if(head){const strong=head.querySelector('strong');if(strong)strong.textContent='未確定';const small=head.querySelector('small');if(small)small.textContent='比較して点数を決める';}
      uns.querySelectorAll('[data-uns]').forEach(b=>{b.onclick=()=>openCompare(decodeURIComponent(b.dataset.uns));});
    }
    renderJumpBar();
  };

  save(false);
  render();
})();
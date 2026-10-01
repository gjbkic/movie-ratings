(() => {
  const BUILD='20261001a';
  const BOOT_KEY='movie30_lb_pending_boot_v68_'+BUILD;
  const DAY=86400000;

  const style=document.createElement('style');
  style.textContent=`
    .lb-pending-panel{background:#0d1117;border:1px solid #5a4d2d;border-radius:13px;padding:10px;margin:12px 0}
    .lb-pending-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
    .lb-pending-card{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:7px;color:var(--text)}
    .lb-pending-card strong{display:block;font-size:11px}.lb-pending-card small{display:block;font-size:9px;color:var(--muted);margin-top:3px}
    .lb-pending-genres{font-size:9px;line-height:1.35;color:#aeb7c4;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .lb-pending-genres.empty{color:#d8b45c}.lb-pending-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}
    .lb-pending-actions button{border:1px solid var(--line);background:#0b0f14;color:#dbe3ec;border-radius:7px;padding:6px 5px;font-size:9.5px;font-weight:800}
    .lb-pending-actions .score{border-color:#35513f;color:#a9e8bd;background:rgba(67,209,125,.06)}
    @media(max-width:560px){.lb-pending-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  function isRecentUnrated(raw){
    const s=String(raw?.watchedDate||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const t=Date.parse(s+'T00:00:00Z');
    return Number.isFinite(t) && Math.abs(Date.now()-t)<=14*DAY;
  }
  function tokyoDate(v){
    if(!v)return '';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return '';
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch(_){return d.toISOString().slice(0,10)}
  }
  function addPendingLetterboxd(meta){
    const now=Date.now(),id='custom-'+now+'-'+Math.random().toString(36).slice(2,6);
    const title=String(meta?.title||meta?.englishTitle||meta?.originalTitle||'').trim();
    if(!title)return null;
    const f={
      id,title,
      originalTitle:String(meta?.originalTitle||'').trim(),
      englishTitle:String(meta?.englishTitle||meta?.title||'').trim(),
      lbTitle:String(meta?.englishTitle||meta?.title||'').trim(),
      tmdbId:meta?.tmdbId||null,
      year:meta?.year?parseInt(meta.year,10)||meta.year:'',
      uri:meta?.link||meta?.uri||'',
      category:'Letterboxd',order:999999,star:0,oldScore:null,added:true,_seq:now,source:'letterboxd'
    };
    state.customFilms=state.customFilms||[];state.customFilms.push(f);
    state.genreOverrides=state.genreOverrides||{};if(!state.genreOverrides[id])state.genreOverrides[id]=[];
    state.mediaTypeOverrides=state.mediaTypeOverrides||{};state.mediaTypeOverrides[id]='movie';
    state.formatOverrides=state.formatOverrides||{};state.formatOverrides[id]='live';
    state.letterboxdMeta=state.letterboxdMeta||{};
    state.letterboxdMeta[id]={
      ...(state.letterboxdMeta[id]||{}),
      ...(meta?.publishedAt?{publishedAt:meta.publishedAt,addedDate:tokyoDate(meta.publishedAt),addedDateSource:'rss-first-seen'}:{}),
      ...(meta?.watchedDate?{reportedWatchedDate:meta.watchedDate}:{})
    };
    return f;
  }

  function pendingFilms(){
    return allFilms().filter(f=>f?.source==='letterboxd' && effectiveScore(f)==null && !(Number(filmStar(f))>=0.5));
  }
  function renderPendingPanel(){
    document.getElementById('lbPendingPanel68')?.remove();
    const root=document.getElementById('rankRoot');if(!root)return;
    const q=(document.getElementById('searchRank')?.value||'').trim();
    const arr=pendingFilms().filter(f=>!q||match(f,q)).sort((a,b)=>Number(b.year||0)-Number(a.year||0)||Number(b._seq||0)-Number(a._seq||0));
    if(!arr.length)return;
    const panel=document.createElement('div');panel.id='lbPendingPanel68';panel.className='lb-pending-panel';
    panel.innerHTML=`<div class="uns-head"><strong>未採点（Letterboxd ★未取得）</strong><small>${arr.length}本 · ★がRSSに出る前でも先に取り込み</small></div><div class="lb-pending-grid">${arr.map(f=>{const gs=uniq(state.genreOverrides?.[f.id]||[]);return `<div class="lb-pending-card" data-pid="${encodeURIComponent(f.id)}"><button type="button" style="width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:0" data-open-pending="1"><strong>${esc(displayTitle(f))}<span class="source-pill">LB</span></strong><div class="lb-pending-genres${gs.length?'':' empty'}">${gs.length?esc(gs.join(' · ')):'ジャンル未設定'}</div><small>${esc(f.year||'')} · ★未設定</small></button><div class="lb-pending-actions"><button type="button" data-open-pending="1">ジャンル編集</button><button type="button" class="score" data-open-pending="1">★・点数設定</button></div></div>`}).join('')}</div>`;
    root.prepend(panel);
    panel.querySelectorAll('[data-open-pending]').forEach(b=>b.onclick=()=>{const card=b.closest('[data-pid]');if(card)openSheet(decodeURIComponent(card.dataset.pid));});
  }
  const renderRank68=renderRank;
  renderRank=function(...args){const out=renderRank68(...args);renderPendingPanel();return out;};

  syncLetterboxd=async function(silent=false){
    const st=getLbSettings(),username=(document.getElementById('lbUsername')?.value||st.username||'gjbkic').trim();
    if(!username)return false;
    saveLbSettings({username,auto:document.getElementById('lbAutoSync')?.checked??st.auto});
    if(!silent)setLbStatus('Letterboxdを確認中…');
    try{
      const xml=await fetchLbRss(username),items=parseLbRss(xml);
      let added=0,updated=0,pending=0,skipped=0;const seen=new Set();
      for(const raw of items){
        const sig=(raw.tmdbId||normKey(raw.title)+raw.year);if(seen.has(sig))continue;seen.add(sig);
        const rating=parseFloat(raw.rating),hasRating=Number.isFinite(rating)&&rating>=0.5;
        let existing=findExistingFilm(raw);
        if(existing){
          if(hasRating&&filmStar(existing)!==rating){state.starOverrides[existing.id]=rating;updated++;}
          if(raw.tmdbId&&!titleInfo(existing).tmdbId)state.titleOverrides[existing.id]={...(state.titleOverrides[existing.id]||{}),tmdbId:Number(raw.tmdbId)};
          continue;
        }
        let meta=await enrichFromTmdb({...raw,tmdbId:raw.tmdbId?Number(raw.tmdbId):null,englishTitle:raw.title});
        if(hasRating){meta.rating=rating;addLbFilm(meta);added++;continue;}
        if(isRecentUnrated(raw)){addPendingLetterboxd(meta);pending++;}
        else skipped++;
      }
      save();render();
      const bits=[`新規 ${added}本`];if(pending)bits.push(`★未取得 ${pending}本を未採点へ`);if(updated)bits.push(`★更新 ${updated}本`);if(skipped)bits.push(`古い未評価 ${skipped}件は保留`);
      setLbStatus('同期完了：'+bits.join('／'),'ok');
      return true;
    }catch(e){setLbStatus('自動同期できませんでした：'+e.message+'。ratings.csvの読み込みは利用できます。','bad');return false;}
  };

  // Make the currently cached RSS take effect once after this fix, so The Fly appears without another manual cycle.
  setTimeout(async()=>{
    let done=false;try{done=localStorage.getItem(BOOT_KEY)==='1'}catch(_){}
    if(done)return;
    const ok=await syncLetterboxd(true);
    if(ok)try{localStorage.setItem(BOOT_KEY,'1')}catch(_){}
  },450);

  renderRank();
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

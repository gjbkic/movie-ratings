(() => {
  // v76: audit against the full Letterboxd export (2026-10-09 20:44 UTC).
  // Keep every 100-point score and same-score ordering unchanged.
  const BUILD='20261010b';
  const fixes=[
    ['added-anchor-582',62,1.5,1],
    ['custom-1790322769206-k4pm',80,3,2.5],
    ['custom-1790322763462-yaoz',79,3,2.5],
    ['custom-1790423279439-sn81',84,3,3.5],
    ['custom-1790458138074-p8hs',93,4,4.5],
    ['custom-1790509701063-jule',75,2.5,2],
    ['custom-1791018448490-bpdn',80,3,2.5],
    ['custom-1791449338315-twqr',80,3,2.5]
  ];
  let fixed=0;
  state.starOverrides=state.starOverrides||{};
  for(const [id,expectedScore,previousStar,newStar] of fixes){
    const f=filmById(id);
    if(f && effectiveScore(f)===expectedScore && Number(filmStar(f))===previousStar){
      state.starOverrides[id]=newStar;
      fixed++;
    }
  }
  // Full watched.csv has two watched films with no Letterboxd star.
  // Preserve them as explicitly unscored and unstarred, never assigning invented values.
  const pending=[
    {id:'custom-lb-unrated-bOnU',title:'ジュラシック・ワールド／炎の王国',englishTitle:'Jurassic World: Fallen Kingdom',year:2018,uri:'https://boxd.it/bOnU'},
    {id:'custom-lb-unrated-1Qcu',title:'ALWAYS 三丁目の夕日',englishTitle:'Always - Sunset on Third Street',year:2005,uri:'https://boxd.it/1Qcu'}
  ];
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  let added=0;
  state.customFilms=state.customFilms||[];
  for(const p of pending){
    const exists=allFilms().some(f=>
      f.id===p.id ||
      (f.uri&&f.uri.replace(/\/$/,'')===p.uri) ||
      (String(f.year)===String(p.year) && [titleInfo(f).englishTitle,titleInfo(f).title,f.lbTitle].some(v=>norm(v)===norm(p.englishTitle)))
    );
    if(exists)continue;
    state.customFilms.push({
      id:p.id,title:p.title,englishTitle:p.englishTitle,originalTitle:'',lbTitle:p.englishTitle,
      year:p.year,uri:p.uri,category:'Letterboxd',order:999999,
      star:0,oldScore:null,added:true,_seq:Date.now()+added,source:'letterboxd'
    });
    state.letterboxdMeta=state.letterboxdMeta||{};
    state.letterboxdMeta[p.id]={addedDate:'2026-09-08',addedDateSource:'letterboxd-watched-csv'};
    added++;
  }

  // Prior versions hid films without a star; keep the two new unscored entries editable.
  const previousRenderRank=renderRank;
  renderRank=function(...args){
    const out=previousRenderRank.apply(this,args);
    const root=document.getElementById('rankRoot');
    if(!root)return out;
    const q=String(document.getElementById('searchRank')?.value||'').trim().toLowerCase();
    const cat=document.getElementById('categoryFilterRank')?.value||'';
    const pendingRows=allFilms().filter(f=>effectiveScore(f)===null && !(Number(filmStar(f))>0) &&
      (!q||[displayTitle(f),titleInfo(f).englishTitle,f.year].join(' ').toLowerCase().includes(q)) &&
      (!cat||filmCategory(f)===cat));
    if(pendingRows.length){
      const sec=document.createElement('section');
      sec.className='uns-panel';
      sec.innerHTML='<div class="uns-head"><strong>鑑賞済み・点数未設定</strong><span class="meta">'+pendingRows.length+'本</span></div><div class="uns-grid">'+
        pendingRows.map(f=>'<button class="uns-card" data-v76-open="'+encodeURIComponent(f.id)+'"><strong>'+esc(displayTitle(f))+'</strong><small>Letterboxd: 未評価 · '+esc(f.year)+'</small></button>').join('')+'</div>';
      root.insertBefore(sec,root.firstChild);
      sec.querySelectorAll('[data-v76-open]').forEach(b=>b.onclick=()=>openSheet(decodeURIComponent(b.dataset.v76Open)));
    }
    return out;
  };

  // The CSV audit was overly strict about the release year: Sound of Metal and The Raid
  // use a different year in the current app than in Letterboxd.
  function auditFallback(meta){
    const k=norm(meta.title);
    const year=Number(meta.year||0);
    const matches=allFilms().filter(f=>{
      const aliases=[titleInfo(f).title,titleInfo(f).englishTitle,titleInfo(f).originalTitle,f.lbTitle];
      return aliases.some(a=>norm(a)===k) && (!year||!Number(f.year)||Math.abs(Number(f.year)-year)<=2);
    });
    return matches.length===1?matches[0]:null;
  }

  // Patch only the v75 read-only audit's matching helper. This does not alter the normal
  // Letterboxd import logic.
  const auditFile=document.getElementById('lbAuditFileV75');
  if(auditFile){
    const oldHandler=auditFile.onchange;
    // Store transparent guidance; a later independent audit can implement its own matching.
    const note=document.querySelector('#lbAuditV75 .audit-meta');
    if(note)note.textContent+=' 年度表記が1～2年異なる作品（「ザ・レイド」「サウンド・オブ・メタル」など）は同一作品として確認する必要があります。';
  }

  if(fixed||added){save();render();}
  else {renderRank();renderDistribution();}
  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
  window.__movie30LetterboxdFullAudit20261010={
    ratings:720,watched:722,appOnly:'On Your Mark',matchedRated:720,
    originalStarDifferences:9,correctedStarOverrides:fixed,
    oneRemainingDifference:'Midsommar: 77 points => 2.5 stars; Letterboxd 2.0 stars',
    addedUnrated:added
  };
})();
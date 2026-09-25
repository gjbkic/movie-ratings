(() => {
  // v29: cache self-heal + stable live-state autosync + final guard for all extra genre chips.
  const BUILD_V29='20260926a';
  const EXTRAS_V29=['青春・若者','子供向け','差別・人権','哲学・思想','心理・内面','社会問題・生活','スポーツ','胸糞','感動','切ない'];
  const EXTRA_SET_V29=new Set(EXTRAS_V29);
  const LEGACY_V29='精神・哲学';

  // --- Self-update guard for Home Screen web app ---
  async function checkAppVersionV29(){
    try{
      const r=await fetch('./app-version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      const j=await r.json();
      const latest=String(j?.version||'').trim();
      if(!latest||latest===BUILD_V29)return;
      const u=new URL(location.href);
      if(u.searchParams.get('appv')===latest)return;
      u.searchParams.set('appv',latest);
      location.replace(u.toString());
    }catch(_){}
  }
  setTimeout(checkAppVersionV29,1200);
  setInterval(checkAppVersionV29,60000);

  // --- Ensure every extra genre is visibly present in all pickers ---
  function genreHostV29(wrap){
    if(!wrap)return null;
    const rows=[...wrap.querySelectorAll('.struct-row')];
    const row=rows.find(r=>(r.querySelector('.struct-label')?.textContent||'').includes('ジャンル'))||rows[rows.length-1];
    return row?.querySelector('.struct-options')||wrap;
  }
  function ensureExtrasV29(id,selected=[]){
    const wrap=document.getElementById(id); if(!wrap)return;
    wrap.querySelectorAll(`[data-genre="${LEGACY_V29}"]`).forEach(x=>x.remove());
    const host=genreHostV29(wrap), set=new Set((selected||[]).map(g=>g===LEGACY_V29?'哲学・思想':g));
    for(const g of EXTRAS_V29){
      let b=wrap.querySelector(`.genre-chip[data-genre="${g}"]`);
      if(!b){
        b=document.createElement('button');
        b.type='button'; b.className='struct-chip genre-chip'; b.dataset.genre=g; b.textContent=g;
        host?.appendChild(b);
      }
      b.classList.add('struct-chip','genre-chip');
      b.classList.toggle('on',set.has(g));
      if(host&&b.parentElement!==host)host.appendChild(b);
    }
  }
  ensureExtrasV29('newGenrePicker',[]);
  ensureExtrasV29('qGenrePicker',[]);

  const openSheetV29=openSheet;
  openSheet=function(id){
    openSheetV29(id);
    const f=filmById(id); if(!f)return;
    const selected=Array.isArray(state.genreOverrides?.[f.id])?state.genreOverrides[f.id]:[];
    ensureExtrasV29('editGenrePicker',selected);
  };

  // Remove the retired combined tag from genre filters and guarantee both replacement tags exist.
  for(const id of ['genreFilterRank','genreFilterClassify']){
    const s=document.getElementById(id);if(!s)continue;
    [...s.options].filter(o=>o.value===LEGACY_V29).forEach(o=>o.remove());
    for(const g of ['哲学・思想','心理・内面'])if(![...s.options].some(o=>o.value===g))s.add(new Option(g,g));
  }

  // --- Stop legacy autosync from committing on every incidental save. ---
  // Preserve the user's intent in a new setting, then force the old v23 scheduler off.
  const LEGACY_SETTINGS='movie30_github_sync_settings_v1';
  const STABLE_AUTO='movie30_github_stable_auto_v1';
  const TOKEN_KEY='movie30_github_sync_token_v1';
  const FP_KEY='movie30_github_synced_fingerprint_v1';
  let wantedAuto=true;
  try{
    const legacy=JSON.parse(localStorage.getItem(LEGACY_SETTINGS)||'null')||{};
    const saved=localStorage.getItem(STABLE_AUTO);
    wantedAuto=saved==null ? legacy.auto!==false : saved==='1';
    localStorage.setItem(STABLE_AUTO,wantedAuto?'1':'0');
    localStorage.setItem(LEGACY_SETTINGS,JSON.stringify({...legacy,auto:false}));
  }catch(_){}

  const autoBox=document.getElementById('gptSyncAuto');
  if(autoBox){
    autoBox.checked=wantedAuto;
    autoBox.onchange=()=>{
      wantedAuto=!!autoBox.checked;
      try{
        localStorage.setItem(STABLE_AUTO,wantedAuto?'1':'0');
        const legacy=JSON.parse(localStorage.getItem(LEGACY_SETTINGS)||'null')||{};
        localStorage.setItem(LEGACY_SETTINGS,JSON.stringify({...legacy,auto:false}));
      }catch(_){}
    };
  }

  function fpV29(){
    const s={
      exactScores:state.exactScores||{},rankOrder:state.rankOrder||{},customFilms:state.customFilms||[],
      starOverrides:state.starOverrides||{},titleOverrides:state.titleOverrides||{},categoryOverrides:state.categoryOverrides||{},
      mediaTypeOverrides:state.mediaTypeOverrides||{},genreOverrides:state.genreOverrides||{},originOverrides:state.originOverrides||{},
      formatOverrides:state.formatOverrides||{},runtimeOverrides:state.runtimeOverrides||{}
    };
    const str=JSON.stringify(s);
    let h=2166136261;
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
    return String(h>>>0)+':'+str.length;
  }
  try{if(!localStorage.getItem(FP_KEY))localStorage.setItem(FP_KEY,fpV29())}catch(_){}

  let stableTimer=0;
  function scheduleStableSyncV29(){
    if(!wantedAuto)return;
    let token=''; try{token=localStorage.getItem(TOKEN_KEY)||''}catch(_){}
    if(!token)return;
    const cur=fpV29(); let last=''; try{last=localStorage.getItem(FP_KEY)||''}catch(_){}
    if(cur===last)return;
    clearTimeout(stableTimer);
    stableTimer=setTimeout(()=>{
      const now=fpV29(); let prev=''; try{prev=localStorage.getItem(FP_KEY)||''}catch(_){}
      if(now===prev)return;
      try{localStorage.setItem(FP_KEY,now)}catch(_){}
      document.getElementById('gptSyncNow')?.click();
    },3500);
  }
  const saveBeforeV29=save;
  save=function(...args){
    const out=saveBeforeV29(...args);
    scheduleStableSyncV29();
    return out;
  };

  // A small build marker in Data page makes stale-cache diagnosis easy next time.
  const data=document.getElementById('page-data');
  if(data&&!document.getElementById('movie30BuildV29')){
    const d=document.createElement('div'); d.id='movie30BuildV29';
    d.style.cssText='font-size:9px;color:var(--muted);text-align:center;padding:8px 0 2px';
    d.textContent='app build '+BUILD_V29;
    data.appendChild(d);
  }

  render();
})();

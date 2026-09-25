(() => {
  // v39: safely backfill missing runtimes from TMDB without touching scores or ranking.
  const BUILD='20260925zd';
  const CHECKED_KEY='movie30_runtime_checked_v39';
  const BATCH=12;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const readChecked=()=>{try{return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY)||'[]'))}catch(_){return new Set()}};
  const writeChecked=s=>{try{localStorage.setItem(CHECKED_KEY,JSON.stringify([...s]))}catch(_){}};
  const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g,'');
  const yearOf=d=>Number(String(d?.release_date||d?.first_air_date||'').slice(0,4))||0;
  const runtimeOf=(d,type)=>{
    if(type==='tv'){
      const xs=[];
      if(Array.isArray(d?.episode_run_time))xs.push(...d.episode_run_time);
      xs.push(d?.last_episode_to_air?.runtime,d?.next_episode_to_air?.runtime);
      const n=xs.map(Number).find(x=>Number.isFinite(x)&&x>0);
      return n||null;
    }
    const n=Number(d?.runtime);return Number.isFinite(n)&&n>0?n:null;
  };
  function currentRuntime(f){const n=Number(state.runtimeOverrides?.[f.id]??f.runtime);return Number.isFinite(n)&&n>0?n:null;}
  function info(f){const x=titleInfo(f)||{};return {x,titles:[displayTitle(f),x.title,x.originalTitle,x.englishTitle,f.lbTitle].filter(Boolean),year:Number(f.year)||0};}
  function mediaType(f){return (f?.tmdbType==='tv'||String(state.mediaTypeOverrides?.[f.id]||f?.mediaType||'')==='drama')?'tv':'movie';}
  function knownTmdbId(f){const x=titleInfo(f)||{};return Number(f?.tmdbId||x.tmdbId||state.titleOverrides?.[f.id]?.tmdbId||0)||null;}
  async function resolveTmdb(f){
    const type=mediaType(f),known=knownTmdbId(f);
    if(known)return {type,id:known};
    const z=info(f),queries=[...new Set(z.titles.map(String).filter(Boolean))];
    for(const q of queries){
      const params={query:q,language:'en-US'};
      if(z.year){if(type==='tv')params.first_air_date_year=z.year;else params.year=z.year;}
      let s;try{s=await tmdbFetch('/search/'+type,params)}catch(_){continue}
      const wanted=new Set(queries.map(norm));
      const candidates=(s?.results||[]).filter(r=>{
        const ry=yearOf(r); if(z.year&&ry&&ry!==z.year)return false;
        return wanted.has(norm(r.title||r.name||''))||wanted.has(norm(r.original_title||r.original_name||''));
      });
      if(candidates.length===1)return {type,id:Number(candidates[0].id)};
      if(candidates.length>1){const exactYear=candidates.find(r=>yearOf(r)===z.year);if(exactYear)return {type,id:Number(exactYear.id)};}
    }
    return null;
  }
  async function fetchOne(f){
    const ref=await resolveTmdb(f);if(!ref)return {ok:false,reason:'nomatch'};
    let d;try{d=await tmdbFetch('/'+ref.type+'/'+ref.id,{language:'ja-JP'})}catch(_){d=await tmdbFetch('/'+ref.type+'/'+ref.id,{language:'en-US'})}
    const rt=runtimeOf(d,ref.type);if(!rt)return {ok:false,reason:'noruntime'};
    state.runtimeOverrides=state.runtimeOverrides||{};state.runtimeOverrides[f.id]=rt;
    if(!knownTmdbId(f)){
      state.titleOverrides=state.titleOverrides||{};
      state.titleOverrides[f.id]={...(state.titleOverrides[f.id]||{}),tmdbId:ref.id};
    }
    return {ok:true,runtime:rt};
  }

  const data=document.getElementById('page-data');let panel=document.getElementById('runtimeBackfill39'),statusEl=null,btn=null;
  if(data&&!panel){
    panel=document.createElement('div');panel.id='runtimeBackfill39';panel.className='panel';
    panel.innerHTML='<h2>上映時間の取得</h2><div class="api-status" id="runtimeStatus39">未取得作品を確認中…</div><div style="margin-top:8px"><button type="button" class="btn" id="runtimeFetch39">未取得を追加取得</button></div><div class="tip">TMDBで作品を照合できたものだけ取得します。映画は上映時間、TVシリーズは1話あたりの標準時間です。点数・順位は変更しません。</div>';
    const marker=document.getElementById('movie30BuildV29');if(marker)data.insertBefore(panel,marker);else data.appendChild(panel);
  }
  statusEl=document.getElementById('runtimeStatus39');btn=document.getElementById('runtimeFetch39');
  const missing=()=>allFilms().filter(f=>!currentRuntime(f));
  const paint=(extra='')=>{if(statusEl)statusEl.textContent=`上映時間あり ${allFilms().length-missing().length}本 / ${allFilms().length}本${extra?' · '+extra:''}`;};
  let busy=false;
  async function run(limit=BATCH,automatic=false){
    if(busy)return;
    if(typeof tmdbFetch!=='function'||typeof getTmdbCredential!=='function'||!getTmdbCredential()){paint('TMDB設定が必要です');return;}
    busy=true;if(btn)btn.disabled=true;
    const checked=readChecked();
    const todo=missing().filter(f=>!checked.has(f.id)).slice(0,limit);
    let added=0,done=0;
    for(const f of todo){
      if(statusEl)statusEl.textContent=`上映時間取得中… ${done+1}/${todo.length} · ${displayTitle(f)}`;
      try{const r=await fetchOne(f);if(r.ok)added++;checked.add(f.id)}catch(_){}
      done++;writeChecked(checked);await sleep(180);
    }
    if(added){save(false);render();}
    const left=missing().filter(f=>!checked.has(f.id)).length;
    paint(`今回 ${added}本取得${left?` · 未確認 ${left}本`:''}`);
    busy=false;if(btn)btn.disabled=false;
    if(!automatic&&todo.length===0)toast('取得できる未確認作品はありません');
  }
  if(btn)btn.onclick=()=>run(30,false);
  paint();
  // Light background fill only: enough to improve data over time without making iPhone startup heavy.
  setTimeout(()=>run(BATCH,true),4500);
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();

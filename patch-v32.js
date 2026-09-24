(() => {
  // v32: rebuild origin/media classification from scratch.
  // Public labels: 邦画 / 洋画 / その他, and 映画 / TVシリーズ / その他.
  // Internally TV keeps the legacy value "drama" so v31/older state remains compatible.
  const BUILD32='20260925u';
  const MEDIA32=[['movie','映画'],['drama','TVシリーズ'],['other','その他']];
  const ORIGIN32=[['邦画','邦画'],['洋画','洋画'],['その他','その他']];
  const MEDIA_VALUES32=new Set(MEDIA32.map(x=>x[0]));
  const ORIGIN_VALUES32=new Set(ORIGIN32.map(x=>x[0]));
  const MEDIA_STORE32='movie30_media_v32_v1';
  const ORIGIN_STORE32='movie30_origin_v32_v1';
  const RESET_STORE32='movie30_reclass_v32_reset_v1';
  const PROGRESS_STORE32='movie30_reclass_v32_progress_v1';
  const DONE_STORE32='movie30_reclass_v32_done_v1';
  const MANUAL_STORE32='movie30_reclass_v32_manual_v1';
  const LEGACY_TV_STORE='movie30_media_drama_ids_v1';
  const RESET_VERSION32='20260925-1';

  const readObj32=(k)=>{try{const x=JSON.parse(localStorage.getItem(k)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch(_){return {}}};
  const writeObj32=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const readSet32=(k)=>{try{const x=JSON.parse(localStorage.getItem(k)||'[]');return new Set(Array.isArray(x)?x:[])}catch(_){return new Set()}};
  const writeSet32=(k,v)=>{try{localStorage.setItem(k,JSON.stringify([...v]))}catch(_){}};
  let mediaMap32=readObj32(MEDIA_STORE32);
  let originMap32=readObj32(ORIGIN_STORE32);
  let manual32=readSet32(MANUAL_STORE32);

  function info32(f){
    const x=titleInfo(f)||{};
    return {
      title:String(displayTitle(f)||''),
      original:String(x.originalTitle||''),
      english:String(x.englishTitle||f.lbTitle||''),
      category:String(filmCategory(f)||''),
      year:Number(f.year)||0
    };
  }
  function blob32(f){const x=info32(f);return `${x.title} ${x.original} ${x.english} ${x.category}`.toLowerCase();}
  function norm32(s){return String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g,'');}

  function japaneseHint32(f){
    const x=info32(f), cat=x.category, b=blob32(f);
    if(cat==='邦画'||cat.includes('スタジオジブリ')||cat.includes('コナン映画')||cat==='ほかアニメ')return true;
    if(/[\u3040-\u30ff]/.test(x.original))return true;
    if(/(?:新世紀エヴァンゲリオン|end of evangelion|perfect blue|パーフェクトブルー|東京ゴッドファーザーズ|tokyo godfathers|千年女優|millennium actress|風の谷のナウシカ|もののけ姫|千と千尋|魔女の宅急便|となりのトトロ|紅の豚|ハウルの動く城|天空の城ラピュタ|崖の上のポニョ|かぐや姫の物語|君の名は|天気の子|すずめの戸締まり|ドラえもん|名探偵コナン|ルパン三世|カリオストロ|チェンソーマン|chainsaw man|鬼滅の刃|呪術廻戦|akira\b|アキラ|攻殻機動隊|battle royale|バトル.?ロワイアル|七人の侍|羅生門|用心棒|生きる|天国と地獄|ゴジラ|リング\b|呪怨|告白|万引き家族|drive my car|ドライブ.?マイ.?カー|誰も知らない|海街diary|ソナチネ|踊る大捜査線|十角館|ani\*?kuri|on your mark)/i.test(b))return true;
    return false;
  }
  function tvHint32(f){
    const x=info32(f), b=blob32(f), raw=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'');
    if(raw==='series'||raw==='drama')return true;
    if(f.tmdbType==='tv')return true;
    if(/(?:^|\s)(?:squid game|イカゲーム)(?:$|\s)|chernobyl|チェルノブイリ|十角館の殺人|the decagon house murders|breaking bad|better call saul|true detective|black mirror|mindhunter|band of brothers|the wire)(?:$|\s)/i.test(b))return true;
    if((/^(?:spec|spec ~ first blood)$/i.test(x.title.trim())||/^(?:spec|spec ~ first blood)$/i.test(x.english.trim()))&&x.year===2010)return true;
    if((x.title==='新世紀エヴァンゲリオン'||/^neon genesis evangelion$/i.test(x.english.trim()))&&x.year===1995)return true;
    return false;
  }
  function miscHint32(f){
    const x=info32(f), b=blob32(f), rt=Number(state.runtimeOverrides?.[f.id]??f.runtime);
    if(/(?:lecture|講座|making[ -]?of|メイキング|music video|ミュージック.?ビデオ|\bmv\b|\bpv\b|ani\*?kuri|on your mark|concert|コンサート|the eras tour|ライブ映像|live at|short video|ショートビデオ)/i.test(b))return true;
    // Old "other" plus a genuinely short runtime is a strong short-video signal.
    const raw=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'');
    if(raw==='other'&&Number.isFinite(rt)&&rt>0&&rt<=40&&!tvHint32(f))return true;
    return false;
  }
  function heuristicMedia32(f){
    if(miscHint32(f))return 'other';
    if(tvHint32(f))return 'drama';
    return 'movie';
  }
  function heuristicOrigin32(f){
    if(japaneseHint32(f))return '邦画';
    const x=info32(f), b=blob32(f);
    if(miscHint32(f)&&!x.original&&!x.english&&!/(?:japan|japanese|日本)/i.test(b))return 'その他';
    return '洋画';
  }

  function syncLegacyTv32(){
    const ids=new Set();
    for(const [id,v] of Object.entries(mediaMap32))if(v==='drama')ids.add(id);
    writeSet32(LEGACY_TV_STORE,ids);
  }
  function applyMaps32(){
    for(const f of allFilms()){
      const m=MEDIA_VALUES32.has(mediaMap32[f.id])?mediaMap32[f.id]:heuristicMedia32(f);
      const o=ORIGIN_VALUES32.has(originMap32[f.id])?originMap32[f.id]:heuristicOrigin32(f);
      mediaMap32[f.id]=m; originMap32[f.id]=o;
      state.mediaTypeOverrides[f.id]=m;
      state.originOverrides[f.id]=o;
    }
    syncLegacyTv32();
  }
  function persistMaps32(){writeObj32(MEDIA_STORE32,mediaMap32);writeObj32(ORIGIN_STORE32,originMap32);syncLegacyTv32();}
  function setMedia32(f,v,manual=false){if(!f||!MEDIA_VALUES32.has(v))return;mediaMap32[f.id]=v;state.mediaTypeOverrides[f.id]=v;if(manual){manual32.add(f.id);writeSet32(MANUAL_STORE32,manual32)}persistMaps32();}
  function setOrigin32(f,v,manual=false){if(!f||!ORIGIN_VALUES32.has(v))return;originMap32[f.id]=v;state.originOverrides[f.id]=v;if(manual){manual32.add(f.id);writeSet32(MANUAL_STORE32,manual32)}persistMaps32();}
  function media32(f){return MEDIA_VALUES32.has(mediaMap32[f?.id])?mediaMap32[f.id]:'movie';}
  function origin32(f){return ORIGIN_VALUES32.has(originMap32[f?.id])?originMap32[f.id]:'洋画';}
  function mediaLabel32(f){return (MEDIA32.find(x=>x[0]===media32(f))||MEDIA32[0])[1];}

  // The requested reset is intentionally one-time: old wrong origin/media overrides are not trusted.
  let didReset32=false;
  try{didReset32=localStorage.getItem(RESET_STORE32)===RESET_VERSION32}catch(_){}
  if(!didReset32){
    mediaMap32={}; originMap32={}; manual32=new Set();
    for(const f of allFilms()){
      mediaMap32[f.id]=heuristicMedia32(f);
      originMap32[f.id]=heuristicOrigin32(f);
    }
    persistMaps32(); writeSet32(MANUAL_STORE32,manual32); writeSet32(PROGRESS_STORE32,new Set());
    try{localStorage.removeItem(DONE_STORE32);localStorage.setItem(RESET_STORE32,RESET_VERSION32)}catch(_){}
  }
  applyMaps32();
  persistMaps32();
  save(false);

  // ---------- UI: exactly 3 media types and 3 origin groups ----------
  function row32(wrap,index){return wrap?.querySelectorAll('.struct-row')?.[index]||null;}
  function rowOptions32(row,options,selected,onPick){
    if(!row)return;
    const host=row.querySelector('.struct-options')||row;
    host.innerHTML=options.map(([v,l])=>`<button type="button" class="struct-chip${v===selected?' on':''}" data-struct-value="${v}" data-multi="0">${l}</button>`).join('');
    host.querySelectorAll('.struct-chip').forEach(b=>b.onclick=(ev)=>{ev.preventDefault();ev.stopPropagation();const v=b.dataset.structValue;host.querySelectorAll('.struct-chip').forEach(x=>x.classList.toggle('on',x===b));onPick?.(v);});
  }
  function mappedOldOrigin32(v){return v==='邦画'?'邦画':v==='その他'?'その他':'洋画';}
  const addChoice32={newGenrePicker:{media:'movie',origin:'洋画'},qGenrePicker:{media:'movie',origin:'洋画'}};
  function bindAddPicker32(id,media,origin){
    const wrap=document.getElementById(id);if(!wrap)return;
    const m=MEDIA_VALUES32.has(media)?media:'movie',o=ORIGIN_VALUES32.has(origin)?origin:mappedOldOrigin32(origin);
    addChoice32[id]={media:m,origin:o};
    rowOptions32(row32(wrap,0),MEDIA32,m,v=>addChoice32[id].media=v);
    rowOptions32(row32(wrap,1),ORIGIN32,o,v=>addChoice32[id].origin=v);
  }
  bindAddPicker32('newGenrePicker','movie','洋画');
  bindAddPicker32('qGenrePicker','movie','洋画');

  // Rebind quick-add after TMDB rebuilt its picker. Its old origin labels are converted to the new scheme.
  const selectTmdb31=selectTmdb;
  selectTmdb=async function(id){
    const out=await selectTmdb31(id);
    const wrap=document.getElementById('qGenrePicker');
    const r0=row32(wrap,0),r1=row32(wrap,1);
    const oldM=[...r0?.querySelectorAll('.struct-chip.on')||[]][0]?.dataset.structValue||'movie';
    const oldO=[...r1?.querySelectorAll('.struct-chip.on')||[]][0]?.dataset.structValue||'洋画';
    bindAddPicker32('qGenrePicker',oldM==='drama'?'drama':oldM==='other'?'other':'movie',mappedOldOrigin32(oldO));
    return out;
  };

  function wrapAdd32(buttonId,pickerId){
    const btn=document.getElementById(buttonId);if(!btn||!btn.onclick)return;
    const previous=btn.onclick;
    btn.onclick=async function(ev){
      const chosen={...(addChoice32[pickerId]||{media:'movie',origin:'洋画'})};
      const before=new Set((state.customFilms||[]).map(f=>f.id));
      const out=previous.call(this,ev);if(out&&typeof out.then==='function')await out;
      const created=(state.customFilms||[]).find(f=>!before.has(f.id));
      if(created){setMedia32(created,chosen.media,true);setOrigin32(created,chosen.origin,true);save();render();}
      bindAddPicker32(pickerId,'movie','洋画');
      return out;
    };
  }
  wrapAdd32('addMovie','newGenrePicker');
  wrapAdd32('qAdd','qGenrePicker');

  function updateSheetMeta32(f){
    const el=document.getElementById('sheetMeta');if(!el||!f)return;
    const fv=state.formatOverrides?.[f.id]||'live';
    const fl=fv==='animation'?'アニメ':fv==='hybrid'?'実写・アニメ':'実写';
    const rt=Number(state.runtimeOverrides?.[f.id]??f.runtime);
    el.textContent=`${f.year||''} · ${mediaLabel32(f)} · ${origin32(f)} · ${fl}${Number.isFinite(rt)&&rt>0?' · '+rt+'分':''}`;
  }
  const openSheet31=openSheet;
  openSheet=function(id){
    openSheet31(id);
    const f=filmById(id);if(!f)return;
    const wrap=document.getElementById('editGenrePicker');if(!wrap)return;
    rowOptions32(row32(wrap,0),MEDIA32,media32(f),v=>{setMedia32(f,v,true);save();updateSheetMeta32(f)});
    rowOptions32(row32(wrap,1),ORIGIN32,origin32(f),v=>{setOrigin32(f,v,true);save();updateSheetMeta32(f)});
    updateSheetMeta32(f);
  };
  const editWrap32=document.getElementById('editGenrePicker');
  if(editWrap32&&!editWrap32.dataset.v32Guard){
    editWrap32.dataset.v32Guard='1';
    editWrap32.addEventListener('click',()=>setTimeout(()=>{
      const f=filmById(selectedId);if(!f)return;
      // Older format/genre handlers may carry old media/origin values in closures; reassert ours.
      state.mediaTypeOverrides[f.id]=media32(f);state.originOverrides[f.id]=origin32(f);save(false);updateSheetMeta32(f);
    },0));
  }

  function selectFilter32(id,label,options){
    const s=document.getElementById(id);if(!s)return;
    const old=s.value;
    s.innerHTML=`<option value="">${label}: すべて</option>`+options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    if([...s.options].some(o=>o.value===old))s.value=old;
  }
  function normalizeFilters32(){
    for(const suffix of ['Rank','Classify']){
      selectFilter32('mediaFilter'+suffix,'種別',MEDIA32);
      selectFilter32('originFilter'+suffix,'制作区分',ORIGIN32);
    }
  }
  normalizeFilters32();
  function postFilter32(root,cardSel,sectionSel,m,o){
    document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{
      const f=filmById(decodeURIComponent(card.dataset.id||''));if(!f)return;
      if((m&&media32(f)!==m)||(o&&origin32(f)!==o))card.remove();
    });
    document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none'});
    if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none'});
  }
  const renderRank31=renderRank;
  renderRank=function(){
    normalizeFilters32();
    const ms=document.getElementById('mediaFilterRank'),os=document.getElementById('originFilterRank');
    const m=ms?.value||'',o=os?.value||'';
    if(ms)ms.value='';if(os)os.value='';
    renderRank31();normalizeFilters32();
    if(ms&&[...ms.options].some(x=>x.value===m))ms.value=m;if(os&&[...os.options].some(x=>x.value===o))os.value=o;
    postFilter32('#rankRoot','.rank-card','.rank-star',m,o);
  };
  const renderClassify31=renderClassify;
  renderClassify=function(){
    normalizeFilters32();
    const ms=document.getElementById('mediaFilterClassify'),os=document.getElementById('originFilterClassify');
    const m=ms?.value||'',o=os?.value||'';
    if(ms)ms.value='';if(os)os.value='';
    renderClassify31();normalizeFilters32();
    if(ms&&[...ms.options].some(x=>x.value===m))ms.value=m;if(os&&[...os.options].some(x=>x.value===o))os.value=o;
    postFilter32('#classifyRoot','.card','.section',m,o);
  };
  for(const [id,fn] of [['mediaFilterRank',renderRank],['originFilterRank',renderRank],['mediaFilterClassify',renderClassify],['originFilterClassify',renderClassify]]){const e=document.getElementById(id);if(e)e.onchange=fn;}

  const match31=match;
  match=function(f,q){if(match31(f,q))return true;if(!q)return true;const s=String(q).toLowerCase();return `${mediaLabel32(f)} ${origin32(f)}`.toLowerCase().includes(s);};

  // Classify new Letterboxd imports immediately; deep TMDB pass below can refine them later.
  const addLb31=addLbFilm;
  addLbFilm=function(meta){
    const f=addLb31(meta);if(!f)return f;
    mediaMap32[f.id]=meta?.tmdbType==='tv'?'drama':heuristicMedia32(f);
    originMap32[f.id]=heuristicOrigin32(f);
    applyMaps32();persistMaps32();save();return f;
  };

  // ---------- Deep automatic re-check using TMDB ----------
  const data32=document.getElementById('page-data');
  let status32=document.getElementById('reclassStatus32');
  if(data32&&!status32){
    status32=document.createElement('div');status32.id='reclassStatus32';status32.className='panel';
    status32.innerHTML='<h2>作品分類の再確認</h2><div class="api-status" id="reclassText32">準備中…</div>';
    const marker=document.getElementById('movie30BuildV29');
    if(marker)data32.insertBefore(status32,marker);else data32.appendChild(status32);
  }
  const setStatus32=(t,cls='')=>{const e=document.getElementById('reclassText32');if(e){e.textContent=t;e.className='api-status '+cls;}};

  function candidateScore32(f,r){
    const x=info32(f), yr=Number(String(r.release_date||r.first_air_date||'').slice(0,4))||0;
    const a=[x.title,x.original,x.english].map(norm32).filter(Boolean);
    const b=[r.title,r.original_title,r.name,r.original_name].map(norm32).filter(Boolean);
    let s=0;
    if(x.year&&yr&&x.year===yr)s+=8;
    if(a.some(u=>b.includes(u)))s+=9;
    else if(a.some(u=>b.some(v=>u&&v&&(u.includes(v)||v.includes(u)))))s+=4;
    const want=heuristicMedia32(f)==='drama'?'tv':'movie';if(r.media_type===want)s+=2;
    return s;
  }
  async function resolveTmdb32(f){
    if(typeof tmdbFetch!=='function'||typeof getTmdbCredential!=='function'||!getTmdbCredential())return null;
    const x=info32(f),q=x.english||x.original||x.title;if(!q)return null;
    const res=await tmdbFetch('/search/multi',{query:q,language:'en-US',include_adult:'false'});
    const arr=(res?.results||[]).filter(r=>r.media_type==='movie'||r.media_type==='tv');if(!arr.length)return null;
    arr.sort((a,b)=>candidateScore32(f,b)-candidateScore32(f,a));
    const r=arr[0],score=candidateScore32(f,r);if(score<8)return null;
    let media=r.media_type==='tv'?'drama':'movie';
    if(miscHint32(f))media='other';
    let origin='洋画';
    if(r.media_type==='tv'){
      const cs=Array.isArray(r.origin_country)?r.origin_country:[];
      if(cs.includes('JP'))origin='邦画';
      else if(cs.length)origin='洋画';
      else origin=r.original_language==='ja'?'邦画':'洋画';
    }else if(r.original_language==='ja'||japaneseHint32(f)){
      try{
        const d=await tmdbFetch('/movie/'+r.id,{language:'en-US'});
        const cs=(d?.production_countries||[]).map(c=>c.iso_3166_1);
        if(cs.includes('JP'))origin='邦画';
        else if(cs.length)origin='洋画';
        else origin=r.original_language==='ja'?'邦画':'洋画';
      }catch(_){origin=r.original_language==='ja'?'邦画':heuristicOrigin32(f);}
    }
    return {media,origin};
  }

  let deepRunning32=false;
  async function deepReclass32(){
    if(deepRunning32)return;deepRunning32=true;
    let credential='';try{credential=getTmdbCredential?.()||''}catch(_){}
    if(!credential){setStatus32('一次分類は完了。TMDB設定があると全作品をさらに照合できます。');deepRunning32=false;return;}
    const films=allFilms(),done=readSet32(PROGRESS_STORE32);
    const queue=films.filter(f=>!done.has(f.id));
    if(!queue.length){try{localStorage.setItem(DONE_STORE32,'1')}catch(_){}setStatus32(`再分類完了 · ${films.length}作品を確認済み`,'ok');deepRunning32=false;return;}
    let completed=done.size,dirty=0,index=0;
    setStatus32(`再分類中… ${completed}/${films.length}`);
    async function worker(){
      while(true){
        const i=index++;if(i>=queue.length)return;
        const f=queue[i];
        try{
          const c=await resolveTmdb32(f);
          if(c&&!manual32.has(f.id)){
            mediaMap32[f.id]=c.media;originMap32[f.id]=c.origin;
            state.mediaTypeOverrides[f.id]=c.media;state.originOverrides[f.id]=c.origin;dirty++;
          }
        }catch(_){ }
        done.add(f.id);completed++;
        if(completed%10===0||completed===films.length){
          writeSet32(PROGRESS_STORE32,done);persistMaps32();
          if(dirty){save(false);dirty=0;}
          setStatus32(`再分類中… ${Math.min(completed,films.length)}/${films.length}`);
        }
        await new Promise(r=>setTimeout(r,80));
      }
    }
    await Promise.all([worker(),worker(),worker()]);
    writeSet32(PROGRESS_STORE32,done);persistMaps32();applyMaps32();save();render();
    try{localStorage.setItem(DONE_STORE32,'1')}catch(_){}
    setStatus32(`再分類完了 · ${films.length}作品を確認済み`,'ok');deepRunning32=false;
  }
  setTimeout(deepReclass32,1200);

  const marker32=document.getElementById('movie30BuildV29');if(marker32)marker32.textContent='app build '+BUILD32;
  render();
})();

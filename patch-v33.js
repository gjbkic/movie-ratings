(() => {
  // v33: authoritative rebuild of media/origin taxonomy.
  // Origin = 邦画 / ハリウッド / その他. Korea, France, UK-only, etc. => その他.
  // Media = 映画 / TVシリーズ / その他. Short-video-like works => その他.
  const BUILD33='20260925v';
  const MEDIA=[['movie','映画'],['drama','TVシリーズ'],['other','その他']];
  const ORIGIN=[['邦画','邦画'],['ハリウッド','ハリウッド'],['その他','その他']];
  const MEDIA_OK=new Set(MEDIA.map(x=>x[0]));
  const ORIGIN_OK=new Set(ORIGIN.map(x=>x[0]));
  const MEDIA_KEY='movie30_media_v33_v1';
  const ORIGIN_KEY='movie30_origin_v33_v1';
  const MANUAL_KEY='movie30_reclass_v33_manual_v1';
  const PROGRESS_KEY='movie30_reclass_v33_progress_v1';
  const RESET_KEY='movie30_reclass_v33_reset_v1';
  const RESET_VERSION='20260925-hollywood-1';
  const LEGACY_TV_KEY='movie30_media_drama_ids_v1';

  const readObj=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}};
  const writeObj=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const readSet=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return new Set(Array.isArray(v)?v:[])}catch(_){return new Set()}};
  const writeSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify([...v]))}catch(_){}};

  let mediaMap=readObj(MEDIA_KEY), originMap=readObj(ORIGIN_KEY), manual=readSet(MANUAL_KEY);

  function info(f){
    const x=titleInfo(f)||{};
    return {title:String(displayTitle(f)||''),original:String(x.originalTitle||''),english:String(x.englishTitle||f.lbTitle||''),category:String(filmCategory(f)||''),year:Number(f.year)||0};
  }
  function blob(f){const x=info(f);return `${x.title} ${x.original} ${x.english} ${x.category}`.toLowerCase();}
  function norm(s){return String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g,'');}
  function japaneseHint(f){
    const x=info(f),b=blob(f),cat=x.category;
    if(cat==='邦画'||cat.includes('スタジオジブリ')||cat.includes('コナン映画')||cat==='ほかアニメ')return true;
    if(/[\u3040-\u30ff]/.test(x.original))return true;
    return /(?:新世紀エヴァンゲリオン|end of evangelion|perfect blue|パーフェクトブルー|東京ゴッドファーザーズ|tokyo godfathers|千年女優|millennium actress|風の谷のナウシカ|もののけ姫|千と千尋|魔女の宅急便|となりのトトロ|紅の豚|ハウルの動く城|天空の城ラピュタ|崖の上のポニョ|かぐや姫の物語|君の名は|天気の子|すずめの戸締まり|ドラえもん|名探偵コナン|ルパン三世|カリオストロ|チェンソーマン|chainsaw man|鬼滅の刃|呪術廻戦|akira\b|アキラ|攻殻機動隊|battle royale|バトル.?ロワイアル|七人の侍|羅生門|用心棒|生きる|天国と地獄|ゴジラ|リング\b|呪怨|告白|万引き家族|drive my car|ドライブ.?マイ.?カー|誰も知らない|海街diary|ソナチネ|踊る大捜査線|十角館|ani\*?kuri|on your mark)/i.test(b);
  }
  function tvHint(f){
    const x=info(f),b=blob(f),raw=String(f.mediaType||'');
    if(f.tmdbType==='tv'||raw==='series'||raw==='drama')return true;
    if(/(?:squid game|イカゲーム|chernobyl|チェルノブイリ|十角館の殺人|the decagon house murders|breaking bad|better call saul|true detective|black mirror|mindhunter|band of brothers|the wire)/i.test(b))return true;
    if((/^(?:spec|spec ~ first blood)$/i.test(x.title.trim())||/^(?:spec|spec ~ first blood)$/i.test(x.english.trim()))&&x.year===2010)return true;
    return (x.title==='新世紀エヴァンゲリオン'||/^neon genesis evangelion$/i.test(x.english.trim()))&&x.year===1995;
  }
  function miscHint(f){
    const b=blob(f),rt=Number(state.runtimeOverrides?.[f.id]??f.runtime),raw=String(f.mediaType||'');
    if(/(?:lecture|講座|making[ -]?of|メイキング|music video|ミュージック.?ビデオ|\bmv\b|\bpv\b|ani\*?kuri|on your mark|concert|コンサート|the eras tour|ライブ映像|live at|short video|ショートビデオ)/i.test(b))return true;
    return raw==='other'&&Number.isFinite(rt)&&rt>0&&rt<=40&&!tvHint(f);
  }
  function heuristicMedia(f){if(miscHint(f))return 'other';if(tvHint(f))return 'drama';return 'movie';}
  function heuristicOrigin(f){if(japaneseHint(f))return '邦画';return 'その他';}
  function countryOrigin(countries,language=''){
    const cs=Array.isArray(countries)?countries.filter(Boolean):[];
    if(cs.includes('JP'))return '邦画';
    if(cs.includes('US'))return 'ハリウッド';
    if(cs.length)return 'その他';
    return language==='ja'?'邦画':'その他';
  }
  function mediaOf(f){return MEDIA_OK.has(mediaMap[f?.id])?mediaMap[f.id]:'movie';}
  function originOf(f){return ORIGIN_OK.has(originMap[f?.id])?originMap[f.id]:'その他';}
  function mediaLabel(f){return (MEDIA.find(x=>x[0]===mediaOf(f))||MEDIA[0])[1];}
  function persist(){writeObj(MEDIA_KEY,mediaMap);writeObj(ORIGIN_KEY,originMap);const tv=new Set(Object.entries(mediaMap).filter(([,v])=>v==='drama').map(([id])=>id));writeSet(LEGACY_TV_KEY,tv);}
  function apply(){for(const f of allFilms()){const m=MEDIA_OK.has(mediaMap[f.id])?mediaMap[f.id]:heuristicMedia(f);const o=ORIGIN_OK.has(originMap[f.id])?originMap[f.id]:heuristicOrigin(f);mediaMap[f.id]=m;originMap[f.id]=o;state.mediaTypeOverrides[f.id]=m;state.originOverrides[f.id]=o;}persist();}
  function setMedia(f,v,manualPick=false){if(!f||!MEDIA_OK.has(v))return;mediaMap[f.id]=v;state.mediaTypeOverrides[f.id]=v;if(manualPick){manual.add(f.id);writeSet(MANUAL_KEY,manual)}persist();}
  function setOrigin(f,v,manualPick=false){if(!f||!ORIGIN_OK.has(v))return;originMap[f.id]=v;state.originOverrides[f.id]=v;if(manualPick){manual.add(f.id);writeSet(MANUAL_KEY,manual)}persist();}

  let reset=false;try{reset=localStorage.getItem(RESET_KEY)===RESET_VERSION}catch(_){}
  if(!reset){
    mediaMap={};originMap={};manual=new Set();
    for(const f of allFilms()){mediaMap[f.id]=heuristicMedia(f);originMap[f.id]=heuristicOrigin(f);}
    writeSet(MANUAL_KEY,manual);writeSet(PROGRESS_KEY,new Set());
    try{localStorage.setItem(RESET_KEY,RESET_VERSION)}catch(_){}
  }
  apply();save(false);

  function row(wrap,i){return wrap?.querySelectorAll('.struct-row')?.[i]||null;}
  function fillRow(r,options,selected,onPick){if(!r)return;const host=r.querySelector('.struct-options')||r;host.innerHTML=options.map(([v,l])=>`<button type="button" class="struct-chip${v===selected?' on':''}" data-struct-value="${v}" data-multi="0">${l}</button>`).join('');host.querySelectorAll('.struct-chip').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const v=b.dataset.structValue;host.querySelectorAll('.struct-chip').forEach(x=>x.classList.toggle('on',x===b));onPick?.(v);});}
  function mapOldOrigin(v){if(v==='邦画')return '邦画';if(v==='ハリウッド')return 'ハリウッド';return 'その他';}
  const addChoice={newGenrePicker:{media:'movie',origin:'その他'},qGenrePicker:{media:'movie',origin:'その他'}};
  function bindAdd(id,m='movie',o='その他'){
    const wrap=document.getElementById(id);if(!wrap)return;
    m=MEDIA_OK.has(m)?m:'movie';o=ORIGIN_OK.has(o)?o:mapOldOrigin(o);addChoice[id]={media:m,origin:o};
    fillRow(row(wrap,0),MEDIA,m,v=>addChoice[id].media=v);fillRow(row(wrap,1),ORIGIN,o,v=>addChoice[id].origin=v);
  }
  bindAdd('newGenrePicker');bindAdd('qGenrePicker');

  const selectTmdbBase=selectTmdb;
  selectTmdb=async function(id){
    const out=await selectTmdbBase(id),wrap=document.getElementById('qGenrePicker');
    const oldM=[...row(wrap,0)?.querySelectorAll('.struct-chip.on')||[]][0]?.dataset.structValue||'movie';
    const oldO=[...row(wrap,1)?.querySelectorAll('.struct-chip.on')||[]][0]?.dataset.structValue||'その他';
    bindAdd('qGenrePicker',oldM==='drama'?'drama':oldM==='other'?'other':'movie',mapOldOrigin(oldO));return out;
  };
  function wrapAdd(buttonId,pickerId){
    const btn=document.getElementById(buttonId);if(!btn||!btn.onclick)return;const prev=btn.onclick;
    btn.onclick=async function(ev){const chosen={...(addChoice[pickerId]||{media:'movie',origin:'その他'})},before=new Set((state.customFilms||[]).map(f=>f.id));const out=prev.call(this,ev);if(out&&typeof out.then==='function')await out;const f=(state.customFilms||[]).find(x=>!before.has(x.id));if(f){setMedia(f,chosen.media,true);setOrigin(f,chosen.origin,true);save();render();}bindAdd(pickerId);return out;};
  }
  wrapAdd('addMovie','newGenrePicker');wrapAdd('qAdd','qGenrePicker');

  function updateMeta(f){const el=document.getElementById('sheetMeta');if(!el||!f)return;const fv=state.formatOverrides?.[f.id]||'live',fl=fv==='animation'?'アニメ':fv==='hybrid'?'実写・アニメ':'実写',rt=Number(state.runtimeOverrides?.[f.id]??f.runtime);el.textContent=`${f.year||''} · ${mediaLabel(f)} · ${originOf(f)} · ${fl}${Number.isFinite(rt)&&rt>0?' · '+rt+'分':''}`;}
  const openSheetBase=openSheet;
  openSheet=function(id){openSheetBase(id);const f=filmById(id),wrap=document.getElementById('editGenrePicker');if(!f||!wrap)return;fillRow(row(wrap,0),MEDIA,mediaOf(f),v=>{setMedia(f,v,true);save();updateMeta(f)});fillRow(row(wrap,1),ORIGIN,originOf(f),v=>{setOrigin(f,v,true);save();updateMeta(f)});updateMeta(f);};

  function setFilter(id,label,options){const s=document.getElementById(id);if(!s)return;const old=s.value;s.innerHTML=`<option value="">${label}: すべて</option>`+options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');if([...s.options].some(o=>o.value===old))s.value=old;}
  function normalizeFilters(){for(const suffix of ['Rank','Classify']){setFilter('mediaFilter'+suffix,'種別',MEDIA);setFilter('originFilter'+suffix,'制作区分',ORIGIN);}}
  function postFilter(root,cardSel,sectionSel,m,o){document.querySelectorAll(`${root} ${cardSel}`).forEach(card=>{const f=filmById(decodeURIComponent(card.dataset.id||''));if(f&&((m&&mediaOf(f)!==m)||(o&&originOf(f)!==o)))card.remove();});document.querySelectorAll(`${root} ${sectionSel}`).forEach(sec=>{if(!sec.querySelector(cardSel))sec.style.display='none'});if(root==='#rankRoot')document.querySelectorAll('#rankRoot .score-bin').forEach(bin=>{if(!bin.querySelector(cardSel))bin.style.display='none'});}
  const renderRankBase=renderRank;
  renderRank=function(){normalizeFilters();const ms=document.getElementById('mediaFilterRank'),os=document.getElementById('originFilterRank'),m=ms?.value||'',o=os?.value||'';if(ms)ms.value='';if(os)os.value='';renderRankBase();normalizeFilters();if(ms&&[...ms.options].some(x=>x.value===m))ms.value=m;if(os&&[...os.options].some(x=>x.value===o))os.value=o;postFilter('#rankRoot','.rank-card','.rank-star',m,o);};
  const renderClassBase=renderClassify;
  renderClassify=function(){normalizeFilters();const ms=document.getElementById('mediaFilterClassify'),os=document.getElementById('originFilterClassify'),m=ms?.value||'',o=os?.value||'';if(ms)ms.value='';if(os)os.value='';renderClassBase();normalizeFilters();if(ms&&[...ms.options].some(x=>x.value===m))ms.value=m;if(os&&[...os.options].some(x=>x.value===o))os.value=o;postFilter('#classifyRoot','.card','.section',m,o);};
  normalizeFilters();
  for(const [id,fn] of [['mediaFilterRank',renderRank],['originFilterRank',renderRank],['mediaFilterClassify',renderClassify],['originFilterClassify',renderClassify]]){const e=document.getElementById(id);if(e)e.onchange=fn;}
  const matchBase=match;match=function(f,q){if(matchBase(f,q))return true;if(!q)return true;return `${mediaLabel(f)} ${originOf(f)}`.toLowerCase().includes(String(q).toLowerCase());};

  const addLbBase=addLbFilm;
  addLbFilm=function(meta){const f=addLbBase(meta);if(!f)return f;mediaMap[f.id]=meta?.tmdbType==='tv'?'drama':heuristicMedia(f);originMap[f.id]=heuristicOrigin(f);apply();save();return f;};

  const data=document.getElementById('page-data');let panel=document.getElementById('reclassStatus33');
  if(data&&!panel){panel=document.createElement('div');panel.id='reclassStatus33';panel.className='panel';panel.innerHTML='<h2>作品分類の再確認</h2><div class="api-status" id="reclassText33">準備中…</div>';const marker=document.getElementById('movie30BuildV29');if(marker)data.insertBefore(panel,marker);else data.appendChild(panel);}
  const status=(t,cls='')=>{const e=document.getElementById('reclassText33');if(e){e.textContent=t;e.className='api-status '+cls;}};

  function scoreCandidate(f,r){const x=info(f),yr=Number(String(r.release_date||r.first_air_date||'').slice(0,4))||0,a=[x.title,x.original,x.english].map(norm).filter(Boolean),b=[r.title,r.original_title,r.name,r.original_name].map(norm).filter(Boolean);let s=0;if(x.year&&yr&&x.year===yr)s+=8;if(a.some(u=>b.includes(u)))s+=9;else if(a.some(u=>b.some(v=>u&&v&&(u.includes(v)||v.includes(u)))))s+=4;if(r.media_type===(heuristicMedia(f)==='drama'?'tv':'movie'))s+=2;return s;}
  async function resolveTmdb(f){
    if(typeof tmdbFetch!=='function'||typeof getTmdbCredential!=='function'||!getTmdbCredential())return null;
    const x=info(f),q=x.english||x.original||x.title;if(!q)return null;
    const res=await tmdbFetch('/search/multi',{query:q,language:'en-US',include_adult:'false'}),arr=(res?.results||[]).filter(r=>r.media_type==='movie'||r.media_type==='tv');if(!arr.length)return null;
    arr.sort((a,b)=>scoreCandidate(f,b)-scoreCandidate(f,a));const r=arr[0];if(scoreCandidate(f,r)<8)return null;
    let media=r.media_type==='tv'?'drama':'movie',origin='その他';
    if(r.media_type==='tv')origin=countryOrigin(r.origin_country||[],r.original_language||'');
    else{
      try{const d=await tmdbFetch('/movie/'+r.id,{language:'en-US'}),countries=(d?.production_countries||[]).map(c=>c.iso_3166_1);origin=countryOrigin(countries,r.original_language||'');const rt=Number(d?.runtime);if((miscHint(f))||(Number.isFinite(rt)&&rt>0&&rt<=40&&String(f.mediaType||'')==='other'))media='other';}
      catch(_){origin=r.original_language==='ja'?'邦画':heuristicOrigin(f);}
    }
    if(miscHint(f))media='other';
    return {media,origin};
  }
  let running=false;
  async function deepReclass(){
    if(running)return;running=true;let credential='';try{credential=getTmdbCredential?.()||''}catch(_){}
    if(!credential){status('一次分類は完了。TMDB設定があると全作品をさらに照合できます。');running=false;return;}
    const films=allFilms(),done=readSet(PROGRESS_KEY),queue=films.filter(f=>!done.has(f.id));if(!queue.length){status(`再分類完了 · ${films.length}作品を確認済み`,'ok');running=false;return;}
    let completed=done.size,index=0,dirty=0;status(`再分類中… ${completed}/${films.length}`);
    async function worker(){while(true){const i=index++;if(i>=queue.length)return;const f=queue[i];try{const c=await resolveTmdb(f);if(c&&!manual.has(f.id)){mediaMap[f.id]=c.media;originMap[f.id]=c.origin;state.mediaTypeOverrides[f.id]=c.media;state.originOverrides[f.id]=c.origin;dirty++;}}catch(_){}done.add(f.id);completed++;if(completed%10===0||completed===films.length){writeSet(PROGRESS_KEY,done);persist();if(dirty){save(false);dirty=0;}status(`再分類中… ${Math.min(completed,films.length)}/${films.length}`);}await new Promise(r=>setTimeout(r,80));}}
    await Promise.all([worker(),worker(),worker()]);writeSet(PROGRESS_KEY,done);apply();save();render();status(`再分類完了 · ${films.length}作品を確認済み`,'ok');running=false;
  }
  setTimeout(deepReclass,1000);
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD33;
  render();
})();

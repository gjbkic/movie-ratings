(() => {
  // v42: seed user-confirmed watched Japanese TV series that may not come through Letterboxd/IMDb.
  // All are added as watched but UNRATED (star 0, no exact score/rank).
  const BUILD='20260926d';
  const SEED_KEY='movie30_confirmed_tv_seed_v42_20260926d';
  const MEDIA_KEY='movie30_media_v33_v1';
  const ORIGIN_KEY='movie30_origin_v33_v1';
  const LEGACY_TV_KEY='movie30_media_drama_ids_v1';
  const TAG_MAIN='TV本編';
  const TV_TAGS=new Set(['TV本編','TV特番・SP']);

  const SEEDS=[
    {id:'seed-tv-hanzawa-2013',title:'半沢直樹',english:'Hanzawa Naoki',year:2013},
    {id:'seed-tv-legalhigh-2012',title:'リーガル・ハイ',english:'Legal High',year:2012},
    {id:'seed-tv-legalhigh2-2013',title:'リーガルハイ 第2期',english:'Legal High 2',year:2013},
    {id:'seed-tv-trick-2000',title:'TRICK',english:'Trick',year:2000},
    {id:'seed-tv-trick2-2002',title:'TRICK2',english:'Trick 2',year:2002},
    {id:'seed-tv-trick3-2003',title:'TRICK3',english:'Trick 3',year:2003},
    {id:'seed-tv-hero-2001',title:'HERO',english:'Hero',year:2001},
    {id:'seed-tv-hero-2014',title:'HERO 第2期',english:'Hero 2',year:2014},
    {id:'seed-tv-999-2016',title:'99.9-刑事専門弁護士-',english:'99.9 Criminal Lawyer',year:2016},
    {id:'seed-tv-9992-2018',title:'99.9-刑事専門弁護士- SEASON II',english:'99.9 Criminal Lawyer Season II',year:2018},
    {id:'seed-tv-spec-2010',title:'SPEC〜警視庁公安部公安第五課 未詳事件特別対策係事件簿〜',english:'SPEC ~ First Blood',year:2010},
    {id:'seed-tv-strawberrynight-2012',title:'ストロベリーナイト',english:'Strawberry Night',year:2012},
    {id:'seed-tv-galileo-2007',title:'ガリレオ',english:'Galileo',year:2007},
    {id:'seed-tv-liargame-2007',title:'LIAR GAME',english:'Liar Game',year:2007},
    {id:'seed-tv-codeblue-2008',title:'コード・ブルー -ドクターヘリ緊急救命-',english:'Code Blue',year:2008},
    {id:'seed-tv-boss-2009',title:'BOSS',english:'Boss',year:2009}
  ];

  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g,'');
  const readObj=k=>{try{const x=JSON.parse(localStorage.getItem(k)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch(_){return {}}};
  const writeObj=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const writeSet=(k,s)=>{try{localStorage.setItem(k,JSON.stringify([...s]))}catch(_){}};
  const aliases=f=>{const x=titleInfo(f)||{};return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f?.lbTitle].filter(Boolean).map(norm);};
  function findSeed(seed){
    const wanted=new Set([seed.title,seed.english].filter(Boolean).map(norm));
    return allFilms().find(f=>Number(f.year)===Number(seed.year)&&aliases(f).some(a=>wanted.has(a)))||null;
  }
  function ensureMain(f){
    state.mediaTypeOverrides=state.mediaTypeOverrides||{};
    state.genreOverrides=state.genreOverrides||{};
    state.originOverrides=state.originOverrides||{};
    state.formatOverrides=state.formatOverrides||{};
    state.mediaTypeOverrides[f.id]='drama';
    state.originOverrides[f.id]='邦画';
    state.formatOverrides[f.id]='live';
    const base=Array.isArray(state.genreOverrides[f.id])?state.genreOverrides[f.id].filter(g=>!TV_TAGS.has(g)):[];
    state.genreOverrides[f.id]=[...new Set([...base,TAG_MAIN])];
    if(!f.tmdbType)f.tmdbType='tv';
  }

  let already=false;try{already=localStorage.getItem(SEED_KEY)==='1'}catch(_){}
  if(already){const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;return;}

  state.customFilms=state.customFilms||[];
  const mediaMap=readObj(MEDIA_KEY),originMap=readObj(ORIGIN_KEY);
  let added=0,matched=0;
  for(const seed of SEEDS){
    let f=findSeed(seed);
    if(!f){
      f={id:seed.id,title:seed.title,originalTitle:seed.title,englishTitle:seed.english||'',lbTitle:seed.english||seed.title,tmdbId:null,tmdbType:'tv',year:seed.year,uri:'',category:'追加映画',order:999999,star:0,oldScore:null,added:true,_seq:Date.now()+added,source:'manual-confirmed-watched'};
      state.customFilms.push(f);added++;
    }else matched++;
    ensureMain(f);
    mediaMap[f.id]='drama';originMap[f.id]='邦画';
    delete state.exactScores?.[f.id];
    delete state.assignments?.[f.id];
    for(const k of Object.keys(state.rankOrder||{}))state.rankOrder[k]=(state.rankOrder[k]||[]).filter(id=>id!==f.id);
  }
  writeObj(MEDIA_KEY,mediaMap);writeObj(ORIGIN_KEY,originMap);
  writeSet(LEGACY_TV_KEY,new Set(Object.entries(mediaMap).filter(([,v])=>v==='drama').map(([id])=>id)));
  try{localStorage.setItem(SEED_KEY,'1')}catch(_){}
  save();
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  toast(`視聴済みTVを${added}件追加${matched?`（既存${matched}件は本編に整理）`:''}`);
  try{sessionStorage.setItem('movie30_tvseed_reload_v42',BUILD)}catch(_){}
  setTimeout(()=>location.reload(),180);
})();

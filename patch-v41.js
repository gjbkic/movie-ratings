(() => {
  // v41: review-based TV classification. Corrects Letterboxd/TMDB entries that are
  // semantically TV series/specials even when their source entity is typed as a movie.
  const BUILD='20260926c';
  const MEDIA_KEY='movie30_media_v33_v1';
  const LEGACY_TV_KEY='movie30_media_drama_ids_v1';
  const TAG_MAIN='TV本編', TAG_SP='TV特番・SP';
  const TV_TAGS=new Set([TAG_MAIN,TAG_SP]);

  const CURRENT_SPECIAL_IDS=new Set([
    'custom-1790322758188-46qe', // 逃げ恥 新春SP
    'custom-1790322761655-im7g', // 半沢直樹 エピソードゼロ
    'custom-1790322761955-twge', // リーガル・ハイ SP2
    'custom-1790322762266-mrn9', // リーガル・ハイ SP
    'custom-1790322763462-yaoz', // IWGP スープの回
    'custom-1790322764349-xp48', // Stranger Things 5: The Finale
    'custom-1790423279439-sn81', // ストロベリーナイト 2010 TV special
    'custom-1790423279786-lguu', // TRICK 新作SP2
    'custom-1790423280120-qki8', // TRICK 新作SP
    'custom-1790423280570-6eki'  // TRICK 新作SP3
  ]);

  const CURRENT_MAIN_IDS=new Set([
    'custom-1790322756823-bi61', // JoJo Stone Ocean
    'custom-1790322757185-u25f', // JoJo Stardust Crusaders
    'custom-1790322757548-hd0x', // JoJo Golden Wind
    'custom-1790322757929-0kod', // JoJo Diamond is Unbreakable
    'custom-1790423280875-9b4j'  // 踊る大捜査線 TV series
  ]);

  const readObj=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return {}}};
  const writeObj=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const writeSet=(k,s)=>{try{localStorage.setItem(k,JSON.stringify([...s]))}catch(_){}};
  function rawGenres(f){const g=state.genreOverrides?.[f?.id];return Array.isArray(g)?[...new Set(g)]:[];}
  function textOf(f){const x=titleInfo(f)||{};return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f?.lbTitle].filter(Boolean).join(' ');}
  function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}

  function titleSpecial(f){
    const t=norm(textOf(f)),y=Number(f?.year)||0;
    if(CURRENT_SPECIAL_IDS.has(f?.id))return true;
    if(y===2010&&/(?:^| )ストロベリーナイト(?: |$)|strawberry night/.test(t))return true;
    return /(?:逃げるは恥だが役に立つ.*(?:新春|スペシャル)|full-time wife escapist.*new year.*special|半沢直樹.*エピソードゼロ|hanzawa naoki.*spin.?off|リーガル.?ハイ.*スペシャル|legal high.*\bsp\b|池袋ウエストゲートパーク.*スープ|ikebukuro west gate park.*\bsp\b|stranger things 5.*finale|トリック.*新作スペシャル|trick shinsaku special|今日から俺は.*スペシャル|義母と娘のブルース.*スペシャル|コンフィデンスマンjp.*(?:運勢編|スペシャル)|踊る大捜査線.*スペシャル)/i.test(t);
  }
  function titleMain(f){
    if(CURRENT_MAIN_IDS.has(f?.id))return true;
    const t=norm(textOf(f)),y=Number(f?.year)||0;
    if(y===1995&&/(?:新世紀エヴァンゲリオン|neon genesis evangelion)/i.test(t))return true;
    if(y===2010&&/(?:^| )spec(?: ~ first blood)?(?: |$)/i.test(t))return true;
    return /(?:jojo's bizarre adventure: (?:stone ocean|stardust crusaders|golden wind|diamond is unbreakable)|踊る大捜査線|bayside shakedown|十角館の殺人|the decagon house murders|squid game|イカゲーム|chernobyl|チェルノブイリ|breaking bad|better call saul|true detective|black mirror|mindhunter|band of brothers|the wire)/i.test(t);
  }

  function currentMedia(f,map){return String(state.mediaTypeOverrides?.[f?.id]||map[f?.id]||f?.mediaType||'movie');}
  function shouldBeTV(f,map){return titleSpecial(f)||titleMain(f)||f?.tmdbType==='tv'||['drama','series'].includes(currentMedia(f,map));}
  function setSubtype(f,sp){
    state.genreOverrides=state.genreOverrides||{};
    const base=rawGenres(f).filter(g=>!TV_TAGS.has(g));
    base.push(sp?TAG_SP:TAG_MAIN);
    const prev=rawGenres(f),next=[...new Set(base)];
    if(prev.length===next.length&&prev.every((x,i)=>x===next[i]))return false;
    state.genreOverrides[f.id]=next;return true;
  }

  const map=readObj(MEDIA_KEY);
  let mediaChanged=false,stateChanged=false;
  const films=allFilms();
  for(const f of films){
    if(!shouldBeTV(f,map))continue;
    if(map[f.id]!=='drama'){map[f.id]='drama';mediaChanged=true;}
    state.mediaTypeOverrides=state.mediaTypeOverrides||{};
    if(state.mediaTypeOverrides[f.id]!=='drama'){state.mediaTypeOverrides[f.id]='drama';stateChanged=true;}
    const sp=titleSpecial(f);
    if(sp||titleMain(f)||!rawGenres(f).some(g=>TV_TAGS.has(g)))stateChanged=setSubtype(f,sp)||stateChanged;
  }
  if(mediaChanged){
    writeObj(MEDIA_KEY,map);
    writeSet(LEGACY_TV_KEY,new Set(Object.entries(map).filter(([,v])=>v==='drama').map(([id])=>id)));
  }
  if(stateChanged)save(false);

  // v33 keeps its media map in a closure. If this pass corrected a movie->TV item,
  // reload once so all existing filters/edit controls read the corrected map too.
  if(mediaChanged){
    let reloaded=false;try{reloaded=sessionStorage.getItem('movie30_tvclass_reload_v41')===BUILD}catch(_){}
    if(!reloaded){try{sessionStorage.setItem('movie30_tvclass_reload_v41',BUILD)}catch(_){};setTimeout(()=>location.reload(),120);return;}
  }

  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
  render();
})();

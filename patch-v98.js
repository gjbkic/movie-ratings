(() => {
'use strict';
// v98: flush sticky headings and protect manually-entered exact scores during LB refresh.
const BUILD='20261012h';
const css=document.createElement('style');css.id='movie30-score-sync98';
css.textContent=[
 // The navigation and its current star section form a continuous sticky stack.
 '#page-rank #starJumpBar{margin-bottom:0!important;border-bottom:0!important;padding-bottom:4px!important;}',
 '#rankRoot .rank-star{margin-top:0!important;border-top:0!important;}',
 '#rankRoot .rank-star>.rank-star-head{top:var(--movie98-star-top,150px)!important;margin-top:0!important;border-top:1px solid #283541!important;border-radius:0!important;}',
 '#rankRoot .score-bin>.score-label{top:var(--movie98-score-top,190px)!important;}',
 '#rankRoot .rank-star,#rankRoot .uns-panel{scroll-margin-top:calc(var(--movie98-star-top,150px) + 2px)!important;}',
 '#rankRoot .score-bin{scroll-margin-top:calc(var(--movie98-score-top,190px) + 2px)!important;}'
].join('\n');document.head.append(css);
let ticking=false,last='';
function align(){
 ticking=false;
 const header=document.querySelector('.top'),jump=document.getElementById('starJumpBar');
 if(!header||!jump)return;
 const headerBottom=Math.max(0,Math.ceil(header.getBoundingClientRect().bottom));
 const h=Math.ceil(jump.getBoundingClientRect().height);
 const heading=document.querySelector('#rankRoot .rank-star>.rank-star-head');
 const headingHeight=Math.ceil(heading?.getBoundingClientRect().height||38);
 // Share actual measurements. One pixel of overlap joins the borders on iOS.
 const a=Math.max(headerBottom,headerBottom+h-1);
 const b=a+headingHeight-1;
 const key=a+':'+b;
 if(last!==key){
  last=key;document.documentElement.style.setProperty('--movie98-star-top',a+'px');
  document.documentElement.style.setProperty('--movie98-score-top',b+'px');
 }
}
function queue(){if(ticking)return;ticking=true;requestAnimationFrame(align);}
window.addEventListener('scroll',queue,{passive:true});
window.addEventListener('resize',queue,{passive:true});
if(typeof ResizeObserver==='function'){
 const ro=new ResizeObserver(queue);
 const head=document.querySelector('.top'),bar=document.getElementById('starJumpBar');
 if(head)ro.observe(head);if(bar)ro.observe(bar);
}
queue();

const episodeKeys=[
 ['hang','blackmirrorhangthedj','black-mirror-hang-the-dj'],
 ['uss','blackmirrorusscallister','black-mirror-uss-callister']
];
const normalize=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const uri=x=>String(x||'').replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();
const validScore=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=100;
function keyFor(f){
 if(!f)return '';
 const info=titleInfo(f),names=[info.title,info.originalTitle,info.englishTitle,
  f.title,f.originalTitle,f.englishTitle,f.lbTitle].map(normalize);
 const path=uri(f.uri);
 for(const [key,title,slug] of episodeKeys){
  if(names.includes(title)||path.includes('/film/'+slug))return key;
 }
 return '';
}
function snapshot(){
 const result=new Map();
 for(const f of allFilms()){
  if(!Object.prototype.hasOwnProperty.call(state.exactScores||{},f.id))continue;
  const score=state.exactScores[f.id];
  if(!validScore(score))continue;
  const ref={id:f.id,key:keyFor(f),score:Number(score),star:scoreToStar(score)};
  result.set(f.id,ref);
 }
 return result;
}
// Restore only exact scores actually entered in this browser, never estimate a
// numerical score from Letterboxd stars. Preserve the same-score rank list.
function restoreScored(before){
 let restored=0,corrected=0;
 state.exactScores=state.exactScores||{};
 state.starOverrides=state.starOverrides||{};
 for(const item of before.values()){
  let film=filmById(item.id);
  if(!film&&item.key){
   const matching=allFilms().filter(f=>keyFor(f)===item.key);
   if(matching.length===1)film=matching[0];
  }
  if(!film)continue;
  if(!validScore(state.exactScores[film.id])){
   state.exactScores[film.id]=item.score;
   restored++;
  }
  // The app's numeric score is authoritative; LB's ★ must never reclassify it.
  if(Number(state.starOverrides[film.id]??film.star)!==scoreToStar(state.exactScores[film.id])){
   state.starOverrides[film.id]=scoreToStar(state.exactScores[film.id]);
   corrected++;
  }
  if(film.id!==item.id&&item.key){
   for(const [score,ids] of Object.entries(state.rankOrder||{})){
    if(!Array.isArray(ids))continue;
    const ix=ids.indexOf(item.id);
    if(ix<0||ids.includes(film.id))continue;
    ids[ix]=film.id;
   }
  }
 }
 return {restored,corrected};
}
// Explicit same-episode identification: duplicate TV records can otherwise fool
// older "find existing film" handlers and make an unrated copy appear.
const previousFind=findExistingFilm;
findExistingFilm=function(raw){
 const target=previousFind(raw);
 if(target)return target;
 const pseudo={
  uri:raw?.link||raw?.uri||'',title:raw?.title||'',
  englishTitle:raw?.englishTitle||raw?.title||'',
  originalTitle:raw?.originalTitle||''
 };
 const key=keyFor(pseudo);
 if(!key)return null;
 const candidates=allFilms().filter(f=>keyFor(f)===key&&(!raw.year||!f.year||Number(raw.year)===Number(f.year)));
 if(!candidates.length)return null;
 const matched=candidates.filter(f=>uri(f.uri)&&uri(f.uri)===uri(pseudo.uri));
 const pool=matched.length?matched:candidates;
 // If duplicates exist, prefer an already numerically scored record.
 pool.sort((a,b)=>Number(validScore(state.exactScores?.[b.id]))-Number(validScore(state.exactScores?.[a.id])));
 return pool[0];
};

// Keep a separate read-only recovery source in the browser's existing backups.
// This targets only the two reported episodes, never creates guessed ratings.
function backupRepair(){
 const missing=new Map();
 for(const [key] of episodeKeys) {
  const matches=allFilms().filter(f=>keyFor(f)===key);
  if(matches.length&&!matches.some(f=>validScore(state.exactScores?.[f.id])))missing.set(key,matches);
 }
 if(!missing.size)return 0;
 const backups=[];
 for(const k of [...BACKUP_KEYS,...LEGACY_KEYS]){
  try{
   const v=JSON.parse(localStorage.getItem(k)||'null');
   if(v?.exactScores&&Array.isArray(v.customFilms))backups.push(v);
  }catch(_){}
 }
 backups.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
 let restored=0;
 for(const [key,films] of missing){
  const values=[];
  for(const b of backups){
   for(const f of b.customFilms||[]){
    const names=[f.title,f.originalTitle,f.englishTitle,f.lbTitle,
       b.titleOverrides?.[f.id]?.title,b.titleOverrides?.[f.id]?.englishTitle].map(normalize);
    const identified=episodeKeys.find(([k,n,slug])=>k===key&&
       (names.includes(n)||uri(f.uri).includes('/film/'+slug)));
    if(!identified)continue;
    const score=b.exactScores?.[f.id];
    if(validScore(score))values.push({id:f.id,score:Number(score),updatedAt:b.updatedAt||0});
   }
  }
  // Refuse conflicting backups; score choices are the user's, not ours.
  const numbers=[...new Set(values.map(v=>v.score))];
  if(numbers.length!==1)continue;
  const exact=films.find(f=>values.some(v=>v.id===f.id));
  // Never guess between two distinct records of the same TV episode.
  const target=exact||(films.length===1?films[0]:null);
  if(!target)continue;
  state.exactScores[target.id]=numbers[0];
  state.starOverrides[target.id]=scoreToStar(numbers[0]);
  restored++;
 }
 return restored;
}
// Preserve scores throughout all nested sync wrappers, including metadata updates.
const oldSync=syncLetterboxd;
let inProgress=null;
syncLetterboxd=async function(...args){
 if(inProgress)return inProgress;
 const scoresBefore=snapshot();
 inProgress=(async()=>{
  try{return await oldSync.apply(this,args);}
  finally{
   const change=restoreScored(scoresBefore);
   if(change.restored||change.corrected){
    save();render();
    const status=document.getElementById('lbStatus');
    if(status)status.textContent+=' · アプリ内採点を保護 '+(change.restored+change.corrected)+'件';
   }
  }
 })();
 try{return await inProgress;}finally{inProgress=null;}
};
const syncButton=document.getElementById('syncLetterboxd');
if(syncButton)syncButton.onclick=()=>syncLetterboxd(false);
const topSync=document.getElementById('topLbSyncV73');
// The upper shortcut invokes the lexical syncLetterboxd binding at click time;
// it already uses the new wrapper, so no need to replace its handler.
// Do not display a stray unrated duplicate of an already-scored identical
// episode. Its record is retained in saved state; only a disposable,
 // note-free duplicate is removed from read-only list output.
const originalAllFilms=allFilms;
allFilms=function(...args){
 const items=originalAllFilms.apply(this,args);
 const scored=new Map();
 for(const f of items){
  const k=keyFor(f);
  if(k&&validScore(state.exactScores?.[f.id])&&!scored.has(k))scored.set(k,f);
 }
 if(!scored.size)return items;
 return items.filter(f=>{
  const k=keyFor(f),keeper=k?scored.get(k):null;
  if(!keeper||keeper.id===f.id||validScore(state.exactScores?.[f.id]))return true;
  const note=state.letterboxdMeta?.[f.id]||{};
  if(note.note||note.watchHistory?.length||note.rssReviewRecords&&Object.keys(note.rssReviewRecords).length)return true;
  if(Number(f.year||0)!==Number(keeper.year||0))return true;
  const sameUri=uri(f.uri)&&uri(f.uri)===uri(keeper.uri);
  const englishA=normalize(titleInfo(f).englishTitle||f.lbTitle);
  const englishB=normalize(titleInfo(keeper).englishTitle||keeper.lbTitle);
  const sameEnglish=Boolean(englishA&&englishB&&englishA===englishB);
  return !(sameUri||sameEnglish);
 });
};
const backfilled=backupRepair();
if(backfilled){save();render();}
window.__movie30SyncGuard98={version:BUILD,restoreFromBackupCount:backfilled};
const label=document.getElementById('movie30BuildV29');
if(label)label.textContent='app build '+BUILD;
})();
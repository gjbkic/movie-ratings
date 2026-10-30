// Repair the two known records for the same 2001 film without touching its score or rank.
// This runs on local state too: an older iPhone snapshot can otherwise upload the
// removed row to live-state.json again after a one-off GitHub data repair.
(function(root){
  const KEEP='custom-1792179458643-m8hx';
  const EXTRA='custom-1793382511630-rbdf';
  const CURRENT_URI='https://letterboxd.com/gjbkic/film/crayon-shinchan-the-movie-the-storm-called-2001/';
  const OLD_URI='https://letterboxd.com/gjbkic/film/crayon-shin-chan-the-storm-called-the-adult/';
  const TMDB_ID=37280;
  function repair(s){
    const films=s?.customFilms;
    if(!Array.isArray(films))return {changed:false,blocked:'customFilms missing'};
    const keep=films.find(f=>f?.id===KEEP),extra=films.find(f=>f?.id===EXTRA);
    if(!keep)return {changed:false,blocked:extra?'ranked film missing':null};
    const title=s.titleOverrides?.[KEEP]||{};
    const knownId=title.tmdbId??keep.tmdbId;
    if(Number(keep.year)!==2001||keep.source!=='letterboxd'||
      (knownId!=null&&Number(knownId)!==TMDB_ID))return {changed:false,blocked:'ranked film identity changed'};
    if(extra){
      const extraId=s.titleOverrides?.[EXTRA]?.tmdbId??extra.tmdbId;
      const ranked=Object.values(s.rankOrder||{}).some(ids=>Array.isArray(ids)&&ids.includes(EXTRA));
      const extraScore=s.exactScores?.[EXTRA];
      const keepStar=Number(s.starOverrides?.[KEEP]??keep.star);
      const extraStar=Number(s.starOverrides?.[EXTRA]??extra.star);
      const prior=s.letterboxdMeta?.[EXTRA]?.retiredDuplicateFilm20261031;
      if(Number(extra.year)!==2001||extra.source!=='letterboxd'||
        Number(extraId)!==TMDB_ID||extra.uri!==CURRENT_URI||
        extraScore!=null||extra.oldScore!=null||ranked||extraStar!==keepStar||
        (prior&&JSON.stringify(prior)!==JSON.stringify(extra))){
        return {changed:false,blocked:'duplicate has distinct or changed data'};
      }
    }
    let changed=false;
    if(!knownId){s.titleOverrides=s.titleOverrides||{};s.titleOverrides[KEEP]={...title,tmdbId:TMDB_ID};changed=true}
    if(keep.uri===OLD_URI){keep.uri=CURRENT_URI;changed=true}
    if(extra){
      s.letterboxdMeta=s.letterboxdMeta||{};
      s.letterboxdMeta[EXTRA]={...(s.letterboxdMeta[EXTRA]||{}),
        retiredDuplicateFilm20261031:{...extra},retiredInto:KEEP};
      // Keep every override and the complete note/watch metadata under EXTRA as
      // an orphan archive. Never replace the ranked film's conflicting review.
      s.customFilms=films.filter(f=>f?.id!==EXTRA);
      changed=true;
    }
    return {changed,removed:!!extra,kept:KEEP};
  }
  if(typeof module==='object'&&module.exports)module.exports={repair,KEEP,EXTRA,CURRENT_URI};
  if(root&&root.document){
    root.__movie30RepairCrayonDuplicate=repair;
    root.__movie30StorageReady=Promise.resolve(root.__movie30StorageReady).then(ok=>{
      if(!ok||root.__movie30RecoveryBlocked)return ok;
      const result=repair(state);
      root.__movie30CrayonRepairResult=result;
      if(result.blocked){console.warn('Adult Empire duplicate kept for review:',result.blocked);return ok}
      // app-boot persists the repaired state after the raw startup snapshots
      // have already been archived by movie30RestoreStorage().
      return ok;
    });
  }
})(typeof window!=='undefined'?window:null);

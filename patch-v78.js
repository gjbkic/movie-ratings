(() => {
  // v78: remove the user's explicitly approved obsolete note even if Safari
  // still holds a local copy older than live-state.json. Match the exact legacy
  // content so any new manual or imported review is left untouched.
  const id='custom-1791377114135-l3hd';
  const old=state.letterboxdMeta?.[id]?.note;
  if(typeof old==='string' && old.length===453 && old.startsWith('1. 「遺体は一体……」／上川隆也')){
    delete state.letterboxdMeta[id].note;
    const preview=document.getElementById('note66');
    if(preview && selectedId===id) preview.value='';
    save();
  }
})();
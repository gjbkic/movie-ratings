(() => {
  // v30: one-step undo for accidental ranking drags.
  const style=document.createElement('style');
  style.textContent=`
    #undoLastDrag{white-space:nowrap;padding:8px 9px}
    #undoLastDrag:disabled{opacity:.32;cursor:default}
    @media(max-width:560px){#undoLastDrag{font-size:10px;padding:8px 7px}}
  `;
  document.head.appendChild(style);

  const topActions=document.querySelector('.topactions');
  let undoBtn=document.getElementById('undoLastDrag');
  if(!undoBtn&&topActions){
    undoBtn=document.createElement('button');
    undoBtn.id='undoLastDrag';
    undoBtn.type='button';
    undoBtn.className='btn';
    undoBtn.textContent='↩ 戻す';
    undoBtn.title='直前のドラッグ移動を元に戻す';
    undoBtn.disabled=true;
    topActions.insertBefore(undoBtn,topActions.firstChild);
  }

  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const rankSnapshot=()=>({
    exactScores:clone(state.exactScores),
    rankOrder:clone(state.rankOrder),
    starOverrides:clone(state.starOverrides),
    assignments:clone(state.assignments)
  });
  const sig=s=>JSON.stringify(s);

  let pendingBefore=null;
  let undoState=null;

  function setUndoAvailable(on){
    if(undoBtn)undoBtn.disabled=!on;
  }
  function clearUndo(){
    undoState=null;
    setUndoAvailable(false);
  }

  const startDragV29=startDrag;
  startDrag=function(e){
    const card=e?.currentTarget?.closest?.('.rank-card');
    const list=card?.closest?.('.score-list');
    pendingBefore=(card&&list)?{
      id:decodeURIComponent(card.dataset.id||''),
      snapshot:rankSnapshot(),
      signature:sig(rankSnapshot())
    }:null;
    return startDragV29(e);
  };

  const endDragV29=endDrag;
  endDrag=function(e){
    const before=pendingBefore;
    pendingBefore=null;
    const out=endDragV29(e);
    if(before){
      const after=rankSnapshot();
      if(before.signature!==sig(after)){
        undoState={id:before.id,snapshot:before.snapshot,afterUpdatedAt:Number(state.updatedAt||0)};
        setUndoAvailable(true);
      }
    }
    return out;
  };

  const cancelDragV29=cancelDrag;
  cancelDrag=function(){
    pendingBefore=null;
    return cancelDragV29();
  };

  if(undoBtn)undoBtn.onclick=()=>{
    if(!undoState)return;
    // Do not roll back a later ranking/edit action by accident.
    if(Number(state.updatedAt||0)!==Number(undoState.afterUpdatedAt||0)){
      clearUndo();
      toast('ドラッグ後に別の変更があるため戻せません');
      return;
    }
    const u=undoState;
    state.exactScores=clone(u.snapshot.exactScores);
    state.rankOrder=clone(u.snapshot.rankOrder);
    state.starOverrides=clone(u.snapshot.starOverrides);
    state.assignments=clone(u.snapshot.assignments);
    clearUndo();
    save();
    render();
    const card=document.querySelector(`.rank-card[data-id="${encodeURIComponent(u.id)}"]`);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('just-placed');
      setTimeout(()=>card?.classList.remove('just-placed'),1800);
    }
    toast('直前のドラッグを戻しました');
  };
})();

/* Film detail presentation cleanup: 20261014h.
 * Keeps existing editing handlers, save schema, ranks, notes and API data intact. */
(() => {
  'use strict';
  const sheet=document.querySelector('#sheetBg .sheet');
  if(!sheet || typeof openSheet!=='function')return;

  const css=document.createElement('style');
  css.id='movie30-detail-unified-style';
  css.textContent=[
    '#sheetBg .sheet{--detail-accent:#a9e8bd;}',
    '#sheetBg .sheet-meta{font-size:12px;line-height:1.4;color:#aeb7c4;margin-top:5px;margin-bottom:12px;}',
    '#sheetBg .edit-title-grid{margin:10px 0 13px;}',
    '#sheetBg .sheetgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:13px 0;}',
    '#sheetBg .sheetgrid label:not([hidden]){min-width:0;font-size:11px;color:#aeb7c4;}',
    '#sheetBg .sheetgrid .field{width:100%;min-height:39px;margin-top:5px;}',
    '#sheetBg label:has(#editMediaType),#sheetBg label:has(#editCategory){display:none!important;}',
    '#sheetBg #detail66{background:transparent;border:0;padding:0;margin:10px 0;}',
    '#sheetBg #detail66 .v66-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 10px;}',
    '#sheetBg #detail66 .v66-stat{background:#141d27;border:1px solid #2d3a47;border-radius:12px;padding:11px 8px;}',
    '#sheetBg #detail66 .v66-stat strong{font-size:20px;}',
    '#sheetBg #detail66 .v66-stat span{font-size:10px;}',
    '#sheetBg #detail66 .v66-nei{display:none!important;}',
    '#sheetBg #detail66 .v66-actions{margin:8px 0 0;}',
    '#sheetBg #detail66 .v66-actions:empty{display:none;}',
    '#sheetBg #detail66 .tip{font-size:10px;margin:4px 0 12px;color:#91a0b0;}',
    '#sheetBg #directorPanel84 #getDirector84,#sheetBg #directorPanel84 #directorStatus84{display:none!important;}',
    '#sheetBg .movie30-legacy-genre-head{display:none!important;}',
    '#sheetBg #movie30-detail-classification{border:1px solid #2c3744;border-radius:13px;background:#101720;overflow:hidden;margin:12px 0 16px;}',
    '#sheetBg #movie30-detail-classification>summary{cursor:pointer;list-style:none;display:flex;flex-direction:column;gap:7px;padding:12px 14px;position:relative;user-select:none;}',
    '#sheetBg #movie30-detail-classification>summary::-webkit-details-marker{display:none;}',
    '#sheetBg #movie30-detail-classification>summary::after{content:"⌄";position:absolute;right:12px;top:11px;color:#a9e8bd;font-size:19px;}',
    '#sheetBg #movie30-detail-classification[open]>summary::after{content:"⌃";}',
    '#sheetBg #movie30-detail-classification>summary:focus-visible{outline:2px solid #a9e8bd;outline-offset:-2px;}',
    '#sheetBg .movie30-detail-class-head{font-size:13px;font-weight:850;color:#eef6fb;padding-right:25px;}',
    '#sheetBg .movie30-detail-class-preview{display:flex;flex-wrap:wrap;gap:5px;padding-right:10px;}',
    '#sheetBg .movie30-detail-class-token{display:inline-flex;align-items:center;gap:5px;background:#182936;border:1px solid #324653;border-radius:7px;padding:5px 7px;color:#e1eaf3;font-size:10px;line-height:1.25;}',
    '#sheetBg .movie30-detail-class-token b{font-weight:600;color:#9bafc0;}',
    '#sheetBg #editGenrePicker{margin:0;border-top:1px solid #2b3744;padding:4px 12px 12px;}',
    '#sheetBg #editGenrePicker .struct-row{margin:11px 0;}',
    '#sheetBg #editGenrePicker .struct-label{font-size:11px;margin-bottom:7px;}',
    '#sheetBg #editGenrePicker .struct-options{gap:6px;}',
    '#sheetBg #editGenrePicker .struct-chip{min-height:32px;padding:7px 10px;}',
    '@media(max-width:520px){#sheetBg .sheetgrid{grid-template-columns:repeat(2,minmax(0,1fr));}#sheetBg .sheetgrid label:has(#editRuntime){grid-column:1/-1;}#sheetBg .sheetgrid label{font-size:10px;}#sheetBg #detail66 .v66-stats{grid-template-columns:repeat(2,minmax(0,1fr));}}'
  ].join('\n');
  document.head.appendChild(css);

  const editor=document.getElementById('editGenrePicker');
  let classification=document.getElementById('movie30-detail-classification');
  if(editor && !classification){
    const preceding=editor.previousElementSibling;
    if(preceding && preceding.classList.contains('tip') && /ジャンル/.test(preceding.textContent||'')){
      preceding.classList.add('movie30-legacy-genre-head');
    }
    classification=document.createElement('details');
    classification.id='movie30-detail-classification';
    const summary=document.createElement('summary');
    summary.innerHTML='<span class="movie30-detail-class-head">分類・ジャンル <span style="color:#97a8b7;font-weight:500;font-size:11px">タップして編集</span></span><span class="movie30-detail-class-preview" id="movie30-detail-class-preview"></span>';
    classification.appendChild(summary);
    editor.before(classification);
    classification.appendChild(editor);
  }
  const type=document.getElementById('editMediaType');
  if(type?.closest('label'))type.closest('label').style.display='none';

  function preview(){
    const target=document.getElementById('movie30-detail-class-preview');
    if(!target)return;
    target.replaceChildren();
    const rows=[...document.querySelectorAll('#editGenrePicker .struct-row')];
    const display=[];
    const labels={ '種別':'種別','制作区分':'制作','形式':'形式','TV区分':'TV区分','ジャンル（複数選択可）':'ジャンル'};
    for(const row of rows){
      if(getComputedStyle(row).display==='none')continue;
      const raw=row.querySelector('.struct-label')?.textContent?.trim()||'';
      const label=labels[raw]||(/ジャンル/.test(raw)?'ジャンル':raw);
      if(!label)continue;
      const on=[...row.querySelectorAll('.struct-chip.on')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()).filter(Boolean);
      if(on.length)display.push([label,on.join('・')]);
    }
    const seen=new Set();
    for(const [label,value] of display){
      if(seen.has(label))continue;
      seen.add(label);
      const chip=document.createElement('span');chip.className='movie30-detail-class-token';
      const title=document.createElement('b');title.textContent=label;
      const val=document.createElement('span');val.textContent=value;
      chip.append(title,val);target.append(chip);
    }
    if(!display.length){
      const blank=document.createElement('span');blank.className='movie30-detail-class-token';blank.textContent='分類は未設定';target.append(blank);
    }
  }

  function ranks(f){
    const score=effectiveScore(f);
    if(score==null)return null;
    const sortedScores=[...new Set(allFilms().map(effectiveScore).filter(x=>x!=null).map(Number))].sort((a,b)=>b-a);
    let above=0;
    for(const s of sortedScores){
      const tied=rankSorted(allFilms().filter(x=>effectiveScore(x)===s),s);
      if(s===Number(score)){
        const i=tied.findIndex(x=>x.id===f.id);
        return {overall:i<0?null:above+i+1,total:above+sortedScores.filter(y=>y<=s).reduce((n,y)=>n+allFilms().filter(x=>effectiveScore(x)===y).length,0),same:i<0?null:i+1,tied:tied.length,score};
      }
      above+=tied.length;
    }
    return null;
  }

  function tidy(id){
    if(selectedId!==id)return;
    const f=filmById(id);if(!f)return;
    // Category metadata is in the collapsible classification preview; runtime has one editable field.
    const meta=document.getElementById('sheetMeta');
    if(meta)meta.textContent=f.year?String(f.year):'公開年未設定';
    const detail=document.getElementById('detail66');
    const score=effectiveScore(f);
    if(detail){
      const stats=detail.querySelector('.v66-stats');
      if(stats){
        const old=[...stats.children];
        if(old.length>=4){
          old[0].remove();old[3].remove(); // Duplicate score and duplicate runtime.
        }
        stats.hidden=score==null;
        if(score==null)stats.style.display='none';else stats.style.display='';
      }
      const near=detail.querySelector('.v66-nei');if(near)near.remove();
      const jump=detail.querySelector('#detailJump66');
      if(jump)jump.hidden=score==null;
      const tip=detail.querySelector('.tip');
      if(tip){
        const m=state.letterboxdMeta?.[id]||{};
        const bits=[];
        if(m.reportedWatchedDate)bits.push('鑑賞日：'+m.reportedWatchedDate);
        if(m.addedDate)bits.push('Letterboxd追加：'+m.addedDate);
        tip.textContent=bits.join(' · ');
        tip.hidden=!bits.length;
      }
    }
    const director=document.getElementById('getDirector84');
    if(director)director.hidden=true;
    const dstatus=document.getElementById('directorStatus84');
    if(dstatus)dstatus.hidden=true;
    preview();
  }

  // Preserve the previous expanded state only when editing the same item.
  let lastId=null;
  const formerOpen=openSheet;
  openSheet=function(id,...rest){
    if(classification&&id!==lastId)classification.open=false;
    const result=formerOpen.call(this,id,...rest);
    lastId=id;
    tidy(id);
    return result;
  };
  const rating=document.getElementById('editScore');
  const runtime=document.getElementById('editRuntime');
  for(const control of [rating,runtime]){
    control?.addEventListener('change',()=>{
      const id=selectedId;
      setTimeout(()=>{if(id===selectedId)tidy(id)},0);
    });
  }
  editor?.addEventListener('click',()=>{
    const id=selectedId;
    setTimeout(()=>{if(id===selectedId)tidy(id)},0);
    setTimeout(()=>{if(id===selectedId)tidy(id)},120);
  });
  window.__movie30DetailUnified={version:'20261014h',refresh:()=>selectedId&&tidy(selectedId)};
})();
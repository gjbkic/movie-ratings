// Extracted from .github/workflows/movie-drag-touch.yml; original behavioral assertions retained.
const {launch}=require('./harness.cjs'),fs=require('fs');
(async()=>{
  const browser=await launch();
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const data=require('./fixture.cjs').fixture();
  await page.addInitScript(state=>{if(!sessionStorage.getItem('legacy-seeded')){localStorage.setItem('movie30_data_v1',JSON.stringify({...state,updatedAt:Date.now()}));sessionStorage.setItem('legacy-seeded','1')}},data.state);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:8777/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('html.movie30-ready',{timeout:25000});
  await page.waitForTimeout(1500);
  let before=await page.evaluate(()=>{
    const lists=[...document.querySelectorAll('#rankRoot .score-list')];
    const list=lists.find(l=>l.querySelectorAll('.rank-card').length>=4);
    if(!list)throw Error('No ranking list with at least 4 cards');
    const cards=[...list.querySelectorAll('.rank-card')];
    cards[1].scrollIntoView({behavior:'instant',block:'center'});
    return {score:list.dataset.score,from:cards[1].dataset.id,to:cards[2].dataset.id};
  });
  await page.waitForTimeout(150);
  const pts=await page.evaluate(({from,to})=>{
    const source=document.querySelector('.rank-card[data-id="'+from+'"]');
    const target=document.querySelector('.rank-card[data-id="'+to+'"]');
    const handle=source.querySelector('.drag-handle').getBoundingClientRect();
    const tgt=target.getBoundingClientRect();
    return {start:{x:handle.left+handle.width/2,y:handle.top+handle.height/2},target:{x:handle.left+handle.width/2,y:tgt.bottom-tgt.height*.25},
      fromRect:source.getBoundingClientRect().toJSON(),toRect:tgt.toJSON(),
      order:[...source.closest('.score-list').querySelectorAll('.rank-card')].map(x=>x.dataset.id)};
  },before);
  console.log('BEFORE',JSON.stringify({before,pts}));
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:7,x:pts.start.x,y:pts.start.y,radiusX:5,radiusY:5}]});
  await page.waitForTimeout(160);
  const lifted=await page.evaluate(()=>{
    const el=document.querySelector('.movie30-floating-drag');
    return {found:!!el,top:el?.getBoundingClientRect().top,
      position:el&&getComputedStyle(el).position,
      zIndex:el&&getComputedStyle(el).zIndex,
      transform:el&&getComputedStyle(el).transform,
      originalOpacity:document.querySelector('.rank-card.dragging')&&getComputedStyle(document.querySelector('.rank-card.dragging')).opacity}
  });
  const midway={x:pts.start.x+(pts.target.x-pts.start.x)*.65,y:pts.start.y+(pts.target.y-pts.start.y)*.65};
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:7,x:midway.x,y:midway.y,radiusX:5,radiusY:5}]});
  await page.waitForTimeout(210);
  const during=await page.evaluate(()=>{
    const ghost=document.querySelector('.movie30-floating-drag');
    const r=ghost?.getBoundingClientRect();
    return {ghost:!!ghost,top:r?.top,left:r?.left,width:r?.width,height:r?.height,
      transform:ghost&&getComputedStyle(ghost).transform,shadow:ghost&&getComputedStyle(ghost).boxShadow,
      moved:typeof dragCtx!=='undefined'&&dragCtx?.moved, originalOpacity:document.querySelector('.rank-card.dragging')&&getComputedStyle(document.querySelector('.rank-card.dragging')).opacity}
  });
  console.log('LIFTED',JSON.stringify(lifted),'DURING',JSON.stringify(during));
  // Screenshots are not dumped into CI logs.
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:7,x:pts.target.x,y:pts.target.y,radiusX:5,radiusY:5}]});
  await page.waitForTimeout(130);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(450);
  const after=await page.evaluate(({score,from})=>{
    const l=[...document.querySelectorAll('#rankRoot .score-list')].find(x=>x.dataset.score===score);
    return {order:[...(l?.querySelectorAll('.rank-card')||[])].map(x=>x.dataset.id),
      saved:state.rankOrder[score],savedTime:state.updatedAt,
      floating:document.querySelectorAll('.movie30-floating-drag').length,
      card:!!l?.querySelector('.rank-card[data-id="'+from+'"]')};
  },before);
  console.log('AFTER',JSON.stringify(after),'ERRORS',JSON.stringify(errors));
  if(!lifted.found||lifted.position!=='fixed'||!during.ghost||!during.moved||Math.abs(during.top-lifted.top)<10)throw Error('Card did not lift and follow the finger');
  const original=pts.order.indexOf(before.from),final=after.order.indexOf(before.from);
  if(final===original||!after.saved||after.saved.indexOf(before.from)===original)throw Error('Finger reorder not saved');
  if(after.floating)throw Error('Drag ghost remains after release');
  if(errors.length)throw Error('JavaScript errors during touch drag');
  console.log('TOUCH_DRAG_PASS',JSON.stringify({original,final}));
  console.log('CONTROL_DIAG',JSON.stringify(await page.evaluate(id=>{
    const c=document.querySelector('.rank-card[data-id="'+id+'"]');
    return {view:typeof view!=='undefined'?view.page:null,rankCount:document.querySelectorAll('#rankRoot .rank-card').length,
      focused:c?.className,hasControls:!!c?.querySelector('.v66-pos'),
      filter:window.__movie30IsRankFiltered?.(),
      focusExport:typeof window.__movie30FocusRankCard,
      diagnostic:window.__movie30LastJump99};
  },before.from)));
  const controls=page.locator('.rank-card[data-id="'+before.from+'"] .v66-pos [data-sw]');
  await controls.first().waitFor({timeout:5000});
  const reverse=final>0?'-1':'1';
  await page.locator('.rank-card[data-id="'+before.from+'"] .v66-pos [data-sw="'+reverse+'"]').click({force:true,timeout:7000});
  await page.waitForTimeout(120);
  const buttonFloating=await page.locator('.movie30-floating-drag').count();
  await page.waitForTimeout(900);
  const reverted=await page.evaluate(({score,from})=>{
    const list=[...document.querySelectorAll('#rankRoot .score-list')].find(x=>x.dataset.score===score);
    return {index:[...list.querySelectorAll('.rank-card')].findIndex(x=>x.dataset.id===from),
      savedIndex:(state.rankOrder[score]||[]).indexOf(from),
      remainingGhost:document.querySelectorAll('.movie30-floating-drag').length};
  },before);
  console.log('BUTTON_SWAP',JSON.stringify({buttonFloating,reverted}));
  if(buttonFloating<1||reverted.index!==original||reverted.savedIndex!==original||reverted.remainingGhost!==0)throw Error('Button swap did not animate and restore original rank');
  await page.evaluate(()=>window.__movie30PendingSave);
const durableOrder=await page.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores}));
await page.reload();await page.waitForSelector('html.movie30-ready');
if(await page.evaluate(()=>JSON.stringify({rankOrder:state.rankOrder,exactScores:state.exactScores}))!==durableOrder)throw Error('Touch result changed after reload');
await browser.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

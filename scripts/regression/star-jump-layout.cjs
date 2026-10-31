'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(origin);await ready(page);await page.waitForTimeout(300);
  const stateBefore=await snapshot(page);
  const initial=await page.evaluate(()=>{
   const top=document.querySelector('.top'),bar=document.getElementById('starJumpBar');
   return {height:Math.round(top.getBoundingClientRect().height),top:parseInt(getComputedStyle(bar).top,10),buttons:bar.querySelectorAll('button').length};
  });
  assert(initial.buttons>=5,'Star-jump buttons missing');
  assert.equal(initial.top,initial.height,'Star-jump position is not aligned with header');
  const repeat=await page.evaluate(()=>{
   const top=document.querySelector('.top'),original=top.getBoundingClientRect;let reads=0;
   top.getBoundingClientRect=function(...args){reads++;return original.apply(this,args)};
   try{renderRank();return {reads,top:parseInt(getComputedStyle(document.getElementById('starJumpBar')).top,10)}}
   finally{top.getBoundingClientRect=original}
  });
  assert.equal(repeat.reads,0,'Rank redraw forces a synchronous header layout read');
  assert.equal(repeat.top,initial.top,'Rank redraw moved the star-jump bar');
  const scrolled=await page.evaluate(async()=>{
   document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,1200);await new Promise(resolve=>setTimeout(resolve,120));
   return {scrollY,header:Math.round(document.querySelector('.top').getBoundingClientRect().height),bar:Math.round(document.getElementById('starJumpBar').getBoundingClientRect().top)};
  });
  assert(scrolled.scrollY>300,'Ranking did not scroll');
  assert(Math.abs(scrolled.bar-scrolled.header)<=2,'Star-jump bar separated from sticky header while scrolling');
  await page.evaluate(()=>window.scrollTo(0,0));
  const resized=await page.evaluate(async()=>{
   const top=document.querySelector('.top');top.style.minHeight=(Math.round(top.getBoundingClientRect().height)+31)+'px';
   await new Promise(resolve=>setTimeout(resolve,150));
   const bar=document.getElementById('starJumpBar');return {height:Math.round(top.getBoundingClientRect().height),top:parseInt(getComputedStyle(bar).top,10)};
  });
  assert.equal(resized.top,resized.height,'Star-jump position did not follow header height change');
  assert.deepEqual(await snapshot(page),stateBefore,'Layout adjustment changed film data');
  console.log('STAR_JUMP_LAYOUT_PASS',JSON.stringify({initial,repeat,scrolled,resized}));
 }finally{await browser.close()}
})().catch(e=>{console.error('STAR_JUMP_LAYOUT_FAIL',e.stack||e);process.exitCode=1});

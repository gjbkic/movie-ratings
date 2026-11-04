'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  await page.evaluate(()=>{state.letterboxdMeta['fixture-0012'].poster84={path:'/synthetic-scope.jpg'};openSheet('fixture-0012')});await page.waitForTimeout(300);
  const before=await snapshot(page);
  const samples=await page.evaluate(async()=>{
   let calls=0;const original=window.__movie30PosterDecorate84;
   window.__movie30PosterDecorate84=function(...args){calls++;return original.apply(this,args)};
   const result=[];
   const notify=()=>document.getElementById('movie30PosterDetail84').appendChild(document.createElement('span'));
   for(const mode of ['detail','detail-first','full-first']){
    calls=0;
    if(mode==='full-first')window.__movie30SearchPosters90.refresh();
    notify();await Promise.resolve();
    if(mode==='detail-first')window.__movie30SearchPosters90.refresh();
    await new Promise(r=>setTimeout(r,300));result.push({mode,calls});
   }
   window.__movie30PosterDecorate84=original;return result;
  });
  assert.equal(samples[0].calls,0,'Detail mutations must not scan list posters');
  for(const s of samples.slice(1))assert.equal(s.calls,1,s.mode+' must retain the full update');
  assert.deepEqual(await snapshot(page),before);
  assert.match(await page.locator('#movie30PosterDetail84 img').getAttribute('src'),/synthetic-scope\.jpg$/);
  console.log('POSTER_SCOPE_PASS '+JSON.stringify(samples));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

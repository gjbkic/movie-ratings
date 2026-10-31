'use strict';
const {launch,ready,origin,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  await page.evaluate(()=>{
   state.letterboxdMeta['fixture-0012'].poster84={path:'/synthetic-first.jpg'};
   openSheet('fixture-0012');
  });
  await page.waitForTimeout(250);
  const before=await snapshot(page);
  const writes=await page.evaluate(async()=>{
   const img=document.querySelector('#movie30PosterDetail84 img');
   if(!img)throw Error('Missing detail poster');
   const changes=[];
   const observer=new MutationObserver(rs=>changes.push(...rs.map(r=>r.attributeName)));
   observer.observe(img,{attributes:true,attributeFilter:['role','aria-label']});
   window.__movie30SearchPosters90.refresh();
   window.__movie30SearchPosters90.refresh();
   await new Promise(r=>setTimeout(r,100));observer.disconnect();
   return changes;
  });
  assert.deepEqual(writes,[],'Repeated refresh rewrote unchanged accessibility attributes');
  assert.deepEqual(await snapshot(page),before);
  await page.evaluate(()=>{
   state.letterboxdMeta['fixture-0012'].poster84.path='/synthetic-later.jpg';
   window.__movie30SearchPosters90.refresh();
  });
  await page.waitForTimeout(100);
  assert.match(await page.locator('#movie30PosterDetail84 img').getAttribute('src'),/synthetic-later\.jpg$/);
  await page.evaluate(()=>{
   window.__movie30SearchPosters90.refresh();
   state.letterboxdMeta['fixture-0001'].poster84={path:'/synthetic-other.jpg'};
   openSheet('fixture-0001');
  });
  await page.waitForTimeout(250);
  assert.match(await page.locator('#movie30PosterDetail84 img').getAttribute('src'),/synthetic-other\.jpg$/);
  assert.equal(await page.locator('#movie30PosterDetail84 img').getAttribute('role'),'button');
  assert.equal(await page.locator('#movie30PosterDetail84 img').getAttribute('aria-label'),'ポスターを大きく表示');
  console.log('POSTER_REFRESH_PASS: unchanged attributes, state preserved, late metadata, current detail');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
  await page.goto(origin);await ready(page);
  const before=await snapshot(page);
  await page.locator('#rankPosterOnly84').click();
  const result=await page.evaluate(()=>{
   const list=document.querySelector('#rankRoot .score-list');
   return {
    columns:getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length,
    rankSearchFont:parseFloat(getComputedStyle(document.querySelector('#searchRank')).fontSize),
    classifySearchFont:parseFloat(getComputedStyle(document.querySelector('#searchClassify')).fontSize)
   };
  });
  assert.equal(result.columns,4,'Poster mode must have four columns at 430px: '+JSON.stringify(result));
  assert(result.rankSearchFont>=18&&result.classifySearchFont>=18,'iPhone search fields need a margin above Safari focus-zoom threshold: '+JSON.stringify(result));
  assert.deepEqual(await snapshot(page),before);
  console.log('MOBILE_SEARCH_POSTER_PASS',result);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

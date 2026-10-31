'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();
 try{
  const results=[];
  for(const width of [390,430]){
   const page=await browser.newPage({viewport:{width,height:932},isMobile:true,hasTouch:true});
   await page.goto(origin);await ready(page);
   const before=await snapshot(page);
   await page.locator('#rankPosterOnly84').click();
   await page.locator('#searchRank').click();
   const result=await page.evaluate(()=>{
    const list=document.querySelector('#rankRoot .score-list');
    return {
     width:innerWidth,
     columns:getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length,
     rankSearchFont:parseFloat(getComputedStyle(document.querySelector('#searchRank')).fontSize),
     classifySearchFont:parseFloat(getComputedStyle(document.querySelector('#searchClassify')).fontSize),
     scrollWidth:document.documentElement.scrollWidth,
     chromeScale:visualViewport.scale
    };
   });
   assert.equal(result.columns,4,'Poster mode must have four columns at '+width+'px: '+JSON.stringify(result));
   assert(result.rankSearchFont>=18&&result.classifySearchFont>=18,'iPhone search fields need a margin above Safari focus-zoom threshold: '+JSON.stringify(result));
   assert(result.scrollWidth<=result.width&&result.chromeScale===1,'Search focus must not overflow or zoom the Chrome test viewport: '+JSON.stringify(result));
   assert.deepEqual(await snapshot(page),before);
   results.push(result);await page.close();
  }
  console.log('MOBILE_SEARCH_POSTER_PASS',results);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

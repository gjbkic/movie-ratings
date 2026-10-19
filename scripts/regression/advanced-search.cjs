'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});if(process.env.MOVIE_GUIDANCE_BASELINE==='1'){
   for(const name of ['app-core.js','app-enhancements.js']){
    let body=require('node:child_process').execFileSync('git',['show','02f2460:'+name],{encoding:'utf8',maxBuffer:16*1024*1024});
    if(name==='app-core.js')body=body.replace(/const BASE_FILMS=\[[^\n]*\];(?=\r?\nconst DEFAULT_MAP=)/,'const BASE_FILMS=[];');
    await page.route('**/'+name+'*',r=>r.fulfill({contentType:'text/javascript',body}));
   }
  }
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
  const before=await snapshot(page);
  if(!process.env.MOVIE_GUIDANCE_BASELINE)assert((await page.locator('.movie96-expand').textContent()).includes('絞込'));
  await page.locator('.movie96-expand').click();
  async function order(){if(process.env.MOVIE_GUIDANCE_BASELINE)return;assert(await page.evaluate(()=>document.getElementById('movie96FilterHeader').nextElementSibling.id==='movie96BasicGroup'&&document.getElementById('movie96BasicGroup').nextElementSibling.id==='movie95FacetGroup'))}
  if(!process.env.MOVIE_GUIDANCE_BASELINE)await order();
  const original=await page.locator('#rankRoot .rank-card').count();
  await page.locator('#advBox66 [data-inc]').filter({hasText:'SF'}).first().click();await page.waitForTimeout(200);await order();
  console.log('GENRE_AFTER_CLICK',JSON.stringify({baseline:!!process.env.MOVIE_GUIDANCE_BASELINE,original,after:await page.locator('#rankRoot .rank-card').count()}));
  const filtered=await page.locator('#rankRoot .rank-card').count();assert(filtered>0&&filtered<original);
  await page.locator('#s166').fill('0');await page.waitForTimeout(150);assert.equal(await page.locator('#s166').inputValue(),'0');
  await page.locator('#clearAdv66').click();await page.waitForTimeout(200);await order();assert.equal(await page.locator('#rankRoot .rank-card').count(),original);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/search-guidance-mobile.png'});
  await page.locator('.movie96-close').click();assert.equal(await page.locator('.movie96-expand').getAttribute('aria-expanded'),'false');
  assert.deepEqual(await snapshot(page),before,'Search controls must not change film data');
  assert.deepEqual(errors,[]);console.log('ADVANCED_SEARCH_PASS: automatic filtering and reset preserve data');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

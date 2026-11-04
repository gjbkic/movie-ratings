'use strict';
const {launch,origin,ready,saved,snapshot,reload,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto(origin);await ready(page);
  const target=await page.evaluate(()=>{
   for(const [score,ids] of Object.entries(state.rankOrder))for(let i=0;i<ids.length-1;i++){
    const a=ids[i],b=ids[i+1];
    if((state.genreOverrides[a]||[]).includes('SF')&&!(state.genreOverrides[b]||[]).includes('SF'))return {score,id:a,neighbor:b};
   }
   throw Error('No visible film with a hidden global neighbor');
  });
  const before=await snapshot(page);
  await page.locator('#page-rank .movie96-expand').click();
  await page.locator('#advBox66 .movie96-chip-group > summary').first().click();
  await page.locator('#advBox66 [data-inc]').filter({hasText:'SF'}).first().click();
  assert.equal(await page.evaluate(()=>window.__movie30IsRankFiltered()),true);
  assert.equal(await page.locator('#rankRoot .rank-card[data-id="'+target.id+'"]').count(),1);
  assert.equal(await page.locator('#rankRoot .rank-card[data-id="'+target.neighbor+'"]').count(),0);
  await page.locator('#rankRoot .rank-card[data-id="'+target.id+'"] .rank-title').click();
  assert.equal(await page.evaluate(()=>selectedId),target.id);
  const jump=page.locator('#detailJump66');
  assert.equal(await jump.textContent(),'全体順位へ移動して入れ替える');
  assert.equal(await jump.evaluate(e=>e.closest('.v66-actions')?.previousElementSibling?.classList.contains('v66-stats')),true,'Jump action should follow the visible rank summary');
  assert.equal(await jump.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.sheet').getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom}),true,'Jump action should be visible without scrolling the detail sheet');
  await jump.click();
  assert.equal(await page.evaluate(()=>window.__movie30IsRankFiltered()),false);
  assert.equal(await page.locator('#sheetBg.open').count(),0);
  assert.equal(await page.locator('#rankRoot .rank-card[data-id="'+target.neighbor+'"]').count(),1);
  assert.equal(await page.locator('#rankRoot .rank-card[data-id="'+target.id+'"] [data-sw="1"]').count(),1);
  assert.deepEqual((await snapshot(page)).rankOrder,before.rankOrder,'Jump must not edit ranking');
  await page.locator('#rankRoot .rank-card[data-id="'+target.id+'"] [data-sw="1"]').click();
  await page.waitForTimeout(850);await saved(page);
  const expected=[...before.rankOrder[target.score]],index=expected.indexOf(target.id);
  [expected[index],expected[index+1]]=[expected[index+1],expected[index]];
  const after=await snapshot(page);
  assert.deepEqual(after.rankOrder[target.score],expected,'Swap must use the global adjacent film');
  for(const key of Object.keys(before.rankOrder).filter(key=>key!==target.score))assert.deepEqual(after.rankOrder[key],before.rankOrder[key]);
  for(const key of ['exactScores','starOverrides','letterboxdMeta','genreOverrides','customFilms'])assert.deepEqual(after[key],before[key],key);
  await reload(page);
  assert.deepEqual((await snapshot(page)).rankOrder[target.score],expected,'Swapped full ranking must survive reload');
  console.log('GENRE_DETAIL_JUMP_PASS',JSON.stringify(target));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

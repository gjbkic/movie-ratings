'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.goto(origin);await ready(page);
    const before=await snapshot(page),search=page.locator('#searchRank'),menu=page.locator('#page-rank .movie92-suggestions');
    await search.fill('架空作品');await menu.locator('.movie92-entry').first().waitFor();
    assert.equal(await menu.isVisible(),true);
    await search.click(); // A second tap dismisses the keyboard, retaining the query.
    assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'searchRank');
    assert.equal(await search.inputValue(),'架空作品');
    assert.equal(await menu.isVisible(),true,'Dismissing the keyboard must leave search suggestions available');
    const fit=await page.evaluate(()=>{
      const menu=document.querySelector('#page-rank .movie92-suggestions');
      const top=menu.getBoundingClientRect().top,viewport=window.visualViewport;
      Object.defineProperty(viewport,'height',{configurable:true,value:top+230});
      Object.defineProperty(viewport,'offsetTop',{configurable:true,value:160});
      viewport.dispatchEvent(new Event('resize'));
      return {top,visibleHeight:viewport.height,maxHeight:parseFloat(menu.style.maxHeight)};
    });
    assert(fit.maxHeight<=218,'Suggestions must fit above a panned iPhone keyboard: '+JSON.stringify(fit));
    await menu.locator('.movie92-entry').first().click();
    assert.equal(await page.locator('#sheetBg').isVisible(),true,'Candidate remains selectable after keyboard dismissal');
    assert.deepEqual(await snapshot(page),before,'Search and candidate opening must not modify film data');
    console.log('PASS: keyboard dismissal keeps scrollable candidates above the visual viewport bottom');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

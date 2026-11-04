'use strict';
const {launch,origin,ready,snapshot,assert}=require('./harness.cjs');
(async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.goto(origin);await ready(page);
    const before=await snapshot(page),pending=page.locator('[data-uns] [data-score-v67]').first();
    await pending.scrollIntoViewIfNeeded();
    const baseline=await page.evaluate(()=>window.scrollY);
    await pending.click();
    const overlay=page.locator('#compareBg'),sheet=overlay.locator('.compare-sheet');
    await overlay.waitFor({state:'visible'});
    const opened=await page.evaluate(()=>({position:getComputedStyle(document.body).position,top:parseFloat(document.body.style.top),pageY:window.scrollY}));
    assert.equal(opened.position,'fixed','Opening the ranking chooser must freeze the document itself');
    assert.equal(opened.top,-baseline,'The scroll position must be retained while the chooser is open');
    await page.evaluate(()=>document.querySelector('#compareBg .compare-sheet').scrollTop=180);
    assert((await sheet.evaluate(e=>e.scrollTop))>0,'The ranking chooser itself must remain scrollable');
    const frozen=await page.evaluate(()=>({top:document.body.style.top,pageY:window.scrollY}));
    assert.equal(parseFloat(frozen.top),opened.top,'Scrolling inside the chooser must not move the page behind it');
    assert.equal(frozen.pageY,opened.pageY);
    await overlay.locator('#compareClose').click();
    assert.equal(await overlay.isVisible(),false);
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).position),'fixed');
    assert(Math.abs((await page.evaluate(()=>window.scrollY))-baseline)<=2,'Closing must restore the original page scroll position');
    assert.deepEqual(await snapshot(page),before,'Opening and closing must not change any film data');
    console.log('PASS: ranking chooser scrolls independently and restores its background position');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

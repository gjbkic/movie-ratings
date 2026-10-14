// Extracted from .github/workflows/movie-star-editor.yml; original behavioral assertions retained.
const {launch}=require('./harness.cjs'),assert=require('node:assert/strict');
(async()=>{
  const browser=await launch();
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
    localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({username:'gjbkic',auto:false}));
  });
  await page.goto('http://localhost:8784/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('html.movie30-ready',{timeout:30000});
  const ids=await page.evaluate(async()=>{
    const unscored=addFilm('Star Test Unscored',2026,'追加映画',0,'',{keepUnscored:true});
    const scored=addFilm('Star Test Scored',2026,'追加映画',4,88,{});
    if(!unscored||!scored)throw Error('Cannot add isolated test films');
    // Manual addFilm defaults an unspecified star to three. Explicitly
    // emulate the actual unrated TMDB import, which stores star zero.
    state.starOverrides[unscored.id]=0;
    await save();
    await window.__movie30StorageReady;
    return {unscored:unscored.id,scored:scored.id};
  });
  await page.evaluate(id=>openSheet(id),ids.unscored);
  const initial=await page.evaluate(()=>{
    const sel=document.getElementById('editStar'),label=sel.closest('label');
    return {visible:getComputedStyle(label).display!=='none',disabled:sel.disabled,value:sel.value,score:document.getElementById('editScore').value,option0:!!sel.querySelector('option[value="0"]')};
  });
  console.log('STAR_INITIAL',JSON.stringify(initial));
  assert(initial.visible&&!initial.disabled&&initial.value==='0'&&initial.score===''&&initial.option0,'Unscored star selector is not visible/editable');
  await page.locator('#editStar').selectOption('4.5');
  await page.waitForTimeout(250);
  const after=await page.evaluate(id=>{
    const f=filmById(id);
    return {star:filmStar(f),score:effectiveScore(f),
      hasExact:Object.prototype.hasOwnProperty.call(state.exactScores,id),
      rankOccurrences:Object.values(state.rankOrder).flat().filter(x=>x===id).length,
      selected:document.getElementById('editStar').value,
      scoreInput:document.getElementById('editScore').value};
  },ids.unscored);
  assert.equal(after.star,4.5);assert.equal(after.score,null);
  assert.equal(after.hasExact,false);assert.equal(after.rankOccurrences,0);
  assert.equal(after.scoreInput,'');assert.equal(after.selected,'4.5');
  await page.evaluate(()=>closeSheet());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('html.movie30-ready',{timeout:30000});
  await page.evaluate(id=>openSheet(id),ids.unscored);
  const reload=await page.evaluate(id=>{
    const f=filmById(id);return {found:!!f,star:f&&filmStar(f),score:f&&effectiveScore(f),
    selected:document.getElementById('editStar').value,disabled:document.getElementById('editStar').disabled};
  },ids.unscored);
  assert.deepEqual(reload,{found:true,star:4.5,score:null,selected:'4.5',disabled:false});
  await page.locator('#editStar').selectOption('0');
  const cleared=await page.evaluate(id=>({star:filmStar(filmById(id)),score:effectiveScore(filmById(id))}),ids.unscored);
  assert.deepEqual(cleared,{star:0,score:null});
  await page.evaluate(id=>openSheet(id),ids.scored);
  const rated=await page.evaluate(id=>{
    const f=filmById(id),sel=document.getElementById('editStar');
    return {score:effectiveScore(f),star:sel.value,disabled:sel.disabled,visible:getComputedStyle(sel.closest('label')).display!=='none'};
  },ids.scored);
  assert.equal(rated.score,88);assert.equal(rated.star,'4');assert(rated.disabled&&rated.visible,'Scored star should be visible and readonly');
  await page.evaluate(id=>openSheet(id),ids.unscored);
  await page.locator('#editScore').fill('85');
  await page.locator('#editScore').blur();
  await page.waitForTimeout(180);
  const nowScored=await page.evaluate(id=>{
    const f=filmById(id);return {score:effectiveScore(f),star:document.getElementById('editStar').value,
      disabled:document.getElementById('editStar').disabled};
  },ids.unscored);
  assert.deepEqual(nowScored,{score:85,star:'3.5',disabled:true});
  assert.equal(errors.length,0,'Browser JavaScript errors '+errors.join(' | '));
  console.log('STAR_EDITOR_PASS',JSON.stringify({initial,after,reload,cleared,rated,nowScored,errors}));
  await browser.close();
})().catch(e=>{console.error('STAR_EDITOR_FAILED',e.stack||e);process.exit(1)});

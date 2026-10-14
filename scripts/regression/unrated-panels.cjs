// Extracted from .github/workflows/movie-unrated-panels.yml; original behavioral assertions retained.
const {launch}=require('./harness.cjs'),assert=require('node:assert/strict');
(async()=>{
  const browser=await launch();
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({username:'gjbkic',auto:false}))});
  await page.goto('http://localhost:8785/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('html.movie30-ready',{timeout:30000});
  const ids=await page.evaluate(async()=>{
    const a=addFilm('Stage Test Star Missing',2026,'追加映画',0,'',{keepUnscored:true});
    const b=addFilm('Stage Test Score Missing',2026,'追加映画',4.5,'',{keepUnscored:true});
    state.starOverrides[a.id]=0;
    await save();renderRank();
    return {a:a.id,b:b.id};
  });
  const snapshot=()=>page.evaluate(({a,b})=>{
    const up=document.querySelector('#rankRoot [data-pending-kind="star"]');
    const down=document.querySelector('#rankRoot [data-pending-kind="score"]');
    const cid=id=>encodeURIComponent(id);
    const items=p=>[...p?.querySelectorAll('[data-v76-open],[data-uns]')||[]].map(e=>e.dataset.v76Open||e.dataset.uns);
    const headers=[up,down].map(p=>({
      title:p?.querySelector('.uns-head strong')?.textContent,
      expanded:p?.querySelector('.uns-head')?.getAttribute('aria-expanded'),
      hidden:p?.querySelector('.uns-grid')?.hidden,
      items:items(p),
      rect:p?.getBoundingClientRect().top
    }));
    const jump=[...document.querySelectorAll('#starJumpBar button')].map(x=>x.textContent);
    return {headers,jump,aStar:filmStar(filmById(a)),aScore:effectiveScore(filmById(a)),
      bStar:filmStar(filmById(b)),bScore:effectiveScore(filmById(b)),
      aId:cid(a),bId:cid(b)};
  },ids);
  const initial=await snapshot();
  assert.equal(initial.headers[0].title,'星も未確定');
  assert.equal(initial.headers[1].title,'点数未確定');
  assert(initial.headers[0].rect<initial.headers[1].rect,'Expected star-unset group above score-unset');
  assert(initial.headers[0].items.includes(initial.aId),'Unstarred film absent from first group');
  assert(!initial.headers[1].items.includes(initial.aId),'Unstarred film appears as score-pending');
  assert(initial.headers[1].items.includes(initial.bId),'Starred film absent from second group');
  assert(initial.jump.includes('星も未確定')&&initial.jump.includes('点数未確定'),'Jump labels missing');
  await page.locator('#rankRoot [data-pending-kind="star"] .uns-head').click({force:true});
  const folded=await snapshot();
  assert.equal(folded.headers[0].expanded,'false');
  assert.equal(folded.headers[0].hidden,true);
  assert.equal(folded.headers[1].expanded,'true');
  await page.evaluate(()=>renderRank());
  assert.equal((await snapshot()).headers[0].hidden,true,'Fold lost after render');
  await page.locator('#rankRoot [data-pending-kind="star"] .uns-head').click({force:true});
  assert.equal((await snapshot()).headers[0].hidden,false);
  await page.evaluate(id=>openSheet(id),ids.a);
  await page.locator('#editStar').selectOption('3.5');
  await page.waitForTimeout(220);
  const moved=await snapshot();
  assert(!moved.headers[0].items.includes(moved.aId),'Film stayed in star-unset after rating');
  assert(moved.headers[1].items.includes(moved.aId),'Film did not move down to score-unset');
  assert.equal(moved.aStar,3.5);
  assert.equal(moved.aScore,null);
  await page.evaluate(()=>closeSheet());
  await page.locator('#rankRoot [data-pending-kind="score"] .uns-head').click({force:true});
  const scoreClosed=await snapshot();
  assert.equal(scoreClosed.headers[1].hidden,true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('html.movie30-ready',{timeout:30000});
  const afterReload=await snapshot();
  assert.equal(afterReload.headers[1].hidden,true,'Fold state not persisted');
  assert.equal(afterReload.aStar,3.5);
  assert.equal(afterReload.aScore,null);
  assert(afterReload.headers[1].items.includes(afterReload.aId),'Film location not persisted');
  await page.evaluate(id=>openSheet(id),ids.a);
  await page.locator('#editScore').fill('85');await page.locator('#editScore').blur();
  await page.evaluate(()=>window.__movie30PendingSave);
  // Numeric editing currently uses rankSorted's fallback for a newly scored ID.
  // Check the complete effective order, not an unsupported assumption that every
  // scored ID must immediately have an explicit manual rankOrder slot.
  const beforeReloadOrder=await page.evaluate(()=>rankSorted(allFilms().filter(f=>effectiveScore(f)===85),85).map(f=>f.id));
  assert(beforeReloadOrder.includes(ids.a));
  await page.reload();await page.waitForSelector('html.movie30-ready');
  const ranked=await page.evaluate(id=>({score:effectiveScore(filmById(id)),order:rankSorted(allFilms().filter(f=>effectiveScore(f)===85),85).map(f=>f.id),visible:!!document.querySelector('.score-list[data-score="85"] .rank-card[data-id="'+encodeURIComponent(id)+'"]'),inPending:[...document.querySelectorAll('[data-v76-open],[data-uns]')].some(e=>(e.dataset.v76Open||e.dataset.uns)===encodeURIComponent(id))}),ids.a);
  assert.equal(ranked.score,85);assert.deepEqual(ranked.order,beforeReloadOrder);assert.equal(ranked.visible,true);assert.equal(ranked.inPending,false);
  assert.equal(errors.length,0,'JS errors: '+errors.join(' | '));
  console.log('UNRATED_STAGES_PASS',JSON.stringify({initial:{headers:initial.headers.map(h=>({title:h.title,expanded:h.expanded})),jump:initial.jump.slice(0,4)},folded:folded.headers.map(x=>x.hidden),moved:{star:moved.aStar,score:moved.aScore},afterReload:{star:afterReload.aStar,score:afterReload.aScore,fold:afterReload.headers[1].hidden},errors}));
  await browser.close();
})().catch(e=>{console.error('UNRATED_STAGES_FAILED',e.stack||e);process.exit(1)});

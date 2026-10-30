'use strict';
const {repair,KEEP,EXTRA,CURRENT_URI}=require('../../app-crayon-duplicate-repair.js');
const {fixture,launch,origin,ready,reload,snapshot,assert}=require('./harness.cjs');
const data=fixture(740).state;
const kept={id:KEEP,title:'架空作品 A',year:2001,uri:'https://letterboxd.com/gjbkic/film/crayon-shin-chan-the-storm-called-the-adult/',source:'letterboxd',star:3.5,oldScore:null};
const extra={id:EXTRA,title:'架空作品 B',year:2001,uri:CURRENT_URI,source:'letterboxd',tmdbId:37280,star:3.5,oldScore:null};
data.customFilms.push(kept,extra);
data.exactScores[KEEP]=86;
data.rankOrder['86'].push(KEEP);
data.titleOverrides[EXTRA]={tmdbId:37280};
data.letterboxdMeta[KEEP]={note:'架空の元レビュー',watchHistory:[{id:'keep-watch'}]};
data.letterboxdMeta[EXTRA]={note:'別の架空レビュー',noteSource:'manual',watchHistory:[{id:'extra-watch'}],unknown:{keep:true}};
const before=structuredClone(data),local=structuredClone(data),result=repair(local);
assert(result.removed);
assert.deepEqual(local.rankOrder,before.rankOrder);
assert.deepEqual(local.exactScores,before.exactScores);
assert.equal(local.letterboxdMeta[EXTRA].note,'別の架空レビュー');
assert.deepEqual(local.letterboxdMeta[EXTRA].watchHistory,[{id:'extra-watch'}]);
assert.equal(local.customFilms.some(f=>f.id===EXTRA),false);
assert.equal(local.customFilms.find(f=>f.id===KEEP).uri,CURRENT_URI);
assert.equal(repair(local).changed,false,'Repair must be idempotent');
const conflict=structuredClone(data);conflict.exactScores[EXTRA]=82;
const conflictBefore=structuredClone(conflict);
assert(repair(conflict).blocked,'A separately scored duplicate needs manual review');
assert.deepEqual(conflict,conflictBefore,'Conflicting data must remain untouched');
const starConflict=structuredClone(data);starConflict.starOverrides[EXTRA]=4;
const starConflictBefore=structuredClone(starConflict);
assert(repair(starConflict).blocked,'A separately rated duplicate needs manual review');
assert.deepEqual(starConflict,starConflictBefore);
(async()=>{
 const browser=await launch();try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(seed=>{localStorage.setItem('movie30_data_v1',JSON.stringify(seed));localStorage.setItem('regression-initialized','1')},data);
  const page=await context.newPage();await page.goto(origin);await ready(page);
  const first=await snapshot(page);
  assert.equal(first.customFilms.filter(f=>f.id.startsWith('fixture-')||f.id===KEEP||f.id===EXTRA).length,741);
  assert(!first.customFilms.some(f=>f.id===EXTRA));
  for(const [score,ids] of Object.entries(before.rankOrder))
    assert.deepEqual(first.rankOrder[score].filter(id=>id.startsWith('fixture-')||id===KEEP),ids);
  for(const [id,score] of Object.entries(before.exactScores))assert.equal(first.exactScores[id],score);
  assert.equal(first.letterboxdMeta[EXTRA].note,'別の架空レビュー');
  assert.deepEqual(first.letterboxdMeta[EXTRA].watchHistory,[{id:'extra-watch'}]);
  assert.deepEqual(first.letterboxdMeta[KEEP].watchHistory,[{id:'keep-watch'}]);
  await reload(page);const restored=await snapshot(page);
  assert.equal(restored.customFilms.filter(f=>f.id.startsWith('fixture-')||f.id===KEEP||f.id===EXTRA).length,741);
  for(const [score,ids] of Object.entries(before.rankOrder))
    assert.deepEqual(restored.rankOrder[score].filter(id=>id.startsWith('fixture-')||id===KEEP),ids);
  assert.deepEqual(restored.letterboxdMeta[EXTRA],first.letterboxdMeta[EXTRA]);
  // A later Letterboxd slug change must still match a single known movie ID.
  const hit=await page.evaluate(()=>{
    const f=state.customFilms.find(x=>x.id==='fixture-0001');
    state.letterboxdMeta[f.id].poster84={tmdbId:99123};
    return findExistingFilm({title:'A completely different movie title',year:f.year,tmdbId:99123,link:'https://letterboxd.com/fixture-user/film/new-slug/'}).id;
  });
  assert.equal(hit,'fixture-0001');
  await context.close();
  console.log('PASS 740 fictional films: duplicate repair persists after reload, conflicting notes/watch history survive, changed slug matches verified ID');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

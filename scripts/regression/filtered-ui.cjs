// Existing actual filtered-arrow assertions; only setup is replaced.
const {launch,origin,ready,saved,snapshot,reload,assert}=require('./harness.cjs');
let browser;
(async()=>{
 browser=await launch();const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();await p.goto(origin);await ready(p);await saved(p);
 const fixture=await p.evaluate(()=>{for(const [k,ids]of Object.entries(state.rankOrder)){const groups={};for(const id of ids){for(const g of state.genreOverrides[id]||[])(groups[g]??=[]).push(id)}for(const [cat,shown]of Object.entries(groups))if(shown.length>=2&&shown.length<ids.length){const from=ids.find((id,i)=>shown.includes(id)&&shown.includes(ids[i+1]));if(from)return {k,cat,shown,from,before:[...ids]}}}throw Error('No partial category fixture')});
 await p.locator('#page-rank .movie96-expand').click();
 await p.locator('#advBox66 .movie96-chip-group > summary').first().click();
 await p.locator('#advBox66 [data-inc]').filter({hasText:fixture.cat}).first().click();
 await p.waitForFunction(({k,count})=>document.querySelectorAll('#rankRoot .score-list[data-score="'+k+'"] .rank-card').length===count,{k:fixture.k,count:fixture.shown.length},{timeout:5000});
 assert.deepEqual((await snapshot(p)).rankOrder[fixture.k],fixture.before,'Filtering alone must not change the saved rank order');
 const visibleBefore=await p.locator('#rankRoot .score-list[data-score="'+fixture.k+'"] .rank-card').evaluateAll(cards=>cards.map(card=>decodeURIComponent(card.dataset.id)));
 assert.deepEqual(visibleBefore,fixture.before.filter(id=>fixture.shown.includes(id)),'Filtered cards must retain their saved order before an edit');
 const from=fixture.from;await p.evaluate(id=>{window.__movie30FocusRankCard(id);document.querySelector('.rank-card[data-id="'+id+'"]').scrollIntoView({block:'center'})},from);
 const adjacent=fixture.before[fixture.before.indexOf(from)+1];
 assert.equal(await p.locator('#rankRoot .rank-card[data-id="'+adjacent+'"]').count(),1,'Adjacent card must be visible before filtered swap');
 // Record the transient lift before clicking. On a busy CI worker the click
 // promise can resolve after the 540ms animation has already finished.
 await p.evaluate(()=>{
  window.__filteredFloatingSeen=false;
  window.__filteredFloatingObserver=new MutationObserver(()=>{
   if(document.querySelector('.movie30-floating-drag'))window.__filteredFloatingSeen=true;
  });
  window.__filteredFloatingObserver.observe(document.body,{childList:true,subtree:true});
  // A sticky overlay can intercept elementFromPoint while the lift animation
  // runs. Arrow swaps still have a known adjacent target and must commit it.
  const nativeElementFromPoint=document.elementFromPoint.bind(document);
  window.__filteredHitTestCalls=0;
  document.elementFromPoint=(x,y)=>{if(dragCtx){window.__filteredHitTestCalls++;return document.querySelector('.top')||document.body}return nativeElementFromPoint(x,y)};
  window.__restoreFilteredHitTest=()=>{document.elementFromPoint=nativeElementFromPoint};
 });
 await p.locator('.rank-card[data-id="'+from+'"] [data-sw="1"]').click();
 await p.waitForFunction(()=>window.__filteredFloatingSeen,null,{timeout:1500});
 await p.evaluate(()=>{window.__filteredFloatingObserver.disconnect();delete window.__filteredFloatingObserver});
 await p.waitForTimeout(900);await p.evaluate(()=>window.__restoreFilteredHitTest());await saved(p);
 const changed=(await snapshot(p)).rankOrder[fixture.k],expected=[...fixture.before],at=expected.indexOf(from);
 assert((await p.evaluate(()=>window.__filteredHitTestCalls))>0,'The test must exercise obstructed hit-testing');
 [expected[at],expected[at+1]]=[expected[at+1],expected[at]];
 assert.deepEqual(changed,expected,'The arrow must exchange the selected adjacent films exactly');
 assert.deepEqual(changed.filter(id=>!fixture.shown.includes(id)),fixture.before.filter(id=>!fixture.shown.includes(id)));
 await reload(p);assert.deepEqual((await snapshot(p)).rankOrder[fixture.k],changed);console.log('PASS actual filtered arrow swap preserves hidden slots and order after restart',fixture.k,fixture.cat);
 await c.close();await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});


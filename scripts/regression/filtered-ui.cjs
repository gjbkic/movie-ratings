// Existing actual filtered-arrow assertions; only setup is replaced.
const {launch,origin,ready,saved,snapshot,reload,assert}=require('./harness.cjs');
let browser;
(async()=>{
 browser=await launch();const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();await p.goto(origin);await ready(p);await saved(p);
 const fixture=await p.evaluate(()=>{for(const [k,ids]of Object.entries(state.rankOrder)){const groups={};for(const id of ids){for(const g of state.genreOverrides[id]||[])(groups[g]??=[]).push(id)}for(const [cat,shown]of Object.entries(groups))if(shown.length>=2&&shown.length<ids.length){const from=ids.find((id,i)=>shown.includes(id)&&shown.includes(ids[i+1]));if(from)return {k,cat,shown,from,before:[...ids]}}}throw Error('No partial category fixture')});
 await p.evaluate(()=>{const e=document.getElementById('advBox66');e.classList.add('movie96-is-open','open');e.style.display='block'});await p.locator('#advBox66 [data-inc]').filter({hasText:fixture.cat}).first().click({force:true});await p.waitForTimeout(250);
 const from=fixture.from;await p.evaluate(id=>{window.__movie30FocusRankCard(id);document.querySelector('.rank-card[data-id="'+id+'"]').scrollIntoView({block:'center'})},from);
 // Record the transient lift before clicking. On a busy CI worker the click
 // promise can resolve after the 540ms animation has already finished.
 await p.evaluate(()=>{
  window.__filteredFloatingSeen=false;
  window.__filteredFloatingObserver=new MutationObserver(()=>{
   if(document.querySelector('.movie30-floating-drag'))window.__filteredFloatingSeen=true;
  });
  window.__filteredFloatingObserver.observe(document.body,{childList:true,subtree:true});
 });
 await p.locator('.rank-card[data-id="'+from+'"] [data-sw="1"]').click({force:true});
 await p.waitForFunction(()=>window.__filteredFloatingSeen,{timeout:1500});
 await p.evaluate(()=>{window.__filteredFloatingObserver.disconnect();delete window.__filteredFloatingObserver});
 await p.waitForTimeout(900);await saved(p);
 const changed=(await snapshot(p)).rankOrder[fixture.k];assert.notDeepEqual(changed,fixture.before);assert.deepEqual(changed.filter(id=>!fixture.shown.includes(id)),fixture.before.filter(id=>!fixture.shown.includes(id)));assert.equal(changed.length,fixture.before.length);
 await reload(p);assert.deepEqual((await snapshot(p)).rankOrder[fixture.k],changed);console.log('PASS actual filtered arrow swap preserves hidden slots and order after restart',fixture.k,fixture.cat);
 await c.close();await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});


'use strict';
// Release-blocking design review: a failed request is not permission to overwrite a newer remote revision.
const {test}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');
test('automatic retry must preserve a remote edit made after the failed attempt',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();let revision='fixture-revision-A',puts=0,gets=0,fail=true,remoteNote='Original remote review';
  await page.route('https://api.github.com/**',async r=>{
   if(r.request().method()==='PUT'){
    puts++;if(fail)return r.fulfill({status:503,json:{message:'fixture unavailable'}});
    const payload=JSON.parse(Buffer.from(r.request().postDataJSON().content,'base64').toString('utf8'));
    remoteNote=payload.state.letterboxdMeta['fixture-0012'].note;return r.fulfill({json:{content:{sha:'fixture-revision-C'}}});
   }
   gets++;return r.fulfill({json:{sha:revision,content:Buffer.from(JSON.stringify({state:{letterboxdMeta:{'fixture-0012':{note:remoteNote}}}})).toString('base64')}});
  });
  await page.goto(origin);await ready(page);
  await page.evaluate(()=>{localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token');const box=document.getElementById('gptSyncAuto');box.checked=true;box.onchange();state.titleOverrides['fixture-0012']={title:'Pending local edit'};return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000});
  await page.waitForTimeout(1200);const first=puts;assert(first>0);
  revision='fixture-revision-B';remoteNote='New legitimate peer review';fail=false;
  await page.evaluate(()=>save());await page.waitForTimeout(4200);
  assert.equal(puts,first,'Retry overwrote a changed remote revision; candidate comparison is required');
  assert.equal(remoteNote,'New legitimate peer review');
 }finally{await browser.close()}
});

'use strict';
// Release-blocking design review: a failed request is not permission to overwrite a newer remote revision.
const {test}=require('node:test');
const {launch,origin,ready,assert}=require('./harness.cjs');
const {remoteFrom,reply}=require('./cloud-fixture.cjs');
test('automatic retry must preserve a remote edit made after the failed attempt',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();let revision='fixture-revision-A',puts=0,gets=0,fail=true,remote;
  await page.route('https://api.github.com/**',async r=>{
   if(r.request().method()==='PUT'){
    puts++;if(fail)return r.fulfill({status:503,json:{message:'fixture unavailable'}});
    const payload=JSON.parse(Buffer.from(r.request().postDataJSON().content,'base64').toString('utf8'));
    remote=payload;return r.fulfill({json:{content:{sha:'fixture-revision-C'}}});
   }
   gets++;return r.fulfill({json:reply(remote,revision)});
  });
  await page.goto(origin);await ready(page);remote=await remoteFrom(page);
  await page.evaluate(()=>{localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token');const box=document.getElementById('gptSyncAuto');box.checked=true;box.onchange();state.titleOverrides['fixture-0012']={title:'Pending local edit'};return save()});
  await page.waitForFunction(()=>document.getElementById('gptSyncStatus').textContent.includes('同期できません'),{},{timeout:12000});
  await page.waitForTimeout(1200);const first=puts;assert(first>0);
  revision='fixture-revision-B';remote.state.letterboxdMeta['fixture-0012'].note='New legitimate peer review';fail=false;
  await page.evaluate(()=>save());await page.waitForTimeout(4200);
  assert.equal(puts,first,'Retry overwrote a changed remote revision; candidate comparison is required');
  assert.equal(remote.state.letterboxdMeta['fixture-0012'].note,'New legitimate peer review');
  assert.match(await page.locator('#gptSyncStatus').textContent(),/同期を停止/);
 }finally{await browser.close()}
});

async function cloudCase(){
 const browser=await launch(),page=await browser.newPage();
 const server={sha:'A',remote:null,puts:0,mode:'ok',get:null,hold:null};
 await page.route('https://api.github.com/**',async r=>{
  if(r.request().method()!=='PUT')return r.fulfill({json:server.get||reply(server.remote,server.sha)});
  server.puts++;
  const body=r.request().postDataJSON();
  if(body.sha!==server.sha)return r.fulfill({status:409,json:{message:'fixture revision conflict'}});
  if(server.hold)await server.hold;
  if(server.mode!=='fail'){server.remote=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));server.sha+='B'}
  return r.fulfill({status:server.mode==='ok'?200:503,json:{content:{sha:server.sha}}});
 });
 await page.goto(origin);await ready(page);server.remote=await remoteFrom(page);
 await page.evaluate(()=>localStorage.setItem('movie30_github_sync_token_v1','synthetic-not-a-token'));
 const sync=()=>page.evaluate(()=>document.getElementById('gptSyncNow').onclick());
 const edit=note=>page.evaluate(note=>{state.letterboxdMeta['fixture-0012'].note=note;return save()},note);
 return {browser,page,server,sync,edit};
}

test('a committed PUT with a lost response is recognized by exact content, without a second write',async()=>{
 const {browser,page,server,sync,edit}=await cloudCase();try{
  await edit('Local sent review');server.mode='lost';await sync();assert.equal(server.puts,1);
  assert.match(await page.locator('#gptSyncStatus').textContent(),/同期できません/);
  server.mode='ok';await sync();assert.equal(server.puts,1);
  assert.match(await page.locator('#gptSyncStatus').textContent(),/同期しました/);
 }finally{await browser.close()}
});

test('unknown ancestry after restart cannot overwrite a peer; late local edits and raw remote remain exportable',async()=>{
 const {browser,page,server,sync,edit}=await cloudCase();try{
  await edit('Unsent local before restart');
  server.remote.state.letterboxdMeta['fixture-0012'].note='Peer review';server.sha='peer';
  server.remote.futureEnvelope={keep:[0,null,'value']};
  await page.reload();await ready(page);await sync();assert.equal(server.puts,0);
  await edit('Additional local edit after stop');
  await page.evaluate(()=>{window.candidateDownloads=[];download=(name,text)=>window.candidateDownloads.push({name,text})});
  await page.locator('#gptSyncCandidates button').nth(0).evaluate(b=>b.click());
  await page.locator('#gptSyncCandidates button').nth(1).evaluate(b=>b.click());
  const files=await page.evaluate(()=>window.candidateDownloads.map(f=>JSON.parse(f.text)));
  assert.equal(files[0].state.letterboxdMeta['fixture-0012'].note,'Additional local edit after stop');
  assert.deepEqual(files[1],server.remote);
  await sync();assert.equal(server.puts,0);
 }finally{await browser.close()}
});

test('old successful-looking fingerprints cannot authorize sending over unknown remote content',async()=>{
 const {browser,page,server,edit}=await cloudCase();try{
  await edit('Local pending');
  await page.evaluate(()=>{
   localStorage.setItem('movie30_github_synced_fingerprint_v1',window.__movie30GithubDataFingerprintV29(state));
   const box=document.getElementById('gptSyncAuto');box.checked=true;box.onchange();
  });
  server.remote.state.letterboxdMeta['fixture-0012'].note='Independent peer edit';server.sha='peer';
  await page.evaluate(()=>save());await page.waitForTimeout(4300);
  assert.equal(server.puts,0);assert.match(await page.locator('#gptSyncStatus').textContent(),/同期を停止/);
 }finally{await browser.close()}
});

test('missing, partial and undecodable remote content fail closed',async()=>{
 const {browser,page,server,sync}=await cloudCase();try{
  for(const bad of [{sha:'A'},{sha:'A',encoding:'base64',content:'!bad!'},reply({app:'movie30-live',schema:2,state:{rankOrder:{}}})]){
   await page.reload();await ready(page);server.get=bad;await sync();assert.equal(server.puts,0);
   assert.match(await page.locator('#gptSyncStatus').textContent(),/同期を停止/);
  }
 }finally{await browser.close()}
});

test('long PUT requeues later edits after both existing auto timers elapsed',async()=>{
 const {browser,page,server,sync,edit}=await cloudCase();try{
  await page.evaluate(()=>{const box=document.getElementById('gptSyncAuto');box.checked=true;box.onchange()});
  await edit('First sent version');let release;server.hold=new Promise(r=>release=r);
  const sending=sync();while(!server.puts)await page.waitForTimeout(50);
  await edit('Later unsent version');await page.waitForTimeout(4300);
  server.hold=null;release();await sending;
  assert.equal(server.remote.state.letterboxdMeta['fixture-0012'].note,'First sent version');
  assert.match(await page.locator('#gptSyncStatus').textContent(),/未同期/);
  await page.waitForTimeout(4300);
  assert.equal(server.remote.state.letterboxdMeta['fixture-0012'].note,'Later unsent version');assert.equal(server.puts,2);
 }finally{await browser.close()}
});

test('envelope metadata survives a normal write; unknown state fields block destructive replacement',async()=>{
 const {browser,page,server,sync,edit}=await cloudCase();try{
  server.remote.futureEnvelope={keep:[0,null,'']};await edit('Normal edit');await sync();
  assert.equal(server.puts,1);assert.deepEqual(server.remote.futureEnvelope,{keep:[0,null,'']});
  server.remote.state.futureState={keep:0};server.sha='peer';await edit('Pending second edit');await sync();
  assert.equal(server.puts,1);assert.deepEqual(server.remote.state.futureState,{keep:0});
  assert.match(await page.locator('#gptSyncStatus').textContent(),/同期を停止/);
 }finally{await browser.close()}
});

test('saving GitHub token settings cannot bypass the protected sync path',async()=>{
 const {browser,page,server,edit}=await cloudCase();try{
  await edit('Local pending review');server.remote.state.letterboxdMeta['fixture-0012'].note='Peer review';server.sha='peer';
  await page.evaluate(()=>{document.getElementById('gptSyncToken').value='synthetic-not-a-token';return document.getElementById('gptSyncSave').onclick()});
  assert.equal(server.puts,0,'The legacy settings button bypassed revision protection');
  assert.equal(server.remote.state.letterboxdMeta['fixture-0012'].note,'Peer review');
 }finally{await browser.close()}
});

test('large remote files are read by immutable blob SHA, including a concurrent branch update',async()=>{
 for(const race of [false,true]){
  const {browser,page,server,sync,edit}=await cloudCase();try{
   server.remote.largeFixtureEnvelope='架空'.repeat(550000);
   const blob=reply(server.remote,server.sha);let reads=0;
   server.get={sha:'A',encoding:'none',content:'',size:3300000};
   await page.route('https://api.github.com/**/git/blobs/*',async r=>{
    assert.equal(new URL(r.request().url()).pathname.split('/').at(-1),'A');reads++;
    if(race){server.sha='peer';server.remote.state.letterboxdMeta['fixture-0012'].note='Peer during blob read'}
    return r.fulfill({json:blob});
   });
   await edit('Pending local');await sync();assert.equal(reads,1);
   if(race){assert.equal(server.remote.state.letterboxdMeta['fixture-0012'].note,'Peer during blob read');assert.match(await page.locator('#gptSyncStatus').textContent(),/409/)}
   else{assert.equal(server.remote.state.letterboxdMeta['fixture-0012'].note,'Pending local');assert.equal(server.remote.largeFixtureEnvelope.length,1100000)}
  }finally{await browser.close()}
 }
});

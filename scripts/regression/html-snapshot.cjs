'use strict';
const {test}=require('node:test');
const {chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');
test('standalone HTML reopens fictional state offline, escapes content and excludes credentials',async()=>{
 const browser=await chromium.launch(options);try{
  const source=await browser.newContext();await isolate(source);const page=await source.newPage();await page.goto(origin);await ready(page);
  await page.evaluate(async()=>{state.letterboxdMeta['fixture-0012'].note='snapshot </script><script>globalThis.snapshotInjected=true</script>; 日本語';state.fixtureUnknown.extra={zero:0,missing:null};await save();localStorage.setItem('movie30_github_sync_token_v1','snapshot-secret-must-not-export')});
  const clean=()=>page.evaluate(()=>{const x=JSON.parse(JSON.stringify(state));delete x.storageIntegrity;return x});
  const before=await clean(),html=await page.evaluate(()=>snapshotHtml());
  assert.equal(typeof html,'string');assert(!html.includes('snapshot-secret-must-not-export'));
  const offline=await browser.newContext();const assetRequests=[];await offline.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin==='https://offline-snapshot.test'&&u.pathname==='/')return r.fulfill({contentType:'text/html',body:html});assetRequests.push(u.pathname);return r.abort()});
  const restored=await offline.newPage(),errors=[];restored.on('pageerror',e=>errors.push(e.message));await restored.goto('https://offline-snapshot.test');await ready(restored);
  assert.equal(await restored.evaluate(()=>!!globalThis.snapshotInjected),false);
  assert.deepEqual(await restored.evaluate(()=>{const x=JSON.parse(JSON.stringify(state));delete x.storageIntegrity;return x}),before);
  assert(!assetRequests.some(p=>/app-[\w-]+\.js$/.test(p)),JSON.stringify(assetRequests));assert.deepEqual(errors,[]);
  const again=await restored.evaluate(()=>snapshotHtml());assert.equal(typeof again,'string');assert(again.includes('movie30-snapshot-data'));
 }finally{await browser.close()}
});

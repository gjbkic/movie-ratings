'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../app-lb-transport.js'),'utf8');
function setup(fetch){let timers=0;const context={window:{},fetch,AbortController,setTimeout(fn,ms){timers++;return setTimeout(fn,ms)},clearTimeout(t){timers--;clearTimeout(t)}};vm.runInNewContext(source,context);return {...context.window.Movie30LbTransport,timers:()=>timers}}
function stopped(signal){return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))}
test('complete response is returned; request method/body/headers and HTTP errors preserved',async()=>{
 let seen;const transport=setup(async(url,opt)=>{seen={url,opt};return {ok:false,status:409,text:async()=>'{"message":"conflict"}'}});
 const result=await transport.read('/synthetic',{method:'PUT',body:'synthetic',headers:{Accept:'application/json'}},100);
 assert.equal(result.response.status,409);assert.equal(JSON.parse(result.text).message,'conflict');assert.equal(seen.opt.method,'PUT');assert.equal(seen.opt.body,'synthetic');assert.equal(seen.opt.headers.Accept,'application/json');assert.equal(transport.timers(),0);
});
for(const method of ['GET','PUT'])test(method+' hanging request is aborted with no automatic resend',async()=>{
 let calls=0,signal;const transport=setup(async(url,opt)=>{calls++;signal=opt.signal;return stopped(signal)});
 await assert.rejects(transport.read('/synthetic',{method},10),e=>e.name==='TimeoutError');assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(transport.timers(),0);
});
test('body stall remains covered after response headers',async()=>{
 let signal;const transport=setup(async(url,opt)=>{signal=opt.signal;return {text:()=>stopped(signal)}});
 await assert.rejects(transport.read('/synthetic',{},10),e=>e.name==='TimeoutError');assert.equal(signal.aborted,true);assert.equal(transport.timers(),0);
});
test('network errors are preserved and timer is released',async()=>{
 const error=Error('synthetic network failure'),transport=setup(async()=>{throw error});await assert.rejects(transport.read('/synthetic'),e=>e===error);assert.equal(transport.timers(),0);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-render-lifecycle.js'),'utf8'),ctx);const {decorate}=ctx.window.Movie30RenderLifecycle;
test('renderer boundary preserves receiver, args, return identity and nested order',()=>{
 const log=[],receiver={},arg={},value={};
 const inner=decorate(function(...args){assert.equal(this,receiver);assert.deepEqual(args,[arg,2]);log.push('render');return value},{before(){log.push('inner-before')},after(result,...args){assert.equal(this,receiver);assert.equal(result,value);assert.deepEqual(args,[arg,2]);log.push('inner-after');return 'ignored'}});
 const outer=decorate(inner,{before(){log.push('outer-before')},after(){log.push('outer-after')}});
 assert.equal(outer.call(receiver,arg,2),value);assert.deepEqual(log,['outer-before','inner-before','render','inner-after','outer-after']);
});
test('render errors skip after effects, and promise identity is not awaited',()=>{
 const err=Error('render failed');let after=0;assert.throws(()=>decorate(()=>{throw err},{after(){after++}})(),e=>e===err);assert.equal(after,0);
 const promise=Promise.resolve('later');assert.equal(decorate(()=>promise,{after(result){assert.equal(result,promise);after++}})(),promise);assert.equal(after,1);
});

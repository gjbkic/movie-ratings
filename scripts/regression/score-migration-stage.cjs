'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const policy=require('../../app-score-policy.js'),{fixture}=require('./fixture.cjs');
const {stage}=require('../../app-score-migration-stage.js');
function setup(){
 const sourceJson=JSON.stringify(fixture().state),stamp='memory+local+idb revision A';let writes=0,locked=false;
 const args={sourceJson,stamp,baseFilms:[],policy,readSource:async()=>({json:sourceJson,stamp}),withLegacyLock:async work=>{locked=true;try{return await work()}finally{locked=false}},store:{commit:async()=>{assert(locked);writes++;return {status:'committed'}}}};
 return {args,writes:()=>writes};
}
test('unchanged source stages verified conversion under the shared lock but does not activate',async()=>{
 const {args,writes}=setup();const r=await stage(args);assert.equal(r.status,'staged');assert.equal(r.activated,false);assert.equal(writes(),1);
});
test('source edit before staging stops without writing',async()=>{
 const {args,writes}=setup();args.readSource=async()=>({json:args.sourceJson,stamp:'B'});assert.equal((await stage(args)).status,'source-changed');assert.equal(writes(),0);
});
test('source edit during checkpoint commit is detected, checkpoint is not activated',async()=>{
 const {args}=setup();let revision='A';args.readSource=async()=>({json:args.sourceJson,stamp:revision});args.stamp='A';args.store.commit=async()=>{revision='B';return {status:'committed'}};
 assert.deepEqual(await stage(args),{status:'source-changed-after-stage',activated:false,checkpointMayExist:true});
});
test('source read failure after commit is uncertain, never a success',async()=>{
 const {args}=setup();let calls=0;args.readSource=async()=>{if(++calls===2)throw Error('read failed');return {json:args.sourceJson,stamp:args.stamp}};
 assert.deepEqual(await stage(args),{status:'uncertain',activated:false,checkpointMayExist:true});
});
test('missing lock/source stamp fails closed',async()=>{
 for(const key of ['withLegacyLock','stamp']){const {args,writes}=setup();delete args[key];assert.equal((await stage(args)).status,'invalid');assert.equal(writes(),0)}
});
test('conflict, failure and uncertain commit are never reported staged',async()=>{
 for(const status of ['conflict','failed','uncertain']){const {args}=setup();args.store.commit=async()=>({status});const r=await stage(args);assert.equal(r.status,status);assert.equal(r.activated,false)}
});
test('already migrated input and invalid rank memberships are rejected before writes',async()=>{
 for(const mode of ['current','rank']){const {args,writes}=setup();const state=JSON.parse(args.sourceJson);if(mode==='current')state.scorePolicy=policy.CURRENT;else state.rankOrder[80].push('unknown');args.sourceJson=JSON.stringify(state);args.readSource=async()=>({json:args.sourceJson,stamp:args.stamp});assert.equal((await stage(args)).status,'invalid');assert.equal(writes(),0)}
});

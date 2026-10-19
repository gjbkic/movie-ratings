'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const policy=require('../../app-score-policy.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function ordered(s){return Object.entries(s.rankOrder).sort((a,b)=>Number(b[0])-Number(a[0])).flatMap(([,ids])=>ids)}

test('all 101 integer scores preserve displayed stars and monotonic order',()=>{
 let previous=-1;
 for(let score=0;score<=100;score++){
  const next=policy.convertScore(score);
  assert(Number.isInteger(next));assert(next>=previous);previous=next;
  assert.equal(policy.starForScore(next,policy.CURRENT),policy.starForScore(score,policy.LEGACY));
  if(score<50)assert.equal(next,score);
 }
 assert.deepEqual([50,62,63,70,71,76,77,80,81,82,83,84,85,86,87,92,93,98,100].map(policy.convertScore),[54,58,59,63,64,69,70,75,76,79,81,82,85,87,88,92,93,98,100]);
});
test('740 fictional films preserve order, all unrelated data, missing/null/zero and seasons',()=>{
 const s=fixture().state,before=clone(s),p=policy.plan(s,[]);
 assert.deepEqual(s,before);assert.equal(p.sourceJson,JSON.stringify(s));
 assert.deepEqual(ordered(p.target),ordered(s));
 const excluded=new Set(['exactScores','rankOrder','scorePolicy','storageIntegrity']);
 for(const key of Object.keys(s))if(!excluded.has(key))assert.deepEqual(p.target[key],s[key],key);
 assert(!Object.hasOwn(p.target.exactScores,'fixture-0000'));
 assert.equal(p.target.exactScores['fixture-0001'],null);assert.equal(p.target.exactScores['fixture-0002'],0);
 assert.equal(p.target.exactScores['fixture-0004'],67);
 assert.deepEqual(p.target.letterboxdMeta['fixture-0010'].seasonScoresV1,{1:91,2:0});
 assert.equal(p.target.scorePolicy,policy.CURRENT);
 assert.equal(policy.matchesSource(s,p),true);
 s.letterboxdMeta['fixture-0012'].note+=' changed';assert.equal(policy.matchesSource(s,p),false);
});
test('merged score groups retain higher former scores first, then existing saved order',()=>{
 const s={customFilms:[],exactScores:{},rankOrder:{}};
 s.customFilms=['a','b','c','d'].map((id,i)=>({id,order:i,oldScore:null}));
 s.exactScores={a:50,b:51,c:51,d:50};s.rankOrder={50:['d','a'],51:['c','b']};
 const p=policy.plan(s,[]);assert.deepEqual(p.target.rankOrder['54'],['c','b','d','a']);
});
test('oldScore fallback is materialized, explicit null overrides oldScore, base catalog untouched',()=>{
 const s={customFilms:[],exactScores:{},rankOrder:{}},base=[{id:'base',oldScore:81},{id:'null',oldScore:82}];
 s.exactScores.null=null;const original=clone(base),p=policy.plan(s,base);
 assert.equal(p.target.exactScores.base,76);assert.equal(p.target.exactScores.null,null);
 assert.deepEqual(base,original);assert.deepEqual(p.target.rankOrder,{76:['base']});
});
test('missing saved ranks use the same category/order/sequence fallback as current ranking',()=>{
 const s={customFilms:[],exactScores:{},rankOrder:{}};
 s.customFilms=[{id:'a',oldScore:81,order:2},{id:'b',oldScore:81,order:1},{id:'c',oldScore:81,order:0}];
 s.rankOrder={81:['a']};assert.deepEqual(policy.plan(s,[]).target.rankOrder['76'],['a','c','b']);
});
test('round-trip with current marker does not convert twice or erase later edits',()=>{
 const s=policy.plan(fixture().state,[]).target;
 s.exactScores['fixture-0012']=72; // Simulate a later valid edit, with corresponding rank membership.
 for(const ids of Object.values(s.rankOrder)){const i=ids.indexOf('fixture-0012');if(i>=0)ids.splice(i,1)}
 (s.rankOrder['72']??=[]).push('fixture-0012');
 const restored=JSON.parse(JSON.stringify(s)),p=policy.plan(restored,[]);
 assert.equal(p.changed,false);assert.deepEqual(p.target,s);
});
test('unknown policy, fractional/invalid scores, duplicate IDs, dangling or stale ranks fail without mutation',()=>{
 const cases=[s=>s.scorePolicy='future',s=>s.exactScores['fixture-0012']=81.5,s=>s.exactScores['fixture-0012']=true,s=>s.exactScores['fixture-0012']='broken',s=>s.customFilms.push(clone(s.customFilms[0])),s=>s.rankOrder['80'].push('missing'),s=>s.rankOrder['80'].push(s.rankOrder['80'][0]),s=>s.rankOrder['80'].push('fixture-0002'),s=>s.exactScores.unknown=81];
 for(const mutate of cases){const s=fixture().state;mutate(s);const before=clone(s);assert.throws(()=>policy.plan(s,[]));assert.deepEqual(s,before)}
});
test('backup includes original integrity; target removes obsolete integrity without changing source',()=>{
 const s=fixture().state;s.storageIntegrity={checksum:'original'};
 const p=policy.plan(s,[]);assert.deepEqual(JSON.parse(p.sourceJson),s);assert(!Object.hasOwn(p.target,'storageIntegrity'));
});
test('all old groups merge without reversing a single film, including incomplete saved orders',()=>{
 const s={customFilms:[],exactScores:{},rankOrder:{}};
 for(let score=0;score<=100;score++){
  const ids=[];
  for(let i=0;i<4;i++){const id=`s${score}-${i}`;ids.push(id);s.customFilms.push({id,order:i});s.exactScores[id]=score}
  s.rankOrder[score]=[ids[2],ids[0]];
 }
 const expected=[];for(let score=100;score>=0;score--)expected.push(`s${score}-2`,`s${score}-0`,`s${score}-1`,`s${score}-3`);
 assert.deepEqual(ordered(policy.plan(s,[]).target),expected);
});
test('null markers cannot silently trigger conversion and unusual IDs retain their score',()=>{
 const s={customFilms:[{id:'__proto__',oldScore:81}],exactScores:{},rankOrder:{}};
 const p=policy.plan(s,[]);assert(Object.hasOwn(p.target.exactScores,'__proto__'));assert.equal(p.target.exactScores.__proto__,76);
 s.scorePolicy=null;assert.throws(()=>policy.plan(s,[]),/Unknown/);
});

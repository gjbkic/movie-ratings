'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {fixture}=require('./fixture.cjs');
test('rating and ranking preserve legacy edge cases, order, references and state',()=>{
 const state=fixture().state,films=state.customFilms;
 const category=f=>String(state.categoryOverrides?.[f.id]??f.category??'').trim();
 const old={state,allFilms:()=>films,filmCategory:category,uniq:a=>Array.from(new Set((a||[]).filter(Boolean)))};vm.createContext(old);vm.runInContext(fs.readFileSync(path.join(__dirname,'rank-queries-baseline.txt'),'utf8'),old);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-rank-queries.js'),'utf8'),ctx);const q=ctx.window.Movie30RankQueries;
 const score=f=>q.effectiveScore(f,state.exactScores),sort=(a,b)=>q.originalSort(a,b,category),rank=(a,s)=>q.rankSorted(a,s,state.rankOrder,sort);
 const values=[undefined,null,'',0,'0',false,true,-1,100,101,'  ',NaN,Infinity,'87','invalid'];
 for(const v of values){state.exactScores.edge=v;for(const prior of values){const f={id:'edge',oldScore:prior};assert.equal(score(f),old.effectiveScore(f))}}delete state.exactScores.edge;
 assert.equal(q.effectiveScore(null,state.exactScores),null);
 const before=JSON.stringify(state);
 for(const s of [0,50,88,100]){const a=films.slice().reverse(),b=a.slice();assert.equal(rank(a,s),a);old.rankSorted(b,s);assert.deepEqual(a.map(f=>f.id),b.map(f=>f.id));assert(a.every(f=>films.includes(f)))}
 const deps={allFilms:()=>films,effectiveScore:score,rankSorted:rank,uniq:old.uniq};
 for(const f of films.filter((_,i)=>i%17===0)){assert.equal(JSON.stringify(q.rankInfo(f,deps)),JSON.stringify(old.rankInfo(f)))}
 assert.equal(JSON.stringify(state),before);
 const saved=['a','b','a','missing'],a=[{id:'a',order:1},{id:'b',order:2},{id:'c',order:3}];state.rankOrder.edge=saved;const b=a.slice();q.rankSorted(a,'edge',state.rankOrder,sort);old.rankSorted(b,'edge');assert.deepEqual(a,b);assert.deepEqual(saved,['a','b','a','missing']);
});

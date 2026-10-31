'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {fixture}=require('./fixture.cjs');
test('detail rank matches the original for every fictional film without modifying source order/state',()=>{
 const state=fixture().state,films=state.customFilms;
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-rank-queries.js'),'utf8'),ctx);const q=ctx.window.Movie30RankQueries;
 let calls=0,sorts=0;
 const score=f=>{calls++;return q.effectiveScore(f,state.exactScores)};
 const rank=(a,s)=>{sorts++;return q.rankSorted(a,s,state.rankOrder,(a,b)=>q.originalSort(a,b,f=>f.category))};
 const deps={allFilms:()=>films,effectiveScore:score,rankSorted:rank};
 const old={...deps};vm.createContext(old);vm.runInContext(fs.readFileSync(path.join(__dirname,'detail-ranks-baseline.txt'),'utf8'),old);
 const before=JSON.stringify(state);
 for(const film of [...films,{id:'not-in-list',oldScore:80},{id:'not-in-list',oldScore:99},{id:'not-in-list',oldScore:33}]){
  assert.equal(JSON.stringify(q.detailRank(film,deps)),JSON.stringify(old.ranks(film)),film.id);
 }
 const target=films[12];calls=0;sorts=0;old.ranks(target);const prior={calls,sorts};calls=0;sorts=0;q.detailRank(target,deps);const current={calls,sorts};
 assert.equal(current.calls,films.length+1);assert.equal(current.sorts,1);assert(current.calls<prior.calls);assert(current.sorts<prior.sorts);
 assert.equal(JSON.stringify(state),before);
 console.log('DETAIL_RANK_WORK',JSON.stringify({prior,current}));
 // Observe current scores/order on each call; never retain a stale ranking cache.
 state.rankOrder['80']=['fixture-0012',...(state.rankOrder['80']||[]).filter(id=>id!=='fixture-0012')];
 state.exactScores['fixture-0013']=100;
 for(const film of [films[12],films[13],films[0],films[2]])assert.equal(JSON.stringify(q.detailRank(film,deps)),JSON.stringify(old.ranks(film)));
});

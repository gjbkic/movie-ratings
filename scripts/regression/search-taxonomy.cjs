'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const baseline=require('./search-taxonomy-baseline.json'),{fixture}=require('./fixture.cjs');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-search-queries.js'),'utf8'),ctx);
for(const name of Object.keys(baseline))test(name+' taxonomy search retains legacy IDs and lazy label reads',()=>{
 const films=fixture().state.customFilms;let manual=false,prior=false;const calls=[];
 const deps={match21:()=>prior,matchV30:()=>prior,matchBase:()=>prior,
 formatLabel:f=>{calls.push('format:'+f.id);return manual?'実写・アニメ':'実写'},
 mediaLabel31:f=>{calls.push('media31:'+f.id);return manual?'TVシリーズ':'映画'},
 mediaLabel:f=>{calls.push('media:'+f.id);return manual?'TVシリーズ':'映画'},
 originOf:f=>{calls.push('origin:'+f.id);return manual?'日本':'その他'}};
 const old=vm.runInNewContext('('+baseline[name]+')',deps);
 const next=(f,q)=>{
  if(prior)return true;if(!q)return true;
  const label=name==='format'?deps.formatLabel(f):name==='media'?deps.mediaLabel31(f):`${deps.mediaLabel(f)} ${deps.originOf(f)}`;
  return ctx.window.Movie30SearchQueries.taxonomyLabel(q,label);
 };
 for(manual of [false,true])for(prior of [false,true])for(const q of ['',null,0,false,' ','映画','TV','tv','日本','その他','実写・アニメ','映画 その他','ＴＶ','不存在']){
  calls.length=0;const expected=films.filter(f=>old(f,q)).map(f=>f.id),reads=[...calls];calls.length=0;
  assert.deepEqual(films.filter(f=>next(f,q)).map(f=>f.id),expected);assert.deepEqual(calls,reads);
 }
});

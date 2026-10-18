'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {fixture}=require('./fixture.cjs');
test('cast search retains name/originalName matches, lazy reads and live cache changes',()=>{
 const fold=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const cache=new Map(),calls=[];
 const namesForFilm=id=>{calls.push(id);return [...new Set((cache.get(id)||[]).flatMap(p=>[p.name,p.originalName]).filter(Boolean))]};
 const old={fold,namesForFilm};vm.createContext(old);vm.runInContext(fs.readFileSync(path.join(__dirname,'search-cast-baseline.txt'),'utf8'),old);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-search-queries.js'),'utf8'),ctx);
 const films=fixture().state.customFilms;
 for(const stage of ['empty','loaded','updated']){
  if(stage==='loaded')cache.set('fixture-0012',[{name:'架空俳優甲',originalName:'Synthetic Actor A'},{name:'架空俳優甲',originalName:''},{originalName:'Ｓｙｎｔｈｅｔｉｃ Ｂ'}]);
  if(stage==='updated'){cache.delete('fixture-0012');cache.set('fixture-0013',[{name:'変更後の架空俳優',originalName:'Synthetic Actor C'}])}
  const before=JSON.stringify([...cache]);
  for(const q of ['',null,undefined,0,false,' ','---','架空','俳優甲','synthetic actor','ＳＹＮＴＨＥＴＩＣ','syntheticb','変更後','不存在']){
   calls.length=0;const expected=films.filter(f=>old.matchesFilm(f.id,q)).map(f=>f.id),expectedCalls=[...calls];calls.length=0;
   const actual=films.filter(f=>ctx.window.Movie30SearchQueries.castNames(f.id,q,namesForFilm,fold)).map(f=>f.id);
   assert.deepEqual(actual,expected,stage+' '+q);assert.deepEqual(calls,expectedCalls,'Cache read order');
  }
  assert.equal(JSON.stringify([...cache]),before);
 }
});

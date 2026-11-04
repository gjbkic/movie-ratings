'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('catalog credits retain aliases, empty needles and missing-record behavior',()=>{
 const oldBody=fs.readFileSync(path.join(__dirname,'search-catalog-credits-baseline.txt'),'utf8').trim();
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-search-queries.js'),'utf8'),ctx);
 const allNames=r=>[...(r.directors||[]),...(r.creators||[]),...(r.directorAliases||[])];
 const catalog={};const old=vm.runInNewContext('('+oldBody+')',{catalog,allNames,oldMatch:()=>false});
 for(const rec of [undefined,{}, {directors:['Synthetic Director A'],creators:['架空制作乙'],directorAliases:['ＳＹＮＴＨＥＴＩＣ Ｂ']},{directors:['Christopher Nolan','David Fincher','Akira Kurosawa']}]){
  catalog.fixture=rec;const before=JSON.stringify(catalog);
  for(const q of ['',null,0,' ','---','synthetic','ＳＹＮＴＨＥＴＩＣＢ','架空制作','ノーラン','デビッド','黒沢','不存在']){
   const expected=old({id:'fixture'},q),actual=!q?true:ctx.window.Movie30SearchQueries.catalogCredits(q,rec,allNames);
   assert.equal(actual,expected,String(q));
  }
  assert.equal(JSON.stringify(catalog),before);
 }
});

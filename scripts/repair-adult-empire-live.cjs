'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {repair,KEEP,EXTRA}=require('../app-crayon-duplicate-repair.js');
const file=path.resolve(__dirname,'../live-state.json');
const original=JSON.parse(fs.readFileSync(file,'utf8'));
const next=structuredClone(original);
const result=repair(next.state);
if(!result.removed){
  assert(!result.blocked,result.blocked);
  assert(!next.state.customFilms.some(f=>f.id===EXTRA));
  assert(![...next.ranked,...next.unrated].some(row=>row.id===EXTRA));
  assert(next.state.customFilms.some(f=>f.id===KEEP));
  assert(next.state.letterboxdMeta?.[EXTRA]?.retiredDuplicateFilm20261031);
  console.log('Validated: duplicate absent; ranked film and retired metadata remain');
  process.exit(0);
}
assert(result.removed,'Expected the exact duplicate to be present and safe to retire');
assert.equal(next.ranked.length,original.ranked.length);
assert.deepEqual(next.ranked,original.ranked);
assert.deepEqual(next.state.rankOrder,original.state.rankOrder);
assert.deepEqual(next.state.exactScores,original.state.exactScores);
assert.equal(next.state.customFilms.length,original.state.customFilms.length-1);
assert.equal(next.unrated.length,original.unrated.length);
next.unrated=next.unrated.filter(row=>row.id!==EXTRA);
assert.equal(next.unrated.length,original.unrated.length-1);
assert(next.state.customFilms.some(f=>f.id===KEEP));
assert(next.state.letterboxdMeta[EXTRA].retiredDuplicateFilm20261031);
console.log('Validated: one unscored duplicate retired; ranked scores/order unchanged; original film and metadata archived');
if(process.argv.includes('--write'))fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');

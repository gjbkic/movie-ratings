'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./fixture.cjs'),policy=require('../../app-score-policy.js');
const {assess}=require('../../app-score-entry-gate.js');
const clone=x=>structuredClone(x),old=()=>fixture().state,balanced=()=>policy.plan(old(),[]).target;
const check=(input,route,runtime,expected)=>{const before=JSON.stringify(input),r=assess(input,{route,runtime});assert.equal(r.status,expected);assert.equal(JSON.stringify(input),before);return r};
test('legacy unmarked backup, bare state and live envelope remain compatible on legacy routes',()=>{
 check(old(),'restore','legacy-v23','accept');check({type:'movie30-backup',state:old()},'restore','legacy-v23','accept');
 check(old(),'startup','legacy-v23','accept');check({app:'movie30-live',schema:2,state:old()},'sync','legacy-v23','accept');
});
test('same-policy fictional preview envelope cannot enter restore, startup or sync',()=>{
 const pkg={type:'fictional-score-preview-only',state:balanced()};
 for(const route of ['restore','startup','sync'])check(pkg,route,'balanced-v1','reject');
 check(pkg,'preview','balanced-v1','accept');
});
test('balanced state requires explicit migration on legacy route; old state requires it on balanced route',()=>{
 for(const route of ['restore','startup'])check(balanced(),route,'legacy-v23','migration-required');
 check(old(),'restore','balanced-v1','migration-required');
});
test('unknown and null markers, unexpected envelopes and malformed state are rejected',()=>{
 for(const marker of [null,'future-v9']){const s=old();s.scorePolicy=marker;for(const route of ['restore','startup','sync'])check(s,route,'legacy-v23','reject')}
 check({type:'unknown',state:old()},'restore','legacy-v23','reject');
 check({type:'fictional-score-preview-only',state:old()},'preview','legacy-v23','reject');
 check({type:'movie30-backup',state:{rankOrder:{}}},'restore','legacy-v23','reject');
});
test('sync only admits matching legacy live envelope; preview candidates never sync',()=>{
 check(old(),'sync','legacy-v23','reject');check({type:'movie30-backup',state:old()},'sync','legacy-v23','reject');
 check({app:'movie30-live',schema:2,state:balanced()},'sync','legacy-v23','migration-required');
 check({app:'movie30-live',schema:2,state:balanced()},'sync','balanced-v1','reject');
});
test('preview route only accepts exact fictional preview type and balanced marker',()=>{
 check({type:'fictional-score-preview-only',state:balanced()},'preview','balanced-v1','accept');
 check({type:'movie30-backup',state:balanced()},'preview','balanced-v1','reject');
});
test('current app structure check accepts a preview state when outer type is stripped',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../../app-core.js'),'utf8');
 const fn=code.match(/function movie30ValidState\([^]*?\n\}/)?.[0];assert(fn);
 const scope={};vm.createContext(scope);vm.runInContext(fn,scope);
 const pkg={type:'fictional-score-preview-only',state:balanced()};
 assert.equal(scope.movie30ValidState(pkg.state),true);
 assert.equal(assess(pkg,{route:'restore',runtime:'balanced-v1'}).status,'reject');
});

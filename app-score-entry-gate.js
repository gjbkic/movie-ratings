/* Read-only classification for future import wiring. Never reads or writes app state. */
((root)=>{'use strict';
 const has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 function assess(input,{route,runtime}={}){
  const verdict=(status,reason)=>({status,reason});
  if(!['restore','startup','sync','preview'].includes(route)||!['legacy-v23','balanced-v1'].includes(runtime))return verdict('reject','invalid-context');
  if(!input||typeof input!=='object'||Array.isArray(input))return verdict('reject','invalid-package');
  let kind,body;
  if(has(input,'state')){
   body=input.state;
   if(input.type==='fictional-score-preview-only'&&!has(input,'app'))kind='preview';
   else if(input.type==='movie30-backup'&&!has(input,'app'))kind='backup';
   else if(input.app==='movie30-live'&&input.schema===2&&!has(input,'type'))kind='live';
   else return verdict('reject','unknown-package');
  }else{
   if(has(input,'type')||has(input,'app'))return verdict('reject','unknown-package');
   body=input;kind='bare';
  }
  if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.customFilms)||
     !body.exactScores||typeof body.exactScores!=='object'||Array.isArray(body.exactScores)||
     !body.rankOrder||typeof body.rankOrder!=='object'||Array.isArray(body.rankOrder)||
     !Object.values(body.rankOrder).every(ids=>Array.isArray(ids)&&ids.every(id=>typeof id==='string'))||
     !body.customFilms.every(f=>f&&typeof f.id==='string'))return verdict('reject','invalid-state');
  const policy=has(body,'scorePolicy')?body.scorePolicy:'legacy-v23';
  if(!['legacy-v23','balanced-v1'].includes(policy))return verdict('reject','unknown-policy');
  if(route==='preview')return kind==='preview'&&policy==='balanced-v1'&&runtime==='balanced-v1'?verdict('accept','fictional-preview'):verdict('reject','preview-only');
  if(kind==='preview')return verdict('reject','preview-only');
  if(route==='sync'&&kind!=='live')return verdict('reject','sync-envelope-required');
  if(route==='restore'&&!['bare','backup'].includes(kind))return verdict('reject','restore-envelope-required');
  if(route==='startup'&&kind!=='bare')return verdict('reject','startup-state-required');
  if(policy!==runtime)return verdict('migration-required','policy-mismatch');
  // A dedicated sync destination and activation protocol do not exist yet.
  if(route==='sync'&&runtime==='balanced-v1')return verdict('reject','balanced-sync-unavailable');
  if(route==='startup'&&runtime==='balanced-v1')return verdict('reject','balanced-activation-unavailable');
  return verdict('accept','compatible');
 }
 const api=Object.freeze({assess});if(typeof module==='object'&&module.exports)module.exports=api;else root.Movie30ScoreEntryGate=api;
})(typeof window==='object'?window:globalThis);

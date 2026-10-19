/* Prepare a checkpoint only. This module never activates a new app state.
 * Production source readers and shared-lock adapters are intentionally not wired.
 */
((root)=>{'use strict';
 async function stage(args){
  const {sourceJson,stamp,policy,readSource,withLegacyLock,store}=args||{};
  let checkpointMayExist=false;
  const result=status=>({status,activated:false,...(checkpointMayExist?{checkpointMayExist:true}:{})});
  if(typeof sourceJson!=='string'||typeof stamp!=='string'||!stamp||typeof readSource!=='function'||typeof withLegacyLock!=='function'||typeof store?.commit!=='function'||typeof policy?.plan!=='function'||!Array.isArray(args.baseFilms))return result('invalid');
  // Freeze the catalog used for conversion across all asynchronous operations.
  let baseFilms;try{baseFilms=JSON.parse(JSON.stringify(args.baseFilms))}catch(_){return result('invalid')}
  const matches=source=>source?.json===sourceJson&&source?.stamp===stamp;
  try{return await withLegacyLock(async()=>{
   if(!matches(await readSource()))return result('source-changed');
   let plan;try{plan=policy.plan(JSON.parse(sourceJson),baseFilms);if(!plan.changed)return result('invalid')}catch(_){return result('invalid')}
   checkpointMayExist=true;
   const saved=await store.commit({sourceJson,targetJson:JSON.stringify(plan.target)});
   if(!['committed','already-committed'].includes(saved?.status))return result(['failed','conflict','uncertain','invalid'].includes(saved?.status)?saved.status:'uncertain');
   if(!matches(await readSource()))return result('source-changed-after-stage');
   return result('staged');
  })}catch(_){return result(checkpointMayExist?'uncertain':'source-unavailable')}
 }
 const api=Object.freeze({stage});if(typeof module==='object'&&module.exports)module.exports=api;else root.Movie30ScoreMigrationStage=api;
})(typeof window==='object'?window:globalThis);

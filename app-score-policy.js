/* Pure conversion planning only. No storage, network, DOM or automatic migration.
 * Not loaded by index.html until the isolated persistence/import adapter is ready.
 */
((root)=>{'use strict';
 const LEGACY='legacy-v23',CURRENT='balanced-v1';
 const oldBands=[[.5,0,49],[1,50,62],[1.5,63,70],[2,71,76],[2.5,77,80],[3,81,83],[3.5,84,86],[4,87,92],[4.5,93,97],[5,98,100]];
 const newBands=[[.5,0,53],[1,54,58],[1.5,59,63],[2,64,69],[2.5,70,75],[3,76,81],[3.5,82,87],[4,88,92],[4.5,93,97],[5,98,100]];
 const has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 function scoreNumber(value){
  if(value===null||value===undefined||value==='')return null;
  if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!value.trim()))throw Error('Invalid score');
  const n=Number(value);if(!Number.isInteger(n)||n<0||n>100)throw Error('Invalid score');return n;
 }
 function bands(policy){if(policy===LEGACY)return oldBands;if(policy===CURRENT)return newBands;throw Error('Unknown score policy')}
 function starForScore(value,policy){const n=scoreNumber(value);const ranges=bands(policy);return n===null?null:ranges.find(([,lo,hi])=>n>=lo&&n<=hi)[0]}
 function convertScore(value){
  const n=scoreNumber(value);if(n===null||n<50)return n;
  const i=oldBands.findIndex(([,lo,hi])=>n>=lo&&n<=hi),[,lo,hi]=oldBands[i],[,nextLo,nextHi]=newBands[i];
  return nextLo+Math.round((n-lo)*(nextHi-nextLo)/(hi-lo));
 }
 function plan(source,baseFilms){
  if(!source||typeof source!=='object'||Array.isArray(source))throw Error('State required');
  const policy=has(source,'scorePolicy')?source.scorePolicy:LEGACY;bands(policy);
  if(!Array.isArray(baseFilms)||!Array.isArray(source.customFilms)||!source.exactScores||!source.rankOrder)throw Error('Complete state and catalog required');
  for(const key of ['exactScores','rankOrder'])if(typeof source[key]!=='object'||Array.isArray(source[key]))throw Error('Invalid '+key);
  const films=baseFilms.concat(source.customFilms),byId=new Map(),byScore=new Map();
  const effective=f=>scoreNumber(has(source.exactScores,f.id)?source.exactScores[f.id]:f.oldScore);
  for(const film of films){
   if(!film||typeof film.id!=='string'||!film.id||byId.has(film.id))throw Error('Invalid or duplicate film ID');
   byId.set(film.id,film);const score=effective(film);if(score!==null){if(!byScore.has(score))byScore.set(score,[]);byScore.get(score).push(film)}
  }
  for(const id of Object.keys(source.exactScores))if(!byId.has(id))throw Error('Unknown rated film: '+id);
  const seen=new Set();
  for(const [key,ids] of Object.entries(source.rankOrder)){
   const score=scoreNumber(key);if(score===null||String(score)!==key||!Array.isArray(ids))throw Error('Invalid rank group');
   for(const id of ids){if(!byId.has(id)||seen.has(id)||effective(byId.get(id))!==score)throw Error('Invalid rank membership: '+id);seen.add(id)}
  }
  const sourceJson=JSON.stringify(source),target=JSON.parse(sourceJson);
  if(policy===CURRENT)return {changed:false,sourceJson,target,changes:[]};
  const category=f=>String(source.categoryOverrides?.[f.id]??f.category??'').trim();
  const originalSort=(a,b)=>category(a)!==category(b)?category(a).localeCompare(category(b),'ja'):(a.order??999999)-(b.order??999999)||((a._seq??999999)-(b._seq??999999));
  const changes=[];target.rankOrder={};
  for(const score of [...byScore.keys()].sort((a,b)=>b-a)){
   const saved=source.rankOrder[String(score)]||[],positions=new Map(saved.map((id,i)=>[id,i]));
   const films=byScore.get(score).sort((a,b)=>(positions.get(a.id)??1e9)-(positions.get(b.id)??1e9)||originalSort(a,b));
   const next=convertScore(score),key=String(next);if(!has(target.rankOrder,key))target.rankOrder[key]=[];
   for(const film of films){
    target.rankOrder[key].push(film.id);
    // Materialize base oldScore so a later catalog update cannot undo the conversion.
    Object.defineProperty(target.exactScores,film.id,{value:next,writable:true,enumerable:true,configurable:true});
    changes.push({id:film.id,before:score,after:next,star:starForScore(score,LEGACY)});
   }
  }
  // Null/absent exact scores, separate star overrides, metadata and season scores stay intact.
  target.scorePolicy=CURRENT;delete target.storageIntegrity;
  return {changed:true,sourceJson,target,changes};
 }
 function matchesSource(source,conversion){return JSON.stringify(source)===conversion.sourceJson}
 const api=Object.freeze({LEGACY,CURRENT,starForScore,convertScore,plan,matchesSource,
  ranges:policy=>Object.fromEntries(bands(policy).map(([star,lo,hi])=>[String(star),[lo,hi]]))});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.Movie30ScorePolicy=api;
})(typeof window==='object'?window:globalThis);

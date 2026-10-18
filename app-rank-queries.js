/* Read-only rating/ranking calculations; sorting retains the caller's in-place contract. */
(()=>{'use strict';
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);const validScore=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100;
function effectiveScore(f,exactScores) {
    if (!f) return null;
    if (has(exactScores, f.id)) return validScore(exactScores[f.id]) ? Number(exactScores[f.id]) : null;
    return validScore(f.oldScore) ? Number(f.oldScore) : null;
  }
function originalSort(a,b,filmCategory){if(filmCategory(a)!==filmCategory(b))return filmCategory(a).localeCompare(filmCategory(b),"ja");return (a.order??999999)-(b.order??999999)||((a._seq??999999)-(b._seq??999999))}
function rankSorted(arr,score,rankOrder,originalSort){const saved=rankOrder[String(score)]||[],pos=new Map(saved.map((id,i)=>[id,i]));return arr.sort((a,b)=>{const pa=pos.has(a.id)?pos.get(a.id):1e9,pb=pos.has(b.id)?pos.get(b.id):1e9;return pa-pb||originalSort(a,b)})}
function rankInfo(f,{allFilms,effectiveScore,rankSorted,uniq}){const scores=uniq(allFilms().map(effectiveScore).filter(x=>x!=null).map(Number)).sort((a,b)=>b-a),flat=[];for(const s of scores)flat.push(...rankSorted(allFilms().filter(x=>Number(effectiveScore(x))===s),s));const i=flat.findIndex(x=>x.id===f.id),sc=effectiveScore(f),same=sc==null?[]:rankSorted(allFilms().filter(x=>Number(effectiveScore(x))===Number(sc)),Number(sc)),j=same.findIndex(x=>x.id===f.id);return {all:i<0?null:i+1,total:flat.length,same:j<0?null:j+1,st:same.length,up:i>0?flat[i-1]:null,down:i>=0&&i<flat.length-1?flat[i+1]:null}}
function detailRank(f,{allFilms,effectiveScore,rankSorted}){
 const score=effectiveScore(f);if(score==null)return null;
 let total=0,above=0;const same=[];
 for(const film of allFilms()){
  const value=effectiveScore(film);if(value==null)continue;
  total++;
  if(Number(value)>Number(score))above++;
  else if(Number(value)===Number(score))same.push(film);
 }
 if(!same.length)return null;
 const tied=rankSorted(same,Number(score)),index=tied.findIndex(x=>x.id===f.id);
 return {overall:index<0?null:above+index+1,total,same:index<0?null:index+1,tied:tied.length,score};
}
window.Movie30RankQueries=Object.freeze({effectiveScore,originalSort,rankSorted,rankInfo,detailRank});
})();

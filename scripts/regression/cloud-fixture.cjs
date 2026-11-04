'use strict';
// Mirror the existing live-state fields, without reading any real data file.
async function remoteFrom(page){return page.evaluate(()=>{
 const out={};for(const k of ['exactScores','rankOrder','customFilms','starOverrides','titleOverrides','categoryOverrides','mediaTypeOverrides','genreOverrides','originOverrides','formatOverrides','runtimeOverrides','letterboxdMeta'])out[k]=state[k];
 return {app:'movie30-live',schema:2,state:JSON.parse(JSON.stringify(out))};
})}
const reply=(remote,sha='fixture-sha')=>({sha,encoding:'base64',content:Buffer.from(JSON.stringify(remote)).toString('base64')});
module.exports={remoteFrom,reply};

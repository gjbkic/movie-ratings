'use strict';
// Entirely fictional. Never derive this fixture from live-state or recovery files.
function fixture(count=740) {
  const state={version:23,updatedAt:1900000000000,customFilms:[],exactScores:{},starOverrides:{},rankOrder:{},titleOverrides:{},categoryOverrides:{},mediaTypeOverrides:{},genreOverrides:{},originOverrides:{},formatOverrides:{},runtimeOverrides:{},letterboxdMeta:{},rankRecovery:{version:2},fixtureUnknown:{nested:['preserve',0,null]}};
  for(let i=0;i<count;i++){
    const id='fixture-'+String(i).padStart(4,'0'),score=i<12?null:80+Math.floor((i-12)/40)%19;
    state.customFilms.push({id,title:`架空作品 ${i}`,englishTitle:`${i%40===0?'Black ':''}Fixture Film ${i}`,originalTitle:`Original Fixture ${i}`,lbTitle:`Fixture Film ${i}`,year:2000+i%25,category:'SF',star:i<6?0:4,oldScore:null,added:true,order:i,source:'manual'});
    if(i!==0)state.exactScores[id]=score;
    state.starOverrides[id]=i<6?0:4;
    if(score!==null)(state.rankOrder[score]??=[]).unshift(id);
    state.genreOverrides[id]=i%4<2?['SF']:['ドラマ'];
    state.mediaTypeOverrides[id]='movie';state.originOverrides[id]='日本';state.formatOverrides[id]='live';state.runtimeOverrides[id]=100+i%60;
    state.letterboxdMeta[id]={note:`架空レビュー ${i}`,noteSource:'manual',watchHistory:[{id:`watch-${i}`,date:'2026-01-02',source:'manual'}],unknownNested:{keep:[i,null,'']}};
  }
  state.exactScores['fixture-0002']=0;state.rankOrder['0']=['fixture-0002'];
  state.customFilms[3].oldScore=73; // Explicit null overrides a historical initial score.
  state.customFilms[4].oldScore=74;delete state.exactScores['fixture-0004'];state.rankOrder['74']=['fixture-0004'];
  state.mediaTypeOverrides['fixture-0010']='drama';
  Object.assign(state.letterboxdMeta['fixture-0010'],{contentType:'tv_series',tmdbType:'tv',tmdbSeriesId:990010,seasonCountV1:2,seasonScoresV1:{1:91,2:0}});
  return {app:'movie30-live',schema:2,sourceUpdatedAt:state.updatedAt,state};
}
module.exports={fixture};

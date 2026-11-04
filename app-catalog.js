// One bounded, session-only metadata fetch. Each consumer owns its returned copy.
(() => {
  'use strict';
  let shared=null,inFlight=false;
  window.__movie30LoadCatalog=async ({refresh=false}={})=>{
    if(!shared||(refresh&&!inFlight)){
      inFlight=true;
      shared=(async()=>{
        const response=await fetch('./tmdb-metadata.json?catalog=20261016',{cache:'no-store'});
        if(!response.ok)throw Error('メタデータ取得失敗 (HTTP '+response.status+')');
        const data=await response.json();
        if(data?.schema!==1||!data.films||typeof data.films!=='object'||Array.isArray(data.films))throw Error('メタデータ形式が不正です');
        return data;
      })();
      shared.finally(()=>{inFlight=false}).catch(()=>{});
    }
    const data=await shared;
    // Metadata consumers historically received independent JSON objects.
    return typeof structuredClone==='function'?structuredClone(data):JSON.parse(JSON.stringify(data));
  };
})();

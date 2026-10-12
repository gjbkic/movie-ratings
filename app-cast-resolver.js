/* Read-only TMDB/catalog resolver. Never writes movie state, ratings, ranks or reviews. */
(() => {
  'use strict';
  const fold=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const unique=xs=>[...new Set(xs.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const failure=(type,message)=>Object.assign(new Error(message),{type});
  let rows={},authError='',rateUntil=0;
  const ready=fetch('./tmdb-metadata.json?cast=20261013c',{cache:'no-store'}).then(r=>r.ok?r.json():null)
    .then(d=>{rows=d?.films||{};}).catch(()=>{});
  async function api(path,params={}){
    if(authError)throw failure('api',authError);
    const credential=getTmdbCredential().trim();
    if(!credential)throw failure('api','認証設定なし：TMDB APIキーを設定して再実行してください');
    for(let attempt=0;attempt<3;attempt++){
      if(rateUntil>Date.now())await pause(rateUntil-Date.now());
      const u=new URL('https://api.themoviedb.org/3'+path),headers={accept:'application/json'};
      for(const [k,v]of Object.entries(params))if(v!=null&&v!=='')u.searchParams.set(k,v);
      if(credential.length<=64&&!credential.includes('.'))u.searchParams.set('api_key',credential);else headers.Authorization='Bearer '+credential;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      let response;
      try{response=await fetch(u,{headers,signal:controller.signal});}
      catch(_){if(attempt<2&&navigator.onLine!==false){await pause(1000*2**attempt);continue;}throw failure('api','通信エラー・タイムアウト（最大3回再試行）。通信を確認して再実行してください');}
      finally{clearTimeout(timer);}
      if(response.status===401||response.status===403){authError='認証エラー HTTP '+response.status+'：キーを修正して再実行してください。以降のAPI通信は省略しています';throw failure('api',authError);}
      if(response.status===404||response.status===422)throw failure('unmatched','TMDB ID・作品が見つかりません（HTTP '+response.status+'）');
      if(response.status===429){
        const retry=response.headers.get('Retry-After'),seconds=Number(retry),delay=retry?(Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-Date.now()):2000*2**attempt;
        rateUntil=Date.now()+Math.max(1000,Number.isFinite(delay)?delay:2000);
        document.getElementById('movieCastStatus')?.replaceChildren(document.createTextNode('TMDBの回数制限（429）。指定された待機時間の後に再試行します…'));
        if(attempt<2)continue;throw failure('api','回数制限 HTTP 429（3回再試行）。次回通信はRetry-Afterの後に行います');
      }
      if(response.status>=500){if(attempt<2){await pause(1000*2**attempt);continue;}throw failure('api','TMDBサーバーエラー HTTP '+response.status+'（3回再試行）');}
      if(!response.ok)throw failure('api','TMDB APIエラー HTTP '+response.status);
      try{return await response.json();}catch(_){throw failure('api','TMDBの応答JSONを読み取れません');}
    }
  }
  function people(raw){
    const used=new Set(),result=[];
    for(const p of raw||[]){const name=String(typeof p==='string'?p:p.name||p.original_name||'').trim();if(!name)continue;
      const id=Number(p.id)||0,key=id||fold(name);if(used.has(key))continue;used.add(key);
      result.push({id,name,originalName:p.originalName||p.original_name||p.aliases?.find(x=>x!==name)||'',role:p.role||p.character||p.roles?.map(x=>x.character).filter(Boolean).join('／')||'',order:Number(p.order)||0});
      if(result.length>=15)break;
    }return result;
  }
  function names(f){const i=titleInfo(f),r=rows[f.id]||{};return unique([i.englishTitle,i.originalTitle,i.title,f.lbTitle,r.title,...(r.titleAliases||[])]);}
  function compatible(f,d,type){
    const year=Number(f.year),date=Number(String(d.release_date||d.first_air_date||'').slice(0,4));
    if(type==='movie'&&year&&date&&Math.abs(year-date)>3)return false;
    const wanted=new Set(names(f).map(fold)),actual=unique([d.title,d.name,d.original_title,d.original_name,...(d.alternative_titles?.titles||d.alternative_titles?.results||[]).map(x=>x.title)]);
    return actual.some(n=>wanted.has(fold(n)));
  }
  async function detail(f,type,id,trust=false){
    const d=await api('/'+type+'/'+id,{language:'ja-JP',append_to_response:type==='movie'?'credits,alternative_titles':'aggregate_credits,alternative_titles'});
    if(trust||compatible(f,d,type))return {type,id,data:d};
    const en=await api('/'+type+'/'+id,{language:'en-US',append_to_response:'alternative_titles'});
    if(compatible(f,en,type))return {type,id,data:d};
    throw failure('unmatched','保存IDの作品名・公開年が一致しません（'+type+'/'+id+'）');
  }
  async function resolve(f){
    const m=state.letterboxdMeta?.[f.id]||{},r=rows[f.id]||{},issues=[],tried=new Set();
    const explicitEpisode=m.contentType==='tv_episode';
    if(explicitEpisode&&m.tmdbSeriesId&&m.seasonNumber!=null&&m.episodeNumber!=null){
      const path='/tv/'+m.tmdbSeriesId+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber;
      const d=await api(path,{language:'ja-JP',append_to_response:'credits'});
      return {type:'episode',id:Number(m.tmdbSeriesId),seasonNumber:m.seasonNumber,episodeNumber:m.episodeNumber,data:d};
    }
    const candidates=[];
    if(r.tmdbId&&['movie','tv'].includes(r.type))candidates.push([r.type,r.tmdbId,true]);
    if(m.tmdbSeriesId)candidates.push(['tv',m.tmdbSeriesId,false]);
    const id=titleInfo(f).tmdbId||f.tmdbId||m.poster84?.tmdbId;
    if(id){
      // UI classification "drama" does not establish TMDB's namespace: TV specials often have movie IDs.
      const tv=m.contentType==='tv_series'||f.tmdbType==='tv';candidates.push([tv?'tv':'movie',id,false],[tv?'movie':'tv',id,false]);
    }
    for(const [type,id,trust]of candidates){
      const key=type+':'+id;if(tried.has(key))continue;tried.add(key);
      try{return await detail(f,type,Number(id),trust);}catch(e){if(e.type!=='unmatched')throw e;issues.push(e.message);}
    }
    const titles=names(f),isDrama=m.contentType?.startsWith('tv_')||state.mediaTypeOverrides?.[f.id]==='drama'||r.type==='drama';
    const types=isDrama?['tv','movie']:['movie','tv'];
    for(const type of types)for(const name of unique([...titles,...(isDrama?titles.map(x=>x.split(/[:：]/)[0]):[])]).slice(0,7)){
      const result=await api('/search/'+type,{query:name,language:'ja-JP',include_adult:'false'});
      const en=type==='tv'?await api('/search/tv',{query:name,language:'en-US',include_adult:'false'}):{};
      for(const hit of [...(result.results||[]).slice(0,8),...(en.results||[]).slice(0,8)]){
        if(hit.adult)continue;
        const key=type+':'+hit.id;
        if(compatible(f,hit,type)&&!tried.has(key)){
          tried.add(key);try{return await detail(f,type,hit.id);}catch(e){if(e.type!=='unmatched')throw e;issues.push(e.message);}
        }
        // Compilation/season/episode titles are not silently replaced by a whole series.
        if(type==='tv'&&titles.some(n=>fold(n).startsWith(fold(hit.name))&&fold(n)!==fold(hit.name)&&fold(hit.name).length>4)){
          const series=await api('/tv/'+hit.id,{language:'ja-JP'});
          const seriesEn=await api('/tv/'+hit.id,{language:'en-US'});
          const suffixes=titles.map(n=>n.split(/[:：]/).slice(1).join(':')).filter(Boolean).map(fold);
          for(const title of titles)for(const label of [hit.name,series.name,seriesEn.name,series.original_name]){const head=fold(label);if(head&&fold(title).startsWith(head))suffixes.push(fold(title).slice(head.length));}
          for(const season of series.seasons||[]){
            const n=season.season_number,enName=seriesEn.seasons?.find(s=>s.season_number===n)?.name;
            if(suffixes.includes(fold(season.name))||suffixes.includes(fold(enName))){const d=await api('/tv/'+hit.id+'/season/'+n,{language:'ja-JP',append_to_response:'aggregate_credits'});return {type:'season',id:hit.id,seasonNumber:n,data:d};}
            if(n!==0&&!suffixes.some(s=>s.length>3))continue;
            const special=await api('/tv/'+hit.id+'/season/'+n,{language:'en-US'});
            let exact=(special.episodes||[]).filter(ep=>compatible(f,{...ep,first_air_date:ep.air_date},'movie')||suffixes.includes(fold(ep.name)));
            if(!exact.length&&titles.some(t=>Number(t.match(/\b(\d+)\s*:\s*(?:the\s+)?finale\b/i)?.[1])===n))exact=(special.episodes||[]).filter(ep=>ep.episode_type==='finale');
            if(exact.length===1){const ep=exact[0],d=await api('/tv/'+hit.id+'/season/'+n+'/episode/'+ep.episode_number,{language:'ja-JP',append_to_response:'credits'});return {type:'episode',id:hit.id,seasonNumber:n,episodeNumber:ep.episode_number,data:d};}
          }
        }
      }
    }
    throw failure('unmatched',(issues.length?issues[0]+'。':'')+'既存ID・邦題・英題・原題・別名と映画／TVの両方を照合しましたが、一意に特定できません');
  }
  async function retrieve(f,{force=false}={}){
    await ready;
    const m=state.letterboxdMeta?.[f.id]||{},row=rows[f.id]||{};
    const episode=m.contentType==='tv_episode',scoped=!episode||(row.contentType==='tv_episode'&&Number(row.seasonNumber)===Number(m.seasonNumber)&&Number(row.episodeNumber)===Number(m.episodeNumber));
    if(!force&&row.cast?.length&&scoped)return {filmId:f.id,tmdbType:episode?'episode':row.contentType==='tv_season'?'season':row.type==='tv'?'tv':'movie',tmdbId:Number(row.tmdbId)||0,seasonNumber:row.seasonNumber,episodeNumber:row.episodeNumber,cast:people(row.cast),source:'github-tmdb-metadata',resolverVersion:2,fetchedAt:row.castCheckedAt||new Date().toISOString()};
    const found=await resolve(f),d=found.data;
    const raw=found.type==='episode'?[...(d.credits?.cast||d.cast||[]),...(d.guest_stars||[])]:d.aggregate_credits?.cast||d.credits?.cast||[];
    let cast=people(raw);
    if(!cast.length){
      const path=found.type==='episode'?'/tv/'+found.id+'/season/'+found.seasonNumber+'/episode/'+found.episodeNumber+'/credits'
        :found.type==='season'?'/tv/'+found.id+'/season/'+found.seasonNumber+'/aggregate_credits':'/'+found.type+'/'+found.id+(found.type==='tv'?'/aggregate_credits':'/credits');
      const en=await api(path,{language:'en-US'});cast=people([...(en.cast||[]),...(en.guest_stars||[])]);
      if(!cast.length&&['tv','season'].includes(found.type)){
        const standard=found.type==='tv'?'/tv/'+found.id+'/credits':'/tv/'+found.id+'/season/'+found.seasonNumber+'/credits';
        const response=await api(standard,{language:'en-US'});cast=people(response.cast||[]);
      }
      if(!cast.length&&found.type==='tv'&&d.number_of_episodes===1){
        const seasons=(d.seasons||[]).filter(s=>s.episode_count===1);
        if(seasons.length===1){const n=seasons[0].season_number,s=await api('/tv/'+found.id+'/season/'+n,{language:'en-US'});
          if(s.episodes?.length===1){const ep=await api('/tv/'+found.id+'/season/'+n+'/episode/'+s.episodes[0].episode_number+'/credits',{language:'en-US'});cast=people([...(ep.cast||[]),...(ep.guest_stars||[])]);}
        }
      }
    }
    return {filmId:f.id,tmdbType:found.type,tmdbId:found.id,seasonNumber:found.seasonNumber,episodeNumber:found.episodeNumber,cast,source:'tmdb',resolverVersion:2,fetchedAt:new Date().toISOString()};
  }
  window.__movie30CastSource={ready,retrieve,reset:()=>{authError='';},catalog:()=>rows};
})();

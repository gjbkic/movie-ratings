/* Person filmographies are read-only. Only the explicit registration button changes movie data. */
(() => {
  'use strict';
  const fold = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const image = (p, size = 'w185') => /^\/[\w.-]+$/.test(p || '') ? 'https://image.tmdb.org/t/p/' + size + p : '';
  const cache = new Map(); // Bounded session cache; never copied into movie backups or localStorage.
  let catalog = {}, active = null, ticket = 0, originFocus = null, historyKey = '', depth = 0;
  fetch('./tmdb-metadata.json?people=20261013b').then(r => r.ok ? r.json() : null)
    .then(x => { catalog = x?.films || {}; if (active) draw(); }).catch(() => {});
  const aliases = name => [name, ...(window.__movie30JPDirector91?.aliases?.get(fold(name)) || [])];
  const namesMatch = (a, b) => aliases(a).some(x => aliases(b).some(y => fold(x) === fold(y)));
  function kindOf(f) {
    const m = state.letterboxdMeta?.[f.id] || {};
    const cached=window.__movie30Cast?.get(f.id),record=catalog[f.id]||{};
    if(cached?.tmdbType)return cached.tmdbType==='movie'?'movie':'tv';
    if(['movie','tv'].includes(record.type))return record.type;
    return String(m.contentType || '').startsWith('tv_') || m.tmdbType === 'tv' || f.tmdbType === 'tv'
      || state.mediaTypeOverrides?.[f.id] === 'drama' ? 'tv' : 'movie';
  }
  function identity(f) {
    const m = state.letterboxdMeta?.[f.id] || {}, cast = window.__movie30Cast?.get(f.id), r = catalog[f.id] || {};
    const type = kindOf(f);
    const id = Number(type === 'tv' ? (m.tmdbSeriesId || cast?.tmdbId || titleInfo(f).tmdbId || r.tmdbId)
      : (titleInfo(f).tmdbId || m.poster84?.tmdbId || cast?.tmdbId || r.tmdbId));
    return id > 0 ? type + ':' + id : '';
  }
  function isEpisode(f) { return ['tv_episode','tv_season'].includes(state.letterboxdMeta?.[f.id]?.contentType)||['episode','season'].includes(window.__movie30Cast?.get(f.id)?.tmdbType); }
  function watched(f) {
    const m = state.letterboxdMeta?.[f.id] || {};
    return !!(m.watchHistory?.length || m.watchedDate || m.lastWatchedDate || f.watchedDate
      || m.watchedDates?.length || effectiveScore(f) != null || Number(filmStar(f)) >= .5);
  }
  function localRole(f, person) {
    const m = state.letterboxdMeta?.[f.id] || {}, c = m.crew84 || {}, r = catalog[f.id] || {};
    const names = person.names || [person.name];
    const same = n => names.some(x => namesMatch(x, n));
    const cast = window.__movie30Cast?.get(f.id)?.cast || [];
    const known = cast.filter(p => person.id && Number(p.id) === Number(person.id));
    const legacy = (r.cast || []).filter(p => same(typeof p === 'string' ? p : p.name));
    const roles = [];
    if (known.length || legacy.length || (!person.id && cast.some(p => same(p.name) || same(p.originalName)))) roles.push('出演');
    if ((m.directors84Manual || c.directors || r.directors || []).some(same)) roles.push('監督');
    if ([...(c.creators || []), ...(r.creators || [])].some(same)) roles.push('製作者');
    return roles;
  }
  function localEntries(person) {
    const remote = new Map((person.works || []).map(w => [w.key, w]));
    return allFilms().flatMap(f => {
      const key = identity(f), w = remote.get(key), roles = localRole(f, person);
      // Exact credit IDs are authoritative for movies/series; episodes retain their own credits.
      if (!roles.length && (!w || isEpisode(f))) return [];
      return [{key: 'local:' + f.id, remoteKey: key, f, type: kindOf(f), title: displayTitle(f),
        year: String(f.year || ''), poster: state.letterboxdMeta?.[f.id]?.poster84?.path || catalog[f.id]?.posterPath || w?.poster || '',
        roles: roles.length ? roles : w.roles, popularity: w?.popularity || 0}];
    });
  }
  function localMatches(work) {
    return allFilms().filter(f => !isEpisode(f) && identity(f) === work.key);
  }
  function rankCompare(a, b) {
    const sa = effectiveScore(a.f), sb = effectiveScore(b.f);
    if ((sa ?? -1) !== (sb ?? -1)) return (sb ?? -1) - (sa ?? -1);
    if (sa != null) {
      const order = state.rankOrder?.[String(sa)] || [];
      const ia = order.indexOf(a.f.id), ib = order.indexOf(b.f.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    }
    return a.title.localeCompare(b.title, 'ja');
  }
  function credits(payload) {
    const byId = new Map();
    for (const [field, role] of [['cast','出演'], ['crew','監督']]) for (const x of payload[field] || []) {
      if (!['movie','tv'].includes(x.media_type) || !x.id || x.adult === true) continue;
      if (field === 'crew' && !['Director','Creator'].includes(x.job)) continue;
      const key = x.media_type + ':' + x.id;
      const w = byId.get(key) || {key, id: Number(x.id), type: x.media_type, title: x.title || x.name || '',
        original: x.original_title || x.original_name || '', year: String(x.release_date || x.first_air_date || '').slice(0,4),
        poster: x.poster_path || '', popularity: Number(x.popularity) || 0, roles: []};
      const label = x.job === 'Creator' ? '製作者' : role;
      if (!w.roles.includes(label)) w.roles.push(label);
      byId.set(key, w);
    }
    return [...byId.values()].filter(w => w.title);
  }
  const style = document.createElement('style');
  style.textContent = `
    #moviePersonBg{position:fixed;inset:0;z-index:4500;background:#0b111b;color:#edf4fc;overflow-y:auto;overscroll-behavior:contain;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);}
    #moviePersonBg[hidden]{display:none!important}.movie-person-shell{max-width:1000px;margin:auto;padding:14px 16px 35px;}
    .movie-person-top{display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;background:#0b111bf5;z-index:2;padding:8px 0;touch-action:none;user-select:none;}
    .movie-person-pull{font-size:11px;color:#aebdd0;padding:8px;}.movie-person-shell{will-change:transform;}
    .movie-person-head{display:flex;gap:15px;align-items:center;margin:20px 0}.movie-person-head img{width:76px;height:102px;object-fit:cover;border-radius:9px;}
    .movie-person-head h2{font-size:24px;margin:0 0 6px}.movie-person-meta,.movie-person-note{font-size:12px;line-height:1.7;color:#aebdd0;}
    .movie-person-controls{display:flex;flex-wrap:wrap;gap:9px;margin:15px 0}.movie-person-controls label{font-size:11px;color:#b4c3d5;display:flex;flex-direction:column;gap:4px;}
    .movie-person-controls select{min-height:39px;font-size:13px;max-width:160px;background:#172434;color:#ecf5ff;border:1px solid #45566b;border-radius:8px;padding:6px;}
    .movie-person-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:18px 13px;margin:16px 0;}
    .movie-person-work{border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer;min-width:0;}
    .movie-person-art{position:relative;aspect-ratio:2/3;background:#1a2737;border-radius:7px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#90a1b8;}
    .movie-person-art img{width:100%;height:100%;object-fit:cover;}.movie-person-badges{position:absolute;bottom:0;inset-inline:0;display:flex;flex-wrap:wrap;gap:3px;padding:5px;background:linear-gradient(transparent,#000d);}
    .movie-person-badge{border-radius:5px;font-size:10px;font-weight:700;padding:4px 5px;background:#192536e8;color:#d9e4f2;}.movie-person-badge.seen{background:#126b43;color:#e4ffef;}
    .movie-person-work strong{display:block;font-size:12px;margin-top:7px;line-height:1.5;overflow-wrap:anywhere;}.movie-person-work small{display:block;font-size:10px;color:#b0bfd2;margin-top:3px;}
    #directorPanel84 p>strong{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}#directorPanel84 h3{font-size:13px;margin:0 0 8px;}#directorPanel84 p{font-size:11px;}#directorPanel84 #getDirector84{font-size:11px;}#directorPanel84 small{display:block;color:#bbc8d8;font-size:11px;margin-top:8px;}
    #sheetBg.movie-person-detail-layer{z-index:4600!important}.movie-person-preview{display:flex;gap:20px;align-items:flex-start;margin:20px 0;}.movie-person-preview>img{width:min(33%,185px);border-radius:8px;}
    .movie-person-preview h2{font-size:22px;margin-top:0;}.movie-person-preview p{white-space:pre-line;font-size:13px;line-height:1.8;}.movie-person-choice{display:block;text-align:left;width:100%;margin:10px 0;padding:13px;}
    #moviePersonBg button:focus-visible{outline:2px solid #acd9ff;outline-offset:3px;}@media(max-width:430px){.movie-person-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:15px 10px}.movie-person-shell{padding-inline:12px}.movie-person-head h2{font-size:21px}}
  `;
  document.head.appendChild(style);
  const overlay = document.createElement('section');
  overlay.id = 'moviePersonBg'; overlay.hidden = true; overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label','人物の作品一覧');
  overlay.innerHTML = '<div class="movie-person-shell"><div class="movie-person-top"><button class="btn" id="moviePersonBack" type="button">閉じる</button><span class="movie-person-pull">↓ 引っ張って戻る</span></div><div id="moviePersonContent"></div></div>';
  document.body.appendChild(overlay);
  const content = overlay.querySelector('#moviePersonContent');
  const back = overlay.querySelector('#moviePersonBack');
  let bodyOverflow = '', htmlOverflow = '';
  function hide() {
    closeSheet();
    ++ticket; active = null; overlay.hidden = true;
    document.documentElement.style.overflow=htmlOverflow;document.body.style.overflow=bodyOverflow;
    document.getElementById('sheetBg')?.classList.remove('movie-person-detail-layer');
    originFocus?.focus?.({preventScroll:true});
  }
  function close() { const steps=depth;hide();depth=0;if(historyKey&&steps)history.go(-steps); }
  function goList() {
    if (active?.preview && depth > 1) history.back();
    else { if (active) active.preview = null; draw(); }
  }
  back.onclick = () => active?.preview ? goList() : close();
  const shell=overlay.querySelector('.movie-person-shell');let pull=null;
  overlay.addEventListener('touchstart',e=>{
    pull=null;if(e.touches.length!==1||e.target.closest('button,input,select,a'))return;
    const handle=e.target.closest('.movie-person-top');if(!handle&&overlay.scrollTop>1)return;
    const p=e.touches[0];pull={x:p.clientX,y:p.clientY,dy:0,start:performance.now(),dragging:false};
  },{passive:true});
  overlay.addEventListener('touchmove',e=>{
    if(!pull||e.touches.length!==1)return;const p=e.touches[0],dy=p.clientY-pull.y,dx=p.clientX-pull.x;
    if(!pull.dragging){if(dy<0||Math.abs(dx)>Math.max(12,dy)){pull=null;return;}if(dy<8)return;pull.dragging=true;}
    if(e.cancelable)e.preventDefault();pull.dy=Math.max(0,dy);shell.style.transition='none';shell.style.transform='translate3d(0,'+Math.min(320,pull.dy*.85)+'px,0)';
  },{passive:false});
  function finishPull(cancelled){const g=pull;pull=null;shell.style.transition='transform 160ms ease-out';shell.style.transform='';
    if(g?.dragging&&!cancelled&&(g.dy>=105||(g.dy>55&&g.dy/Math.max(1,performance.now()-g.start)>.7))){active?.preview?goList():close();}
  }
  overlay.addEventListener('touchend',()=>finishPull(false),{passive:true});overlay.addEventListener('touchcancel',()=>finishPull(true),{passive:true});
  window.addEventListener('popstate', e => {
    if (!active) return;
    if (e.state?.moviePersonKey !== historyKey) { depth = 0; hide(); return; }
    depth = e.state.moviePersonWork ? 2 : 1;
    active.preview = e.state.moviePersonWork || null;
    if (active.preview) preview(active.preview, false); else draw();
  });
  document.addEventListener('keydown', e => {
    if (overlay.hidden || document.getElementById('sheetBg')?.classList.contains('movie-person-detail-layer')) return;
    if (e.key === 'Escape') { e.preventDefault(); active?.preview ? goList() : close(); }
    if (e.key === 'Tab') {
      const nodes = [...overlay.querySelectorAll('button:not([disabled]),select,a[href]')].filter(x => x.getClientRects().length);
      if (!nodes.length) return;
      if (e.shiftKey && (document.activeElement === nodes[0] || !overlay.contains(document.activeElement))) { e.preventDefault(); nodes.at(-1).focus(); }
      else if (!e.shiftKey && (document.activeElement === nodes.at(-1) || !overlay.contains(document.activeElement))) { e.preventDefault(); nodes[0].focus(); }
    }
  });
  function notify(text, retry) {
    content.textContent = '';
    const p = document.createElement('p'); p.className = 'movie-person-note'; p.setAttribute('role','status'); p.textContent = text; content.append(p);
    if (retry) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = '再試行'; b.onclick = retry; content.append(b); }
  }
  async function resolvePerson(input, t) {
    await window.__movie30Cast?.ready;
    if (input.id) return Number(input.id);
    const ids = new Set();
    for (const f of allFilms()) for (const p of window.__movie30Cast?.get(f.id)?.cast || [])
      if (p.id && [p.name,p.originalName].some(n => n && namesMatch(n,input.name))) ids.add(Number(p.id));
    if (ids.size === 1 && input.role !== '監督' && input.role !== '製作者') return [...ids][0];
    // Resolve a director from this work's credits rather than guessing by search popularity.
    const f = filmById(input.filmId), key = f && identity(f);
    if (key) {
      const [type,id] = key.split(':'), m = state.letterboxdMeta?.[f.id] || {};
      const path = isEpisode(f) ? '/tv/'+id+'/season/'+m.seasonNumber+'/episode/'+m.episodeNumber+'/credits'
        : '/'+type+'/'+id+(type === 'tv' ? '' : '/credits');
      try {
        const d = await tmdbFetch(path,{language:'en-US'});
        const people = input.role === '製作者' ? d.created_by || [] : (d.crew || []).filter(p => p.job === 'Director');
        const matches = people.filter(p => namesMatch(p.name,input.name));
        if (matches.length === 1) return Number(matches[0].id);
      } catch (_) {}
    }
    const result = await tmdbFetch('/search/person',{query:input.name,language:'ja-JP',include_adult:'false'});
    if (t !== ticket) return null;
    const candidates = (result.results || []).filter(p => p.id && !p.adult);
    if (candidates.length === 1) return Number(candidates[0].id);
    notify(candidates.length ? '同じ名前の人物が見つかりました。作品や職種を確認して選んでください。' : '人物が見つかりませんでした。');
    for (const p of candidates) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn movie-person-choice';
      b.textContent = [p.name,p.known_for_department,(p.known_for || []).slice(0,3).map(w => w.title || w.name).join('／')].filter(Boolean).join(' · ');
      b.onclick = () => loadPerson({...input,id:p.id},t); content.append(b);
    }
    return null;
  }
  async function loadPerson(input, t) {
    try {
      if (!getTmdbCredential()) throw Error('全作品の取得には「追加・保存」でTMDB APIキーを設定してください。');
      const id = await resolvePerson(input,t);
      if (!id || t !== ticket) return;
      notify('作品一覧を取得中…');
      let data = cache.get(id);
      if (!data) {
        const [p,c] = await Promise.all([tmdbFetch('/person/'+id,{language:'ja-JP'}),tmdbFetch('/person/'+id+'/combined_credits',{language:'ja-JP'})]);
        data = {id, name:p.name || input.name, names:[p.name,...(p.also_known_as || []),input.name].filter(Boolean), profile:p.profile_path, works:credits(c)};
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(id,data);
      }
      if (t !== ticket) return;
      Object.assign(active,data,{loaded:true,error:''}); draw();
    } catch (e) {
      if (t !== ticket || !active) return;
      active.error = String(e.message || e); draw();
    }
  }
  function open(input) {
    if (!input?.name && !input?.id) return;
    const t = ++ticket;
    const first=overlay.hidden;
    if(first)originFocus=document.activeElement;
    // The movie sheet owns its own scroll lock. Close it before capturing the page baseline.
    closeSheet();
    if(first){bodyOverflow=document.body.style.overflow;htmlOverflow=document.documentElement.style.overflow;}
    document.querySelectorAll('.movie92-suggestions').forEach(x => x.hidden = true);
    document.activeElement?.blur?.();
    active = {input, name:input.name || '人物', names:[input.name].filter(Boolean), id:Number(input.id)||0, works:[], scope:'registered', type:'all', role:'all', sort:'rank', loaded:false, preview:null};
    overlay.hidden = false; document.body.style.overflow = 'hidden';document.documentElement.style.overflow='hidden';overlay.scrollTop = 0;
    historyKey = 'person-'+Date.now(); depth = 1;
    history.pushState({...history.state,moviePersonKey:historyKey,moviePersonWork:null},'');
    draw(); back.focus({preventScroll:true}); loadPerson(input,t);
  }
  function select(label,id,options,value) {
    return '<label>'+label+'<select id="'+id+'">'+options.map(([v,n]) => '<option value="'+v+'"'+(value===v?' selected':'')+'>'+n+'</option>').join('')+'</select></label>';
  }
  function draw() {
    if (!active || active.preview) return;
    back.textContent = '閉じる';
    const a = active, local = localEntries(a);
    let items = a.scope === 'registered' ? local : [...a.works];
    if (a.type !== 'all') items = items.filter(w => w.type === a.type);
    if (a.role !== 'all') items = items.filter(w => w.roles.includes(a.role));
    if (a.sort === 'rank' && a.scope === 'registered') items.sort(rankCompare);
    else if (a.sort === 'year') items.sort((x,y) => Number(y.year||0)-Number(x.year||0)||x.title.localeCompare(y.title,'ja'));
    else items.sort((x,y) => y.popularity-x.popularity||x.title.localeCompare(y.title,'ja'));
    const url = image(a.profile);
    content.innerHTML = '<header class="movie-person-head">'+(url?'<img src="'+url+'" alt="">':'')+'<div><h2>'+esc(a.name)+'</h2><div class="movie-person-meta">'+items.length+'作品 · '+(a.scope==='registered'?'登録済み':'TMDBに登録された作品')+'</div></div></header>'
      +'<div class="movie-person-controls">'+select('表示','moviePersonScope',[['registered','登録済み'],['all','全作品']],a.scope)
      +select('作品種別','moviePersonType',[['all','映画＋ドラマ'],['movie','映画'],['tv','ドラマ']],a.type)
      +select('参加','moviePersonRole',[['all','出演・監督・製作'],['出演','出演'],['監督','監督'],['製作者','製作者']],a.role)
      +select('並び順','moviePersonSort',a.scope==='registered'?[['rank','自分の順位順'],['popularity','人気順'],['year','公開年が新しい順']]:[['popularity','人気順'],['year','公開年が新しい順']],a.sort)+'</div>'
      +'<p class="movie-person-note" id="moviePersonStatus" role="status">'+esc(a.error || (!a.loaded?'人物・作品情報を取得中…':a.scope==='registered'?'同点内の順位も全体ランキングと同じです。1点刻み未採点の作品は最後に表示します。':'人気順はTMDBの人気指標を使用しています。'))+'</p>'
      +'<div class="movie-person-grid" id="moviePersonGrid"></div><p class="movie-person-note">緑の ✓ 視聴済み：視聴履歴・視聴日、星評価、点数のいずれかあり。登録だけでは視聴済みになりません。<br>作品情報：TMDB（Letterboxdの人気順とは異なります）</p>';
    if (a.error) { const b=document.createElement('button'); b.className='btn'; b.textContent='再試行'; b.onclick=()=>loadPerson(a.input,ticket); content.querySelector('#moviePersonStatus').after(b); }
    const grid = content.querySelector('#moviePersonGrid');
    for (const w of items) {
      const films = w.f ? [w.f] : localMatches(w), seen = films.some(watched), scored = films.filter(f => effectiveScore(f)!=null);
      const badge = seen ? '<span class="movie-person-badge seen">✓ 視聴済み</span>' : '<span class="movie-person-badge">'+(films.length?'未視聴':'未登録')+'</span>';
      const sc = scored.length ? Math.max(...scored.map(f => effectiveScore(f))) : null;
      const b = document.createElement('button'); b.type='button'; b.className='movie-person-work'; b.dataset.key=w.key;
      const poster = image(w.poster);
      b.innerHTML='<div class="movie-person-art">'+(poster?'<img loading="lazy" src="'+poster+'" alt="">':'ポスターなし')+'<div class="movie-person-badges">'+badge+(sc!=null?'<span class="movie-person-badge">'+sc+'点</span>':'')+(films.length&&!w.f?'<span class="movie-person-badge">登録済み</span>':'')+'</div></div><strong>'+esc(w.title)+'</strong><small>'+esc([w.year,w.type==='tv'?'ドラマ':'映画',...w.roles].filter(Boolean).join(' · '))+'</small>';
      b.querySelector('img')?.addEventListener('error',e=>{e.target.before('ポスターなし');e.target.remove();},{once:true});
      b.setAttribute('aria-label',[w.title,seen?'視聴済み':films.length?'未視聴':'未登録',sc!=null?sc+'点':''].filter(Boolean).join(' · '));
      b.onclick=()=>{
        if (w.f || films.length) { openSheet((w.f||films[0]).id); document.getElementById('sheetBg').classList.add('movie-person-detail-layer'); }
        else preview(w.key,true);
      };
      grid.append(b);
    }
    if (!items.length) { const p=document.createElement('p'); p.className='movie-person-note'; p.textContent=a.loaded?'この条件に合う作品はありません。':'登録済み作品を確認しています。'; grid.append(p); }
    for (const [id,key] of [['moviePersonScope','scope'],['moviePersonType','type'],['moviePersonRole','role'],['moviePersonSort','sort']]) content.querySelector('#'+id).onchange=e=>{
      a[key]=e.target.value;
      if(key==='scope') a.sort=a.scope==='registered'?'rank':'popularity';
      draw(); content.querySelector('#'+id)?.focus({preventScroll:true});
    };
  }
  async function preview(key,push) {
    const a = active, t = ticket, w = a?.works.find(w => w.key===key);
    if (!w) return;
    a.preview=key; back.textContent='人物の作品一覧へ'; overlay.scrollTop=0;
    if (push) { depth=2; history.pushState({...history.state,moviePersonWork:key},''); }
    notify('作品詳細を取得中…');
    try {
      const d = await tmdbFetch('/'+w.type+'/'+w.id,{language:'ja-JP'});
      if(t!==ticket || active?.preview!==key) return;
      const poster=image(d.poster_path||w.poster), title=d.title||d.name||w.title;
      content.innerHTML='<div class="movie-person-preview">'+(poster?'<img src="'+poster+'" alt="">':'')+'<div><h2>'+esc(title)+'</h2><div class="movie-person-meta">'+esc([w.year,w.type==='tv'?'ドラマ':'映画',...w.roles].join(' · '))+'</div><p>'+esc(d.overview||'あらすじは登録されていません。')+'</p></div></div><p class="movie-person-note">未視聴・未採点で登録します。登録後に作品詳細から星・点数・視聴履歴を入力できます。</p><button class="btn" id="moviePersonRegister" type="button">この作品を登録する（未採点）</button><p class="movie-person-note" id="moviePersonRegisterStatus" role="status"></p>';
      content.querySelector('#moviePersonRegister').onclick=async e=>{
        const button=e.currentTarget, status=content.querySelector('#moviePersonRegisterStatus');
        const existing=localMatches(w);
        if(existing.length){ status.textContent='すでに登録されています。'; button.disabled=true; return; }
        button.disabled=true;
        // The established addFilm path handles IDs, persistence and metadata. No rank insertion for blank scores.
        const f=addFilm(title,w.year,'追加映画',0,'',{originalTitle:d.original_title||d.original_name||w.original,englishTitle:w.original||title,tmdbId:w.id,keepUnscored:true});
        if(!f){button.disabled=false;return;}
        f.star=0; f.tmdbType=w.type; state.starOverrides[f.id]=0;
        state.mediaTypeOverrides[f.id]=w.type==='tv'?'drama':(d.genres||[]).some(g=>g.id===99)?'documentary':'movie';
        const m=state.letterboxdMeta[f.id]??={};
        Object.assign(m,{contentType:w.type==='tv'?'tv_series':'movie',tmdbType:w.type,poster84:{path:d.poster_path||w.poster,tmdbId:w.id,provider:'tmdb',checkedAt:new Date().toISOString()}});
        if(w.type==='tv')m.tmdbSeriesId=w.id;
        const saved=await save(); render();
        if(t!==ticket || active?.preview!==key)return;
        status.textContent=saved?'登録して保存しました（未視聴・未採点）。':'登録内容を保存できていません。画面の保存警告からJSONを保存してください。';
        if(!saved){
          status.textContent='登録内容を保存できていません。アプリを閉じる前にJSONを保存してください。';
          const backup=document.createElement('button');backup.type='button';backup.className='btn';backup.textContent='現在のデータをJSON保存';
          backup.onclick=()=>document.getElementById('downloadJson')?.click();status.after(backup);
        }
        button.textContent='登録済み · 作品詳細を開く'; button.disabled=false;
        button.onclick=()=>{openSheet(f.id);document.getElementById('sheetBg').classList.add('movie-person-detail-layer');};
      };
    } catch(e) { if(t===ticket && active?.preview===key) notify('作品詳細を取得できません：'+String(e.message||e),()=>preview(key,false)); }
  }
  // Enhance only the existing director text, including asynchronous credit refreshes.
  const panel=document.getElementById('directorPanel84');
  function linkDirectors(){
    for(const strong of panel?.querySelectorAll('p>strong')||[]){
      if(strong.querySelector('.movie-person-link'))continue;
      const names=strong.textContent.split('、').map(s=>s.trim()).filter(s=>s&&!['未取得','TMDbに該当する記載なし'].includes(s));
      if(!names.length)continue;
      const role=strong.parentElement.textContent.includes('製作者')?'製作者':'監督';
      strong.textContent='';
      names.forEach(name=>{const b=document.createElement('button');b.type='button';b.className='movie-person-link movie-cast-person';b.textContent=name;b.onclick=()=>open({name,role,filmId:selectedId});strong.append(b);});
    }
  }
  if(panel)new MutationObserver(linkDirectors).observe(panel,{childList:true,subtree:true,characterData:true});
  linkDirectors();
  for(const id of ['closeSheet','sheetBg'])document.getElementById(id)?.addEventListener('click',()=>{
    if(!document.getElementById('sheetBg').classList.contains('open')){document.getElementById('sheetBg').classList.remove('movie-person-detail-layer');if(active&&!active.preview)draw();}
  });
  window.__movie30People={open};
})();

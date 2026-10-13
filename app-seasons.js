/* Independent season scores, stored inside each TV series record. */
(() => {
  'use strict';
  const norm = v => String(v || '').normalize('NFKC').toLowerCase().replace(/[\s・_\-:：.!?！？'’]/g, '');
  const presets = [
    [['strangerthings','ストレンジャーシングス未知の世界'],5],
    [['breakingbad','ブレイキングバッド'],5],
    [['prisonbreak','プリズンブレイク'],5],
    [['monster','モンスター'],1],
    [['半沢直樹','hanzawanaoki'],2],
    [['ガリレオ','galileo'],2],
    [['liargame','ライアーゲーム'],2],
    [['コードブルー','codeblue'],3],
    [['リーガルハイ','legalhigh'],2],
    [['trick','トリック'],3],
    [['hero','ヒーロー'],2],
    [['999刑事専門弁護士','99.9刑事専門弁護士'],2],
    [['boss','ボス'],2]
  ];
  const css = document.createElement('style');
  css.id='movie30-season-rating-style';
  css.textContent='#movie30SeasonPanel{margin:22px 0 18px;padding:15px;border:1px solid #455163;border-radius:12px;background:#111b28;color:#eaf1fb}' +
    '#movie30SeasonPanel[hidden]{display:none!important}' +
    '.movie30-season-title{font-size:16px;font-weight:750;margin:0 0 7px}' +
    '.movie30-season-description{font-size:12px;color:#bdc8d5;line-height:1.6;margin:0 0 15px}' +
    '.movie30-season-grid{display:grid;grid-template-columns:1fr;gap:8px}' +
    '.movie30-season-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:8px;background:#1b2a3b}' +
    '.movie30-season-line label{font-size:13px;font-weight:600;min-width:0;line-height:1.4;flex:1}' +
    '.movie30-season-line input{width:77px;min-width:77px;max-width:77px;padding:9px;color:#f4f8fe;background:#101923;border:1px solid #627389;border-radius:8px;text-align:center;font-size:16px}' +
    '.movie30-season-unit{font-size:12px;color:#b5c6d5}' +
    '.movie30-season-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:13px}' +
    '.movie30-season-actions button{min-height:38px;font-size:12px}' +
    '.movie30-season-status{font-size:11px;line-height:1.5;color:#b7c6d6;min-height:15px;margin-top:11px}';
  document.head.appendChild(css);
  const sheet=document.querySelector('#sheetBg .sheet'),closeBtn=document.getElementById('closeSheet');
  if(!sheet||!closeBtn)return;
  const panel=document.createElement('section');
  panel.id='movie30SeasonPanel';panel.hidden=true;
  panel.innerHTML='<h3 class="movie30-season-title">シーズン別の点数</h3>' +
    '<p class="movie30-season-description">上の「点数」はドラマ全体の評価で、ランキングに反映されます。ここではシーズンごとに0〜100点で個別評価できます。シーズンの平均から全体の点数を自動計算することはありません。</p>' +
    '<div class="movie30-season-grid" id="movie30SeasonRows"></div>' +
    '<div class="movie30-season-actions"><button class="btn" type="button" id="movie30SeasonAdd">＋ シーズンを追加</button><button class="btn" type="button" id="movie30SeasonFetch">TMDBからシーズン一覧を取得</button></div>' +
    '<p class="movie30-season-status" id="movie30SeasonStatus" role="status"></p>';
  sheet.insertBefore(panel,closeBtn);
  const scoreLabel=document.getElementById('editScore')?.closest('label');
  const originalLabel=scoreLabel?.firstChild?.nodeType===3?scoreLabel.firstChild.textContent:null;
  let fetchTicket=0;
  const getMeta=f=>state.letterboxdMeta?.[f.id]||{};
  function editMeta(f){
    state.letterboxdMeta=state.letterboxdMeta||{};
    return state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
  }
  function isSeries(f){
    if(!f)return false;
    const m=getMeta(f);
    if(['tv_episode','tv_season'].includes(m.contentType))return false;
    const kind=String(state.mediaTypeOverrides?.[f.id]||f.mediaType||'').toLowerCase();
    return ['tvseries','drama','series'].includes(kind)||m.contentType==='tv_series'||m.tmdbType==='tv'||f.tmdbType==='tv';
  }
  function seasonCount(f){
    const m=getMeta(f);
    const terms=[displayTitle(f),titleInfo(f).englishTitle,titleInfo(f).originalTitle,f.lbTitle].filter(Boolean).map(norm);
    const preset=presets.find(([names])=>names.some(name=>terms.includes(norm(name))))?.[1]||1;
    const keys=Object.keys(m.seasonScoresV1||{}).map(Number);
    const discovered=(Array.isArray(m.seasonCatalogV1)?m.seasonCatalogV1:[]).map(s=>Number(s.number));
    const valid=[preset,Number(m.seasonCountV1)||0,...keys,...discovered].filter(x=>Number.isInteger(x)&&x>=1&&x<=99);
    return Math.min(99,Math.max(1,...valid));
  }
  function showSaveResult(f,promise){
    const msg=panel.querySelector('#movie30SeasonStatus');
    msg.textContent='保存中…';
    Promise.resolve(promise).then(ok=>{
      if(selectedId===f.id&&!panel.hidden)msg.textContent=ok?'シーズン別の点数を保存しました':'保存できませんでした。JSONバックアップを確認してください。';
    }).catch(()=>{
      if(selectedId===f.id&&!panel.hidden)msg.textContent='保存できませんでした。';
    });
  }
  function draw(f){
    fetchTicket++;
    const visible=isSeries(f);
    panel.hidden=!visible;
    if(scoreLabel&&originalLabel!=null)scoreLabel.firstChild.textContent=visible?'シリーズ全体の点数 ':originalLabel;
    if(!visible)return;
    const id=f.id,m=getMeta(f),scores=m.seasonScoresV1||{};
    const catalog=new Map((Array.isArray(m.seasonCatalogV1)?m.seasonCatalogV1:[]).map(s=>[Number(s.number),s]));
    const grid=panel.querySelector('#movie30SeasonRows');
    grid.replaceChildren();
    for(let n=1;n<=seasonCount(f);n++){
      const row=document.createElement('div');row.className='movie30-season-line';
      const label=document.createElement('label');
      label.textContent='シーズン'+n+(catalog.get(n)?.year?'（'+catalog.get(n).year+'）':'');
      const input=document.createElement('input');
      input.type='number';input.min='0';input.max='100';input.step='1';input.inputMode='numeric';input.placeholder='未評価';
      input.setAttribute('aria-label','シーズン'+n+'の点数');
      input.value=scores[n]!==undefined&&Number.isInteger(Number(scores[n]))?String(scores[n]):'';
      const unit=document.createElement('span');unit.className='movie30-season-unit';unit.textContent='点';
      input.addEventListener('change',()=>{
        if(selectedId!==id)return;
        const raw=input.value.trim(),num=Number(raw);
        if(raw!==''&&(!Number.isInteger(num)||num<0||num>100)){
          input.value=scores[n]===undefined?'':String(scores[n]);
          panel.querySelector('#movie30SeasonStatus').textContent='0〜100の整数で入力してください。';
          return;
        }
        const wm=editMeta(f);wm.seasonScoresV1=wm.seasonScoresV1||{};
        if(raw==='')delete wm.seasonScoresV1[n];
        else wm.seasonScoresV1[n]=num;
        showSaveResult(f,save());
      });
      row.append(label,input,unit);grid.append(row);
    }
    panel.querySelector('#movie30SeasonStatus').textContent=m.seasonCatalogV1?.length?'シーズン構成：TMDB参照':'必要に応じてシーズンを追加するか、TMDBから一覧を取得してください。';
  }
  panel.querySelector('#movie30SeasonAdd').addEventListener('click',()=>{
    const f=filmById(selectedId);
    if(!isSeries(f))return;
    const next=seasonCount(f)+1;
    if(next>99){toast('99シーズンまで登録できます');return;}
    editMeta(f).seasonCountV1=next;
    const saving=save();
    draw(f);showSaveResult(f,saving);
    panel.querySelector('#movie30SeasonRows .movie30-season-line:last-child input')?.focus({preventScroll:true});
  });
  panel.querySelector('#movie30SeasonFetch').addEventListener('click',async()=>{
    const f=filmById(selectedId);
    if(!isSeries(f))return;
    const id=f.id,request=++fetchTicket,status=panel.querySelector('#movie30SeasonStatus');
    status.textContent='TMDBからシーズン一覧を取得中…';
    try{
      const m=getMeta(f);
      let sid=Number(m.tmdbSeriesId||(m.contentType==='tv_series'?titleInfo(f).tmdbId:0)||window.__movie30Cast?.get(id)?.tmdbId)||0;
      let tv=null;
      if(sid){try{tv=await tmdbFetch('/tv/'+sid,{language:'ja-JP'});}catch(_){sid=0;}}
      if(!tv){
        const info=titleInfo(f),query=info.englishTitle||info.originalTitle||displayTitle(f);
        const result=await tmdbFetch('/search/tv',{query,language:'ja-JP'});
        const names=[query,info.title,info.originalTitle,info.englishTitle].filter(Boolean).map(norm);
        const match=(result.results||[]).find(x=>names.includes(norm(x.name))||names.includes(norm(x.original_name)))||(result.results||[])[0];
        if(!match)throw Error('該当するTVシリーズが見つかりません');
        sid=Number(match.id);tv=await tmdbFetch('/tv/'+sid,{language:'ja-JP'});
      }
      const rows=(tv.seasons||[]).filter(x=>Number.isInteger(x.season_number)&&x.season_number>=1&&x.season_number<=99)
        .map(x=>({number:x.season_number,year:String(x.air_date||'').slice(0,4)}));
      if(!rows.length)throw Error('シーズン情報が見つかりません');
      if(selectedId!==id||fetchTicket!==request)return;
      const wm=editMeta(f);
      wm.tmdbSeriesId=sid;wm.seasonCatalogV1=rows;
      wm.seasonCountV1=Math.max(Number(wm.seasonCountV1)||0,...rows.map(x=>x.number));
      const saving=save();draw(f);showSaveResult(f,saving);
    }catch(error){
      if(selectedId===id&&fetchTicket===request)status.textContent='取得できませんでした：'+String(error.message||error)+'。手動でシーズンを追加できます。';
    }
  });
  const originalOpenSheet=openSheet;
  openSheet=function(id,...args){
    const result=originalOpenSheet.call(this,id,...args);
    draw(filmById(id));
    return result;
  };
  window.__movie30Seasons={isSeries,draw};
})();
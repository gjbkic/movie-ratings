(() => {
  // v75: numeric scores are authoritative; legacy high/mid/low tiers are retired.
  const BUILD = '20261010a';
  const has = (o,k) => Object.prototype.hasOwnProperty.call(o||{}, k);
  const validScore = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

  // Never reinterpret a stored score using an old 3-tier/scoreMap conversion.
  // Base oldScore remains as the historical initial score only when no newer exact score exists.
  effectiveScore = function(f) {
    if (!f) return null;
    if (has(state.exactScores, f.id)) return validScore(state.exactScores[f.id]) ? Number(state.exactScores[f.id]) : null;
    return validScore(f.oldScore) ? Number(f.oldScore) : null;
  };

  const css=document.createElement('style');
  css.textContent='button.tab[data-page="classify"],#page-classify,.choicegrid,#clearExact{display:none!important}.dist-note-v75{font-size:12px;color:#aeb7c4;margin:12px 0}.lb-audit-v75 .audit-results{max-height:500px;overflow:auto}.lb-audit-v75 table{border-collapse:collapse;width:100%;font-size:12px}.lb-audit-v75 td,.lb-audit-v75 th{padding:7px;border-bottom:1px solid #333;text-align:left}.lb-audit-v75 th{position:sticky;top:0;background:#111820}.lb-audit-v75 .audit-meta{color:#aeb7c4;font-size:12px;line-height:1.6}';
  document.head.appendChild(css);
  const map=document.getElementById('mapRoot');
  if(map && map.parentElement) map.parentElement.style.display='none';
  const editStar=document.getElementById('editStar');
  if(editStar && editStar.closest('label')) editStar.closest('label').style.display='none';

  // Restore the numeric-score screen if the obsolete classification tab was open.
  if(view.page==='classify') { view.page='rank'; save(false); }

  // One source of truth for each distribution bar: the very same score shown in ranking.
  renderDistribution=function(){
    const root=document.getElementById('distributionRoot');if(!root)return;
    const films=allFilms(), scoredFilms=films.map(f=>({f,score:effectiveScore(f)})).filter(x=>validScore(x.score));
    const scores=scoredFilms.map(x=>x.score), total=films.length, n=scores.length, unscored=total-n;
    const avg=n?scores.reduce((a,b)=>a+b,0)/n:null, sorted=scores.slice().sort((a,b)=>a-b);
    const med=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
    const countScore=new Map(),countStar=new Map(STAR_ORDER.map(s=>[Number(s),0]));
    for(const x of scoredFilms){
      countScore.set(x.score,(countScore.get(x.score)||0)+1);
      const star=scoreToStar(x.score);
      countStar.set(star,(countStar.get(star)||0)+1);
    }
    const pct=(k,d)=>d?(100*k/d).toFixed(1)+'%':'0.0%';
    const scoreRows=Array.from(countScore.entries()).sort((a,b)=>b[0]-a[0]);
    const starRows=STAR_ORDER.map(star=>[star,countStar.get(star)||0]);
    const row=(label,count,max,denom)=>'<div class="dist-row"><div class="dist-label">'+label+'</div><div class="dist-count">'+count+'本</div><div class="dist-pct">'+pct(count,denom)+'</div><div class="dist-bar"><div class="dist-fill" style="width:'+(count?Math.max(2,count/max*100):0)+'%"></div></div></div>';
    const mxScore=Math.max(1,...scoreRows.map(x=>x[1])), mxStar=Math.max(1,...starRows.map(x=>x[1]));
    const stat=(num,label)=>'<div class="dist-stat"><strong>'+num+'</strong><span>'+label+'</span></div>';
    root.innerHTML='<div class="dist-summary">'
      +stat(total,'登録作品数')+stat(n,'採点済み')+stat(unscored,'点数未設定')
      +stat(avg===null?'—':avg.toFixed(1),'平均点')+stat(med===null?'—':Number.isInteger(med)?med:med.toFixed(1),'中央値')
      +stat(scores.filter(x=>x>=90).length,'90点以上 · '+pct(scores.filter(x=>x>=90).length,n))
      +stat(scores.filter(x=>x>=95).length,'95点以上 · '+pct(scores.filter(x=>x>=95).length,n))
      +'</div><p class="dist-note-v75">表示中の最新点数から集計。旧「星内・上中下」換算や点数未設定の作品は混ぜません。星別は点数から換算した分布です。</p>'
      +'<div class="dist-grid"><section class="dist-panel"><h2>星別分布（点数から換算）</h2><div class="dist-sub">採点済み'+n+'本に対する割合</div>'
      +starRows.map(x=>row(stars(x[0]),x[1],mxStar,n)).join('')
      +'</section><section class="dist-panel"><h2>1点刻みの分布</h2><div class="dist-sub">採点済み'+n+'本に対する割合 · 0本の点数は省略</div>'
      +(scoreRows.length?scoreRows.map(x=>row(x[0]+'点',x[1],mxScore,n)).join(''):'<div class="dist-empty">点数データがありません</div>')
      +'</section></div>';
  };

  // Remove the retired 星内 column from new CSV exports.
  document.getElementById('downloadCsv').onclick=()=>{
    const header=['邦題／表示名','原題','英題','年','星（点数換算）','点数','カテゴリ','追加映画','TMDB ID'];
    const records=allFilms().map(f=>{
      const info=titleInfo(f),sc=effectiveScore(f);
      return [displayTitle(f),info.originalTitle,info.englishTitle,f.year||'',sc===null?'':scoreToStar(sc),
        sc===null?'':sc,filmCategory(f),!!f.added,info.tmdbId||''];
    });
    const csv=[header,...records].map(r=>r.map(csvCell).join(',')).join('\r\n');
    download('movie30_scores_20261010.csv','\ufeff'+csv,'text/csv;charset=utf-8');
  };

  // Do not silently assign a fabricated score to newly added star-only films.
  const oldAddFilm=addFilm;
  addFilm=function(title,year,category,star,score,meta){
    const extras={...(meta||{})};
    if(score===null||score===undefined||String(score)==='') extras.keepUnscored=true;
    return oldAddFilm(title,year,category,star,score,extras);
  };

  // Read-only full CSV audit. Letterboxd stars are compared with the current point-derived stars,
  // and never overwrite a ranking or a numeric score.
  const host=document.getElementById('page-data');
  if(host&&!document.getElementById('lbAuditV75')){
    const panel=document.createElement('div');
    panel.className='panel lb-audit-v75';panel.id='lbAuditV75';
    panel.innerHTML='<h2>Letterboxdとの全件照合</h2>'
       +'<div class="audit-meta">Letterboxdの最新 ratings.csv を選ぶと、現在の点数と星の差、片方にしかない作品を検出します。比較するだけで採点・順位は変更しません。</div>'
       +'<div class="tools"><label class="btn">ratings.csvを照合<input id="lbAuditFileV75" type="file" accept=".csv,text/csv" hidden></label><button class="btn" id="lbAuditExportV75" disabled>差分CSV</button></div>'
       +'<div class="audit-meta" id="lbAuditSummaryV75">未照合</div><div class="audit-results" id="lbAuditResultsV75"></div>';
    host.insertBefore(panel,host.firstChild);
    let diffRows=[];
    const e=s=>esc(String(s===undefined||s===null?'':s));
    function audit(raw){
      const table=parseCsvText(String(raw).replace(/^\uFEFF/,''));
      if(table.length<2)throw new Error('CSVが空です');
      const heads=table[0].map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase());
      const ix=(...names)=>names.map(n=>heads.indexOf(n)).find(i=>i>=0)??-1;
      const name=ix('name','title'), year=ix('year'), rating=ix('rating'), uri=ix('letterboxd uri','letterboxduri','url');
      if(name<0||rating<0)throw new Error('ratings.csv の Name / Rating 列がありません');
      const seen=new Set(),missing=[],dif=[],matches=[];
      let valid=0;
      for(const cells of table.slice(1)){
        const title=(cells[name]||'').trim(),rt=Number(cells[rating]||0);
        if(!title||!Number.isFinite(rt)||rt<.5||rt>5)continue;
        valid++;
        const meta={title,englishTitle:title,year:year<0?'':(cells[year]||'').trim(),uri:uri<0?'':(cells[uri]||'').trim()};
        const f=findExistingFilm(meta);
        if(!f){missing.push({title,year:meta.year,rating:rt,uri:meta.uri});continue}
        seen.add(f.id);
        const sc=effectiveScore(f), fromScore=sc===null?null:scoreToStar(sc), appStar=Number(filmStar(f));
        matches.push(f);
        if((fromScore!==null&&Math.abs(fromScore-rt)>0.01) || (Number.isFinite(appStar)&&appStar>0&&Math.abs(appStar-rt)>0.01)){
          dif.push({title:displayTitle(f),year:f.year||'',score:sc,appStar,scoreStar:fromScore,lbStar:rt,uri:meta.uri,id:f.id});
        }
      }
      const onlyApp=allFilms().filter(f=>!seen.has(f.id) && !missing.some(x=>x.uri && f.uri===x.uri));
      diffRows=[
        ...dif.map(f=>['星評価差',f.title,f.year,f.score,f.scoreStar,f.appStar,f.lbStar,f.uri]),
        ...missing.map(f=>['CSVのみ（要同定）',f.title,f.year,'','','',f.rating,f.uri]),
        ...onlyApp.map(f=>['アプリのみ',displayTitle(f),f.year||'',effectiveScore(f),effectiveScore(f)===null?'':scoreToStar(effectiveScore(f)),filmStar(f),'',f.uri||''])
      ];
      document.getElementById('lbAuditSummaryV75').textContent='Letterboxd評価 '+valid+'件／一致候補 '+matches.length+'件／星評価差 '+dif.length+'件／CSVのみ '+missing.length+'件／アプリのみ '+onlyApp.length+'件。※TV・独自追加作品はLetterboxdのratings.csvに含まれない場合があります。';
      const combined=[
        ...dif.map(f=>['星評価差',f.title,f.year,f.score,f.scoreStar,f.appStar,f.lbStar]),
        ...missing.map(f=>['CSVのみ（要同定）',f.title,f.year,'','', '',f.rating]),
        ...onlyApp.map(f=>['アプリのみ',displayTitle(f),f.year||'',effectiveScore(f),'',filmStar(f),''])
      ];
      document.getElementById('lbAuditResultsV75').innerHTML='<table><thead><tr>'+['区分','作品','年','点数','点数→★','アプリ★','LB★'].map(z=>'<th>'+e(z)+'</th>').join('')+'</tr></thead><tbody>'
         +combined.slice(0,250).map(r=>'<tr>'+r.map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'
         +(combined.length>250?'<p>画面は先頭250件。全件は差分CSVで確認できます。</p>':'');
      document.getElementById('lbAuditExportV75').disabled=!diffRows.length;
    }
    document.getElementById('lbAuditFileV75').onchange=async evt=>{
      const f=evt.target.files?.[0];if(!f)return;
      try{audit(await f.text())}catch(err){document.getElementById('lbAuditSummaryV75').textContent='照合失敗: '+err.message}
      evt.target.value='';
    };
    document.getElementById('lbAuditExportV75').onclick=()=>{
      const header=['区分','作品','年','点数','点数からの星','アプリの星','Letterboxdの星','Letterboxd URI'];
      const csv=[header,...diffRows].map(r=>r.map(csvCell).join(',')).join('\r\n');
      download('movie30_letterboxd_differences.csv','\ufeff'+csv,'text/csv;charset=utf-8');
    };
  }

  // The older render pipeline still runs to preserve integrations, but this takes precedence.
  const originalRender=render;
  render=function(...args){const result=originalRender.apply(this,args);renderDistribution();return result;};
  renderDistribution();
  renderHeader();
  const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
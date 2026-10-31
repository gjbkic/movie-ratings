/* Data tab organization only. Keep all legacy control nodes and their event handlers intact. */
(() => {
  'use strict';
  const page=document.getElementById('page-data');
  if(!page||document.getElementById('movie30-data-intro'))return;
  const css=document.createElement('style');
  css.textContent=[
    '#page-data .movie30-data-intro{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
    '#page-data .movie30-data-intro p{margin:0;color:var(--muted);font-size:11px;line-height:1.5;flex:1 1 190px}',
    '#page-data .movie30-data-fold{border:1px solid var(--line);border-radius:12px;background:#101720;margin:12px 0;overflow:hidden}',
    '#page-data .movie30-data-fold>summary{list-style:none;cursor:pointer;padding:13px 14px;font-size:13px;font-weight:800;color:#e5edf5;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '#page-data .movie30-data-fold>summary::-webkit-details-marker{display:none}',
    '#page-data .movie30-data-fold>summary::after{content:"⌄";font-size:18px;color:#9bb8c5}',
    '#page-data .movie30-data-fold[open]>summary::after{content:"⌃"}',
    '#page-data .movie30-data-fold>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}',
    '#page-data .movie30-data-fold-content{padding:0 11px 12px}',
    '#page-data .movie30-data-fold-content>.panel{margin-top:9px}',
    '#page-data .movie30-data-fold .tip{line-height:1.5}',
    '#page-data .movie30-data-fold-content .movie30-data-danger{margin-top:15px}',
    '#page-data .movie30-data-info{color:var(--muted);font-size:10px;line-height:1.5;margin:6px 0 0}'
  ].join('\n');
  document.head.append(css);

  const tab=document.querySelector('.tab[data-page="data"]');
  if(tab)tab.textContent='同期・保存';

  // The global "＋ 作品" already provides TMDB search and manual entry.
  // Keep these legacy input nodes mounted because older handlers reference them.
  const duplicate=document.getElementById('newTitle')?.closest('.panel');
  if(duplicate)duplicate.classList.add('hidden');
  const intro=document.createElement('div');
  intro.id='movie30-data-intro';intro.className='panel movie30-data-intro';
  intro.innerHTML='<p>作品の追加・検索は画面上部の「＋ 作品」から。ここでは同期状況とバックアップを管理します。</p>';
  page.prepend(intro);

  function fold(title,id){
    const details=document.createElement('details');
    details.id=id;details.className='movie30-data-fold';
    const summary=document.createElement('summary');summary.textContent=title;
    const content=document.createElement('div');content.className='movie30-data-fold-content';
    details.append(summary,content);
    return {details,content};
  }
  const backup=[...page.querySelectorAll(':scope > .panel')].find(p=>p.querySelector('#downloadJson'));
  if(backup){
    const title=backup.querySelector('h2');if(title)title.textContent='バックアップ';
    const tools=backup.querySelector('.tools');
    const advanced=fold('その他の書き出し・復元操作','movie30-data-backup-advanced');
    const otherExports=document.createElement('div');otherExports.className='tools';
    const csv=document.getElementById('downloadCsv');if(csv)otherExports.append(csv);
    if(otherExports.children.length)advanced.content.append(otherExports);
    const textarea=document.getElementById('backupText');
    if(textarea)advanced.content.append(textarea);
    const textTools=document.createElement('div');textTools.className='tools';
    for(const id of ['showBackup','copyBackup','restoreText']){
      const node=document.getElementById(id);
      if(node)textTools.append(node); // Preserve existing handlers.
    }
    if(textTools.children.length)advanced.content.append(textTools);
    const danger=document.getElementById('resetAll');
    if(danger){
      const caution=fold('全データ初期化（危険）','movie30-data-reset-danger');
      const warning=document.createElement('div');warning.className='movie30-data-info';
      warning.textContent='全評価・順位が消える操作です。通常は使わず、JSONバックアップを保存してください。';
      caution.content.append(warning,danger);
      danger.classList.add('movie30-data-danger');
      advanced.content.append(caution.details);
    }
    // Known HTML snapshot defect: keep the existing button/handler available
    // in DOM for future repair, but do not advertise a broken backup route.
    const html=document.getElementById('downloadHtml');
    if(html){html.hidden=false;html.classList.remove('hidden');advanced.content.append(html)}
    if(advanced.content.children.length)backup.append(advanced.details);
    // JSON remains the recommended data backup.
    const tip=backup.querySelector(':scope > .tip');
    if(tip)tip.textContent='通常は自動保存されます。機種変更や万一の復旧に備え、JSONバックアップを保存してください。';
    if(tools&&!tools.children.length)tools.remove();
  }
  // Save-storage explanations are already shown on the rankings page.
  for(const panel of page.querySelectorAll(':scope > .panel')){
    if(panel.querySelector('h2')?.textContent.trim()==='保存について')panel.classList.add('hidden');
  }

  // Keep Letterboxd and GitHub sync status + buttons in the primary view.
  // Put rarer imports, metadata fetching and credential controls in one expandable area.
  const secondary=fold('その他の取り込み・設定・データ整備','movie30-data-extra');
  const primary=new Set([duplicate,backup,
    document.getElementById('lbStatus')?.closest('.panel'),
    document.getElementById('gptSyncPanel'),intro]);
  for(const panel of [...page.children]){
    if(!panel.classList?.contains('panel')||primary.has(panel)||panel.classList.contains('hidden'))continue;
    secondary.content.append(panel);
  }
  if(secondary.content.children.length){
    if(backup)page.insertBefore(secondary.details,backup);
    else page.append(secondary.details);
  }
})();

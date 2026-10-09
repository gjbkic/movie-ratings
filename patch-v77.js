(() => {
  // v77: lossless Letterboxd review importer + compact, tap-to-expand editable notes.
  'use strict';
  const BUILD='20261010c';
  const noteKey='movie30-before-review-import-v77';
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const esc77=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const css=document.createElement('style');
  css.textContent=[
    '#note66.v66-note{height:70px;min-height:70px;max-height:70px;resize:none;overflow:hidden;cursor:pointer}',
    '.v77-notehint{font-size:10px;color:var(--muted);margin:-2px 0 8px}',
    '.v77-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100100;align-items:center;justify-content:center;padding:12px}',
    '.v77-backdrop.open{display:flex}',
    '.v77-editor{width:min(720px,100%);height:min(84dvh,800px);display:flex;flex-direction:column;gap:12px;background:#10161f;color:#f4f7fb;border:1px solid #3a4656;border-radius:15px;padding:15px;padding-bottom:max(15px,env(safe-area-inset-bottom))}',
    '.v77-editor h3{margin:0;font-size:17px}.v77-editor .v77-help{font-size:11px;color:#9aa7b8}',
    '.v77-editor textarea{flex:1;min-height:120px;width:100%;resize:none;border:1px solid #384658;border-radius:10px;background:#070b11;color:#f4f7fb;font-size:16px;line-height:1.6;padding:13px;white-space:pre-wrap}',
    '.v77-actions{display:flex;justify-content:flex-end;gap:10px}',
    '.v77-report{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65;color:var(--muted);margin-top:9px}',
    '.v77-report.ok{color:#a5e5ba}.v77-report.bad{color:#ffbbbb}',
    '.v77-panel .tip{line-height:1.6}'
  ].join('');
  document.head.appendChild(css);

  // Extend v66's existing detail sheet without changing its layout or score controls.
  const backdrop=document.createElement('div');
  backdrop.className='v77-backdrop';backdrop.id='memoOverlay77';
  backdrop.innerHTML='<div class="v77-editor" role="dialog" aria-modal="true" aria-labelledby="memoTitle77">'
    +'<h3 id="memoTitle77">レビューを表示・編集</h3>'
    +'<div class="v77-help">全文を表示しています。変更するときだけ「保存」を押してください。</div>'
    +'<textarea id="memoFull77" spellcheck="false"></textarea>'
    +'<div class="v77-actions"><button class="btn" id="memoCancel77">キャンセル</button><button class="btn active" id="memoSave77">保存</button></div>'
    +'</div>';
  document.body.appendChild(backdrop);
  let editingId=null;
  const fullText=document.getElementById('memoFull77');
  function dismiss(){backdrop.classList.remove('open');editingId=null;fullText.blur();}
  function launch(id){
    const f=filmById(id);if(!f)return;
    editingId=id;
    document.getElementById('memoTitle77').textContent=displayTitle(f)+' — レビュー全文';
    fullText.value=String(state.letterboxdMeta?.[id]?.note||'');
    backdrop.classList.add('open');
  }
  document.getElementById('memoCancel77').onclick=dismiss;
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)dismiss()});
  document.getElementById('memoSave77').onclick=()=>{
    if(!editingId)return;
    state.letterboxdMeta=state.letterboxdMeta||{};
    const v=fullText.value;
    const prev=state.letterboxdMeta[editingId]||{};
    state.letterboxdMeta[editingId]={...prev,note:v,noteSource:'manual',noteEditedAt:new Date().toISOString()};
    save();
    const box=document.getElementById('note66');
    if(box&&selectedId===editingId)box.value=v;
    dismiss();toast('レビューを保存しました');
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('open'))dismiss()});
  const previousSheet=openSheet;
  openSheet=function(id){
    previousSheet(id);
    const preview=document.getElementById('note66');
    if(!preview)return;
    preview.readOnly=true;
    preview.setAttribute('aria-label','レビュー全文を表示・編集');
    preview.title='タップで全文を表示・編集';
    preview.onclick=()=>launch(id);
    preview.onchange=null;
    preview.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();launch(id)}});
    const label=preview.previousElementSibling;
    if(label&&label.classList.contains('v66-lbl'))label.textContent='レビュー・一言メモ（タップで全文表示）';
  };

  async function zipText(file, wanted){
    const buf=await file.arrayBuffer();
    const bytes=new Uint8Array(buf),v=new DataView(buf);
    let eocd=-1;
    for(let p=buf.byteLength-22;p>=Math.max(0,buf.byteLength-65557);p--){
      if(v.getUint32(p,true)===0x06054b50){eocd=p;break;}
    }
    if(eocd<0)throw new Error('ZIPのファイル一覧を読み取れませんでした');
    const total=v.getUint16(eocd+10,true);
    let at=v.getUint32(eocd+16,true);
    const result={};
    const decode=new TextDecoder('utf-8');
    for(let i=0;i<total;i++){
      if(v.getUint32(at,true)!==0x02014b50)throw new Error('ZIPのファイル一覧が破損しています');
      const method=v.getUint16(at+10,true),compSize=v.getUint32(at+20,true);
      const nameLen=v.getUint16(at+28,true),extraLen=v.getUint16(at+30,true),commentLen=v.getUint16(at+32,true);
      const localAt=v.getUint32(at+42,true);
      const name=decode.decode(bytes.subarray(at+46,at+46+nameLen));
      if(wanted.includes(name)){
        if(v.getUint32(localAt,true)!==0x04034b50)throw new Error('ZIPの内部データが破損しています');
        const start=localAt+30+v.getUint16(localAt+26,true)+v.getUint16(localAt+28,true);
        const packed=bytes.slice(start,start+compSize);
        let raw;
        if(method===0)raw=packed;
        else if(method===8){
          try{
            if(typeof DecompressionStream!=='function')throw new Error('このブラウザではZIP展開に未対応です');
            const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            raw=new Uint8Array(await new Response(stream).arrayBuffer());
          }catch(err){
            throw new Error('ZIPの展開に失敗しました。下記のJSONファイルを利用するか、ZIP内のreviews.csvを選んでください。詳細: '+err.message);
          }
        }else throw new Error('ZIPの圧縮方式に未対応です: '+method);
        result[name]=decode.decode(raw);
      }
      at+=46+nameLen+extraLen+commentLen;
    }
    if(!result['reviews.csv'])throw new Error('ZIPにreviews.csvが含まれていません');
    return result;
  }
  function rowsFromCsv(raw,kind){
    const parsed=parseCsvText(String(raw||'').replace(/^\uFEFF/,''));
    if(!parsed||!parsed.length)return [];
    const head=parsed[0].map(x=>String(x).toLowerCase().trim());
    const get=(row,col)=>{const n=head.indexOf(col.toLowerCase());return n<0?'':String(row[n]||'')};
    if(!head.includes('name')||!head.includes('year')||!head.includes(kind==='reviews'?'review':'letterboxd uri')){
      throw new Error(kind+' のCSV列が正しくありません');
    }
    return parsed.slice(1).filter(r=>get(r,'Name')).map(row=>({
      title:get(row,'Name'),year:get(row,'Year'),
      ...(kind==='reviews'?{
        date:get(row,'Date'),watchedDate:get(row,'Watched Date'),rewatch:get(row,'Rewatch'),
        text:get(row,'Review'),reviewUrl:get(row,'Letterboxd URI')
      }:{uri:get(row,'Letterboxd URI')})
    }));
  }
  async function loadBundle(file){
    if(/\.json$/i.test(file.name)){
      const data=JSON.parse(await file.text());
      if(data.format!=='movie30-letterboxd-reviews-v1'||!Array.isArray(data.reviews))throw new Error('対応するレビューJSONではありません');
      return data;
    }
    if(/\.csv$/i.test(file.name)){
      return {reviews:rowsFromCsv(await file.text(),'reviews'),ratings:[],source:file.name};
    }
    const files=await zipText(file,['reviews.csv','orphaned/reviews.csv','ratings.csv']);
    const reviews=rowsFromCsv(files['reviews.csv'],'reviews');
    const orphan=files['orphaned/reviews.csv']?rowsFromCsv(files['orphaned/reviews.csv'],'reviews'):[];
    return {reviews:reviews.concat(orphan),ratings:files['ratings.csv']?rowsFromCsv(files['ratings.csv'],'ratings'):[],source:file.name};
  }
  function prepare(bundle){
    const films=allFilms();
    const alias=new Map();
    for(const f of films){
      const x=titleInfo(f);
      const opts=[displayTitle(f),x.title,x.englishTitle,x.originalTitle,f.lbTitle].filter(Boolean);
      for(const label of opts){
        const k=norm(label);
        if(!alias.has(k))alias.set(k,[]);
        if(!alias.get(k).includes(f))alias.get(k).push(f);
      }
    }
    const ratingByKey=new Map();
    for(const r of bundle.ratings||[]){
      const code=String(r.uri||'').match(/\/([0-9A-Za-z]+)\/?$/)?.[1];
      if(code)ratingByKey.set(norm(r.title)+'|'+r.year,code);
    }
    function findFilm(r){
      const title=norm(r.title),year=Number(r.year)||0;
      const filmCode=ratingByKey.get(title+'|'+r.year);
      if(filmCode){
        const codeMatch=films.filter(f=>new RegExp('^lb-\\d+-'+filmCode+'$').test(f.id));
        if(codeMatch.length===1)return codeMatch[0];
      }
      const possibles=alias.get(title)||[];
      if(possibles.length===1&&(!year||Math.abs(Number(possibles[0].year)-year)<=3))return possibles[0];
      const byYear=possibles.filter(f=>Number(f.year)===year);
      if(byYear.length===1)return byYear[0];
      const nearby=possibles.filter(f=>year&&Math.abs(Number(f.year)-year)<=2);
      if(nearby.length===1)return nearby[0];
      return null;
    }
    const grouped=new Map(),unmatched=[];
    let valid=0;
    for(const r of bundle.reviews){
      if(!String(r.text||'').trim())continue;
      valid++;
      const f=findFilm(r);
      if(!f){unmatched.push(r);continue;}
      if(!grouped.has(f.id))grouped.set(f.id,[]);
      grouped.get(f.id).push(r);
    }
    const notes=new Map();
    for(const [id,rs] of grouped){
      rs.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
      let text;
      if(rs.length===1)text=rs[0].text;
      else text=rs.map((r,i)=>{
        const day=r.watchedDate||r.date||'日付不明';
        return '【'+day+(r.rewatch==='Yes'?'・再鑑賞':'・記録'+(i+1))+'】\n'+r.text;
      }).join('\n\n────────────\n\n');
      notes.set(id,text);
    }
    return {notes,unmatched,valid,records:bundle.reviews.length,ratings:bundle.ratings?.length||0,multi:[...grouped.values()].filter(a=>a.length>1).length};
  }

  const dataPage=document.getElementById('page-data');
  if(dataPage){
    const panel=document.createElement('div');panel.className='panel v77-panel';
    panel.innerHTML='<h2>Letterboxdレビューを一括反映</h2>'
      +'<div class="tip">エクスポートZIP（reviews.csv＋ratings.csv）を読み込み、レビュー全文を映画ごとの一言メモへ登録します。再鑑賞の複数レビューも日付付きで全件保持。deleted内の削除済みレビューは除外します。<b>既存の一言メモは取り込みが成功した時点で置き換えます。</b> 点数・順位・ジャンルには触れません。</div>'
      +'<div class="tools"><label class="btn active">ZIP・レビューJSONを選択<input id="lbReviewFile77" type="file" accept=".zip,.json,.csv,application/zip,application/json,text/csv" hidden></label>'
      +'<button class="btn" id="lbReviewBackup77" type="button">置換前メモの控え</button></div>'
      +'<div class="v77-report" id="lbReviewStatus77">未取り込み。iPhoneの「ファイル」からLetterboxdのZIPを選択できます。</div>';
    dataPage.insertBefore(panel,dataPage.firstChild);
    const status=document.getElementById('lbReviewStatus77');
    function downloadOld(){
      let backup;
      try{backup=JSON.parse(localStorage.getItem(noteKey)||'null')}catch{}
      if(!backup){status.textContent='まだ置換前メモの控えはありません。';return;}
      download('movie30-before-letterboxd-reviews.json',JSON.stringify(backup,null,2),'application/json');
    }
    document.getElementById('lbReviewBackup77').onclick=downloadOld;
    document.getElementById('lbReviewFile77').onchange=async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      status.className='v77-report';
      status.textContent='ZIPのレビューを読み込み、作品照合中…';
      try{
        const bundle=await loadBundle(file),p=prepare(bundle);
        if(p.valid<100||p.notes.size<100)throw new Error('レビュー件数が想定より少ないため中止しました。レビュー本体のCSVかZIPを選んでください。');
        const existing=Object.entries(state.letterboxdMeta||{}).filter(([,m])=>typeof m.note==='string'&&m.note.trim()).map(([id,m])=>({id,title:displayTitle(filmById(id)||{id,title:id}),note:m.note}));
        const warn=p.unmatched.length?'一致しない作品 '+p.unmatched.length+'件（あとで画面に表示）\n':'';
        const yes=confirm('Letterboxdレビュー '+p.valid+'件を読み込みました。\n作品への一致 '+p.notes.size+'本、未一致 '+p.unmatched.length+'件。\n既存メモ '+existing.length+'件をレビューで置き換えます。\n\n点数や順位は変更しません。続行しますか？');
        if(!yes){status.textContent='確認画面でキャンセルしました。データは変更していません。';return;}
        try{localStorage.setItem(noteKey,JSON.stringify({createdAt:new Date().toISOString(),notes:existing}))}catch(err){console.warn('memo backup unavailable',err)}
        state.letterboxdMeta=state.letterboxdMeta||{};
        for(const m of Object.values(state.letterboxdMeta)){if(m&&typeof m==='object')delete m.note;}
        for(const [id,text] of p.notes){
          const old=state.letterboxdMeta[id]||{};
          state.letterboxdMeta[id]={...old,note:text,noteSource:'letterboxd-export',noteImportedAt:new Date().toISOString()};
        }
        save();
        const selected=selectedId&&filmById(selectedId);
        if(selected){
          const preview=document.getElementById('note66');
          if(preview)preview.value=state.letterboxdMeta[selected.id]?.note||'';
        }
        status.className='v77-report ok';
        status.textContent='反映完了：レビュー '+p.valid+'件（'+p.notes.size+'作品、うち複数レビュー '+p.multi+'作品）。'
          +'\n元の一言メモは '+existing.length+'件置換。控えは「置換前メモの控え」から取得可能。'
          +'\n作品が見つからず未反映 '+p.unmatched.length+'件。'
          +(p.unmatched.length?'\n未反映：'+p.unmatched.map(r=>r.title+' ('+r.year+')').join('、'):'')
          +'\n※点数・同点内順位・ジャンルは維持。';
        toast('Letterboxdレビュー '+p.notes.size+'作品を反映しました');
      }catch(err){
        console.error(err);
        status.className='v77-report bad';
        status.textContent='読み込みに失敗：'+String(err?.message||err);
      }
    };
  }
  window.__movie30ReviewImportBuild=BUILD;
})();
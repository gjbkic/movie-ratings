/* Fictional-file preview only. No app state, storage, fetch or sync access. */
(()=>{'use strict';
 const input=document.getElementById('source'),status=document.getElementById('status'),panel=document.getElementById('result');
 const summary=document.getElementById('summary'),rows=document.getElementById('rows');
 let sourceText='',candidateText='';
 function download(name,body){const url=URL.createObjectURL(new Blob([body],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
 document.getElementById('download-source').onclick=()=>sourceText&&download('fictional-before-score-change.json',sourceText);
 document.getElementById('download-candidate').onclick=()=>candidateText&&download('fictional-score-candidate.json',candidateText);
 function fictional(state){return Array.isArray(state?.customFilms)&&state.customFilms.length===740&&state.customFilms.every(f=>/^fixture-\d{4}$/.test(f?.id||'')&&/^架空作品 \d+$/.test(f?.title||''))&&new Set(state.customFilms.map(f=>f.id)).size===740&&Object.values(state.rankOrder||{}).flat().every(id=>/^fixture-\d{4}$/.test(id))}
 input.onchange=async()=>{
  panel.hidden=true;sourceText='';candidateText='';status.className='';
  try{
   const file=input.files?.[0];if(!file)throw Error('架空JSONを選んでください。');
   if(file.size>8*1024*1024)throw Error('ファイルが大きすぎます。');
   const raw=await file.text(),packageData=JSON.parse(raw),state=packageData.state||packageData;
   if(!fictional(state))throw Error('架空740作品のテストJSONだけを選んでください。');
   const plan=window.Movie30ScorePolicy.plan(state,[]);
   if(!plan.changed)throw Error('すでに新点数帯のJSONです。');
   const next=plan.target,ids=Object.values(state.rankOrder).flat(),nextIds=Object.entries(next.rankOrder).sort((a,b)=>Number(b[0])-Number(a[0])).flatMap(([,list])=>list);
   const beforeIds=Object.entries(state.rankOrder).sort((a,b)=>Number(b[0])-Number(a[0])).flatMap(([,list])=>list);
   if(JSON.stringify(beforeIds)!==JSON.stringify(nextIds))throw Error('順位全体の順番を維持できません。');
   sourceText=raw;
   candidateText=JSON.stringify({type:'fictional-score-preview-only',state:next},null,2)+'\n';
   const changed=plan.changes.filter(c=>c.before!==c.after);
   summary.textContent=`作品 ${state.customFilms.length}件 / 採点済み ${plan.changes.length}件\n点数が変わる作品 ${changed.length}件\n順位全体の順番: 同一\n星の表示: 各作品で同一\nレビュー・鑑賞履歴・ジャンル・シーズン・未知フィールド: 変換処理では変更なし\n変換後のポリシー: ${next.scorePolicy}\n適用状態: 未確定・未適用`;
   rows.replaceChildren();for(const item of changed.slice(0,20)){const tr=document.createElement('tr');for(const value of [item.id,item.before,item.after,item.star]){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}rows.append(tr)}
   panel.hidden=false;status.textContent='架空JSONの変換候補を作りました。現行アプリへは適用していません。';
  }catch(error){status.className='error';status.textContent=error.message||'読み込めませんでした。'}
 };
})();

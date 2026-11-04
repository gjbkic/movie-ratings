// Explicit, field-by-field conflict recovery. No state schema migration.
let movie30ConflictEntries=[];
document.addEventListener('DOMContentLoaded',()=>{
 const host=document.getElementById('page-data');if(!host)return;
 const button=document.createElement('button');button.textContent='競合の退避記録を確認';
 button.onclick=async()=>{const record=await movie30Record('multitab-conflicts');if(!record?.entries?.length){alert('退避記録はありません');return}movie30ConflictNotice(record.entries,true);await movie30RecoveryUi()};
 host.append(button);
});
async function movie30ArchiveConflictEntries(entries){
 const db=await openMovie30Db();if(!db)return false;
 return new Promise(resolve=>{try{
  const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),r=store.get('multitab-conflicts');
  r.onsuccess=()=>{const all=[...(r.result?.entries||[])];for(const e of [...movie30ConflictEntries,...entries])if(!all.some(x=>x.json===e.json))all.push(e);
   movie30ConflictEntries=all;
   if(all.length>12||all.reduce((n,e)=>n+e.json.length,0)>12000000){tx.abort();return}
   store.put({id:'multitab-conflicts',entries:all,active:true});
  };tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false);
 }catch(_){resolve(false)}});
}
async function movie30RecoveryPlan(leftJson=movie30UnsavedJson(),rightJson){
 return movie30WithLock(async()=>{
  const disk=await movie30ReadDisk();
  const valid=[disk.db,disk.local].filter(Boolean).filter(json=>movie30Candidate(json,'recovery'));
  if(!rightJson){
   // Divergent stores need an explicit choice, never a timestamp-based choice.
   if(valid.length===2&&movie30Payload(valid[0])!==movie30Payload(valid[1]))throw Error('保存先が異なります。比較する候補を選んでください');
   rightJson=valid[0];
  }
  if(!movie30Candidate(leftJson,'left')||!movie30Candidate(rightJson,'right'))throw Error('完全で整合する候補を選んでください');
  const left=JSON.parse(movie30Payload(leftJson)),right=JSON.parse(movie30Payload(rightJson)),diffs=[];
  const walk=(a,b,path,ha=true,hb=true)=>{
   if(ha&&hb&&JSON.stringify(a)===JSON.stringify(b))return;
   const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
   if(ha&&hb&&object(a)&&object(b)){
    for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],[...path,key],Object.hasOwn(a,key),Object.hasOwn(b,key));
   }else diffs.push({key:JSON.stringify(path),path,left:a,right:b,hasLeft:ha,hasRight:hb});
  };walk(left,right,[]);
  return {left,right,leftJson,rightJson,diffs,disk,local:movie30Payload(state)};
 });
}
async function movie30ResolveConflict(plan,choices){
 if(!plan||plan.diffs.some(d=>!['left','right'].includes(choices[d.key])))return false;
 return movie30WithLock(async()=>{
  const disk=await movie30ReadDisk();
  if(!movie30SameDisk(disk,plan.disk)||movie30Payload(state)!==plan.local){setSaveStatus('候補が更新されました · 再比較してください');return false}
  const merged=deepCopy(plan.left);
  for(const d of plan.diffs){const side=choices[d.key];let target=merged;
   for(const key of d.path.slice(0,-1))target=target[key];
   const key=d.path.at(-1),has=side==='left'?d.hasLeft:d.hasRight;
   if(has)Object.defineProperty(target,key,{value:deepCopy(d[side]),writable:true,configurable:true,enumerable:true});else delete target[key];
  }
  if(!movie30ValidState(merged)){setSaveStatus('選択結果が不完全です · 保存しません');return false}
  const ranks=Object.values(merged.rankOrder).flat();
  if(new Set(ranks).size!==ranks.length){setSaveStatus('順位が重複しています · 選択を見直してください');return false}
  const films=new Map([...BASE_FILMS,...merged.customFilms].map(f=>[f.id,f]));
  for(const [score,ids]of Object.entries(merged.rankOrder))for(const id of ids){
   const f=films.get(id),value=Object.hasOwn(merged.exactScores,id)?merged.exactScores[id]:f?.oldScore;
   if(!f||value==null||Number(value)!==Number(score)){setSaveStatus('点数と順位の選択が一致しません · 保存しません');return false}
  }
  const entries=[{source:'before-resolution',json:movie30UnsavedJson()},{source:'left-choice',json:plan.leftJson},{source:'right-choice',json:plan.rightJson},...Object.entries(disk).filter(([,json])=>json).map(([source,json])=>({source,json}))];
  if(!await movie30ArchiveConflictEntries(entries)){movie30ConflictNotice(entries,false);setSaveStatus('復帰前の退避に失敗 · 保存停止を維持');return false}
  if(movie30Payload(state)!==plan.local){setSaveStatus('退避中に編集されました · 再比較してください');return false}
  merged.updatedAt=Math.max(Date.now(),...entries.map(e=>{try{return Number(JSON.parse(e.json).updatedAt)||0}catch(_){return 0}}))+1;
  const raw=JSON.stringify(merged);merged.storageIntegrity={version:1,checksum:movie30Checksum(raw),films:merged.customFilms.length,ranks:ranks.length};
  const json=JSON.stringify(merged),parent=movie30Payload(disk.db||disk.local||movie30LastSavedJson);let localSaved=false;
  try{localStorage.setItem(STORAGE_KEY,json);localSaved=localStorage.getItem(STORAGE_KEY)===json}catch(_){}
  const receipt={parent,json,local:localSaved?json:disk.local};
  const dbSaved=await movie30WriteSnapshot(json,merged.updatedAt,receipt);
  const after=await movie30ReadDisk();
  if(!(localSaved||dbSaved)||(localSaved&&after.local!==json)||(dbSaved&&after.db!==json)){
   setSaveStatus('復帰の保存確認に失敗 · 停止を維持しJSONを保存してください');return false;
  }
  if(movie30Payload(state)!==plan.local)return movie30Conflict(after,'復帰保存中の追加編集を保護しました');
  // Both original candidates remain archived even after a successful resolution.
  const db=await openMovie30Db();
  const marked=await new Promise(resolve=>{try{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),r=store.get('multitab-conflicts');r.onsuccess=()=>store.put({...r.result,active:false,resolvedJson:json});tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false)}catch(_){resolve(false)}});
  if(!marked){setSaveStatus('選択結果は保存済み · 解決記録の確認に失敗しました。再比較してください');return false}
  if(movie30Payload(state)!==plan.local)return movie30Conflict(after,'解決記録中の追加編集を保護しました');
  state=normalizeState(merged);movie30LastSavedJson=json;movie30DiskBase=after;
  window.__movie30TabConflict=false;window.__movie30SaveFailed=false;
  document.getElementById('movie30-tab-conflict')?.remove();
  try{movie30Channel?.postMessage({...receipt,disk:after})}catch(_){}
  render();setSaveStatus('競合を解決して保存確認済み · 再読み込みで確認できます');return true;
 });
}
async function movie30RecoveryUi(){
 const host=document.getElementById('movie30-tab-conflict');if(!host)return;
 const old=host.querySelector('.movie30-recovery');old?.remove();
 const panel=document.createElement('div');panel.className='movie30-recovery';host.append(panel);
 const entries=[{source:'現在のタブ',json:movie30UnsavedJson()},...movie30ConflictEntries];
 const disk=await movie30ReadDisk();for(const [source,json]of Object.entries(disk))if(json)entries.push({source,json});
 const candidates=entries.filter((e,i)=>movie30Candidate(e.json,'choice')&&entries.findIndex(x=>movie30Payload(x.json)===movie30Payload(e.json))===i);
 const selects=[];
 for(const label of ['左の候補','右の候補']){const row=document.createElement('label');row.textContent=label;const select=document.createElement('select');candidates.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+' '+e.source;select.append(o)});row.append(select);panel.append(row);selects.push(select)}
 selects[1].value=String(Math.max(0,candidates.length-1));
 const compare=document.createElement('button');compare.textContent='候補を比較';panel.append(compare);
 const output=document.createElement('div');panel.append(output);
 compare.onclick=async()=>{output.replaceChildren();try{
  const plan=await movie30RecoveryPlan(candidates[selects[0].value].json,candidates[selects[1].value].json);if(!plan)return;
  const choices={};
  const note=document.createElement('p');note.textContent='配列（順位・作品一覧など）は全体を選択します。異なる全項目を明示的に選んでください。選ばなかった値も退避JSONに残ります。';output.append(note);
  for(const d of plan.diffs){const row=document.createElement('details'),title=document.createElement('summary');title.textContent=d.path.join(' / ');row.append(title);
   for(const side of ['left','right']){const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=(side==='left'?'左: ':'右: ')+(d[side]===undefined?'（項目なし）':JSON.stringify(d[side],null,2));row.append(pre)}
   const select=document.createElement('select');select.setAttribute('aria-label',d.path.join(' / '));for(const [value,text]of [['','選択してください'],['left','左を採用'],['right','右を採用']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)}select.onchange=()=>choices[d.key]=select.value;row.append(select);output.append(row);
  }
  const apply=document.createElement('button');apply.textContent='選択内容を退避・保存して復帰';output.append(apply);
  apply.onclick=async()=>{if(!confirm('明示的に選んだ値を保存します。両候補は退避に残ります。続けますか？'))return;apply.disabled=true;try{const ok=await movie30ResolveConflict(plan,choices);if(!ok){apply.disabled=false;alert('復帰できません。未選択項目・保存状態を確認し、必要なら再比較してください。')}}catch(e){apply.disabled=false;alert(e.message)}};
 }catch(e){output.textContent=e.message}};
}

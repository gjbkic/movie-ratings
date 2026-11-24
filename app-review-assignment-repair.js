/* Exact, source-verified cleanup of historical RSS positional-join contamination. */
(function(root){
'use strict';
const KEY='reviewAssignmentRepair20261125';
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fold=s=>String(s||'').replace(/\s+/g,' ').trim();
function find(text,body){
 if(!body)return null;
 const re=new RegExp(body.trim().split(/\s+/).map(esc).join('\\s+'),'u');
 const match=re.exec(text);return match?{start:match.index,end:match.index+match[0].length,text:match[0]}:null;
}
function repair(state,plan){
 const meta=state.letterboxdMeta||{},changes=[],restored=[],unresolved=[];
 const backup=(id,m)=>{if(!m[KEY])m[KEY]={beforeNote:String(m.note||''),removedRecords:{},at:new Date().toISOString()};return m[KEY]};
 for(const e of plan.entries){
  const m=meta[e.id];if(!m)continue;
  let text=String(m.note||''),removed=[];
  // Longer registered variants first, to avoid leaving a partial duplicate.
  const bodies=[...new Set(e.bodies)].sort((a,b)=>b.length-a.length);
  for(const body of bodies){
   let match=find(text,body);if(!match)continue;
   backup(e.id,m);
   while(match){
    let start=match.start,end=match.end;
    const prefix=text.slice(0,start),header=prefix.match(/【[^\n】]*】\s*$/u);
    if(header)start=header.index;
    removed.push(match.text);text=text.slice(0,start)+text.slice(end);
    match=find(text,body);
   }
  }
  if(removed.length){
   // Remove only empty separator blocks left by the verified deletion.
   text=text.replace(/(?:\s*─{4,}\s*){2,}/g,'\n\n────────────\n\n').replace(/^\s*─{4,}\s*|\s*─{4,}\s*$/g,'').trim();
   m.note=text;changes.push({id:e.id,guid:e.guid});
   const target=e.targetId&&meta[e.targetId];
   if(target){
    const missing=fold(target.note).includes(fold(e.canonicalBody))?[]:[e.canonicalBody];
    if(missing.length){backup(e.targetId,target);target.note=[target.note,...missing].filter(Boolean).join('\n\n────────────\n\n');restored.push({id:e.targetId,guid:e.guid})}
   }else unresolved.push({id:e.id,guid:e.guid,title:e.title,removedText:removed});
  }
  if(m.rssReviewRecords?.[e.guid]){
   backup(e.id,m).removedRecords[e.guid]=m.rssReviewRecords[e.guid];delete m.rssReviewRecords[e.guid];
   if(!changes.some(c=>c.id===e.id&&c.guid===e.guid))changes.push({id:e.id,guid:e.guid,recordOnly:true});
  }
 }
 // Any unresolvable original remains recoverable in this per-film journal.
 for(const u of unresolved){const m=meta[u.id];(m[KEY].unresolved||=[]).push(u)}
 return {changes,restored,unresolved};
}
if(typeof module!=='undefined'&&module.exports){module.exports={repair,find};return}
root.__movie30ReviewAssignmentRepair={repair};
Promise.resolve(root.__movie30StorageReady).then(async()=>{
 if(root.__movie30RecoveryBlocked)return;
 const response=await fetch('./review-assignment-repair-20261125.json');if(!response.ok)return;
 const result=repair(state,await response.json());
 if(result.changes.length||result.restored.length){await save();if(typeof render==='function')render()}
}).catch(error=>console.error('Review assignment cleanup failed',error));
})(typeof window!=='undefined'?window:globalThis);

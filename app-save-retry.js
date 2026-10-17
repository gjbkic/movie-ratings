/* Save failure controls; never restore or replace state. */
(() => {
  'use strict';
  const previous=movie30StorageWarning;
  movie30StorageWarning=function(failed,fallback){
    const result=previous.call(this,failed,fallback);
    const panel=document.getElementById('movie30-storage-warning');
    if(failed&&panel){
      const detail=document.createElement('div');
      detail.id='movie30-save-failure-detail';
      detail.textContent=document.getElementById('saveState')?.textContent||'';
      if(window.__movie30LastDbError)detail.textContent+=' / IndexedDB: '+window.__movie30LastDbError;
      panel.append(detail);
      const retry=document.createElement('button');retry.id='movie30-save-retry';
      retry.textContent='現在のデータの保存を再試行';
      retry.onclick=()=>{movie30InvalidateDb(movie30DbConnection);save()};
      panel.append(retry);
    }
    return result;
  };
  if(window.__movie30SaveFailed)movie30StorageWarning(true,false);
})();

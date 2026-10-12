(() => {
  const start = async () => {
    try {
      await window.__movie30StorageReady;
    } catch (_) {}
    if(window.__movie30RecoveryBlocked){
      const mask=document.getElementById('movie30-startup-mask');
      if(mask)mask.innerHTML='<div><strong>保存データの復元を停止しました</strong><span>元の保存記録は上書きしていません。</span><a href="./recovery-check.html">保存データの確認・バックアップ</a></div>';
      return;
    }
    window.__movie30BulkBoot = false;
    save(false);

    document.querySelectorAll(".tab").forEach(button => {
      button.onclick = () => {
        view.page = button.dataset.page;
        save();
        render();
      };
    });

    const build = document.getElementById('movie30BuildV29');
    if (build) build.textContent = 'app build 20261012ae';

    try {
      // All saved candidates have been read and raw local records archived.
      render();
      document.documentElement.classList.add('movie30-ready');
      document.getElementById('movie30-startup-mask')?.remove();
      setTimeout(() => window.__movie30AutoSyncPending?.(), 1500);
    } catch (error) {
      console.error('Movie app startup failed', error);
      const mask = document.getElementById('movie30-startup-mask');
      if (mask) {
        mask.innerHTML = '<div><strong>画面を開けませんでした</strong><span>保存データは変更していません。別ページで状態を確認できます。</span><a href="./recovery-check.html" style="display:inline-block;margin-top:16px;color:#9bc7ff">保存データの確認・バックアップ</a></div>';
      }
    }
  };

  // Give Safari one paint opportunity to show the loading screen before the
  // first full-library render.
  requestAnimationFrame(() => requestAnimationFrame(start));
})();

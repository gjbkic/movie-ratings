(() => {
  const start = async () => {
    try {
      await Promise.race([
        window.__movie30StorageReady || Promise.resolve(),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
    } catch (_) {}
    window.__movie30BulkBoot = false;

    document.querySelectorAll(".tab").forEach(button => {
      button.onclick = () => {
        view.page = button.dataset.page;
        save();
        render();
      };
    });

    const build = document.getElementById('movie30BuildV29');
    if (build) build.textContent = 'app build 20261012n';

    try {
      // The state is already loaded in memory. Writing it again during startup
      // serializes the full library and rotates backups on every launch.
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

(() => {
  window.__movie30BulkBoot = false;
  save();
  render();
  const build = document.getElementById('movie30BuildV29');
  if (build) build.textContent = 'app build 20261012j';
  document.documentElement.classList.add('movie30-ready');
  document.getElementById('movie30-startup-mask')?.remove();
  setTimeout(() => window.__movie30AutoSyncPending?.(), 1500);
})();

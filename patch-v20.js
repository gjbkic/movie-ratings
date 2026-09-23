(() => {
  const AUTO_LINE = document.getElementById('lbAutoSync')?.closest('.checkline');
  const autoBox = document.getElementById('lbAutoSync');
  if (autoBox) {
    autoBox.checked = false;
    autoBox.disabled = true;
  }
  if (AUTO_LINE) AUTO_LINE.style.display = 'none';
  try {
    const st = getLbSettings();
    saveLbSettings({ username: (document.getElementById('lbUsername')?.value || st.username || 'gjbkic').trim(), auto: false });
  } catch (_) {}

  function withTimeout(promise, ms = 18000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('タイムアウト')), ms))
    ]);
  }

  function sliceRss(text) {
    const s = String(text || '');
    const start = s.search(/<rss\b/i);
    const end = s.toLowerCase().lastIndexOf('</rss>');
    return start >= 0 && end >= 0 && end > start ? s.slice(start, end + 6) : '';
  }

  function decodeHtmlEntities(text) {
    try {
      const ta = document.createElement('textarea');
      ta.innerHTML = text;
      return ta.value;
    } catch (_) { return text; }
  }

  function extractRss(text) {
    let rss = sliceRss(text);
    if (rss) return rss;
    const decoded = decodeHtmlEntities(String(text || ''));
    rss = sliceRss(decoded);
    if (rss) return rss;
    try {
      const doc = new DOMParser().parseFromString(String(text || ''), 'text/html');
      rss = sliceRss(doc.body?.textContent || '');
      if (rss) return rss;
    } catch (_) {}
    return '';
  }

  function escXml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  }

  function starsToRating(stars) {
    const s = String(stars || '');
    const whole = (s.match(/★/g) || []).length;
    const half = s.includes('½') ? 0.5 : 0;
    const n = whole + half;
    return n > 0 ? n : null;
  }

  function rss2JsonToXml(data) {
    if (!data || data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('RSS変換結果が不正です');
    const items = [];
    for (const x of data.items) {
      const title = String(x.title || '').trim();
      const m = title.match(/^(.*),\s*(\d{4})\s*-\s*(★{0,5}(?:½)?|½)\s*$/u);
      if (!m) continue;
      const rating = starsToRating(m[3]);
      if (!rating) continue;
      items.push(`<item><filmTitle>${escXml(m[1].trim())}</filmTitle><filmYear>${escXml(m[2])}</filmYear><memberRating>${rating}</memberRating><link>${escXml(x.link || '')}</link></item>`);
    }
    if (!items.length) throw new Error('最新ログを解析できませんでした');
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${items.join('')}</channel></rss>`;
  }

  async function fetchViaJina(url) {
    const endpoint = 'https://r.jina.ai/' + url;
    const r = await withTimeout(fetch(endpoint, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/plain,text/html,*/*',
        'X-No-Cache': 'true',
        'X-Cache-Tolerance': '0',
        'X-Respond-With': 'html'
      }
    }), 20000);
    if (!r.ok) throw new Error(`Jina HTTP ${r.status}`);
    const text = await r.text();
    const xml = extractRss(text);
    if (!xml) throw new Error('JinaからRSS本文を取り出せませんでした');
    return xml;
  }

  async function fetchViaRss2Json(url) {
    const endpoint = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url) + '&_=' + Date.now();
    const r = await withTimeout(fetch(endpoint, {cache:'no-store', headers:{Accept:'application/json'}}), 15000);
    if (!r.ok) throw new Error(`rss2json HTTP ${r.status}`);
    return rss2JsonToXml(await r.json());
  }

  async function fetchCachedSnapshot(username) {
    if (String(username).toLowerCase() !== 'gjbkic') throw new Error('保存済みRSSなし');
    const r = await withTimeout(fetch('./letterboxd-gjbkic.xml?v=' + Date.now(), {cache:'no-store'}), 8000);
    if (!r.ok) throw new Error(`保存済みRSS HTTP ${r.status}`);
    const text = await r.text();
    if (!/<(?:rss|item)[\s>]/i.test(text)) throw new Error('保存済みRSS形式エラー');
    return text;
  }

  fetchLbRss = async function(username) {
    const clean = String(username || 'gjbkic').trim() || 'gjbkic';
    const url = `https://letterboxd.com/${encodeURIComponent(clean)}/rss/`;
    const errors = [];
    window.__movie30LbFetchSource = '';

    try {
      const xml = await fetchViaJina(url);
      window.__movie30LbFetchSource = 'fresh-jina';
      return xml;
    } catch (e) { errors.push(e?.message || String(e)); }

    try {
      const xml = await fetchViaRss2Json(url);
      window.__movie30LbFetchSource = 'fresh-rss2json';
      return xml;
    } catch (e) { errors.push(e?.message || String(e)); }

    try {
      const xml = await fetchCachedSnapshot(clean);
      window.__movie30LbFetchSource = 'cached';
      return xml;
    } catch (e) { errors.push(e?.message || String(e)); }

    throw new Error('最新RSSを取得できませんでした：' + errors.join(' / '));
  };

  const previousSync = syncLetterboxd;
  syncLetterboxd = async function(silent = false) {
    if (silent) return;
    const btn = document.getElementById('syncLetterboxd');
    const oldText = btn?.textContent || '今すぐ同期';
    if (btn) { btn.disabled = true; btn.textContent = '最新を取得中…'; }
    setLbStatus('Letterboxdの最新ログをその場で取得しています…');
    try {
      await previousSync(false);
      const status = document.getElementById('lbStatus');
      if (status && !status.classList.contains('bad')) {
        const src = window.__movie30LbFetchSource;
        if (src === 'cached') {
          status.textContent += '（最新取得に失敗したため、最後に保存したRSSを使用）';
          status.classList.remove('ok');
        } else if (src) {
          status.textContent += ' · 最新ログ取得済み';
        }
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
    }
  };

  const syncBtn = document.getElementById('syncLetterboxd');
  if (syncBtn) syncBtn.onclick = () => syncLetterboxd(false);

  const panel = syncBtn?.closest('.panel');
  if (panel) {
    const tip = panel.querySelector('.tip');
    if (tip) tip.textContent = '「今すぐ同期」を押した時だけ、Letterboxdの最新ログを取得します。定期取得はしません。Letterboxdで記録した直後に押せば、その場で取り込めます。';
  }
})();
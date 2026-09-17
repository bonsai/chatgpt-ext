(() => {
  if (window.__bonsaiGitHubLive) return;
  window.__bonsaiGitHubLive = true;

  const API = 'https://api.github.com';
  const USER = 'bonsai';
  const POLL_MS = 30_000;
  let timer;
  let tab = 'now';
  let cache = { repos: [], issues: [] };

  const sessionId = () => {
    const m = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    return m ? m[1] : `page:${location.pathname}`;
  };

  const root = document.createElement('div');
  root.id = 'bonsai-gh-live';
  root.innerHTML = `
    <button id="gh-live-toggle" title="GitHub Context">GH</button>
    <section id="gh-live-panel" hidden>
      <header><b>GH Context</b><span id="gh-live-status">loading…</span></header>
      <div class="gh-tabs">
        <button data-tab="now">NOW</button>
        <button data-tab="related">RELATED</button>
        <button data-tab="activity">ACTIVITY</button>
        <button data-tab="journal">JOURNAL</button>
      </div>
      <div id="gh-live-list"></div>
    </section>`;
  document.documentElement.appendChild(root);

  const panel = root.querySelector('#gh-live-panel');
  const list = root.querySelector('#gh-live-list');
  const status = root.querySelector('#gh-live-status');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const headers = async () => {
    const { githubToken } = await chrome.storage.local.get('githubToken');
    return githubToken
      ? { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' }
      : { Accept: 'application/vnd.github+json' };
  };

  async function api(path) {
    const res = await fetch(API + path, { headers: await headers(), cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function item(title, meta, url) {
    return `<a class="gh-item" href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(title)}</b><span>${esc(meta)}</span></a>`;
  }

  async function sync() {
    const repos = await api(`/users/${USER}/repos?per_page=100&sort=updated&direction=desc&type=owner`);
    const issues = await api(`/search/issues?q=user:${USER}+is:issue&sort=updated&order=desc&per_page=30`);
    cache.repos = repos.filter(r => !r.fork);
    cache.issues = issues.items || [];
  }

  function renderNow() {
    const repos = cache.repos.slice(0, 12);
    const issues = cache.issues.slice(0, 8);
    list.innerHTML = `
      <div class="gh-section"><strong>SESSION</strong><span>${esc(sessionId())}</span></div>
      <div class="gh-section"><strong>ACTIVE REPOS</strong></div>
      ${repos.map(r => item(r.full_name, `${r.language || '—'} · ${new Date(r.pushed_at || r.updated_at).toLocaleString()}`, r.html_url)).join('')}
      <div class="gh-section"><strong>OPEN / RECENT ISSUES</strong></div>
      ${issues.map(i => item(`${i.repository_url.split('/').pop()} #${i.number} — ${i.title}`, `${i.state} · ${new Date(i.updated_at).toLocaleString()}`, i.html_url)).join('') || '<div class="gh-empty">No issues</div>'}`;
  }

  function renderRelated() {
    const text = document.title.toLowerCase() + ' ' + location.pathname.toLowerCase();
    const words = text.split(/[^a-z0-9_-]+/).filter(w => w.length > 3);
    const related = cache.repos
      .map(r => ({ r, score: words.reduce((n, w) => n + (r.name.toLowerCase().includes(w) ? 3 : r.description?.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.r.pushed_at) - new Date(a.r.pushed_at))
      .slice(0, 20);
    list.innerHTML = `<div class="gh-section"><strong>RELATED TO THIS SESSION</strong><span>title / URL based</span></div>${related.map(x => item(x.r.full_name, `${x.r.language || '—'} · match ${x.score}`, x.r.html_url)).join('') || '<div class="gh-empty">関連repoを検出できませんでした</div>'}`;
  }

  function renderActivity() {
    const events = [
      ...cache.repos.map(r => ({ date: r.pushed_at || r.updated_at, title: r.full_name, meta: `${r.language || 'repo'} · repository`, url: r.html_url })),
      ...cache.issues.map(i => ({ date: i.updated_at, title: `${i.repository_url.split('/').pop()} #${i.number} — ${i.title}`, meta: `${i.state} · issue`, url: i.html_url }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
    list.innerHTML = `<div class="gh-section"><strong>ACTIVITY</strong><span>repo / issue unified timeline</span></div>${events.map(e => item(e.title, `${e.meta} · ${new Date(e.date).toLocaleString()}`, e.url)).join('')}`;
  }

  async function loadJournal() {
    const { journal = [] } = await chrome.storage.local.get('journal');
    const entries = journal.filter(x => x.session_id === sessionId()).slice(0, 30);
    list.innerHTML = `
      <form id="gh-journal-form" class="gh-journal-form">
        <input id="gh-journal-repo" placeholder="repo (例: bonsai/chatgpt.com-ext)" autocomplete="off">
        <textarea id="gh-journal-note" rows="3" placeholder="このセッションのメモ…"></textarea>
        <button type="submit">保存</button>
      </form>
      <div class="gh-session">session: ${esc(sessionId())}</div>
      ${entries.map(x => `<article class="gh-journal-entry"><b>${esc(x.repo || '—')}</b><span>${esc(new Date(x.timestamp).toLocaleString())}</span><p>${esc(x.body)}</p></article>`).join('') || '<div class="gh-empty">Journalはまだありません</div>'}`;
    list.querySelector('#gh-journal-form').onsubmit = async e => {
      e.preventDefault();
      const repo = list.querySelector('#gh-journal-repo').value.trim();
      const body = list.querySelector('#gh-journal-note').value.trim();
      if (!body) return;
      const data = await chrome.storage.local.get('journal');
      const journal = Array.isArray(data.journal) ? data.journal : [];
      journal.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), session_id: sessionId(), repo, type: 'note', title: body.slice(0, 80), body, source: 'bonsai/chatgpt.com-ext' });
      await chrome.storage.local.set({ journal: journal.slice(0, 1000) });
      loadJournal();
    };
  }

  async function load() {
    status.textContent = 'sync…';
    try {
      if (tab !== 'journal') await sync();
      if (tab === 'now') renderNow();
      if (tab === 'related') renderRelated();
      if (tab === 'activity') renderActivity();
      if (tab === 'journal') await loadJournal();
      status.textContent = `live · ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      status.textContent = 'error';
      list.innerHTML = `<div class="gh-error">${esc(e.message)}<br><small>Private repos require a GitHub token.</small></div>`;
    }
  }

  root.querySelector('#gh-live-toggle').onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) load();
  };
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; load(); });
  timer = setInterval(() => { if (!panel.hidden) load(); }, POLL_MS);
})();

(() => {
  if (window.__bonsaiGitHubLive) return;
  window.__bonsaiGitHubLive = true;

  const API = 'https://api.github.com';
  const USER = 'bonsai';
  const POLL_MS = 30_000;
  let timer;
  let tab = 'repos';

  const sessionId = () => {
    const m = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    return m ? m[1] : `page:${location.pathname}`;
  };

  const root = document.createElement('div');
  root.id = 'bonsai-gh-live';
  root.innerHTML = `
    <button id="gh-live-toggle" title="GitHub Live">GH</button>
    <section id="gh-live-panel" hidden>
      <header><b>GitHub Live</b><span id="gh-live-status">loading…</span></header>
      <div class="gh-tabs">
        <button data-tab="repos">Repos</button>
        <button data-tab="issues">Issues</button>
        <button data-tab="journal">Journal</button>
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

  function render(items) {
    list.innerHTML = items.map(x => `<a class="gh-item" href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.title)}</b><span>${esc(x.meta)}</span></a>`).join('') || '<div class="gh-empty">No data</div>';
  }

  async function loadJournal() {
    const { journal = [] } = await chrome.storage.local.get('journal');
    const entries = journal.filter(x => x.session_id === sessionId()).slice(0, 30);
    list.innerHTML = `
      <form id="gh-journal-form" class="gh-journal-form">
        <input id="gh-journal-repo" placeholder="repo (例: bonsai/chatgpt.com-ext)" autocomplete="off">
        <textarea id="gh-journal-note" rows="3" placeholder="このセッションのメモ…"></textarea>
        <button type="submit">Journalに保存</button>
      </form>
      <div class="gh-session">session: ${esc(sessionId())}</div>
      ${entries.map(x => `<article class="gh-journal-entry"><b>${esc(x.repo || '—')}</b><span>${esc(new Date(x.timestamp).toLocaleString())}</span><p>${esc(x.body)}</p></article>`).join('') || '<div class="gh-empty">このセッションのJournalはまだありません</div>'}`;

    list.querySelector('#gh-journal-form').onsubmit = async e => {
      e.preventDefault();
      const repo = list.querySelector('#gh-journal-repo').value.trim();
      const body = list.querySelector('#gh-journal-note').value.trim();
      if (!body) return;
      const data = await chrome.storage.local.get('journal');
      const journal = Array.isArray(data.journal) ? data.journal : [];
      journal.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        session_id: sessionId(),
        repo,
        type: 'note',
        title: body.slice(0, 80),
        body,
        source: 'bonsai/chatgpt.com-ext'
      });
      await chrome.storage.local.set({ journal: journal.slice(0, 1000) });
      loadJournal();
    };
  }

  async function load() {
    status.textContent = 'sync…';
    try {
      if (tab === 'journal') {
        await loadJournal();
        status.textContent = `session · ${new Date().toLocaleTimeString()}`;
        return;
      }
      if (tab === 'repos') {
        const repos = await api(`/users/${USER}/repos?per_page=30&sort=updated&direction=desc&type=owner`);
        render(repos.filter(r => !r.fork).slice(0, 20).map(r => ({
          title: r.full_name,
          meta: `${r.language || '—'} · updated ${new Date(r.updated_at).toLocaleString()}`,
          url: r.html_url
        })));
      } else {
        const issues = await api(`/search/issues?q=user:${USER}+is:issue&sort=updated&order=desc&per_page=30`);
        render(issues.items.slice(0, 30).map(i => ({
          title: `${i.repository_url.split('/').pop()} #${i.number} — ${i.title}`,
          meta: `${i.state} · ${new Date(i.updated_at).toLocaleString()}`,
          url: i.html_url
        })));
      }
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
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    load();
  });
  timer = setInterval(() => { if (!panel.hidden) load(); }, POLL_MS);
})();

(() => {
  const app = document.querySelector('#app');
  const syncState = document.querySelector('#sync-state');
  const errorBox = document.querySelector('#error');
  const API = 'https://api.github.com';
  const state = { view: 'resume', user: null, repos: [], issues: [], runs: [], tabs: [], fetchedAt: null };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const gh = (url) => `https://github.com/${url}`;
  const apiHeaders = async () => {
    const { githubToken } = await chrome.storage.local.get('githubToken');
    return { Accept: 'application/vnd.github+json', ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}) };
  };
  async function request(path) {
    const response = await fetch(`${API}${path}`, { headers: await apiHeaders(), cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }
  async function allPages(path) {
    const items = [];
    for (let page = 1; page <= 20; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = await request(`${path}${separator}per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }
  const open = (url) => chrome.runtime.sendMessage({ type: 'open-github', url });
  const statusBadge = (status) => `<span class="badge ${status === 'failure' || status === 'failed' ? 'fail' : status === 'success' ? 'ok' : ''}">${esc(status || 'unknown')}</span>`;
  const row = (title, meta, url, status = '') => `<div class="row"><div><a href="${esc(url)}" data-open="${esc(url)}">${esc(title)}</a><div class="muted">${esc(meta)}</div></div>${statusBadge(status)}</div>`;

  async function sync() {
    errorBox.textContent = '';
    syncState.textContent = '同期中…';
    try {
      const user = await request('/user');
      const [repos, issues] = await Promise.all([allPages('/user/repos?sort=updated&direction=desc'), request('/user/issues?filter=assigned&state=open&sort=updated&direction=desc&per_page=100')]);
      state.user = user; state.repos = repos; state.issues = issues.filter((i) => !i.pull_request);
      state.runs = [];
      for (const repo of state.repos.slice(0, 12)) {
        try { const runs = await request(`/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/actions/runs?per_page=5`); state.runs.push(...(runs.workflow_runs || []).map((run) => ({ ...run, repo: repo.full_name }))); } catch (_) { /* permission varies per repo */ }
      }
      state.runs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      state.tabs = await chrome.tabs.query({});
      state.fetchedAt = new Date();
      await chrome.storage.local.set({ workspaceCache: { repos: state.repos, issues: state.issues, runs: state.runs, fetchedAt: state.fetchedAt.toISOString() } });
      syncState.textContent = `更新 ${state.fetchedAt.toLocaleTimeString()}`;
      render();
    } catch (error) {
      errorBox.textContent = error.message.includes('401') ? 'Tokenを設定してください' : error.message;
      syncState.textContent = '同期失敗';
      render();
    }
  }
  async function loadCache() {
    const cached = (await chrome.storage.local.get('workspaceCache')).workspaceCache;
    if (cached) { Object.assign(state, cached, { fetchedAt: new Date(cached.fetchedAt) }); syncState.textContent = `キャッシュ ${state.fetchedAt.toLocaleTimeString()}`; }
    state.tabs = await chrome.tabs.query({});
  }
  function render() {
    const content = document.createElement('div'); content.className = 'content';
    if (state.view === 'resume') {
      const latest = [...state.issues, ...state.runs].sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0))[0];
      content.innerHTML = `<section class="card"><h3>昨日の続き</h3><p>${latest ? esc(latest.title || `${latest.repo} Actions`) : 'まだ作業記録がありません'}</p><p class="muted">${latest ? esc(latest.repo || latest.html_url || '') : 'Issueを開いて作業を始めてください'}</p><button class="primary" data-view="issues">続ける</button></section><div class="stats"><div class="stat"><b>${state.issues.length}</b><span>open issues</span></div><div class="stat"><b>${state.runs.filter((r) => r.conclusion === 'failure').length}</b><span>failed actions</span></div><div class="stat"><b>${state.repos.length}</b><span>repositories</span></div><div class="stat"><b>${state.tabs.length}</b><span>open tabs</span></div></div>`;
    } else if (state.view === 'sessions') {
      content.innerHTML = `<h3>最近のタブ</h3>${state.tabs.filter((t) => t.url && /^https:\/\/(github|chatgpt)\.com/.test(t.url)).slice(0, 30).map((t) => row(t.title || t.url, t.url, t.url, t.active ? 'active' : 'idle')).join('') || '<div class="empty">対象タブがありません</div>'}`;
    } else if (state.view === 'repos') {
      content.innerHTML = `<h3>Repositories (${state.repos.length})</h3><button class="primary" data-url="https://github.com/new">＋ New repository</button>${state.repos.slice(0, 50).map((r) => row(r.full_name, `${r.language || '—'} · ${r.visibility || 'public'} · ${new Date(r.pushed_at || r.updated_at).toLocaleDateString()}`, r.html_url)).join('') || '<div class="empty">Tokenを設定してrepoを同期してください</div>'}`;
    } else if (state.view === 'issues') {
      content.innerHTML = `<h3>Assigned Issues (${state.issues.length})</h3>${state.issues.slice(0, 50).map((i) => row(`#${i.number} ${i.title}`, `${i.repository?.full_name || ''} · ${i.user?.login || ''}`, i.html_url, i.state)).join('') || '<div class="empty">未完了の担当Issueはありません</div>'}`;
    } else if (state.view === 'actions') {
      content.innerHTML = `<h3>Actions</h3>${state.runs.slice(0, 60).map((r) => row(`${r.repo} · ${r.name}`, `${r.event || ''} · ${new Date(r.updated_at).toLocaleString()}`, r.html_url, r.conclusion || r.status)).join('') || '<div class="empty">Actionsを取得できるrepoがありません</div>'}`;
    } else if (state.view === 'deploy') {
      content.innerHTML = `<section class="card"><h3>Deploy</h3><p>Pages / workflow / deploy操作の入口です。</p><p class="muted">書き込み操作は次のスケルトン段階で確認ダイアログを追加します。</p><button class="secondary" data-url="https://github.com/${esc(state.repos[0]?.full_name || '')}/settings/pages">Pages settings</button></section>`;
    } else {
      content.innerHTML = `<section class="card"><h3>Skills</h3><p>aw Markdownを選び、Web ChatGPTへPromptを渡します。</p><p class="muted">スケルトン: skills/ の同梱とPrompt生成を次段で実装。</p><button class="secondary" data-url="https://chatgpt.com/">ChatGPTを開く</button></section>`;
    }
    app.replaceChildren(content);
    app.querySelectorAll('[data-open],[data-url]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); open(el.dataset.open || el.dataset.url); }));
    app.querySelectorAll('[data-view]').forEach((el) => el.addEventListener('click', () => { state.view = el.dataset.view; document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view)); render(); }));
  }
  document.querySelector('#tabs').addEventListener('click', (event) => { const button = event.target.closest('button'); if (!button) return; state.view = button.dataset.view; document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === button)); render(); });
  document.querySelector('#refresh').addEventListener('click', sync);
  document.querySelector('#settings').addEventListener('click', () => { document.querySelector('#token-form').hidden = !document.querySelector('#token-form').hidden; });
  document.querySelector('#clear-token').addEventListener('click', async () => { await chrome.storage.local.remove('githubToken'); document.querySelector('#token').value = ''; sync(); });
  document.querySelector('#token-form').addEventListener('submit', async (event) => { event.preventDefault(); const token = document.querySelector('#token').value.trim(); if (!token) return; await chrome.storage.local.set({ githubToken: token }); document.querySelector('#token-form').hidden = true; sync(); });
  loadCache().then(render).then(sync);
})();

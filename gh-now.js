(() => {
  const API = 'https://api.github.com';
  const root = document.createElement('section');
  root.id = 'gh-now';
  root.className = 'card';
  root.innerHTML = '<h3>GH NOW</h3><p class="muted">読み込み中…</p>';
  document.querySelector('#app')?.before(root);

  const style = document.createElement('style');
  style.textContent = '#gh-now{margin:10px 10px 0}#gh-now h3{margin-top:0}.now-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.now-item{padding:7px;border:1px solid #ddd;border-radius:7px}.now-item a{display:block}.now-actions{margin-top:8px}.now-actions button{margin:3px 3px 0 0}.now-error{font-size:12px}.now-ok{color:#176b3a}.now-fail{color:#b42318}.now-debug{margin-top:6px;padding:6px;border-top:1px solid #eee}.now-debug pre{white-space:pre-wrap;font-size:11px;max-height:120px;overflow:auto}.now-debug button{margin-right:4px}';
  document.head.appendChild(style);

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const headers = async () => {
    const { githubToken } = await chrome.storage.local.get('githubToken');
    return { Accept: 'application/vnd.github+json', ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}) };
  };
  async function api(path) {
    const res = await fetch(API + path, { headers: await headers(), cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  function parseIssue(url) {
    const m = String(url || '').match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
  }
  function parseRepo(url) {
    const m = String(url || '').match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
    return m ? { owner: m[1], repo: m[2] } : null;
  }
  const open = (url) => chrome.runtime.sendMessage({ type: 'open-github', url });

  async function activeGithub() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function load() {
    try {
      const tab = await activeGithub();
      const issue = parseIssue(tab?.url);
      const repo = issue || parseRepo(tab?.url);
      const [assigned, notifications, reviews] = await Promise.all([
        api('/user/issues?filter=assigned&state=open&per_page=20'),
        api('/notifications?all=false&participating=false&per_page=20'),
        api('/search/issues?q=review-requested:@me+is:pr+is:open&sort=updated&order=desc&per_page=20')
      ]);

      let runs = [];
      if (repo) {
        const data = await api(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/runs?per_page=8`);
        runs = data.workflow_runs || [];
      }

      const failed = runs.filter((r) => r.conclusion === 'failure');
      const active = runs.filter((r) => ['queued', 'in_progress'].includes(r.status));
      const issueRows = (assigned || []).filter((x) => !x.pull_request).slice(0, 4);
      const reviewRows = (reviews.items || []).slice(0, 4);
      const mentionRows = (notifications || []).filter((x) => ['mention', 'subscribed', 'team_mention'].includes(x.reason)).slice(0, 4);
      const current = issue ? await api(`/repos/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repo)}/issues/${issue.number}`) : null;

      root.innerHTML = `
        <h3>GH NOW</h3>
        ${current ? `<div class="now-item"><b>現在のIssue</b><a href="${esc(current.html_url)}" data-url="${esc(current.html_url)}">#${current.number} ${esc(current.title)}</a><span class="muted">${esc(current.state)}</span></div>` : '<p class="muted">現在のIssueページではありません。</p>'}
        <div class="now-grid">
          <div class="now-item"><b>担当Issue</b><span>${issueRows.length}</span>${issueRows.map(x => `<a href="${esc(x.html_url)}" data-url="${esc(x.html_url)}">#${x.number} ${esc(x.title)}</a>`).join('')}</div>
          <div class="now-item"><b>レビュー待ちPR</b><span>${reviewRows.length}</span>${reviewRows.map(x => `<a href="${esc(x.html_url)}" data-url="${esc(x.html_url)}">#${x.number} ${esc(x.title)}</a>`).join('')}</div>
          <div class="now-item"><b>メンション</b><span>${mentionRows.length}</span>${mentionRows.map(x => `<a href="${esc(x.subject?.url || '#')}" data-url="${esc(x.subject?.url || '#')}">${esc(x.subject?.title || x.repository?.full_name || 'notification')}</a>`).join('')}</div>
          <div class="now-item"><b>CI / Actions</b><span class="${failed.length ? 'now-fail' : 'now-ok'}">${failed.length} failed · ${active.length} active</span></div>
        </div>
        <div class="now-actions">
          ${failed.map(r => `<div class="now-item"><b>❌ ${esc(r.name)}</b><span class="muted">${esc(r.head_branch || '')} · ${esc(r.head_sha?.slice(0, 7) || '')}</span><button data-debug="${esc(r.id)}">ChatGPTでデバッグ</button><button data-url="${esc(r.html_url)}">Runを開く</button><div id="debug-${esc(r.id)}"></div></div>`).join('')}
          ${active.map(r => `<div class="now-item"><b>⏳ ${esc(r.name)}</b><span class="muted">${esc(r.head_branch || '')}</span><button data-url="${esc(r.html_url)}">Runを開く</button></div>`).join('')}
          ${!failed.length && !active.length ? '<span class="muted">対象repoの失敗・実行中Actionsはありません。</span>' : ''}
        </div>`;

      root.querySelectorAll('[data-url]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); open(el.dataset.url); }));
      root.querySelectorAll('[data-debug]').forEach((el) => el.addEventListener('click', async () => debugRun(repo, runs.find(r => String(r.id) === el.dataset.debug), el)));
    } catch (error) {
      root.innerHTML = `<h3>GH NOW</h3><p class="now-error">${esc(error.message)}<br><span class="muted">GitHub tokenまたはAPI権限を確認してください。</span></p>`;
    }
  }

  async function debugRun(repo, run, button) {
    if (!repo || !run) return;
    const host = root.querySelector(`#debug-${CSS.escape(String(run.id))}`);
    if (!host) return;
    button.disabled = true;
    button.textContent = '調査中…';
    let step = 'failed step unavailable';
    let excerpt = '';
    try {
      const jobs = await api(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/runs/${run.id}/jobs?per_page=100`);
      const failedJob = (jobs.jobs || []).find((job) => job.conclusion === 'failure');
      const failedStep = failedJob?.steps?.find((s) => s.conclusion === 'failure');
      step = failedJob ? `${failedJob.name}${failedStep ? ` / ${failedStep.name}` : ''}` : step;
    } catch (_) {}

    const prompt = `GitHub Actions の失敗をデバッグしてください。\n\nRepository: ${repo.owner}/${repo.repo}\nBranch: ${run.head_branch || ''}\nCommit: ${run.head_sha || ''}\nWorkflow: ${run.name || ''}\nRun: ${run.html_url || ''}\nFailed job / step: ${step}\nError excerpt: ${excerpt}\n\n制約:\n- 推測ではなく、上記の情報から確認すべき原因候補と切り分け手順を整理してください。\n- GitHubへの書き込みや再実行は提案だけにしてください。\n- secrets、環境変数、ログ全文は要求しないでください。`;

    host.innerHTML = `<div class="now-debug"><b>ChatGPT draft</b><pre>${esc(prompt)}</pre><button data-copy>Promptをコピー</button><button data-send>ChatGPTへ渡す</button></div>`;
    host.querySelector('[data-copy]').onclick = async () => {
      await navigator.clipboard.writeText(prompt);
      host.querySelector('[data-copy]').textContent = 'コピー済み';
    };
    host.querySelector('[data-send]').onclick = async () => {
      const result = await chrome.runtime.sendMessage({ type: 'open-chatgpt-draft', prompt });
      if (!result?.ok) alert(result?.error || 'ChatGPT draftを開けませんでした');
    };
    button.disabled = false;
    button.textContent = '再生成';
  }

  load();
  setInterval(load, 60_000);
})();

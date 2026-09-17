const GITHUB_ORIGIN = 'https://github.com';
const CHATGPT_ORIGIN = 'https://chatgpt.com';

function isAllowedGithubUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === GITHUB_ORIGIN && (url.pathname === '/new' || url.pathname.startsWith('/'));
  } catch (_) {
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'open-github') {
    const url = String(message.url || '');
    if (!isAllowedGithubUrl(url)) {
      sendResponse({ ok: false, error: 'GitHub URL only' });
      return false;
    }
    chrome.tabs.create({ url }).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'open-chatgpt-draft') {
    const prompt = String(message.prompt || '').trim();
    if (!prompt) {
      sendResponse({ ok: false, error: 'Empty prompt' });
      return false;
    }
    chrome.storage.session.set({ chatgptDraft: { prompt, createdAt: new Date().toISOString() } }).then(async () => {
      const tabs = await chrome.tabs.query({ url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] });
      const target = tabs.find((tab) => tab.active) || tabs[0];
      if (target?.id) {
        await chrome.tabs.update(target.id, { active: true });
        sendResponse({ ok: true, tabId: target.id });
      } else {
        const tab = await chrome.tabs.create({ url: `${CHATGPT_ORIGIN}/` });
        sendResponse({ ok: true, tabId: tab.id });
      }
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

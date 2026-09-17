# GitHub Actions → ChatGPT Debug

## Purpose

GitHub Actions の失敗を `GH NOW` から確認し、必要な情報だけを整理したデバッグ用 Prompt を ChatGPT Web に渡す。

## Flow

```text
GitHub Actions
    ↓
GH NOW
    ↓
failed run
    ↓
ChatGPT draft
    ├─ Prompt preview
    ├─ Promptをコピー
    └─ ChatGPTへ渡す
             ↓
        ChatGPT Web
```

## Context

Prompt には次の最小コンテキストを含める。

- repository
- branch
- commit SHA
- workflow
- run URL
- failed job / step

ログ全文や secrets は自動送信しない。

## Human-in-the-loop

ChatGPT への送信は自動実行しない。まず拡張UIで Prompt を確認し、利用者が `ChatGPTへ渡す` を明示的にクリックする。

GitHub の再実行、キャンセル、書き込みも自動化しない。

## Runtime boundary

GitHub 側と ChatGPT Web 側は同じ DOM を直接共有しない。

```text
GitHub DOM
   ↓
Extension context
   ↓
chrome.storage.session
   ↓
ChatGPT DOM
```

`chatgptDraft` を一時的な中間表現として使用する。

## Current implementation

- `gh-now.js`: Actions run の取得、failed job / step の確認、Prompt preview
- `service-worker.js`: GitHub URL と ChatGPT Web のタブ切替、session handoff
- `content.js`: ChatGPT composer への draft 挿入

## Next

- [ ] Actions の失敗状態をリアルタイム通知
- [ ] エラー抜粋を安全に限定取得
- [ ] GitHub / ChatGPT 間の共通 Context schema を定義
- [ ] session の履歴・再開を整理

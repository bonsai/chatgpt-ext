# gh-chatgpt-ext MVP specification

## Goal

GitHub Issue を読んでいる利用者が、Issue の文脈を ChatGPT Web に渡し、回答を Issue コメントの**下書き**へ戻せる Chrome 拡張を作る。外部 API と自動投稿は MVP の対象外とする。

## Scope

### Included

- GitHub の Issue ページを認識する（`/{owner}/{repo}/issues/{number}`）。
- Issue の URL、owner、repo、number、title、本文、選択テキストを `IssueContext` に正規化する。
- GitHub ページに Shadow DOM の floating panel を表示する。
- 利用者の明示操作で `IssueContext` を ChatGPT タブへ渡し、ChatGPT の入力欄にプロンプトを下書きとして入れる。
- ChatGPT の最新アシスタント回答を利用者の明示操作で取得し、GitHub 側 panel に表示する。
- 利用者の明示操作で、回答を GitHub の Issue コメント入力欄へ**下書きとして挿入**する。

### Excluded

- Issue コメント、リアクション、ラベル、Assignee の自動変更・自動送信。
- GitHub API、OpenAI API、トークン、バックエンド。
- PR、Repository、file view、会話履歴の永続同期。
- ChatGPT の送信ボタンを自動で押すこと。利用者が内容を確認して送信する。

## Architecture

`Shared DOM` は使用しない。DOM は GitHub と ChatGPT の各タブに閉じ、拡張の runtime message と `chrome.storage.session` を中間表現 `SharedContext` の輸送・一時保管に使う。

```text
GitHub DOM → GitHubAdapter → SharedContext → ChatGPTAdapter → ChatGPT Web DOM
GitHub DOM ← GitHubAdapter ← SharedContext ← ChatGPTAdapter ← ChatGPT Web DOM
```

| Component | Responsibility |
| --- | --- |
| `GitHubAdapter` | Issue URL/本文/選択範囲の取得、panel表示、コメント下書きへの挿入 |
| `SharedContext` | バージョン付きの安全な中間データ。送信元・日時・状態を保持 |
| `ChatGPTAdapter` | ChatGPT タブの検出、プロンプト下書きの挿入、最新回答の読取 |
| Service worker | タブ探索、adapter 間メッセージ中継、session storage の管理 |

## User flow

1. 利用者が GitHub Issue を開き、必要なら本文の一部を選択する。
2. panel の **ChatGPTへ送る** を押す。
3. 拡張は既存の `chatgpt.com` タブを開くか前面化し、プロンプトを入力欄に下書きする。
4. 利用者が内容を確認して ChatGPT に送信する。
5. ChatGPT タブの **回答をGitHubへ戻す** を押す。
6. GitHub panel に回答プレビューが現れる。
7. 利用者が **コメント下書きへ挿入** を押す。GitHub の送信は利用者自身が行う。

## Prompt format

```text
GitHub Issue の文脈です。回答は日本語で、Issueコメントとして使える形にしてください。

Repository: {owner}/{repo}
Issue: #{number} {title}
URL: {url}

本文:
{body}

選択箇所（あれば）:
{selection}
```

本文は 12,000 文字、選択箇所は 4,000 文字までとし、切り詰め時はその事実を `truncated` に記録する。

## UI states

| State | GitHub panel | ChatGPT panel |
| --- | --- | --- |
| `idle` | Issueを検出、送信可能 | 待機 |
| `drafted` | ChatGPT で確認・送信する案内 | プロンプト下書き済み |
| `answer_ready` | 回答プレビューと下書き挿入 | 回答取得済み |
| `error` | 再試行可能な原因を表示 | adapter非対応などを表示 |

## Permissions and privacy

- `host_permissions`: `https://github.com/*`, `https://chatgpt.com/*`
- `permissions`: `storage`, `tabs`
- Context は `chrome.storage.session` にのみ置き、ブラウザ終了時に消える。
- 認証情報、Cookie、GitHub token、ChatGPT 会話履歴を保存・送信しない。
- 送信・回答の取得・GitHub下書き挿入はすべてボタン操作を要求する。

## Compatibility and failure handling

ChatGPT Web DOM は変更され得る。各 adapter は DOM selector を局所化し、要素未検出時は `ADAPTER_UNSUPPORTED` を返す。既存の GitHub コメント欄が見つからない場合は、回答のコピー操作を提供する。GitHub/ChatGPT の未ログイン状態は、ログインを促す表示のみとする。

## Acceptance criteria

1. 公開 GitHub Issue で `IssueContext` が正しく生成される。
2. 選択テキストあり・なしの両方で ChatGPT 入力欄にプロンプト下書きが作られる。
3. ChatGPT の回答を GitHub panel で確認できる。
4. 回答は GitHub コメント欄に下書き挿入されるが、投稿されない。
5. tabを閉じる・DOMが未対応・未ログインの各ケースで、例外を出さず理由と再試行手段を表示する。

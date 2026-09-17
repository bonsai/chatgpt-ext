# gh-chatgpt-ext

Edge Side PanelからGitHub REST APIを読む、GH WORKSPACEのスケルトンです。

## Load locally

1. Edgeで `edge://extensions` を開く
2. Developer modeを有効にする
3. Load unpackedでこのディレクトリを選ぶ
4. 拡張ボタンを押してGH WORKSPACEを開く
5. `Token設定` にfine-grained GitHub tokenを入力する

Tokenなしでも公開ページの一部は取得できますが、ユーザー・非公開repo・Actions状態には権限が必要です。Tokenは拡張のlocal storageに保存し、URLやログには出しません。

## Implemented skeleton

- Resume / Sessions / Repos / Issues / Actions / Deploy / Skills tabs
- `/user`, `/user/repos`, `/user/issues`, repo Actions runs のREST取得
- repo一覧のページング（最大20ページ）と簡易キャッシュ
- GitHubリンクを新規タブで直接開く
- 取得失敗・401の理由表示

## Not implemented yet

- Issue / repo / Actions / Pages の書き込み確認フロー
- Journal、進捗率、未確認通知の永続化
- Actionsログの要約とChatGPT Debug Prompt
- `aw` Markdownの同期とSkill picker
- IndexedDB、ETag、rate-limitバックオフ

本番利用前にfine-grained tokenの権限を最小化し、書き込み操作に確認ダイアログを追加する。

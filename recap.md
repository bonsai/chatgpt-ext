# gh-chatgpt-ext recap

最終更新: 2026-09-17

## 結論

`bonsai/gh-chatgpt-ext` を、GitHubとChatGPTを埋め込む拡張ではなく、CLIの操作感をWebに持ち込むEdgeサイドバー型の開発ワークスペースにする。

Edge拡張からGitHub REST APIを使い、セッション、repo、Issue、Actions、deploy、Skillを一つのダッシュボードで把握・操作する。設計と進捗の正本はrepo内ドキュメントではなくGitHub Issue APIに置く。

## 発見した痛み

- 昨日までの記憶がなく、Journalに記録していても読み返さない。
- 他セッションが何をしているか、タブがどこにあるか分からない。
- 過去に使ったrepoや、他人のrepoを探せない。
- Issue、実装、Actions、Pages、workflow、deployの進捗率が分からない。
- 実装を作り切る前に次の課題を始め、WIPが増える。
- 価値の低い細部にこだわって時間を浪費していることに気づけない。
- 約1,700 repoを個別に把握できない。まずAPIでインベントリ化し、BQ/BQMLは後段の分析に使う。
- CLIはrepo・ファイル・git・テストに強いが、AI文脈と利用枠が有限。
- Web ChatGPTはクラウド文脈を長く扱え、PC/スマホで戻れるが、GUI操作とログ転記が重い。
- Actions失敗のたびにログをコピーして新しいデバッグPromptを作るのが無駄。
- IDEは起動・依存解決・インデックスが重く、端末に依存する。

## North Star UX

朝にEdgeを開けば、Journalを読み返さなくても次が分かる。

```text
昨日の続き / いまのIssue / 進捗 / ブロック / 次の一手
```

常駐サイドバーのタブ:

```text
Resume | Sessions | Repositories | Issues | Actions | Deploy | Skills
```

行には `status`、`updatedAt`、`repo`、`issue`、`nextAction`、`openTarget` を表示する。読み取りは即時、書き込みだけ確認する。

## 開発フロー

```text
Codexが実装計画を作る
  → 親Issueと小さい子Issueへ分解
  → Web ChatGPTが子Issueを一つずつ処理
  → aw.md / Skillで実装方針を適用
  → GitHub REST APIで変更・Actions・Pagesを確認
  → Actionsで検証
  → 差分と結果を確認してpush/deploy
  → 次の子Issueへ
```

一つの作業は `planned / doing / blocked / done` で管理し、進捗はIssueチェックボックスと子Issueの完了数からだけ計算する。

## Issueを正本にする方針

```text
Issue API        設計・状態・判断の正本
Issue comments   短い作業イベント / Journal
Sub-issues       実装単位
aw.md            実行手順・Skill
repo             コード・テスト
IndexedDB        Edgeのキャッシュ・検索
```

Issue本文の標準フィールド:

```text
Goal / Why / Scope / Non-goals / Acceptance criteria
Status / Progress / Next action / Related repos / Related issues
```

## Edge-only技術方針

- Manifest V3 + Edge Side Panel
- GitHub REST APIを直接利用。サーバー、CLI、IDE、Native Hostは必須にしない
- `GET /user`、`/user/repos`、`/user/issues`、`/notifications`、`/search/issues`、repoのIssues/PR/Actions/Pages系を利用
- list APIはページング、ETag、差分取得、rate-limit表示を実装
- 1,700 repoは一覧を軽量同期し、詳細は直近・利用repoだけ取得
- 認証は初期はfine-grained PATを想定し、read-onlyを初期値にする。tokenはURL・ログ・Issue・Clipboardへ出さない
- repo作成、Issue書き込み、Actions再実行、workflow dispatch、Pages/deployは明示確認が必須
- EdgeからローカルCodex/herdrのsocketは直接読まない。Codexの計画・commit・テスト結果はIssue経由で扱う

## Skill / ChatGPT連携

開発repoの `skills/` にMarkdownを置き、Gitで管理する。CRXのビルド時に同梱する。

```text
skills/actions-debug/SKILL.md    Codex・開発用の完全手順
skills/actions-debug/PROMPT.md  Web ChatGPTへ貼る安全なPrompt
```

拡張はSkillを選び、Issue/Actions文脈を埋めてChatGPT Webへ貼る。実SkillがChatGPT側にインストール済みなら `@skill-id` を付け、未インストールならPrompt Skillとして使う。

## 作成済みGitHub Issue

- [#1 ghの情報まとめを表示する](https://github.com/bonsai/gh-chatgpt-ext/issues/1)
- [#2 GitHub.com/newを開くボタンを追加する](https://github.com/bonsai/gh-chatgpt-ext/issues/2)
- [#3 GitHubリンクを確認なしで直接開く](https://github.com/bonsai/gh-chatgpt-ext/issues/3)
- [#4 Actions状態を通知し、失敗をChatGPTでデバッグする](https://github.com/bonsai/gh-chatgpt-ext/issues/4)
- [#5 Codex無料枠と利用上限を確認する](https://github.com/bonsai/gh-chatgpt-ext/issues/5)

## 現在の成果物

- [pain.md](pain.md): CLI / Web / IDE / 日次開発 / セッション記憶の痛み
- [spec.md](spec.md): 初期Issue→ChatGPT DOM連携の仕様草案。REST API型への更新が次の設計作業
- [schema.json](schema.json): 初期Shared Context schema。Workspace状態schemaへの更新が次の設計作業

## 次に作るもの

最初の完成単位は、ChatGPT連携ではなく **GH NOW + Daily Resume**。

1. REST API認証とSide Panel
2. repo / Issue / Actionsの読み取りとキャッシュ
3. Resumeカード、セッション一覧、進捗表示
4. Issue書き込みとActions操作の確認フロー
5. aw SkillからWeb ChatGPTへのPrompt handoff

Actions、Skill、ChatGPT、Codexの連携は、GH NOWで現在地が見えるようになってから追加する。

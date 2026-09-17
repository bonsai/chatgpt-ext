---
title: "現在地を失わない開発"
subtitle: "gh-chatgpt-ext — GitHub REST APIでつなぐEdgeワークスペース"
slides: 8
---

# 1. 現在地を失わない開発

## gh-chatgpt-ext

CLIの即時性と、Web ChatGPTの継続文脈を、ひとつのサイドバーに集約する。

> 作業を速くする前に、何をしていたかを失わない。

---

# 2. 朝、何を作るべきか分からない

- 昨日までの記憶がない
- Journalに記録していても読み返さない
- 実装を完成させる前に次の課題を始める
- 進捗率と「次の一手」が見えない
- 細部へのこだわりで時間を浪費する

毎朝、開発の再開地点をゼロから再構成している。

---

# 3. CLI・Web・IDEは分断されている

| 面 | 強み | 痛み |
| --- | --- | --- |
| CLI | repo・ファイル・git・テストを速く扱える | AI文脈と利用枠が有限 |
| Web ChatGPT | 会話とクラウド情報を長く扱える | GUI操作、転記、状態収集が重い |
| IDE | コード・差分・診断に近い | 起動が重く、Issueの目的から遠い |
| herdr | session・tab・paneをまとめて扱える | WebとGitHubの全体状態が別 |

必要なのは切り替えではなく、同じ作業を流通させること。

---

# 4. 1,700 repoは記憶で管理できない

GitHubのrepoを一つずつ開いて把握するのは不可能。

Edge拡張はGitHub REST APIから軽量なインベントリを作る。

- 最終push、可視性、言語、活動量
- Open Issue、レビュー待ちPR、Actions失敗
- 最近使ったrepo、関連Issue、他人の公開repo

まず決定的なスコアで地図を作り、BQ/BQMLは後段の分析・推薦に使う。

---

# 5. Issue APIを共有メモリにする

設計ドキュメントをrepoだけに置かない。

```text
Issue API        設計・状態・判断の正本
Issue comments   短い作業イベント / Journal
Sub-issues       実装単位
aw.md            実行手順・Skill
repo             コード・テスト
```

IssueをWeb、CLI、Codex、ChatGPT、スマホが読める共通の作業記録にする。

---

# 6. GH WORKSPACEサイドバー

```text
GH WORKSPACE
├── Resume       昨日の続き / 次の一手
├── Sessions     最近のセッションとタブ
├── Repositories 直近repo / 全repo検索
├── Issues       計画・子Issue・進捗
├── Actions      実行中・失敗・成功
├── Deploy       Pages / workflow / deploy
└── Skills       aw Markdown → Prompt
```

読み取りは即時。repo作成、Issue編集、Actions再実行、deployだけ確認する。

---

# 7. 計画からpushまでを小さく回す

```text
Codexが計画
  → 親Issue + 小さい子Issue
  → Web ChatGPTが子Issueを1件処理
  → aw Skillで実装方針を適用
  → GitHub REST APIで変更・Actionsを確認
  → Debug / Verify
  → 差分確認後にPush・Deploy
  → 次の子Issue
```

Actionsの失敗ログを手で貼り直さず、短い要約から安全なDebug Promptを生成する。

---

# 8. 最初に作るもの

## GH NOW + Daily Resume

1. Edge Side PanelとGitHub REST API認証
2. repo / Issue / Actionsの読み取りとキャッシュ
3. 昨日の続き、進捗、ブロック、次の一手
4. Issue・Actions・Pages操作の確認フロー
5. aw SkillからWeb ChatGPTへのPrompt handoff

> 完成の定義: 朝、Journalを読み返さなくても、いまの作業と次の一手が分かる。

次段で、この8枚をWeb表示用のJSONデータへ分離する。

# Codex usage research

調査日: 2026-09-17
地域: Japan
対象: ChatGPT Free / Go と Codex

## 結論

- OpenAI公式ヘルプでは、Codex は Free / Go を含むすべての ChatGPT プランで利用できる。
- 利用上限はプランによって異なるため、固定の回数を拡張側で仕様化しない。
- 上限付近・到達時は Settings / Usage dashboard で、消費した利用枠、クレジット残高、表示されたリセット時刻を確認できる。
- 実行中の Codex CLI では `/status` で利用状況を確認できる。
- 利用量はモデル、実行場所、タスクの複雑さ、コンテキスト、推論、速度、ツールなどで変動する。長時間タスクは短いリクエストより大きく消費する場合がある。
- 上限到達後に利用可能な選択肢はアカウント/プランに依存し、表示された内容に従う。例として、追加クレジット、利用可能なリセット、アップグレード、リセット待ちがある。

## 拡張に表示する候補フィールド

```text
codex.available
codex.plan
codex.usageSource
codex.allowanceStatus
codex.creditBalance
codex.resetAt
codex.limitMessage
codex.lastCheckedAt
```

## 実装方針

拡張がアカウントの Codex 使用量を直接推測・スクレイピングすることはしない。

- `available`: 利用者が確認した場合のみ設定
- `plan`: 利用者が選択/確認したプラン
- `usageSource`: `settings` / `usage-dashboard` / `cli-status` / `manual`
- `allowanceStatus`: `unknown` / `available` / `near-limit` / `limited`
- `creditBalance`, `resetAt`, `limitMessage`: 利用者が確認した値のみ保存
- `lastCheckedAt`: 確認時刻

パスワード、Cookie、アクセストークン、セッション情報は保存しない。

## 公式情報

OpenAI Help Center: `Using Codex with your ChatGPT plan`

https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan

OpenAI の説明では、Free / Go を含む全プランで Codex を利用でき、上限はプランにより異なる。また、上限確認には Settings / Usage dashboard または Codex CLI の `/status` が案内されている。

## 未実測

- 特定アカウントの実際の残量・リセット時刻
- CLI / IDE / Web / Desktop の個別UIにおける表示差
- 個別アカウントで上限到達時に提示される選択肢

これらはアカウント状態に依存するため、拡張の製品仕様として固定値を持たせない。

# Agent Skills

CodexとClaude Codeで再利用するスキルを管理するリポジトリです。

- Codex用：`.agents/skills/<skill-name>/`
- Claude Code用：`.claude/skills/<skill-name>/`

## スキル一覧

| スキル | 概要 | 必要な環境 | エントリーポイント |
|---|---|---|---|
| `commit-message` | Git変更と規約を確認し、承認されたファイルをstageして、チケットID付きの日本語メッセージを作成します。確定したstage差分とメッセージへの明示許可後だけコミットします。 | Git | [Codex](.agents/skills/commit-message/SKILL.md) / [Claude Code](.claude/skills/commit-message/SKILL.md) |
| `design-spec` | 非デザイナーの曖昧なイメージを対話と比較で具体化し、Standardではtypography、width model、page shell、header・footer・sidebarを確認して、必要な各categoryの5案と連動する配色を1カラムのHTMLで比較し、page全体の雰囲気まで承認した最新DESIGN.mdへ整理します。 | 対象プロジェクトのread/write権限。外部参照調査は必要な場合のみ | [Codex](.agents/skills/design-spec/SKILL.md) / [Claude Code](.claude/skills/design-spec/SKILL.md) |
| `figma-codegen` | Figma MCPと対象projectの根拠から実装案を作り、明示承認後にレスポンシブUIを生成します。初版mapで配置、必須state、Component binding、interaction、visual比較を記録し、JS/TS semantic検査と現在のcode・assetの共通digestで差分同期を保護します。比較画像は保持しません。 | Figma公式MCP、Node.js 22以上、対象projectの実行環境、必要に応じてFigma REST APIのread権限 | [Codex](.agents/skills/figma-codegen/SKILL.md) / [Claude Code](.claude/skills/figma-codegen/SKILL.md) |
| `figma-variable-extract` | Figma DesignファイルのVariableを公式Remote MCPで抽出し、完全生成またはローカル限定生成の完全性を検証してCSS Design Tokensを生成します。raw JSONとreport JSONは同じプロジェクト内へ一時保存し、CSS生成成功後に削除します。 | Figma公式Remote MCP、Node.js 22以上 | [Codex](.agents/skills/figma-variable-extract/SKILL.md) / [Claude Code](.claude/skills/figma-variable-extract/SKILL.md) |
| `japanese-design-review` | 日本語WebサイトとブラウザUIを、ユーザータスク、情報設計、文字組み、視覚階層、レスポンシブ、操作性から監修し、Hard Gateと重大度順の指摘を返します。 | 対象プロジェクトのread権限。render確認は対象プロジェクトの実行環境 | [Codex](.agents/skills/japanese-design-review/SKILL.md) / [Claude Code](.claude/skills/japanese-design-review/SKILL.md) |

## スキルを追加するとき

1. 英語の`.agents/skills/<skill-name>/SKILL.md`、内容確認用の`SKILL.ja.md`、必要なリソースを追加する。
2. `node scripts/sync-skills.mjs`を実行し、Claude Code用コピーを生成する。`agents/openai.yaml`は自動的に除外される。
3. このREADMEのスキル一覧へ要約、必要な環境、エントリーポイントを追加する。
4. スキル形式の検証、同梱Scriptの実行確認、秘密情報スキャンを行う。

## 開発時の検証

`.agents/skills/`を正本とし、`.claude/skills/`は直接編集しません。
Figma関連Skillを変更した後は、対応する回帰テストを実行します。

```bash
node .agents/skills/figma-variable-extract/scripts/test-figma-variable-extract.mjs
node .agents/skills/figma-codegen/scripts/test-compare-images.mjs
node .agents/skills/figma-codegen/scripts/test-validate-figma-code-map.mjs
```

GitHub Actionsでは、Codex用とClaude Code用の同期差分と回帰テストを検証します。

## コミット直前の必須確認

すべてのコミットについて、コミットする直前にリポジトリルートから次の2コマンドをこの順序で実行します。

```bash
node scripts/sync-skills.mjs
node scripts/scan-publishable.mjs
```

同期によって`.claude/skills/`が変更された場合は、意図した生成コピーをコミット対象へ含めます。
いずれかのコマンドが失敗した場合はコミットせず、失敗原因を修正してから両方を再実行します。

# Agent Skills

CodexとClaude Codeで再利用するスキルを管理するリポジトリです。

- Codex用：`.agents/skills/<skill-name>/`
- Claude Code用：`.claude/skills/<skill-name>/`

## スキル一覧

現在、登録されているスキルはありません。

## スキルを追加するとき

1. `.agents/skills/<skill-name>/SKILL.md`と必要なリソースを追加する。
2. `node scripts/sync-skills.mjs`を実行し、Claude Code用コピーを生成する。`agents/openai.yaml`は自動的に除外される。
3. このREADMEのスキル一覧へ要約、必要な環境、エントリーポイントを追加する。
4. スキル形式の検証、同梱Scriptの実行確認、秘密情報スキャンを行う。

## 開発時の検証

`.agents/skills/`を正本とし、`.claude/skills/`は直接編集しません。
GitHub Actionsでは、Codex用とClaude Code用の同期差分を検証します。

## コミット直前の必須確認

すべてのコミットについて、コミットする直前にリポジトリルートから次の2コマンドをこの順序で実行します。

```bash
node scripts/sync-skills.mjs
node scripts/scan-publishable.mjs
```

同期によって`.claude/skills/`が変更された場合は、意図した生成コピーをコミット対象へ含めます。
いずれかのコマンドが失敗した場合はコミットせず、失敗原因を修正してから両方を再実行します。

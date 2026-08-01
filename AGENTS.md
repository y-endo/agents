# リポジトリ運用ルール

## 作業開始時の必須フロー

追跡対象ファイルを変更する前に、作業内容、背景、完了条件を記載したGitHub Issueを必ず起票する。
Issueを起票せずに実装、修正、リファクタリング、文書更新を開始しない。
原則として、1つの作業ブランチには1つのIssueだけを対応させる。

Issue起票後は、最新の`main`から作業ブランチを作成する。
`main`上で直接ファイルを変更したり、コミットしたりしない。

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/<issue-number>-<short-summary>
```

ブランチ名は`feature/<issue-number>-<short-summary>`形式とする。
`<issue-number>`には対応するGitHub Issue番号を入れる。
`<short-summary>`には変更内容を表す短い英語を、ASCII小文字、数字、ハイフンだけを使ったkebab-caseで記載する。
ブランチ名全体を簡潔に保ち、個人名、日付、意味のない連番を含めない。
例として、Issue 123で空の一時ディレクトリを削除する場合は`feature/123-remove-empty-token-dirs`とする。

## スキルの正本

`.agents/skills/`を正本として扱う。
`.claude/skills/`は`scripts/sync-skills.mjs`から生成されるため、直接編集しない。
各スキルは自己完結させる。

## スキル文書の言語

スキルを作成するときは、`.agents/skills/<skill-name>/SKILL.md`を英語で作成し、スキル本体の正本とする。
同じディレクトリに、内容確認用の日本語訳として`SKILL.ja.md`を作成する。
見出し構成、手順、禁止事項、例を英語版と日本語版で対応させ、片方を変更したときは両方を更新する。
英語版と日本語版に意味の差分がある場合は、`SKILL.md`を優先する。

## 変更後の検証

`figma-variable-extract`を変更した後は、次の回帰テストを実行する。

```bash
node .agents/skills/figma-variable-extract/scripts/test-figma-variable-extract.mjs
```

## コミット直前の必須確認

すべてのコミットについて、コミットする直前にリポジトリルートから次の2コマンドをこの順序で実行する。

```bash
node scripts/sync-skills.mjs
node scripts/scan-publishable.mjs
```

秘密情報スキャンの前に、同期コマンドで`.agents/skills/`から`.claude/skills/`を更新する。
同期によってファイルが変更された場合は、意図した生成コピーをコミット対象へ含める。
いずれかのコマンドが失敗した場合はコミットしない。
失敗原因を修正し、コミット直前に両方のコマンドを改めて実行する。

## Pull Requestとリリース

作業ブランチから`main`へのPull Requestを作成する。
Pull Request本文には対応するIssueを`Closes #<issue-number>`で記載し、変更内容、検証結果、互換性への影響を説明する。
必須チェックとレビューが完了するまでマージしない。
`main`へ直接pushまたは直接mergeしない。

リリース時は、Pull Requestを`main`へマージした後、最新の`main`上のリリース対象コミットへ注釈付きタグを付ける。
タグはSemantic Versioningに従う`vMAJOR.MINOR.PATCH`形式とし、既存タグを移動または再利用しない。

- `MAJOR`：後方互換性のないSkillの契約、出力、利用手順の変更
- `MINOR`：後方互換性を保ったSkillまたは機能の追加
- `PATCH`：後方互換性を保った不具合修正、文書修正、内部改善

リリースするバージョンはIssueまたはPull Requestで明示する。
タグは作業ブランチやマージ前のコミットへ付けない。

```bash
git switch main
git pull --ff-only origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

タグのpushを確認した後、不要になった作業ブランチを削除する。

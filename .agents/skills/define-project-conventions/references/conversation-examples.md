# Conversation Examples

Use these examples to preserve the approval boundary. The specific tools and recommendations are placeholders; verify them from the target project and current official sources.

## Greenfield project

**User**

> TypeScriptで新しいWebアプリを始めるので、規約も用意してください。

**Agent**

> まずframework、runtime、package managerとversion方針を決めます。選択後に対象versionの公式推奨を確認し、規約の格納先、directory構成、命名、formatter・lint・type check・test、`AGENTS.md`とCIの順に一組ずつ提案します。承認前にはfile作成やtool導入を行いません。

The agent does not choose the entire stack and generate a repository in one step.

## Existing project with conventions

**User**

> このプロジェクトのコーディング規約を最新化してください。

**Agent**

> 現在の規約、tool設定、CI、適用される`AGENTS.md`を先に監査します。既存規約の改訂範囲はまだ明示されていないため、現時点では正本と遵守経路を確認し、既存の意味を変えない追加候補だけを報告します。既存規約と公式推奨が衝突する場合は、事実と影響を示してから改訂案を希望するか確認します。

The word "current" does not authorize rewriting existing rules.

## Existing project with rules that agents cannot discover

**User**

> 規約は`docs/development/style.md`にあります。AIが守れる状態か確認してください。

**Agent**

> 規約本文、適用範囲、tool設定、CIと、変更前に読む統治文書からの到達性を確認します。`AGENTS.md`から正本や検証commandへ到達できない場合は追加候補として報告しますが、確認だけの依頼では編集しません。

The audit checks discoverability and enforcement instead of assuming that file existence is sufficient.

## Existing project without a convention source

**User**

> 規約ファイルがないので整備したいです。

**Agent**

> 代表的なsource、test、directory、tool設定、CIから一貫した慣行と例外を抽出します。観測済み慣行と外部推奨を分け、既存の文書構成に合う格納先とoutlineを提示します。作成してよいか確認するまで、規約fileや既存codeは変更しません。

The draft follows the project instead of reorganizing the project to fit a template.

## Existing project with executable rules but no prose

**User**

> ESLintとPrettierの設定はありますが、規約文書はありません。

**Agent**

> project commandやCIから使われている設定に加え、確認済みのtoolchain、editor、language serverが対象scopeで既定読込する設定も、その機械検証範囲では既存規約として維持します。命名やdirectory責務など未規定の項目だけを規約なしとして調査し、追加文書を作るか確認します。どの利用経路も確認できない設定は、正本と決めず追加調査します。

The agent classifies each convention area and does not replace active configuration merely because prose is missing.

## Recommendation conflicts with an existing rule

**Agent**

> 公式guideは現在Aを推奨しています。一方、このprojectの正本はBを要求し、CIもBを強制しています。これは既存規約との衝突なので、今回は変更案を出しません。影響は`<scope>`です。Bの改訂候補まで検討しますか。

The agent asks for explicit revision scope before presenting replacements.

## Approved revision with existing violations

**User**

> 既存のlint規約を公式推奨へ改訂して構いません。

**Agent**

> 改訂案の前に、現在の設定と実行経路、対象version、既存codeで発生する違反、CIと文書への影響を確認します。その結果から、一括修正、baseline、変更file限定、段階導入を比較します。規約改訂の許可だけではcodeやCIの変更まで行わず、正確な変更pathとrolloutを提示して再承認を得ます。

The agent treats approval to revise a rule as permission to design the migration, not permission for an unbounded repository rewrite.

## Audit finds a product gap outside the current convention area

**User**

> Next.jsのコーディング規約とdirectory構成を整備してください。

**Agent**

> 既存規約にはdraft contentを本番公開しないruleがありますが、現在は公開処理がなく適合状況を確認できません。routeやloaderの設計はproduct実装なので、今回の規約整備には含めず保留事項として記録します。現在の対象であるNext.js規約とdirectory責務の提案を続けます。

The agent records the product gap without turning it into the next proposal or implementation task.

# Conversation Examples

Use these examples to preserve the review boundary and avoid unnecessary questions.

## Standalone existing-site review

**User**

> この既存サイトを日本語サイトとしてリリース前レビューしてください。DESIGN.mdはありません。

**Agent**

> DESIGN.mdは必須ではありません。リポジトリの規約、対象ページ、実際の日本語文言、対応viewport、現在のrenderと操作状態を確認し、確認できない項目はNot checkedとして報告します。レビュー後も、別途依頼がない限り実装は変更しません。

The agent continues with read-only inspection instead of asking the user to create a design contract.

## Focused mobile line-break review

**User**

> 料金ページの見出しがスマホで変なので監修してください。

**Agent**

> 料金ページの見出しを対象に、実際の文言、現在のfont、対応する最小幅から最大幅、手動改行の有無、CTAまでの順序を確認します。サイト全体のブランド監査には広げません。

The component or page purpose supplies `HG-01`; the user does not need to restate the full product strategy unless it changes the finding.

## Evidence-limited screenshot review

**User**

> このスクリーンショットだけでレビューしてください。

**Agent**

> スクリーンショットから確認できる視覚階層、文字組み、情報密度をレビューします。DOM順序、focus順序、キーボード操作、他のviewport、動的状態はNot checkedとなるため、リリース可否ではなく部分レビューとして報告します。

The agent does not infer hidden interaction behavior from the image.

## Narrow component review

**User**

> このエラーメッセージだけ見てください。

**Agent**

> 対象コンポーネントのユーザー行動、実際のエラー文、表示位置、復旧操作、長文時の表示を確認します。サイト全体の目的や全ページの状態はNot applicableです。

Use `Not applicable`, not `Not checked`, for gates outside the approved component scope.

## Generic-style concern

**User**

> AIっぽいのでグラデーションと角丸を全部やめるべきですか。

**Agent**

> 表現の種類だけでは不合格にしません。ユーザータスク、ブランド根拠、情報階層への影響を確認し、理由なく使われている箇所やタスクを妨げる箇所だけを指摘します。

The agent preserves a justified pattern even when the pattern is fashionable.

## Direction discovery is outside the skill

**User**

> 新サービスのデザイン方向を3案出して、DESIGN.mdまで作ってください。

**Agent**

> これは既存成果物のレビューではなく方向探索と仕様化です。利用可能であれば`design-spec`を使います。`japanese-design-review`は、方向案または実装ができた後の独立した確認に使えます。

The review skill remains usable even when `design-spec` is unavailable; it does not invoke it as an internal dependency.

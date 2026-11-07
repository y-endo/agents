# Report structure

Nine pages (half of `evidence.md` is filled mechanically at scaffold time). Reader: the engineer who asked. Goals: answer client/colleague questions on the spot, and know where to look in review.

Report language: Japanese, です・ます調, short sentences, explain jargon once. No hype words (シームレス, 堅牢, 包括的, 強力, エレガント …), no emoji.

## Report syntax

- Source reference: `[[app/coupons.py:88]]` or `[[app/coupons.py:88-95]]` (repo-relative). Rendered as an editor link; the validator checks the file and lines exist.
- Code excerpt (≤30 lines), always pulled from the real file:

  ````markdown
  ```python title="app/coupons.py:88-95" linenums="88"
  --8<-- "app/coupons.py:88:95"
  ```
  ````

  Right after it, a numbered list of what happens there. Hand-written blocks are allowed only for commands/output (`text` / `console` / `bash` / `sh` / `shell` / `powershell` / `output`); any other hand-written code is a validation ERROR (describe suggested fixes in prose). `evidence.md` is exempt.
- Labels: `【確認済み】` `【推測】` `【未確認】` (rendered as badges).
- Diagrams: Mermaid per `diagram-guide.md`; right after each, a line starting with `**この図で分かること:**`.
- Admonitions `!!! warning "..."` / `!!! note "..."`, sparingly. Collapsibles `??? quote "..."` / `??? success "..."` with the body indented 4 spaces.

## Rules for all pages

- **One owner per fact; elsewhere link.** Problems → review.md; behavior not in requirements → design.md; failure behavior → flow.md / operations.md; flow → flow.md. index.md top-3 and faq.md 補足 are a one-line summary + link.
- **Keep it short.** Target ≤20,000 characters excluding evidence.md (15–30 min read). Cut in this order: `低` findings to one line each → code.md commentary to key parts only → re-explanations on other pages to links. Index top-3, FAQ 補足 and quiz explanations: 1–2 sentences + link. Design trade-offs, code warnings and ops notes must not re-explain review.md problems.
- Headings you add (`###`) contain no symbols (／・（） …): anchors are built from headings and symbols vanish. Keep the template `##` headings exactly.
- Behavior/design claims carry `[[path:line]]`; otherwise `【推測】` or `【未確認】`. Use labels instead of vague words (おそらく, と思われる). The cited line must support the claim.
- Empty item → `該当なし` in one line. Never delete a heading.

## 1. index.md — 概要と仮説の照合

- **3行サマリー**: what it enables / where it changed / the biggest caution, in words a non-engineer can repeat.
- **変更の規模**: files, added/removed lines (copy from evidence.md), new dependencies.
- **全体図**: one diagram of where the change sits in the system.
- **仮説との照合**: table `| あなたの仮説 | 実際（根拠） | 判定 |`, verdict ∈ `一致` / `部分一致` / `相違` / `判断不可`; then bullets "理解を修正すべき点" for 相違/部分一致 only.
- **要注意トップ3**: up to 3 from review.md by severity, one line each, with reference and a link to the review.md heading.
- **読む順番**: 5 min = this page only. 30 min = 仮説との照合 → flow.md → review.md `高` → faq.md → quiz.md. code/design/operations/evidence are reference pages.
- **事前仮説（原文）**: `??? quote "事前仮説（原文）"` with the Phase 0 answers verbatim.

## 2. flow.md — 仕様と処理の流れ

- **できるようになったこと（仕様）**: table of inputs, outputs, preconditions, constraints; note deviations from requirements.
- **主な処理の流れ**: sequence diagram (happy path), then numbered steps with references.
- **分岐と失敗時の動き**: flowchart of which condition returns what (errors, boundaries, no permission). State what the user sees and what happens to data. If state changes (DB, file, in-memory value, external call), **map its position against what can fail after it**. "Nothing changes on failure" holds only for failures before the change.
- **データと状態**: new/changed data; a state diagram only if it adds something; else `該当なし`.

## 3. design.md — 設計とその理由

- **構成と責務**: component diagram (new/changed/existing/external colored) and table `| 部品 | 役割 | 場所 |`. If it would only repeat the index diagram, write `該当なし（index の全体図と同じ）` and keep the table.
- **設計判断**: 3–6 important ones (if the change involves no design decision, e.g. a wording fix: `該当なし` + reason), each:

  ```
  ### 判断: <what was done>
  - 内容: <specific> [[path:line]]
  - 理由: <reason>【推測】or【確認済み】（根拠: commit message / comment / requirement）
  - 他の選択肢: <e.g. simpler option>
  - トレードオフ: <gained / lost>
  ```

  A reason is `【推測】` unless recorded. Never present the report writer's after-the-fact interpretation as the original intent.
- **要件にない判断と未対応のこと**: table `| 種類 | 内容 | 根拠 | 確認したほうがよい相手 |`, 種類 ∈ `既定値` / `要件の読み替え` / `要件にない追加` / `未対応`. Code shows only that a behavior is not in the requirements or that something is unhandled; who decided, or whether it was intentionally excluded, only with a record. Never state "AIが勝手に決めた" / "スコープ外にした" as fact.

## 4. code.md — コード解説

Key parts only, in the order needed to understand.
- **読む順番**: table `| 順番 | ファイル | 何が書いてあるか | 重要度 |`.
- **重要な箇所の解説**: `### <path>` or `### <path> の <function>`: role in 1–2 sentences → excerpt → numbered explanation (explain surprising constructs) → optional `!!! warning` for "when changing this".
- Tests belong in review.md, not here.

## 5. review.md — レビューで見るべきこと

- **要件の出典**: the requirement used to judge over-engineering (Phase 0 Q2), or `要件が不明のため、以下の過剰実装の判定はすべて推測`.
- **怪しい箇所**: by severity, each:

  ```
  ### <short title>
  - 重要度: 高 / 中 / 低
  - 場所: [[path:line]]
  - 何が問題か: <concrete failure/impact>【確認済み】/【推測】
  - 確認方法: <how to settle it: test, try by hand, ask someone>
  ```

  `高` = malfunction, data corruption, security, money. At most 3 `低`. No style preferences.
- **差分の外への影響**: existing code that was **not changed** but now behaves or means something different because of this change. The most important code may not be in the diff. Start with one line `**探し方:** <how you searched>` (e.g. callers of changed functions found with `grep -rn "total(" app tests`; readers of changed data, config, defaults, env vars, exceptions or return values; shared state; unchanged lines in changed files whose inputs changed). Then 1–3 chains, most consequential first:

  ```
  ### 影響: <short title>
  - 変更箇所: [[changed path:line]]
  - 意味が変わる既存コード: [[unchanged path:line]]
  - 何が変わるか: <before → after, concrete>【確認済み】/【推測】
  - 気をつけること: <what to check, who/what is affected>
  ```

  Each item must cite at least one line **outside the changed lines** (the validator checks this); re-describing the diff is not an impact. Only runtime behavior or meaning counts: a test that now covers less belongs in テストの証明範囲, not here. If the change source is a deleted or binary file, write `変更箇所: \`path\`（削除）` / `（バイナリ）` without `[[...]]` (a deleted file has no lines to cite); the unchanged-code citation is still required. An optional small chain diagram (`flowchart LR`, ≤5 nodes, changed=`changed`, unaffected-but-affected=`existing`) only if it is clearer than the bullets. If nothing is affected: `該当なし（探し方: ...）` — the search is still required.
- **過剰実装の疑い**: table `| 内容 | 場所 | 対応する要件 | より単純な案 | 単純にすると失うもの |`; only items with no reason other than "might be used later".
- **テストの証明範囲**: table `| テスト | 証明していること | 証明していないこと |`, then bullets of important untested behavior. A green test is not evidence of safety.

## 6. operations.md — 運用で気にすること

- **設定・環境変数**: table `| 名前 | 既定値 | 影響 | 場所 |`.
- **障害・異常時の挙動**: dependency down, unexpected input, concurrent execution.
- **監視・ログ**: signals to notice problems; if none, say so.
- **変更するときに壊れやすい場所**: places that must change together, implicit assumptions.
- **残っている負債・TODO**: TODO/FIXME, deferred items.

## 7. faq.md / 8. quiz.md

Per `faq-and-quiz.md` (FAQ 5–8, quiz 5–7).

## 9. evidence.md — 証拠

Never edit the machine-generated part (対象, コミット, 変更ファイル). Fill:
- **実行した確認**: per check: command / cwd / exit code / output (verbatim excerpt) / what it shows / what it does not.
- **読んだ範囲と読んでいない範囲**: files read; related areas not read (some callers, infra config, …).
- **別コンテキスト検証**: `実施` / `未実施（理由）` / `未実施（自己チェックのみ）`, adopted fixes, rejected findings with one-line reasons.
- **作業体制**: orchestrator / worker / verifier models, number of review rounds.

# Brief: <slug>

Orchestrator → worker. Terse bullets and tables, no prose. Write content that will appear in the report in Japanese. Every factual item carries `[[path:line]]`; every reason/intent carries a label (`【確認済み】`/`【推測】`/`【未確認】`).

## Meta
- Report dir / repo / scope (base..head, uncommitted?):
- Requirements source (ticket / spec / agent instructions, or "none" → all over-engineering judgments are `【推測】`):
- Audience the user named (Q6):

## Hypothesis answers (verbatim, do not edit)

## Hypothesis verdicts
| あなたの仮説 | 実際（根拠） | 判定 |
|---|---|---|

Corrections the user should make to their understanding:

## Summary (3 lines: what it enables / where it changed / biggest caution)

## Main path (numbered; becomes the sequence diagram)
1.

## Branches and failures (condition → result; mark where state changes and what fails after it)

## Data and state (or 該当なし)

## Components (name | role | location | 新規/変更/既存/外部)

## Design decisions (3–6: what | evidence | reason + label | alternative | trade-off)

## Not in requirements / unhandled (種類 | 内容 | 根拠 | 確認したほうがよい相手)

## Findings (title | 重要度 | location | problem + label | how to confirm), most severe first

## Impact outside the diff (探し方: commands used; then 1–3 chains: changed [[path:line]] → unchanged [[path:line]] → what changes + label → what to check; or 該当なし + 探し方)

## Over-engineering (内容 | 場所 | 対応する要件 | より単純な案 | 単純にすると失うもの)

## Tests (test | proves | does not prove) and important untested behavior

## Operations (config, failure behavior, monitoring, fragile places, TODO/debt)

## Code walkthrough (reading order; key excerpts as path:start-end + the point to explain)

## FAQ (5–8: question | asker | scene | 即答 key point incl. verified/unverified boundary | evidence | do not assert)

## Quiz (5–7: question | answer | evidence | reread pointer)

## Evidence log (command | cwd | exit code | output excerpt | proves | does not prove)

## Read / not read

## Worker notes
<!-- worker appends here; orchestrator resolves each in Phase 4 -->

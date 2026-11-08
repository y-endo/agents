# Phase 0: hypothesis interview

Why first: once people read the AI's explanation they take it as their own understanding ("borrowed confidence"). Writing down a guess first and checking it against code facts exposes the gap between "feels understood" and "understood". Wrong guesses are useful: they mark where the engineer would get stuck when asked.

## How to ask

- One message, numbered, each item noting "わからない／なしでOK".
- Propose the scope and let the user confirm. Show only branch name, base, commit count and changed file names; **never commit subjects** (AI-written summaries; they land in evidence.md later anyway).
- Say nothing about the code content yet (not even "it looks like …").
- Do not ask what the code answers (language, file layout).

## Question template (send in Japanese)

```
レポートを作る前に、現在の理解を教えてください。
回答は後でコードと照合するため、正確でなくても構いません。
各項目に「わからない」「なし」と答えても構いません。

1. 対象範囲: <候補> で合っていますか？
2. 元の要件: チケット、仕様書、エージェントに渡した指示文があれば、場所か内容を教えてください。
3. この変更で、何ができるようになったと思っていますか？（1〜3行）
4. 処理の流れや設計は、どうなっていると予想していますか？（大まかな説明で構いません）
5. 気になっている点、怪しいと思っている点はありますか？
6. 誰に説明する予定ですか？（クライアント／社内の非エンジニア／社内エンジニア）
   聞かれそうなことがあれば教えてください。
```

## Using the answers

- Save the reply verbatim to a file and pass it to `new_report.py --hypothesis`. Copy it verbatim into the brief and index.md `事前仮説（原文）` (the validator compares it). Do not fix typos; only indentation and blank lines may change.
- Split answers 3/4/5 into claims, one table row per claim, verdict ∈ `一致` / `部分一致` / `相違` / `判断不可`.
  - `相違` / `部分一致`: say what differs, with evidence, in the 実際 column.
  - `判断不可`: not decidable from code (business intent etc.).
- No requirements from Q2 → every over-engineering judgment is `【推測】`; state it in review.md.
- Questions from Q6 must appear in faq.md (wording may be tidied).
- Skip, or "don't know/none" to all of Q3–Q5 (no claims to check) → `--no-hypothesis` and write `仮説なしで作成（照合なし）` instead of the table.

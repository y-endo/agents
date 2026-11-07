# FAQ and quiz

## FAQ (faq.md): 5–8 questions

Only questions the engineer will actually be asked and could get stuck on.

### Selection

1. Questions the user listed in Phase 0 Q6 are mandatory (wording may be tidied).
2. From these angles, only what **actually applies** to this change:
   - what is now possible, what changes for users
   - when it does not work, limits
   - impact on existing features or past data
   - behavior on failure/outage (mandatory if money, data or notifications are involved)
   - security / personal data (only if handled)
   - cost / performance (only if external services or heavy processing were added)
   - what config/ops can and cannot handle (support inquiries)
   - why not another approach (only if internal engineers would ask)
3. If you cannot picture who would ask it, drop it.

### Exclude

- details obvious from the code (variable names, file locations, library versions)
- internals non-engineers never ask (inheritance, pattern names)
- generic questions (「テストは大事ですか」「このコードは安全ですか」)
- off-topic questions, or ones whose only answer is "unknown"

### Format (Japanese)

```markdown
### Q. <question, in the asker's own words>

- 質問者: クライアント / 社内（非エンジニア） / 社内（エンジニア）
- 聞かれる場面: <e.g. 仕様確認の打ち合わせ、問い合わせ対応時>

**即答:** <1–2 sentences, no jargon, sayable as is>

**補足（根拠）:** <for engineers, with [[path:line]]>

**断言しないこと:** <unverified points to answer with 「確認して回答します」; omit if none>
```

**The 即答 alone must not overstate the guarantee**, because people read only that line. Put the boundary between what the code confirms (the processing exists / it rejects) and what is not confirmed (how the UI shows it, business handling, unimplemented integrations) inside the 即答 itself.
Example: 「期限切れのクーポンを拒否する処理はあります。購入画面でどう案内されるかは、画面側が未実装のため未確定です。」

## Quiz (quiz.md): 5–7 questions

Ask for **predictions**, not recall. Unanswerable questions show where understanding is missing.

### Must include (≥1 each)

- failure behavior: 「◯◯のとき、利用者には何が返り、データはどうなるか」
- change impact: 「◯◯の仕様を変えるとき、どこを直す必要があるか」
- test limits: 「今のテストが全部通っていても防げない不具合は何か」
- behavior not in requirements: 「◯◯について、要件に書かれていないのに実装されている挙動（または未対応のこと）は何か」

### Choosing examples and numbers

For questions about the user's Phase 0 concerns (e.g. calculation order), pick numbers/conditions where **the wrong and the right understanding give different answers**. An example where both give the same result (e.g. percentage discount vs percentage tax order) tests nothing.

### Exclude

- name/location recall (「この関数名は？」)
- questions answerable by memorizing the report text

### Format (Japanese)

```markdown
### Q1. <question>

??? success "答えと解説"
    <answer>

    <why, with [[path:line]]>

    読み直す場所: [flow.md の 分岐と失敗時の動き](flow.md#分岐と失敗時の動き)
```

Indent the collapsible body 4 spaces or it will not fold.

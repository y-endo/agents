# Verifier prompt

Fill the `<...>` placeholders and pass everything below the line. **Do not pass your conversation, summary or conclusions**; the verifier must not be anchored. Only the repo and report locations.

---

You are verifying an AI-written implementation-explanation report (in Japanese). Do not edit any files.

- Repository: `<repo_root>`
- Scope: `<base>..<head>` (or the uncommitted diff)
- Report: `<report_dir>/docs/*.md` (`[[path:line]]` points to repository files and lines)

Read the actual code and check only these four things:

1. Statements contradicted by the code (behavior, conditions, return values, error behavior). For any "state does not change on failure" statement, check the line that changes state against the lines after it that can raise.
2. Important behavior missing from the report (especially failures, data writes, money, permissions, personal data), including unchanged code whose behavior changes because of this diff (callers, readers of changed data/config/defaults).
3. Assertions without evidence (including reasons labeled 【確認済み】 without a record).
4. Wrong verdicts in 「仮説との照合」.

Report at most 8 items, most important first, each as:

- Type: 1–4
- Where in the report: file and heading
- Problem: what is wrong
- Evidence: `path:line` and its content

Do not report wording, style, layout, structure preferences or minor nitpicks. If nothing essential is wrong, reply only 「重大な問題なし」.

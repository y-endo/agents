---
name: impl-explainer
description: Generate a Japanese HTML report (MkDocs Material) that lets an engineer quickly understand code an AI agent implemented (uncommitted diff, branch, commit range, or a feature) well enough to answer client and colleague questions on the spot. First interviews the engineer for their own hypothesis, then checks it against code facts (file:line evidence, commands run and their output), and produces flow/design diagrams, a code walkthrough, suspicious code and over-engineering, operational concerns, a curated FAQ, and a comprehension quiz. The requesting model supervises and judges; the page writing is delegated to a workhorse model. Use for "explain this implementation", "help me understand the AI-written code", "make a report of this change/diff", "実装を解説して", "impl-explainer".
---

# impl-explainer

Goal: the engineer can explain the change **in their own words**. Not "read the AI's summary", but "test your own hypothesis against code facts, and know what nobody decided and what the tests do not prove".

Works in Claude Code and Codex. "Ask the user" = use a question tool if available, otherwise ask in chat and wait.
The report is written in **Japanese** (templates, headings and labels are Japanese). Talk to the user in their language.

## Non-negotiable rules

1. **Hypothesis first.** Until the Phase 0 answers arrive, give no explanation, summary or opinion about the code.
2. **Evidence for claims.** Behavior/design claims carry `[[path:line]]`, and the cited line must actually support the claim. Code excerpts are pulled from real files with snippets syntax, never retyped.
3. **Certainty labels.** `【確認済み】` (read or ran it), `【推測】` (inferred intent/reason), `【未確認】` (not or cannot be verified). "Why it was built this way" is `【推測】` unless a record (commit message, comment, ticket, the agent's instructions) says so.
4. **A green test proves only what it checks.** Record commands and output verbatim in evidence; state what they do not prove.
5. **Distrust your own summary too.** Phase 5 is a fresh-context verification.
6. **No filler.** Empty item → one line `該当なし`. No padding findings, questions or diagrams.
7. **Never modify the working tree** (`git checkout` / `stash` / `reset`, reverting files). The user's uncommitted work would be lost.

## Roles

- **Orchestrator** = the model the user asked (you). Owns the interview, understanding, every judgment, the review and the hand-off. Accountable for quality.
- **Worker** = a workhorse model that turns your brief into the Markdown pages and runs the build. It makes no new judgments.
- **Verifier** = a fresh-context agent that only checks the finished report.

Model choice, how to spawn, and the review checklist: `references/delegation.md` (read before Phase 3).

## Flow

```
P0 hypothesis interview → P1 scaffold → P2 read & judge          (orchestrator)
P3 brief → worker writes pages & builds                          (worker)
P4 review, ≤2 fix rounds → P5 fresh-context verification → P6 hand-off   (orchestrator)
```

Scripts are in `scripts/` next to this file (`<skill>` below): Python ≥3.10 stdlib only, run as `python -X utf8`. `build.py` prepares pinned MkDocs itself (uv if present, otherwise a venv; first run needs internet). Script messages say what to do on errors.

## Phase 0: hypothesis interview (always first)

Follow `references/hypothesis-interview.md`: one message with six questions ("don't know" is valid). When proposing the scope show only branch, base, commit count and file names (`git rev-list --count <base>..HEAD`, `git diff --name-only <base>...HEAD`); **never commit subjects**, which are the AI's own summary and would anchor the hypothesis.

## Phase 1: scaffold and facts

```bash
python -X utf8 <skill>/scripts/new_report.py --repo <repo_root> --slug <name> --hypothesis <answers_file> [--base <ref>] [--head <ref>] [--uncommitted]
```

- `<answers_file>`: the user's Phase 0 reply saved verbatim to a file outside the repo or under `<repo>/.impl-explainer/` (excluded from the diff); `validate.py` checks it is pasted unchanged. Use `--no-hypothesis` instead only if the user declined, or answered "don't know/none" to all of Q3–Q5.
- Default base: merge-base with main/master (else `HEAD~1`). `--uncommitted` targets working-tree changes (plus `base..HEAD` commits if `--base` is given).
- Creates `<repo>/.impl-explainer/<date>-<slug>/` (git-ignored) with commits, changed files and diff stats written mechanically into `docs/evidence.md`. Same slug again needs `--force` (the old report is kept as `<dir>.bak-<time>`); after code changes prefer a new slug.
- If it stops or warns (uncommitted edits in target files, large diff), relay it to the user and follow their choice.

## Phase 2: read and judge (orchestrator)

Read the **whole** diff, plus callers/callees until you can explain the behavior. Run only safe, quick checks (tests, build); never write to external services or production config. Throwaway check scripts go outside the repo. Decide, with `[[path:line]]` for each:

- Main path from entry (API/UI/CLI/job) to exit (DB/external/response), branches, failure paths. Where state changes (DB, file, in-memory value, external call) and what can fail **after** it ("nothing changes on failure" holds only for failures before the state change).
- Hypothesis verdict per claim: `一致` / `部分一致` / `相違` / `判断不可`.
- Suspicious code (swallowed exceptions, pointless retries, dead code, shared state, time/money/encoding, security): severity `高`/`中`/`低`, how to confirm. No style preferences.
- Impact outside the diff: unchanged code whose behavior or meaning changes because of this change (callers of changed functions, readers of changed data/config/defaults/exceptions/return values, shared state, unchanged lines in changed files). Search for it explicitly and record how (commands).
- Over-engineering vs the stated requirement, the simpler alternative, what it would lose.
- Behavior not in the requirements and unhandled items (`既定値` / `要件の読み替え` / `要件にない追加` / `未対応`). Do not claim who decided, or that something was intentionally excluded, without a record.
- What each test proves and does not prove.
- FAQ (5–8) and quiz (5–7) per `references/faq-and-quiz.md`.

## Phase 3: brief and delegate

Copy `assets/brief-template.md` to `<report_dir>/brief.md` and fill it with every Phase 2 judgment and its evidence. The brief is the worker's single source of truth. Spawn the worker per `references/delegation.md` with `references/worker-prompt.md`. If no worker can be spawned, or you are already a workhorse-class model, write the pages yourself following the same references (`references/report-structure.md`, `references/diagram-guide.md`, `references/faq-and-quiz.md`).

## Phase 4: orchestrator review

Follow "Review" in `references/delegation.md`. Open the cited lines behind every high-stakes claim yourself; never accept the worker's summary as evidence. Send all fixes in one message; at most 2 rounds, then fix small remaining issues yourself.

## Phase 5: fresh-context verification

Spawn a verifier with only the repo and report paths (not your conclusions), using `references/verifier-prompt.md`. Adopt only factual errors, important missing behavior and unsupported assertions; one pass, no back-and-forth. Before adopting a finding, re-verify it yourself (read the lines or run it) and log the command and output in `evidence.md` 実行した確認; never record the verifier's claim alone as 【確認済み】. Update `brief.md` first, then have the worker (or yourself) apply it. Without a fresh context you may self-check once, but record `未実施（自己チェックのみ）` in evidence and say so in Phase 6.

## Phase 6: hand-off

Run `python -X utf8 <skill>/scripts/build.py <report_dir>` (validate + build) a final time; ERROR must be 0. If you can drive a browser, screenshot the diagram pages (index/flow/design) to confirm Mermaid rendered (Material draws into a closed shadow DOM; JS cannot check it). If the browser cannot open `file://`, serve it: `python -m http.server 8000 --directory <report_dir>/site`. Tell the user, briefly:

1. Absolute path to `site/index.html` (open directly; diagrams need internet).
2. Hypothesis result (counts and the biggest mismatch).
3. Top 3 cautions, one line each with reference.
4. "If you cannot answer a quiz question, reread its pointer."
5. Anything not done or not verified (verification, diagram rendering, tests not run).

Do not paste the report into chat.

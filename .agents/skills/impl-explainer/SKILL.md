---
name: impl-explainer
description: Create a Japanese MkDocs Material report that compares an engineer's initial understanding with code evidence. Use when asked to explain AI-written code or report on an uncommitted diff, branch, commit range, or feature. Includes diagrams, code walkthroughs, review findings, operational concerns, questions and comprehension checks. Not for implementing or fixing the target code.
---

# Explain an Implementation

Help the engineer explain the change in their own words by comparing their initial understanding with code evidence.
Identify decisions without a recorded rationale and behavior the tests do not cover.

Works in Claude Code and Codex. "Ask the user" = use a question tool if available, otherwise ask in chat and wait.
The report is written in **Japanese** (templates, headings and labels are Japanese). Talk to the user in their language.

## Non-negotiable rules

1. **Hypothesis first.** Until the Phase 0 answers arrive, give no explanation, summary or opinion about the code.
2. **Evidence for claims.** Behavior/design claims carry `[[path:line]]`, and the cited line must actually support the claim. Code excerpts are pulled from real files with snippets syntax, never retyped.
3. **Certainty labels.** `【確認済み】` (read or ran it), `【推測】` (inferred intent/reason), `【未確認】` (not or cannot be verified). "Why it was built this way" is `【推測】` unless a record (commit message, comment, ticket, the agent's instructions) says so.
4. **A green test proves only what it checks.** Record commands and output verbatim in evidence; state what they do not prove.
5. **Distrust your own summary too.** Phase 5 is a fresh-context verification.
6. **No filler.** Empty item → one line `該当なし`. No padding findings, questions or diagrams.
7. **Preserve the target repository.** Do not edit source files, switch branches, stash, reset, or revert the user's work. Generated reports and their local caches belong under `.impl-explainer/`; build environments may also use the user cache when permitted.

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

## Runtime and writing conventions

Scripts are in `scripts/` next to this file (`<skill>` below).
Check Git and Python before starting; Python 3.10 or newer is required.
On macOS/Linux, check `python3 --version`; on Windows, check `py -3 --version` or `python --version`.
Use the verified interpreter consistently. Examples below use `python3`; replace it with `py -3` or the verified executable when needed.
Quote paths, including placeholders, because repository and skill paths may contain spaces.

The scripts use the Python standard library. `build.py` prepares the dependencies in `assets/requirements.lock` using uv when available, otherwise a venv.
The first build needs internet access. Respect sandbox and network permissions; report blocked setup rather than bypassing restrictions.
Use `-B` so Python does not leave `__pycache__` in the distributed skill directory.

Write Japanese instructions in plain form and reports in polite form.
Use one sentence per line and one topic per paragraph; explain unfamiliar terms when introduced.
Avoid decorative emphasis, vague summaries, em dashes, and middle dots used to join words in new prose.
Preserve uncertainty, quoted answers, code, logs, and fixed template headings.
The report-specific conventions are in [references/report-structure.md](references/report-structure.md); no separately installed writing skill is required.

## Phase 0: hypothesis interview (always first)

Follow `references/hypothesis-interview.md`: one message with six questions ("don't know" is valid). When proposing the scope show only branch, base, commit count and file names (`git rev-list --count <base>..HEAD`, `git diff --name-only <base>...HEAD`); **never commit subjects**, which are the AI's own summary and would anchor the hypothesis.

## Phase 1: scaffold and facts

```bash
python3 -B -X utf8 "<skill>/scripts/new_report.py" --repo "<repo_root>" --slug <name> --hypothesis "<answers_file>" [--base <ref>] [--head <ref>] [--uncommitted]
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

Run `python3 -B -X utf8 "<skill>/scripts/build.py" "<report_dir>"` (validate + build) a final time; ERROR must be 0.
If you can drive a browser, inspect and screenshot the diagram pages (index/flow/design) to confirm Mermaid rendered; a successful build alone does not prove rendering.
If the browser cannot open `file://`, serve it locally with `python3 -m http.server 8000 --bind 127.0.0.1 --directory "<report_dir>/site"` and stop the server after checking.
Tell the user, briefly:

1. Absolute path to `site/index.html` (open directly; diagrams need internet).
2. Hypothesis result (counts and the biggest mismatch).
3. Top 3 cautions, one line each with reference.
4. "If you cannot answer a quiz question, reread its pointer."
5. Anything not done or not verified (verification, diagram rendering, tests not run).

Do not paste the report into chat.

# Delegation: orchestrator, worker, verifier

Why: understanding and judging is input-heavy and decides quality; writing ~15–20k characters of Japanese pages is output-heavy and mechanical once the judgments exist. So the orchestrator keeps every judgment (in `brief.md`) and the worker only turns it into pages. Quality is protected by the brief contract and the orchestrator's review, not by trusting the worker.

## Choosing models

| Orchestrator (you) | Worker | Verifier |
|---|---|---|
| Claude Opus / Fable class (Claude Code) | Claude Sonnet class (latest) | fresh Sonnet |
| OpenAI frontier, e.g. `gpt-6-astra` (Codex) | OpenAI workhorse (e.g. `gpt-6.1-sol`) | fresh workhorse |
| Already a workhorse model (Sonnet, `*-sol`, …) | none: write the pages yourself | fresh same-tier |

- Worker = the vendor's current **workhorse** tier: strong long-form writing and format discipline. Never the fast/cheap tier (Haiku, `*-luna`, `*-reserve`, `mini`, …) for writing; quality must not drop.
- Model names change. Pick by tier, using the harness's model list. If the user names models, use those.

## How to spawn

- Use the current harness's agent tool with a fresh context and an available workhorse model. Inspect its schema and model list; do not assume model IDs or parameters from another installation.
- Prefer the built-in tool. Use a separate CLI only when permitted, installed, and its local help confirms the invocation. Shell redirection differs between PowerShell and POSIX shells; quote paths and use the installed shell's syntax.
- If delegation is unavailable or prohibited, write the pages yourself and record the limitation. Do not use a separate process to bypass a tool or permission restriction.
- The worker needs read access to the repo and skill, write access to `<report_dir>` (plus the build cache), and the verified Python interpreter from SKILL.md. The first build also needs permission to fetch pinned dependencies. Fill `references/worker-prompt.md` with the actual paths and interpreter.
- If the worker cannot run the build (sandbox or network limits), it reports that; you run `build.py` yourself and send it the errors.

## Brief contract

The worker MAY: phrase and structure the brief's content into the pages; choose excerpt line ranges; draw diagrams that match the brief's flows; add small factual details read from code, each with `[[path:line]]` and a label.

The worker MUST NOT: change verdicts, severities, the FAQ/quiz selection or labels toward more certainty; add new findings; edit the verbatim hypothesis; touch anything outside `<report_dir>`; modify the working tree. Disagreements go to `## Worker notes` at the end of `brief.md`, never silently into the pages.

## Review (Phase 4 checklist)

1. Re-run `python3 -B -X utf8 "<skill>/scripts/validate.py" "<report_dir>"` with the verified interpreter: 0 ERROR.
2. Resolve every item in `## Worker notes` (accept with evidence, or reject).
3. **Open the cited lines yourself** for: every row of the hypothesis table, the top-3 cautions, every `高` finding, every FAQ `即答`, every failure/state statement in `flow.md`, and every 差分の外への影響 item (open the unchanged line and confirm its meaning really changes). The line must support the claim, not merely exist.
4. Money, rounding, dates and boundaries: check every such explanation against an actual run at a boundary value (e.g. `round` in Python is banker's rounding, not 四捨五入). Spot-check 5 other citations at random.
5. Diagrams: the sequence diagram matches the brief's main path; the branch diagram shows failure endpoints; no diagram repeats another.
6. Fidelity: each brief item appears in the page that owns it; nothing new appeared without citation and label; no certainty was upgraded.
7. Length: if the validator warns (>20,000 chars), cut in the order given in `report-structure.md`.
8. Japanese: plain, no hype words; each `即答` can be said to a client as-is and keeps the verified/unverified boundary.

Send fixes as one numbered message (page, exact problem, expected result). A second round only for remaining blocking items; afterwards fix trivial issues yourself. Fill `## 作業体制` in `evidence.md` (orchestrator, worker, verifier models; review rounds).

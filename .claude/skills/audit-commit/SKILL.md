---
name: audit-commit
description: Audit a proposed Git commit for security and compliance blockers before an AI agent commits it. Use when the user asks whether staged changes are safe, compliant, or ready to commit; requests a pre-commit security review; or asks an AI agent to commit changes. Inspect the exact staged diff and repository rules, run fast relevant existing checks, escalate only for risk-triggering changes, and return an evidence-backed GO or NO-GO decision. Do not use this skill as a manual pre-commit hook or as a full-repository security audit.
---

# Audit a Commit

Audit the exact staged snapshot immediately before commit approval.
Keep the audit read-only, fast by default, and explicit about evidence gaps.

## Boundaries

- Treat the staged diff as the proposed commit. Do not silently include unstaged or untracked files.
- Do not stage, unstage, edit, commit, or change refs.
- Do not install tools, contact external services, or run full-history or full-repository scans by default.
- Never expose a discovered secret or personal value in output. Redact it and identify only its type and location.
- Do not claim that a GO decision proves absolute security, legal compliance, or regulatory certification.

If the exact scope has not been staged, report NO-GO and ask for the intended snapshot to be finalized first.
When used with `commit-message`, run this audit after its exact staging step and before final commit approval.
If HEAD or the index changes after the audit, invalidate the result and run the audit again.
Treat the result as valid only for the exact HEAD and staged snapshot observed by the final comparison.

## Quick Audit

1. Read the applicable repository instructions and identify mandatory pre-commit checks.
2. Inspect the proposed snapshot with:
   - `git status --short`
   - `git rev-parse --verify HEAD` to capture HEAD; record `unborn` when HEAD does not exist yet
   - `git diff --cached --stat`
   - `git diff --cached --name-status`
   - `git diff --cached --raw --no-abbrev --no-renames` to capture staged paths, modes, and object IDs for the final comparison
   - `git diff --cached --check` for whitespace errors and conflict markers only, not security findings
   - `git diff --cached`
3. Inspect staged files directly only when the diff is incomplete, such as new binary, symlink, generated, vendored, or unusually large content.
4. Verify that the staged scope matches the stated intent and contains no unrelated, accidental, or unexplained file.
5. Screen every applicable category using the staged snapshot. Do not inspect unchanged callers or run extra checks unless an escalation trigger exists. Use repository-provided scanners and the smallest relevant existing validation when they are already available and safe to run.
6. Re-run the HEAD and raw staged-diff commands and compare their exact results with step 2, then recheck `git status --short` and `git diff --cached --stat`. Return NO-GO if HEAD or the staged snapshot differs.

Stop after the Quick Audit when no escalation trigger exists.

## Audit Categories

Record each category as `Pass`, `Fail`, `Not checked`, or `Not applicable`.

- Use `Pass` when the category applies and sufficient evidence was checked.
- Use `Fail` when the audit observes a blocker.
- Use `Not checked` when the category applies but required evidence is unavailable or was not checked.
- Use `Not applicable` when the staged snapshot does not affect the category.

Do not create an evidence gap from hypothetical or undisclosed policies or checks.
If no applicable requirement is identified from repository instructions, the stated scope, or the staged change, use `Not applicable`.
Treat `Not checked` as blocking only when the missing evidence is required to decide:

- whether a suspected secret is present;
- whether changed security, data, or permission behavior is safe;
- whether added external code, assets, or artifacts have acceptable origin, license, provenance, and integrity;
- whether a mandatory repository check passed; or
- whether a specific applicable repository, legal, or organizational requirement identified from repository instructions, the stated scope, or the staged change is satisfied.

Treat any other `Not checked` as a warning and explain why resolving it cannot change the commit decision.

### Sensitive information

- Check for credentials, tokens, private keys, connection strings, internal identifiers, personal data, confidential content, and sensitive values in code, configuration, fixtures, logs, examples, and generated files.
- Check whether new logging, errors, telemetry, or test output can disclose sensitive data.
- Treat a suspected live secret as `Fail`. Do not test or use it.

### Security behavior

- Check changed trust boundaries, input validation, output encoding, authentication, authorization, session handling, cryptography, file and process operations, network requests, deserialization, error handling, and logging.
- Check for broader permissions, unsafe defaults, security-control bypasses, disabled verification, and fail-open behavior.
- On escalation, trace only the changed high-risk path far enough to verify its source, validation, authorization, and sink.

### Supply chain and provenance

- Review added or changed dependencies, lockfiles, registries, install scripts, CI actions, downloaded artifacts, generated content, vendored code, and binaries.
- Confirm a legitimate source, intended version or integrity evidence, and compatibility with repository license and attribution rules.
- Do not guess a license or provenance. When the snapshot adds or changes external code, assets, or artifacts and required evidence is unavailable, mark it as `Not checked`.

### Data and policy compliance

- Check collection, storage, transfer, retention, deletion, consent, and access changes involving personal, confidential, regulated, or customer data.
- Check repository instructions, approved scope, required generated copies, required documentation, and prohibited files or operations.
- When the staged change is governed by an applicable legal or organizational policy and required evidence is unavailable, mark it as `Not checked`; do not invent a conclusion.
- Do not assume an undisclosed policy applies.

### Verification integrity

- Check deleted or weakened tests, scanners, approvals, branch protections, validation commands, audit logs, and ignore rules.
- Confirm required checks apply to the staged content and did not pass only because files were skipped, ignored, generated later, or outside the checked scope.
- Distinguish a command that was run from evidence that it covered the proposed commit.
- When a mandatory check may mutate project files or the index, require a recorded successful run before the audited snapshot was finalized, then use available read-only evidence to confirm its expected output is included in that snapshot.
- If the required run is not evidenced or its output cannot be tied to the snapshot, report blocking `Not checked` and ask the user to run the check separately. Do not replace a required invocation with an equivalent state check.

## Escalation Triggers

The Quick Audit screens only the staged snapshot.
Perform a targeted deeper review, which may inspect unchanged callers, configuration, tests, and data flow, only when the Quick Audit cannot resolve a category or the staged snapshot introduces or changes security-relevant behavior in:

- handling, storage, or transfer of credentials, secrets, identity, personal data, or regulated data;
- authentication, authorization, sessions, cryptography, payments, destructive data operations, or audit logging behavior;
- externally influenced shell or process execution, file access, network destinations, permission boundaries, or executable CI/CD, deployment, infrastructure, or security configuration;
- dependencies, lockfiles, install hooks, generated or vendored code, binaries, licenses, or external assets;
- large, obfuscated, unreadable, or partially represented changes;
- a suspicious pattern, failed check, or blocking evidence gap found during the Quick Audit.

Do not escalate merely because documentation or examples mention a risk area or unchanged high-risk code exists.
For an escalation, inspect only the affected path.
Run the smallest existing targeted check that can resolve the risk.
If resolution requires installation, network access, a command that mutates project files or the index, a broad scan, or unavailable organizational evidence, do not start it implicitly. Report `Not checked`, explain the exact gap, and request separate authorization when that check is necessary.

## Decision Rules

Return `GO` only when:

- the exact staged scope matches the stated intent;
- no category has a `Fail` result;
- no blocking `Not checked` remains;
- applicable repository-required checks passed against the proposed snapshot; and
- the exact HEAD and raw staged-diff fingerprint matched at the final audit comparison.

Return `NO-GO` for any blocker, failed required check, scope mismatch, changed HEAD or staged snapshot, suspected secret, or blocking `Not checked` result.
A non-blocking `Not checked` is a warning and may accompany `GO`, but state why it cannot change the decision.
Do not commit. Final commit approval remains a separate user decision.

## Output

Report concisely:

1. `Decision: GO` or `Decision: NO-GO`.
2. The staged file scope and stated intent.
3. Findings ordered by `Blocker`, then `Warning`, with each finding's audit status. Include non-blocking `Not checked` under `Warning`. Provide redacted evidence, file and line when available, and the smallest remediation.
4. Commands and repository rules checked, including failures and skipped checks.
5. Whether the exact initial and final HEAD and raw staged-diff fingerprints matched at the final audit check, and that the result applies only to that observed snapshot.
6. A statement that no commit was created and separate commit approval is still required.

If there are no findings, say so directly rather than padding the report.

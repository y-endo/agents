---
name: define-project-conventions
description: >-
  Establish or audit project-specific coding conventions, directory structure,
  naming rules, quality tooling, and agent instructions through an
  approval-gated workflow grounded first in current official guidance and then
  in established ecosystem practice. Use for greenfield project setup, for an
  existing project with no documented conventions, or to check whether an
  existing project's rules are discoverable and enforceable by AI agents.
  Preserve existing rules by default: unless the user explicitly asks to revise
  them, report conflicts as facts and offer only additive recommendations.
---

# Define Project Conventions

Create a project-native convention contract without imposing a generic template or silently rewriting existing practice.

## Protect project authority

- Locate and obey all applicable governance before running project commands or inspecting project content, including root and nested `AGENTS.md`, `CLAUDE.md`, contribution guides, and repository policy.
- Treat the task as advisory until the user explicitly authorizes file changes. Separate audit, proposal, approval, application, and verification.
- Read the smallest representative set of manifests, lockfiles, runtime pins, source files, tests, tool configuration, CI, and documentation needed to establish facts.
- Do not inspect secrets, dependency contents, generated output, or unrelated product code.
- Do not change application behavior, dependencies, directory layout, or existing convention text unless separately authorized.
- Keep convention proposals and artifacts within convention documentation, verification-only enforcement, agent instructions, and their project-native configuration. Product features and runtime or content behavior are not convention deliverables, even at the proposal or design stage.

## Audit the current project

Derive an initial scope from the request and governing instructions. Inspect repository, package, language, generated-code, and infrastructure boundaries before expanding the audit. Ask the user only when an undiscoverable boundary would materially change the convention areas or deliverables in scope.

### Discover the stack

Identify only technologies that affect the requested conventions:

- languages, frameworks, runtimes, package managers, and verified versions
- application, library, generated, fixture, test, and infrastructure boundaries
- formatter, linter, type checker, test runner, build tool, and editor settings
- directory and file naming patterns actually used in representative code
- CI checks and local commands that currently enforce behavior

Distinguish evidence confidence as **Confirmed**, **Observed pattern**, or **Assumption**. A repeated pattern is observed practice, not automatically a rule.

### Find existing authority

Search project-native locations and tool configuration rather than relying on a fixed list of filenames. For each governing source, record:

- path and applicable scope
- whether it is normative documentation, executable configuration, or an implementation pattern
- precedence and any overlap with root or nested instructions
- whether an AI agent is told to read it before editing
- whether the stated verification command exists and runs in the relevant scope

Report contradictions between documentation, configuration, CI, and implementation as facts. Follow any applicable precedence or conflict-resolution procedure defined by governance; otherwise, do not silently choose a winner.

## Classify the audited areas

After completing the audit above, classify each convention area in scope from verified evidence, then follow the safest applicable path:

1. **Greenfield**: no established implementation or conventions govern the area.
2. **Existing with conventions**: normative written rules govern the area, or executable configuration is designated by governance, invoked by project commands or CI, or consumed by default by the verified toolchain, editor, or language server for that area.
3. **Existing without conventions**: implementation and structure exist, but neither normative written rules nor active executable configuration govern the area.

Treat a configuration file as active only after verifying that the applicable tool and version discover it for the affected scope, whether explicitly or by default. Otherwise keep it as evidence to investigate, not governing authority. In a mixed project, use **Greenfield** for unimplemented areas, **Existing with conventions** for governed areas, and **Existing without conventions** only for implemented but uncovered areas; absence of prose does not erase active executable rules.

If evidence is incomplete, report what was checked, list the evidence needed to resolve the classification, and ask a focused question before proposing changes. Do not treat an absent file name as proof that no rules exist.

Read [conversation-examples.md](references/conversation-examples.md) when the correct path or approval boundary is unclear. Read [deliverables.md](references/deliverables.md) before proposing a convention document, `AGENTS.md` integration, or final report.

## Research current recommendations

Research only after the local audit, and only for unresolved or requested topics.

Use this priority order:

1. current official guidance for the verified version
2. language or framework defaults and maintained first-party tooling
3. widely adopted ecosystem practice supported by current evidence
4. fit with the existing project
5. explicit team preference

Prefer primary sources. Record the source URL or document, relevant version, and access date. Do not claim that a rule is current, official, or common from model memory alone. If official guidance is silent or several official choices are valid, say so and explain the recommendation. Popularity is a tie-breaker, not a substitute for project fit.

Do not name a specific tool, framework, package manager, or layout as the recommended default before this evidence check. When research requires more context, ask about product and operational requirements without embedding an unverified choice in the question.

If required current sources cannot be accessed, mark the affected recommendation evidence `Not checked`. State that current, official, or common status is unverified, then ask whether to continue with only confirmed local evidence or defer the recommendation. Do not let unavailable external research block an otherwise useful local audit.

Do not research every possible topic. Cover only applicable items from this set:

- formatting, linting, types, imports, language constructs, and API boundaries
- directory ownership, dependency direction, file and symbol naming
- tests, fixtures, generated files, documentation, and comments
- errors, logging, configuration, environment variables, and dependency policy
- security basics, editor consistency, build checks, and CI enforcement

When initial project setup is in scope, assess a separate, applicable foundation baseline: runtime pinning and lockfile policy; ignore, line-ending, and editor settings; essential README or contribution guidance; CI; dependency update and security checks; and secret handling. Present gaps as optional foundation recommendations, not coding rules, and do not require one file per item.

Prefer existing tools and native capabilities. Add a dependency only when the approved rule cannot be enforced adequately without it.

## Follow the matching path

### Greenfield

Present a small recommended baseline for each verified language or framework. Explain official support, project consequences, and any unresolved choice. Decide one coherent group at a time:

1. stack and version policy
2. convention source and scope
3. directory and naming model
4. formatting, static checks, and tests
5. agent instructions and CI enforcement

Do not scaffold files, install tools, or create directories before approval.

### Existing with conventions

Evaluate whether an AI agent can discover and follow the current rules. Check the source of truth, scope, precedence, links from governing instructions, and runnable enforcement.

Preserve the existing contract. Unless the user explicitly requests revision:

- do not propose replacing, renaming, reorganizing, or rewriting an existing rule
- do not relabel a team choice as wrong merely because another choice is more common
- present only additive recommendations that do not change existing meaning
- if a recommendation conflicts with an existing rule, report the conflict and ask whether the user wants revision options; do not provide them yet

An `AGENTS.md` pointer to an existing source and its existing validation command is additive only when it does not alter the rule. Ask before editing it.

When the user explicitly authorizes a revision, treat it as a migration rather than a normal addition. Identify the exact current authority and target rule; inspect effects on existing code, configuration, CI, documentation, and downstream scopes; report compatibility and existing violations; agree on rollout and exceptions; and record the evidence and rationale in the proposal and final report. Permission to revise a rule does not by itself authorize code, dependency, or CI changes. Obtain exact-path approval under the change gate below.

### Existing without conventions

Infer a draft from the smallest representative sample. Separate:

- **Inferred practice**: consistent patterns already present but not yet authoritative
- **Exceptions or ambiguity**: competing patterns that require a decision
- **External recommendation**: current guidance not yet adopted by the project

Inspect the existing documentation hierarchy before proposing a project-native document location and outline that preserve the existing structure. If that hierarchy was not available, label any path as provisional. Ask whether to create it. Do not describe inferred practice as approved until the user accepts it, and do not reorganize code to make the draft appear consistent.

## Get decisions and approval

For each material decision, provide a recommendation, evidence, alternatives only when genuinely viable, and the effect of each choice. Ask one coherent decision group at a time unless the user requests a batch or delegates the choice.

After each group, maintain a compact checkpoint:

- verified project facts
- inferred but unapproved practice
- approved decisions
- additive recommendations awaiting approval
- unresolved conflicts or blockers
- deferred findings outside the current convention scope

Before changing files, show the exact paths to create or update, the purpose of each change, excluded files, and planned verification. Obtain explicit approval for that proposal. Existing-rule changes require explicit scope even if other additions were approved.

Treat short replies such as "OK" or "continue" as approval only for the exact proposal immediately pending. If no exact proposal is pending, return to the next agreed convention group or ask the user; do not promote a deferred finding or internal plan into scope.

## Make conventions enforceable

Use executable configuration as the source of truth for machine-checkable behavior. Use prose for architectural intent, naming decisions that tools cannot express, exceptions, and the commands that prove compliance. Avoid duplicating the same rule across documents.

Separate convention enforcement from product implementation. An enforcement change may verify or reject nonconformance, but it must not add or change what the product publishes or does at runtime. Treat routes, loaders, rendering, publication behavior, runtime APIs, and domain workflows as product work even when motivated by a written rule; defer the gap unless that product work is separately requested and approved.

Before introducing or tightening a formatter, linter, type checker, test, or required CI check in an existing project, establish the current violation set without applying automatic fixes. Agree on its scope and choose an explicit rollout: fix existing violations now, adopt a reviewed baseline, check changed files only, or phase in documented temporary exclusions. State when the check becomes required in CI. Do not auto-fix the repository or enable a predictably failing required check before that rollout is approved.

When integrating with `AGENTS.md` or equivalent governance, make the smallest project-native addition that states:

- the normative convention path
- the scope to which it applies
- any established precedence
- when the agent must read it
- exact validation commands for the affected scope

Account for nested instruction files. A root pointer does not override a more specific governing file. Do not claim agent compliance merely because a document exists.

## Verify and finish

Run only approved, project-native checks. Verify that referenced paths and commands exist, tool configuration matches the written contract, nested scopes remain coherent, and no unapproved rule was changed. For a newly introduced or tightened check, distinguish agreed baseline violations from new regressions and do not report adoption complete until the approved rollout state passes.

Read [deliverables.md](references/deliverables.md) and use its **Final report** contract.

Stop at the authorized boundary. A completed audit does not authorize implementation.

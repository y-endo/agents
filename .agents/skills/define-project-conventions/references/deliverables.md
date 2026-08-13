# Deliverables

Read this file before proposing or producing project convention artifacts.

## Choose a project-native source of truth

Prefer, in order:

1. an existing convention location explicitly designated by project governance
2. an existing contributor or development guide that already owns engineering practice
3. one focused document under the project's established documentation hierarchy

Do not introduce a new documentation hierarchy only for this skill. For a small project, a concise section in an existing contribution guide may be enough. For a multi-language or multi-package repository, one overview may point to scoped documents, but create separate files only when ownership or applicable checks genuinely differ.

Before proposing a path, state why it fits the repository and which alternatives were rejected. Do not use a generic filename as an unexplained default.

## Separate responsibilities

Keep each fact in one authoritative place:

| Concern | Preferred authority |
|---|---|
| Formatting, lint, type, test behavior | Executable tool configuration |
| CI-required checks | CI configuration and referenced commands |
| Architecture and dependency direction | Convention document |
| Naming not enforceable by tools | Convention document |
| Agent discovery, scope, and required workflow | Applicable `AGENTS.md` or equivalent |
| Tool and runtime versions | Manifest, lockfile, or runtime pin |

The prose document should point to executable configuration instead of copying every option.

## Convention proposal outline

Adapt this outline to the project. Omit sections with no verified need.

1. Purpose, authority, and scope
2. Verified stack and supported versions
3. Source and directory boundaries
4. File and symbol naming
5. Language and framework rules
6. Formatting and static analysis
7. Tests and fixtures
8. Errors, logging, and configuration
9. Dependencies, generated files, and documentation
10. Required local and CI checks
11. Explicit exceptions and how they are approved

Label each rule's decision status as one of:

- **Existing authority**: already authoritative
- **Inferred practice**: derived from consistent implementation, not yet approved
- **Recommended addition**: supported by current evidence, not yet approved
- **Approved decision**: accepted by the user or current project authority

These labels describe rule decisions, not evidence confidence. Remove them from the final normative document unless the project uses them as part of its governance.

## Minimal agent-instruction pattern

Adapt wording and headings to the repository. Do not copy this block blindly.

```markdown
## Project conventions

Before changing files in `<scope>`, read `<normative-path>`.
Follow the executable formatter, lint, type-check, and test configuration as the source of truth for machine-checkable rules.
Run `<exact-command>` for changes in this scope.
More specific nested instructions take precedence where their documented scope applies.
```

If the repository already defines precedence, preserve its wording. If no exact validation command exists, do not invent one; record it as unresolved.

## Final report

Use a compact report with:

1. project and convention-area classification and inspected scope
2. current sources of truth and agent-discoverability result
3. approved files created or changed
4. existing rules intentionally left untouched
5. evidence table with recommendation, rule decision status, evidence confidence, version, source, and access date
6. verification results and limitations
7. unresolved decisions, additive recommendations, and deferred out-of-scope findings with the separate authorization they require

Use `Not checked` when evidence was unavailable. Do not convert an audit into a compliance certification.

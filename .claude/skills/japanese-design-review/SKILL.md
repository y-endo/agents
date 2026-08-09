---
name: japanese-design-review
description: Review Japanese-language websites and browser-based product UI for user-task fit, information architecture, Japanese writing and typography, visual hierarchy, responsive behavior, interaction states, accessibility, and brand-specific originality. Use for pre-release design review, implementation or design-diff critique, mobile Japanese line-break review, dense business UI review, or evidence-limited review of an existing project. Report evidence-backed hard gates and severity-ranked findings. Do not use to discover a new visual direction, write a DESIGN.md, implement UI, certify WCAG conformance, or review native apps, print, video, or spatial design.
---

# Review Japanese Web Design

Review the smallest requested web surface and make release or revision risks clear to a non-designer.
Treat the project, its users, and its real Japanese content as the primary evidence.

## Protect the boundary

- Read all governing project instructions before project inspection or commands.
- Treat a review request as read-only unless the user separately requests implementation.
- Work without `design-spec`, `DESIGN.md`, Figma, or a design system.
- When a design contract or accepted reference exists, use it as project evidence rather than as a dependency of this skill.
- Route visual-direction discovery and `DESIGN.md` creation to `design-spec` when available.
- Route Figma-backed implementation or resynchronization to `figma-codegen` when available.
- Do not upload private code, screenshots, assets, or user data to an external service without authorization.
- Do not claim expert design approval, usability-test evidence, or accessibility certification.

## Load details only when needed

- Read [review-criteria.md](references/review-criteria.md) before judging a screen, page, flow, component, or release.
- Read [source-cards.md](references/source-cards.md) before applying a general Japanese design rule or citing an external source.
- Read [content-test-cases.md](references/content-test-cases.md) before testing Japanese copy, line breaks, responsive typography, or UI states.
- Read [conversation-examples.md](references/conversation-examples.md) when the requested scope is vague, evidence is incomplete, or the review concerns only one component.

## Follow the evidence order

Resolve conflicts in this order:

1. verified project users, tasks, real content, constraints, and supported environments;
2. applicable accessibility standards and Japanese layout requirements;
3. verified project brand rules, design contracts, components, and tokens;
4. scoped source cards with rationale, exceptions, and verification;
5. annotated Japanese examples, awards, galleries, and trends.

Never treat a domestic example, award, gallery entry, or book as proof of usability, conversion, or project fit.
Do not replace a project-specific decision with a generic design-system default.

## Follow the review workflow

### 1. Establish scope

Identify the exact page, screen, flow, component, or diff under review.
Determine whether the user needs a focused critique, a release decision, or a baseline review with limited evidence.
Inspect the smallest representative surface and its obvious governing content, styles, components, routes, and tests.

Record or discover:

- primary user and task;
- page or feature purpose;
- real Japanese content;
- supported viewport range and relevant device classes;
- required normal, hover, focus, selected, disabled, loading, empty, error, and success states;
- brand, implementation, performance, and accessibility constraints;
- available render, DOM, reading-order, focus-order, and interaction evidence.

Ask only for material information that cannot be found locally.
Do not block a narrower evidence-limited review when useful findings remain possible.

### 2. Separate evidence from assumptions

List the artifacts actually inspected.
Mark inferred project facts as assumptions and explain their effect on the review.
Use `Not checked` when evidence required for a claim is unavailable.
Use `Not applicable` only when a gate is outside the approved review scope.
Never convert `Not checked` into a pass.
Determine gate applicability from the target and approved scope before considering evidence availability.

For visual claims, inspect a current rendering at the target viewport whenever the environment permits it.
Code alone does not prove rendered line breaks, clipping, hierarchy, focus visibility, or responsive order.
Do not treat a missing declaration in partial code or CSS as evidence that a rendered presentation, state, or behavior is absent.
When artifact completeness cannot be established, use `Not checked` instead of `Fail`.

### 3. Test representative Japanese content

Use the product's real copy first.
Add only the boundary cases relevant to the target from [content-test-cases.md](references/content-test-cases.md).
Check supported narrow and wide widths, browser zoom up to 200% when applicable, and changed fonts or text size when the environment supports them.

Do not optimize a manual line break for one screenshot.
Accept a deliberate break only when it preserves meaning and remains valid across the supported conditions where it appears.

### 4. Review by user impact

Apply [review-criteria.md](references/review-criteria.md) in this order:

1. user task and information architecture;
2. Japanese writing and typography;
3. visual hierarchy and attention order;
4. responsive behavior and UI states;
5. interaction and accessibility;
6. brand fit and project-specific originality.

Evaluate attention order from the user's task, not from an assumed F-pattern or Z-pattern.
Check desktop and mobile separately.
Compare visual order with DOM, reading, and focus order whenever those artifacts are available.

### 5. Judge gates and findings

Evaluate every applicable hard gate as `Pass`, `Fail`, `Not checked`, or `Not applicable`.
Any `Fail` prevents a passing release recommendation.
Any material `Not checked` makes the result partial and prevents a complete release recommendation.

Report findings in descending severity:

- `Blocker`: prevents the primary task, comprehension, operation, or a responsible release decision;
- `Major`: creates substantial load, error risk, or misunderstanding for affected users;
- `Minor`: causes localized friction, inconsistency, or reduced readability;
- `Suggestion`: offers a supported improvement without identifying a requirement failure.

Do not assign a numerical score.
False precision does not replace calibrated user or product evidence.

### 6. Report for action

Report in this order:

1. review scope and evidence used;
2. hard-gate table;
3. severity-ranked findings;
4. unverified areas and residual risks;
5. rerun steps.

For each finding include:

- finding ID and severity;
- exact location;
- observed fact, kept separate from interpretation;
- affected user and task;
- project requirement or source-card ID;
- correction direction, without silently implementing it;
- verification method;
- confidence.

Lead with blockers and major findings rather than compliments.
Mention working decisions only when preserving them affects the correction.
Use the user's language, defaulting to Japanese for a Japanese-language project.

## Avoid generic review behavior

Do not reject gradients, glass effects, large rounded cards, bento grids, abstract 3D objects, centered heroes, glow, particles, or illustration merely because they are common in generated work.
Flag them only when evidence shows that they lack a project-specific reason, obscure hierarchy, impair a task, conflict with the brand, or imitate a source-identifying combination.

Do not enforce a stereotyped "Japanese look."
Japanese-language fitness concerns content, composition, user expectations, and context, not a mandatory visual style.

## Bundled resources

- [review-criteria.md](references/review-criteria.md): hard gates, review dimensions, severity, and report contract.
- [source-cards.md](references/source-cards.md): scoped rules, source roles, exceptions, and current source catalog.
- [content-test-cases.md](references/content-test-cases.md): Japanese content and state boundary cases.
- [conversation-examples.md](references/conversation-examples.md): standalone, focused, and evidence-limited review examples.

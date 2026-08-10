# DESIGN.md Templates

Read this file immediately before creating or revising a design contract. Use the project's established contract format when one exists. Otherwise start from the applicable template and remove every section that does not affect implementation or a required check.

## Contents

1. Quick template
2. Standard template
3. Writing rules

## Quick template

```markdown
# Design Contract: <changed scope>

## Status

- Scope: <affected component or screen>
- Document: <Draft or Ready for implementation>
- Baseline: <verified file, commit, or version>
- Typography hard gates: <font-size clamp/vw and text max-width/ch decisions, or not affected>
- Width model: <affected full-width regions, max-width regions, gutters, and article measure, or not affected>
- Visual reference: <project-approved relative path, scoped reference to establish for a visual Quick change, or not required for non-visual Quick work>
- Candidate selection approval: <selected option IDs and approval evidence or not required>
- Final combined-context approval: <approval evidence or not required>
- Blocking Unresolved: <none or concise list>

## Implementation Contract

- <required changed rule>
- <inherited rules that prevent regression>
- <states, responsive behavior, accessibility, or localization affected by this change>
- <explicit exclusions>

## Current Decisions

| Decision | Label | Evidence or authority | Rationale |
|---|---|---|---|
| <material changed decision> | <Approved, Proposed, Default, or Unresolved> | <source> | <why> |

## Checks

| Check | Result | Evidence or limitation |
|---|---|---|
| <required check> | <Pass, Fail, or Not checked> | <source> |
| Final combined-context approval | <Pass, Fail, or Not checked> | <approval evidence for a visual Quick change> |
```

Do not add product-wide discovery, references, foundations, or a full component inventory to a narrow change unless the requested decision affects them.

## Standard template

```markdown
# Design Specification: <product or affected area>

> <one sentence describing the product-specific direction and primary task>

## Status

- Scope: <greenfield, redesign, or affected area>
- Document: <Draft or Ready for implementation>
- Baseline: <verified commit, version, or greenfield evidence>
- Viewport-fluid font sizing: <Approved or rejected; authority and scope>
- Text measure in `ch`: <Approved or rejected; authority and scope>
- Width model: <full-width outer regions; max-width inner regions; desktop and narrow gutters; article readable measure>
- Page shell: <approved one-, two-, or three-column structure, region purposes, and narrow transformation>
- Shell components: <required or omitted header, footer, and sidebar with product reasons>
- Visual reference: <project-approved relative path or blocking Unresolved>
- Candidate selection approval: <selected option IDs and approval evidence>
- Final full-page atmosphere approval: <desktop and narrow approval evidence>
- Calibration evidence: <five layout IDs; five IDs for each required shell component and applicable category; five palette IDs; selections, palette interaction check, coherence approvals>
- Approval authority: <project authority, stakeholder, or delegated scope>
- Blocking Unresolved: <none or concise list>
- Checks: <Pass, Fail, and Not checked summary>

## Implementation Contract

### Composition and hierarchy

<full-width and contained regions, gutters, article measure, page-shell columns, header/footer/sidebar responsibilities, focal point, reading path, density, and responsive transformations>

### Visual system

<link to the accepted visual reference and require its visible backlink to this file; project-native tokens, typography roles, color pairings, spacing, shape, surface, imagery, icon, and motion rules that implementation needs>

### Components, content, and states

<component-family grammar, anatomy, variants, content limits, interaction and lifecycle states, and recovery behavior>

### Accessibility and localization

<declared standard and version, focus, keyboard, target sizing, non-color cues, errors, reduced motion, zoom or reflow, supported writing systems, expansion, and directionality>

### Prohibited substitutions

<specific shortcuts that would destroy the approved direction or product fit>

## Product and Experience

- Primary users and task: <evidence-backed summary>
- Intended impression: <approved qualities>
- Product-specific source material: <objects, actions, information shape, history, or language>
- Main screens and flows: <scope>

## Approved Direction

<current first-view idea, product meaning, selected direction, and material tradeoffs>

### References

For each reference, record URL or supplied source, observation date when inspected, evidence limitations, and use as Inspiration or Target.

For each Target, include the post-approval fidelity brief:

- scope: <aspect or affected direction; screen, state, and viewport>
- required similarities: <structural or experiential relationships>
- product-specific adaptations: <required original expression>
- must not copy: <identity, assets, copy, or source-identifying combination>
- acceptance checks: <observable comparison>

## Responsive, Content, and Platform Rules

<content-driven transformations, overflow, input methods, themes, supported languages, and platform constraints not already clear in the contract>

## Current Decisions

| Decision | Label | Evidence or authority | Rationale and consequence |
|---|---|---|---|
| <material decision only> | <Approved, Proposed, Default, or Unresolved> | <source> | <why it changes implementation> |

## Check Contract and Evidence

| Required check | Pass criteria | Result | Evidence or limitation |
|---|---|---|---|
| Text conformance | <scope-specific criteria> | <Pass, Fail, or Not checked> | <source> |
| Rendered conformance | <scope-specific criteria> | <Pass, Fail, or Not checked> | <source> |
| Accepted visual reference | <selected component relationships and palette are represented> | <Pass, Fail, or Not checked> | <source> |
| Target fidelity | <scope-specific criteria or not applicable> | <Pass, Fail, or Not checked> | <source> |

## Unresolved

| Item | Blocking? | Why it matters | Evidence or decision needed |
|---|---|---|---|
| <remaining item> | <yes or no> | <implementation effect> | <next evidence> |
```

## Writing rules

- Put the Implementation Contract before background so an implementation agent can act without reading a design diary.
- Treat the file as the current contract. Replace changed rules and delete stale content instead of appending history.
- Do not add a changelog, revision history, dated adjustment notes, superseded decisions, or rejected alternatives. Use Git history when an older state is needed.
- Describe relationships and consequences, not only token values or library names.
- Use representative real content when approving hierarchy and typography.
- Record only material decisions. Omit routine values that follow an approved token or component rule.
- Express a still-relevant rejected treatment as a current prohibited substitution without preserving its history.
- Use `Default` only for reversible low-risk choices that do not establish visual character.
- Keep or return the document to `Draft` if a blocking Unresolved item or required-check `Fail` remains. A `Not checked` result also blocks readiness when its evidence is required to implement without guessing or support a claimed conformance result.
- Avoid placeholders. Omit an inapplicable section instead of writing “N/A” repeatedly.

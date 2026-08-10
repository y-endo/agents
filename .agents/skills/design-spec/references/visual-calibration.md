# Visual Calibration

Read this file before creating component or palette comparisons, an accepted visual reference, or a Design Probe.

## Contents

1. Required calibration
2. Artifact paths and ordinary safety
3. Width-model gate
4. Page-shell decision
5. Temporary comparison sheet
6. Candidate requirements
7. Selection and coherence pass
8. Accepted visual reference
9. Later adjustments

## Required calibration

Every Standard contract marked `Ready for implementation` must have a current accepted visual reference covering the applicable visual system. An existing reference may satisfy this requirement only when it:

- is mutually linked with the current contract
- contains the affected categories and representative responsive context
- still matches the current Approved decisions and verified implementation baseline
- is not made stale by the requested work

If any condition fails, run calibration before readiness. A flow or state revision fully governed by an existing visual system is Quick rather than Standard, even across several screens.

For visual Quick work, compare the affected category and its immediate context. If the accepted reference already covers the category, replace only that sample and preserve every unaffected accepted sample. If it omits the category, merge the approved sample and necessary context without removing existing samples. If no accepted reference exists, use the verified current implementation and contract as the baseline and create a limited reference for the approved Quick scope. Do not expand Quick into product-wide calibration solely to establish a reference.

When the change is visual, render three affected candidates in the temporary HTML. Prose or an unrendered token list may frame the options but cannot complete selection. If the user skips required calibration, keep the contract `Draft` and mark visual calibration as blocking Unresolved.

## Artifact paths and ordinary safety

Use project-root-relative paths unless the project already defines equivalent locations:

- Temporary comparison: `tmp/design-spec/<task-id-or-scope>/calibration.html`
- Accepted reference: normally `design-spec/references/visual-reference.html`

Choose a task identifier or scope slug that makes the temporary path unique to the current task. Never reuse a shared fixed temporary file. Before creating the comparison, record the accepted-reference path in the checkpoint. If the normal accepted path conflicts with another artifact, stop until the user resolves the conflict or explicitly approves another project-relative path. Use the approved path consistently in the contract and checks.

Before writing, replacing, or removing an existing artifact path:

1. Confirm that governing repository instructions have already been read and that the exact path is inside the project root.
2. Inspect the exact file and its exact Git status.
3. Stop if the path is a symlink, contains uncommitted changes, or cannot be identified as a design-spec artifact owned by the project.
4. Never remove a tracked accepted reference automatically. Obtain user approval before replacing it.

Mark generated HTML so its purpose and governing contract are identifiable:

```html
<meta name="design-spec-artifact" content="calibration">
```

The accepted reference instead uses `content="visual-reference"` and contains the visible contract backlink defined below. A marker does not authorize overwriting a dirty or otherwise ambiguous file.

Replace or remove a temporary file only when it is untracked, has the calibration marker, belongs to the current task path, and was created by the current task. Otherwise leave it untouched and report the conflict. Never delete the accepted reference automatically.

This workflow protects against accidental overwrite in ordinary single-agent Git work. It does not provide transaction guarantees against malicious local processes, concurrent writers, or crashes. If concurrent modification or other interference is suspected, stop and let the user resolve it.

## Width-model gate

Before Standard direction exploration or calibration, explicitly approve one shared site-width model:

1. Which outer regions span the available viewport, such as header and footer backgrounds, hero bands, or section bands.
2. Which inner regions use a maximum width, such as header and footer content, the page shell, main content, or an aside, and whether they share a container.
3. Which project token or approved value supplies the screen-edge gutter at desktop and narrow widths.
4. How the article readable measure relates to the site container, including its unit and narrow-width behavior. It must also obey the `ch` hard gate.

Treat an outer landmark and its inner content as separate decisions. A full-width header or footer may contain a centered max-width inner wrapper; do not constrain the outer landmark merely because its content is contained. Prefer the available containing width over `100vw` when the latter would introduce scrollbar overflow. Use verified project values or explicit options instead of inventing widths and gutters.

Apply the approved width model to every candidate. In the comparison and combined previews, make outer and inner boundaries judgeable with representative short and long content. If any part remains unanswered, stop before candidate generation and keep the contract `Draft`.

## Page-shell decision

After direction approval and before component candidates, resolve the page shell in this order:

1. Present one-, two-, and three-column structures with the same representative content. Explain the primary content region, the task served by each additional column, and how each structure transforms at narrow widths. Include another structure only when product evidence requires it.
2. Ask only for approval of the column structure, region order, and narrow transformation in this decision group. Do not ask whether header, footer, or sidebar is required yet. Do not add a column merely to hold decoration or generic secondary content.
3. After that answer, confirm header, footer, and sidebar separately in the next decision group. State the product task, content, and responsive behavior of each. Omit a shell component when it has no approved responsibility.

This gate chooses the structural family; it is not one of the five-candidate groups. Within the approved family, create five page-shell layout candidates and five candidates for each required header, footer, and sidebar. Use stable IDs such as `SHELL-A`, `HEADER-B`, `FOOTER-C`, and `SIDEBAR-D`. Preserve a logical DOM, reading, and focus order when a multi-column shell stacks or changes at narrow widths.

## Temporary comparison sheet

Create one standalone, network-independent HTML document using representative product content. It should be easy to open locally and compare at desktop and narrow widths.

Before generating it, resolve the typography and width-model hard gates from `SKILL.md`. Do not place `clamp()` or viewport units in `font-size`, or `max-width` in `ch` on text-content containers, unless the corresponding gate is explicitly Approved. Apply the same gate decisions to every candidate so an unapproved technique or accidental width change cannot enter through one option.

For Standard work, include only applicable categories from this set:

- `h1`–`h5` hierarchy and body or metadata roles
- boxes or surfaces
- page-shell layout within the approved column structure
- header, footer, and sidebar when the page-shell decision requires them
- cards
- buttons and links
- tables
- lists
- forms, navigation, charts, media, or another product-critical category when present
- five coherent palettes expressed through semantic roles such as canvas, surface, text, muted text, border, primary, accent, success, warning, and danger

For Quick work, include the current baseline, three candidates for the affected category, necessary states, and enough surrounding context to judge the relationship. Keep unrelated categories unchanged.

Place every candidate group in a single vertical comparison column at all viewport widths. Do not use a side-by-side candidate grid. This rule governs the comparison sheet, not the rendered site shell inside a candidate: a selected two- or three-column site layout must remain visible within its full-width preview. Give each candidate the available preview width so Japanese content, tables, responsive transformations, and component relationships remain judgeable.

Implement the five palettes as a native radio group with a `fieldset`, a `legend`, and visible palette names. Store each palette in semantic CSS custom properties. When a radio changes, a small inline script must update a `data-palette` value on the common preview ancestor that contains every candidate and the combined preview. Every candidate must consume the same active semantic properties, so the chosen palette immediately restyles the whole proposal instead of changing only swatches. Keep a usable default palette when JavaScript is unavailable; persistence is unnecessary for this temporary artifact. Preserve visible keyboard focus and a non-color selected-state cue.

Avoid remote fonts, scripts, images, analytics, or dependencies unless the user explicitly authorizes them and they are necessary. Label unavailable assets or behavior rather than substituting a misleading approximation.

## Candidate requirements

For each applicable Standard category, show exactly five candidates. Show exactly five palettes. Keep representative content, viewport, and state constant within a category so the visual decision is observable.

Give every Standard candidate a distinct product-specific design intent. Each must connect different product evidence or a different interpretation of the approved direction to visible consequences in hierarchy or component grammar and in relevant relationships such as emphasis, density, borders versus surfaces, alignment, content grouping, or action treatment. Do not derive five options from one base by changing only color, font, radius, spacing, shadow, or decoration. If five defensible intents cannot be produced, return to Explore instead of filling the sheet with near-duplicates. Quick candidates may vary only the requested axis while preserving all unrelated properties.

Give every option a short stable label such as `TYPE-A`, `SURFACE-B`, `CONTROL-C`, or `PALETTE-D`, plus one sentence explaining the product consequence. Do not present an option that violates approved requirements merely to fill the count.

## Selection and coherence pass

Ask the user to select, combine, or reject the candidates for every applicable category and the palette. Record the selection checkpoint before combining them.

Combine the selections into a representative full page using the same product content at desktop and narrow widths. Include the approved page shell, every required header, footer and sidebar, the primary task, and enough supporting content to judge the balance between chrome and content. Verify that full-width outer regions span the preview while their inner content, gutters, and article measure follow the approved model. Check typography, spacing, surface hierarchy, component emphasis, semantic color pairings, reading path, density, focus, states, and responsive behavior together. If selections conflict, explain the conflict and propose the smallest correction that preserves the user's intent. Obtain approval for that correction.

Candidate selection is not final approval. After the coherence pass, show the full-page combined sample and ask the user to approve its overall atmosphere and composition as the accepted visual source for the stated scope. If isolated choices feel wrong together, revise the affected selection or candidate rather than treating the mismatch as approved. Do not silently alter the page after approval.

## Accepted visual reference

Save only the final approved system at the project-approved accepted-reference path. Remove rejected candidates and obsolete visual rules. The accepted file is a current-state reference, not a comparison archive or changelog.

The accepted file must:

- keep the `visual-reference` ownership marker
- state its covered and intentionally omitted categories
- include representative responsive context and states used for approval
- contain the applicable accepted semantic colors, typography, layout, and components
- contain a visible relative link back to the governing contract:

```html
<a data-design-spec-contract href="<relative-path-to-DESIGN.md>">DESIGN.md</a>
```

Link the accepted HTML from `DESIGN.md` and verify that both links resolve. Translate its accepted relationships into project-native tokens, components, responsive rules, states, and prohibited substitutions. If the text and HTML disagree, keep the contract `Draft` and resolve the conflict with the user.

A Quick reference created without an existing reference includes only the affected category, necessary context and states, and a limited-coverage note. A later Quick change must preserve every unaffected sample and merge or replace only the approved affected sample. Never replace a multi-category reference with only the newest category.

The accepted HTML is a visual reference, not copy-ready production code. Implementation may adapt markup to the project stack while preserving the approved visual relationships and accessibility contract.

## Later adjustments

When an approved visual rule changes:

1. Classify the change again. Quick compares three candidates for only the affected category and necessary context. Standard compares five candidates with distinct design intent for every applicable category and five palettes.
2. Obtain category selection and final combined-context approval.
3. Recheck the accepted path and obtain user approval before replacing it.
4. Preserve unaffected accepted samples, replace or merge the affected sample, and update the current rules in `DESIGN.md`.
5. Verify the mutual links and required checks. Remove only a current-task temporary file that passes the ordinary safety rules above.

Do not append a change record to either artifact. Use Git history when prior states must be recovered.

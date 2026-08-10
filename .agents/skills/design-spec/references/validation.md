# Design Specification Checks

Read this file before planning a Design Probe or reporting that a design contract has been checked.

## Use precise results

Declare the checks required for the affected scope and report each as:

- **Pass**: the stated criteria were checked against named current evidence.
- **Fail**: current evidence contradicts the contract or criteria.
- **Not checked**: evidence, authorization, tooling, or evaluator is unavailable.

Do not replace `Not checked` with inference. Do not use an unqualified “validated.” Name the check, evidence, review context, coverage, omissions, and result.

After checking, keep or return the document to `Draft` when any readiness check is `Fail`. A `Not checked` result also blocks readiness when the missing evidence is required to implement the affected scope without guessing or to support a claimed conformance result. Mark `Ready for implementation` only when every readiness check passes.

## Same-agent conformance check

Use the authoring agent's conformance check as the default available path. It can verify whether the contract is internally consistent and whether supplied or rendered evidence conforms to it. It cannot establish independent design quality, accessibility conformance, stakeholder fit, or usability.

Check the applicable items:

- implementation rules are traceable to project facts, Approved decisions, Defaults, or explicit Unresolved items
- `DESIGN.md` and the accepted visual reference contain only the current approved state, with no appended change history or stale alternatives
- no blocking Unresolved item is hidden behind a Default
- composition, focal point, reading path, hierarchy, density, and responsive transformation agree across sections
- product-specific source material has visible implementation consequences
- the direction does not depend on an unexplained bundle from the generic AI styling catalog
- applicable flows, content cases, component variants, loading, empty, error, success, disabled, permission, and recovery states are covered
- tokens, component names, units, and output format match the actual project or the recorded greenfield proposal
- accessibility behavior and supported writing systems have concrete implementation rules
- qualitative preferences do not silently become arbitrary numeric thresholds
- the `clamp()` plus `vw` font-size gate and the `max-width` in `ch` text-measure gate have explicit answers whenever applicable, and the artifacts obey them
- each Target has explicit approval, scope, required similarities, original adaptations, prohibited copying, and observable acceptance checks
- every Standard contract marked Ready has a current accepted visual reference, with either reuse evidence or final combined approval
- `DESIGN.md` and the accepted visual reference link to each other and resolve to the exact current files

## Rendered conformance

Use rendered evidence when text alone cannot show the approved relationships. Compare the current implementation with the accepted visual reference first, then use a user-supplied artifact or an authorized temporary Design Probe for material relationships outside its coverage.

Record:

- source and generation or observation date
- review context: `Same-agent` or `Fresh-context agent`
- screens, states, content, writing systems, input methods, and viewports covered
- material omissions
- criteria checked and `Pass`, `Fail`, or `Not checked` result
- claims the evidence cannot support

Check relationships rather than isolated feature presence: focal point, relative scale, alignment, density, rhythm, content-to-interface balance, typography roles, imagery, surface hierarchy, motion, and responsive transformation. The accepted visual reference establishes only its declared coverage. Use a representative task composition when page-level decisions exceed that coverage.

For a Target, compare against the approved reference evidence only when that evidence remains available and is permitted for use. Pixel identity is not required. Fail when isolated details appear but the approved structural or experiential relationship is materially lost. Mark `Not checked` when the reference cannot be reproduced reliably.

## Accepted visual reference

For every Standard contract marked `Ready for implementation`, verify:

- the reuse decision proves the existing reference remains current and covers the affected scope, or the final combined sample received explicit approval
- the width-model gate records full-width outer regions, max-width inner regions, desktop and narrow screen-edge gutters, and article readable measure without inventing values
- desktop and narrow evidence shows every approved full-width outer region spanning the available preview while its inner content follows the approved container and gutter rules
- the article measure remains distinct from the site container when approved and complies with the `ch` hard gate
- page-shell evidence compares one-, two-, and three-column structures, records the approved structure and region purposes, and defines its narrow-width transformation
- header, footer, and sidebar are each marked required or omitted with a product reason; every required shell component has exactly five candidates and one approved selection
- calibration evidence names every applicable category, exactly five design-intent candidates per category, exactly five palettes, one selection per category and palette, any coherence correction approval, and final combined approval
- all comparison groups remain in one vertical column at every viewport; internal previews still render the approved multi-column site shell where applicable
- changing the native palette radio group applies the selected semantic color properties to every candidate and the combined preview, while keyboard focus and a non-color selected-state cue remain visible
- the final desktop and narrow previews combine the approved shell, required shell components, primary task, and representative content, and have explicit approval for overall atmosphere and composition
- the project-approved accepted-reference path named in `DESIGN.md` contains only accepted styles and current coverage
- `DESIGN.md` links to that HTML, and the HTML contains a visible resolving link back to `DESIGN.md`
- the path is not a symlink, its exact Git status is clean before replacement, and the ownership marker and contract backlink identify it as the project design-spec artifact
- the user approved replacement of an existing accepted reference
- the current accepted sample agrees with the contract and contains no rejected alternatives or change history

For a Quick visual change, verify:

- the comparison rendered exactly three candidates for the affected category and enough context to judge them
- candidate selection and final combined-context approval are separate evidence
- a new limited reference uses a verified current implementation or contract baseline
- every unaffected sample from an existing reference remains present
- an omitted category is merged without replacing unrelated accepted content
- the same path-safety, replacement approval, current-state, and mutual-link checks above pass

Use `Fail` when the accepted file and current contract disagree, when a required link is missing, when replacement lacks approval, or when an existing path is a symlink, dirty, or of unknown ownership. Return the document to `Draft`, resolve the conflict with the user, then update the current artifacts instead of recording it as history.

These checks protect ordinary single-agent Git work. They do not claim transaction safety against malicious local processes, concurrent writers, or crashes. Suspected interference requires stopping rather than claiming readiness.

## Design Probe

Create a Design Probe only when the user authorizes visual probing. Build the smallest temporary artifact that makes the affected decisions observable.

Do not create a Design Probe merely to repeat component and palette calibration already covered by the accepted visual reference. Use it for page-level composition, responsive transformation, motion, or another material relationship outside that reference.

- Include representative content, not generic placeholder prose.
- Include the primary task composition and only the affected component states.
- Use project-native tokens, units, and conventions when they exist.
- For greenfield, use only values supported by the approved direction or clearly label them Proposed.
- Keep it network-independent unless remote material is explicitly authorized and required.
- Do not add product dependencies or treat the probe as production implementation.
- Declare omitted behavior such as real data, complex motion, media, device APIs, performance, or assistive technology.

Keep the probe temporary by default. Ask before retaining it in the repository, changing ignore rules, or incorporating it into product code.

## Fresh-context agent review

Use a fresh-context reviewer only when the environment provides one and the extra check is proportionate to the task. Give it the raw design contract, approved inputs, relevant repository evidence, artifact, and check criteria. Withhold the authoring agent's expected result and diagnosis.

Treat its output as another conformance review, not as independent evidence. A fresh agent does not approve material decisions and does not establish human design quality, accessibility, or usability.

If no fresh-context reviewer exists, continue with the same-agent check. Do not leave the workflow structurally blocked by an optional reviewer.

## Accessibility and usability claims

Verify current numeric accessibility criteria from the declared project standard or authoritative source. Visual inspection can check some contrast, focus appearance, target appearance, reflow, and motion behavior, but it cannot prove semantics, keyboard operation, assistive-technology behavior, or task success.

Use implementation or technical evidence for accessibility claims. Use actual or representative users performing relevant tasks for usability claims. Stakeholder approval confirms intent only; it is not usability evidence.

## Route findings

- Wrong impression or material visual choice: return to Explore and Approve.
- Component grammar or palette mismatch: return to Calibrate, replace the accepted visual reference, then update the current contract.
- Approved direction is right but the contract is ambiguous: return to Specify.
- Missing flow, state, content case, or responsive behavior: update requirement mapping, then Specify.
- Missing visual state or accepted-reference sample: return to Calibrate, update the accepted reference, then Specify.
- Contract is clear but the probe is wrong: revise only the probe.
- Missing runtime, device, performance, accessibility, or user evidence: keep the check `Not checked` until appropriate evidence exists.

Stop when the authorized deliverable is complete, the user pauses, or a blocking decision requires new authority. Repeated cosmetic revisions are evidence to inspect the upstream direction or acceptance criteria, not a reason to impose a fixed revision count.

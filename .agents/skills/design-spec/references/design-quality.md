# Design Quality Guide

Read this guide before generating a new visual direction or when a proposal risks looking like an unmodified template.

## Contents

1. Product-specific source material
2. Generic AI styling catalog
3. Positive quality checks
4. Accessibility failure modes
5. CJK and multilingual failure modes

## Product-specific source material

Inventory material that belongs to the product before choosing visual treatments:

- domain objects and the relationships between them
- repeated user actions and the tempo of those actions
- information shape: chronology, comparison, hierarchy, network, collection, location, or progression
- physical, technical, historical, or cultural context
- characteristic content, vocabulary, data, and constraints
- brand history and existing recognition, when present

Build directions from different source material rather than restyling one layout. A collection may lead to a cover-led index, a browsing shelf, or a personal archive; each implies a different composition and interaction model. The product metaphor must clarify the task rather than merely decorate it.

For each candidate, connect the source material to visible consequences:

| Question | Required consequence |
|---|---|
| What is visually dominant? | First-view composition and focal point |
| How does the user move through information? | Reading path, navigation, grouping, and pacing |
| What should feel quiet, urgent, playful, or authoritative? | Type character, contrast, density, material, and motion |
| What makes this product recognizable? | Product-specific composition, content treatment, or interaction |
| What does the direction cost? | Accessibility, performance, content, and implementation consequences |

## Generic AI styling catalog

These patterns are warning signs, not universal bans. A pattern is acceptable when product evidence or explicit user preference supports it and the specification explains its role. Flag a proposal when several appear as an unexplained bundle.

| Pattern | Why it becomes generic | Product-specific move |
|---|---|---|
| Blue-purple gradient hero | Supplies mood without product meaning | Derive color and emphasis from content, brand, or task state |
| Blurred glowing orbs | Fills empty space without changing hierarchy | Use meaningful imagery, data, texture, or deliberate negative space |
| Glass cards on a dark background | Applies a fashionable material to every product | Choose surfaces from density, environment, and interaction needs |
| Three equal feature cards | Forces unrelated claims into a symmetrical marketing template | Let importance and narrative determine count, size, and order |
| Random bento grid | Creates novelty without an information model | Map regions to real object relationships or task priority |
| Oversized gradient headline | Treats typography as a visual effect rather than content | Set prominence from message length, language, and reading path |
| Unapproved fluid display type with `clamp()` and `vw` | Imports an oversized English landing-page scale without deciding whether continuous viewport growth suits the product or language | Require the typography hard gate; otherwise use project-native fixed or breakpoint sizes |
| English-derived `max-width: Nch` on Japanese text | Treats an English line-length convention as a universal content measure and can make Japanese copy unnaturally narrow | Require the text-measure hard gate and test representative Japanese lines; otherwise use project layout constraints without `ch` |
| Header or footer constrained to content width | Collapses a page-level region and its inner alignment wrapper into one box, making the site chrome look unintentionally narrow | Approve outer and inner widths separately; let the outer region span the available width when intended |
| One fashionable sans-serif everywhere | Removes voice and weakens functional hierarchy | Choose a role-based type system and verify supported scripts |
| Uniform large radii | Makes controls, panels, and media share one undifferentiated shape | Define shape by component role, containment, and brand character |
| Pill styling on every control | Obscures component hierarchy and consumes space | Reserve pills for tags, filters, or actions that benefit from them |
| Soft shadow on every container | Adds depth without an elevation model | Use grouping, borders, spacing, or limited task-driven elevation |
| Icon-heading-paragraph repetition | Produces a component gallery instead of a story or task flow | Vary structure according to content type and importance |
| Floating dashboard mockup | Uses a generic product screenshot as decoration | Show a representative task, outcome, or credible product evidence |
| Abstract illustration with no domain link | Adds personality that could belong to any product | Use subject matter, materials, diagrams, or imagery native to the domain |
| Center-aligned everything | Removes directional rhythm and impairs dense reading | Align according to reading flow, hierarchy, and content length |
| Accent color on every interactive element | Competes for attention and destroys prioritization | Reserve emphasis for primary action, state, or key content |
| Section-by-section reveal animation | Adds motion because the page scrolls | Use motion only to explain state, continuity, hierarchy, or causality |
| Emoji used as the icon system | Creates inconsistent weight and platform-dependent rendering | Use text labels or a coherent icon set with accessible names |
| Excessive empty space | Imitates luxury or editorial pacing without narrative support | Tie spacing rhythm to content transitions and task tempo |
| Neon dark mode as the default personality | Substitutes contrast effects for product character | Derive dark surfaces, chroma, and glow from environment and use case |
| Unmodified component-library appearance | Outsources visual direction to defaults | Keep accessible behavior while defining product-specific composition and family grammar |

Also flag generic copy such as “unlock,” “supercharge,” or “seamless” when it replaces concrete product value. Content is part of the design direction because headline length, evidence, labels, and error language shape the interface.

## Positive quality checks

A direction needs positive reasons, not only an avoidance list. Before recommending it, answer:

- Which product evidence produced this direction?
- What relationship among composition, hierarchy, type, density, imagery, and motion creates its character?
- Would the direction remain recognizable in grayscale and without decorative effects?
- Could the same proposal be pasted onto an unrelated finance, AI, travel, and productivity product with only noun changes? If so, revise it.
- Does the primary task become clearer or faster to understand?
- Does representative real content strengthen the design, or does it break the intended layout?
- Does every page-shell column, header, footer, and sidebar have a product responsibility rather than filling a familiar website template?
- Does the combined full page preserve the intended atmosphere when navigation, long content, states, and supporting chrome appear together?
- Are viewport-fluid font sizing and `ch` text measures present only when their hard gates are explicitly Approved?
- Do full-width regions, contained inner regions, gutters, and article measure express one approved width model at desktop and narrow widths?
- Which alternative was rejected, and what material consequence made it worse for this product?

Compare directions by structural differences. Different directions should change the focal point, reading path, information hierarchy, content treatment, or interaction model. A palette or radius change alone is a variant.

## Accessibility failure modes

Record the applicable accessibility standard and version in the final contract. Verify current numeric thresholds from the project or an authoritative standard instead of inventing them. Make the following behavior explicit where applicable:

- Use native semantic controls or define equivalent name, role, value, and state.
- Keep every action keyboard-operable with a logical focus order and no keyboard trap.
- Make `:focus-visible` perceptible in every theme and state; prevent clipping by overflow or sticky containers.
- Do not encode selection, validity, severity, or status by color alone. Add text, shape, iconography, or another programmatically available cue.
- Associate labels, descriptions, requirements, and errors with their fields. Define when errors appear, where focus moves, and how a user recovers.
- Measure text and non-text contrast in the actual composited state, including gradients, images, disabled appearances, and overlays.
- Measure target size and spacing against the declared standard for touch and pointer input; do not assume visual size equals the hit area.
- Preserve content and actions during text resize, browser zoom, narrow reflow, and orientation changes. Avoid two-dimensional scrolling except where the content requires it.
- For motion, provide reduced-motion behavior that removes vestibular triggers such as large transforms, parallax, zoom, or continuous motion while preserving essential state feedback.
- Give loading, success, empty, error, disabled, and permission states usable names and recovery paths.
- Treat custom drag, gesture, canvas, chart, and spatial interactions as accessibility risks that need an alternative input or representation.

A visual mock can expose some failures but cannot establish semantic, keyboard, assistive-technology, or task usability conformance.

## CJK and multilingual failure modes

Validate typography with representative strings in every supported writing system. Latin placeholder text does not establish multilingual fit.

- CJK display text often needs more line height than a Latin display treatment. Check actual glyph bounds, punctuation, wrapping, and adjacent controls instead of copying one ratio.
- Confirm that the selected font contains the required scripts and weights. Avoid browser-synthesized bold or italic when the script or font lacks a true face.
- Do not use italic as the only emphasis mechanism for scripts where it is uncommon or synthetic.
- Check line-start and line-end punctuation, prohibited breaks, paired punctuation, small kana, dashes, and brackets with the target browser's line-breaking behavior.
- Test mixed CJK, Latin, numerals, units, product names, and code. Their baseline, width, weight, and spacing can change the perceived hierarchy.
- Test dense navigation, buttons, labels, and tables with realistic Japanese copy and with longer translated strings. Avoid fixed-height containers that assume English length.
- Do not treat `max-width: Nch` as a default Japanese reading measure. Use it only after explicit approval and verify actual Japanese line length, punctuation, and narrow-screen behavior.
- Define truncation, wrapping, and expansion behavior. A shorter source string is not evidence that another locale will fit.
- For right-to-left locales, define reading order, layout mirroring, directional icons, mixed-direction numbers, focus order, and animation direction. Do not mirror logos or inherently directional content blindly.
- Cover ruby, vertical writing, locale-specific quotation, or locale-specific fonts only when the product requires them; record them explicitly rather than assuming support.

Inspect desktop and narrow layouts with the same content priorities. A translation must not demote the primary action or destroy the approved reading path merely because its text is longer.

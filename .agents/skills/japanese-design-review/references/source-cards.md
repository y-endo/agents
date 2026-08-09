# Source Cards

Apply a card only within its scope and recheck a live source when the claim is release-critical or likely to have changed.
The `checked_at` values record the draft research date, not permanent currency.

## Contents

- [Source precedence](#source-precedence)
- [Typography and Japanese composition](#typography-and-japanese-composition)
- [Attention and content](#attention-and-content)
- [Interaction and accessibility](#interaction-and-accessibility)
- [Project adaptation](#project-adaptation)
- [Candidate book and example catalog](#candidate-book-and-example-catalog)

## Source precedence

Use project evidence before these cards.
Use the referenced WCAG A and AA success criteria as a review baseline for applicable Web surfaces.
Treat them as project conformance requirements only when the project claims the relevant target, and never infer complete conformance from this scoped review.
Treat W3C JLReq as a detailed Japanese composition requirement source with its documented scope and status.
Treat public design systems as high-quality guidance, not as the target project's brand or universal defaults.
Treat publisher descriptions as evidence of a book's stated coverage, not as permission to reconstruct its content.

## Typography and Japanese composition

### `JP-TYPE-001` Standard body and UI text size

```yaml
source:
  name: Digital Agency Design System, Typography Overview
  url: https://design.digital.go.jp/dads/foundations/typography/
  section: Font size
  checked_at: 2026-08-09
scope:
  surfaces: [website-body, standard-ui-text]
rule: Use 16 CSS px or larger as the initial standard for body and UI text.
rationale: The source identifies 16 CSS px or larger as its baseline for body and UI readability.
exceptions:
  - Supporting information or constrained dense UI may use 14 CSS px when the project context justifies it.
  - Do not apply the baseline as a substitute for testing the actual typeface, user group, device, and density.
verification:
  - Inspect computed size and current rendering.
  - Test real Japanese content and relevant text scaling.
confidence: high
```

### `JP-TYPE-002` Reading-text line height

```yaml
source:
  name: Digital Agency Design System, Typography Overview
  url: https://design.digital.go.jp/dads/foundations/typography/
  section: Line box height
  checked_at: 2026-08-09
scope:
  surfaces: [reading-body]
rule: Start reading-text line height at 1.5 times the font size or greater.
rationale: Adequate line spacing reduces tracking load for continuous text.
exceptions:
  - Large headings usually need a tighter ratio.
  - Dense administrative UI may prioritize information density; test that context separately.
verification:
  - Measure computed line height.
  - Inspect multiline Japanese text rather than a one-line sample.
confidence: high
```

### `JP-TYPE-003` Reading measure

```yaml
source:
  name: Digital Agency Design System, Typography Accessibility
  url: https://design.digital.go.jp/dads/foundations/typography/accessibility/
  section: Text display considerations
  checked_at: 2026-08-09
scope:
  surfaces: [reading-body, long-form-help]
rule: Use about 80 half-width or 40 full-width glyphs as a starting measure for a text block.
rationale: Long lines increase tracking difficulty for some readers.
exceptions:
  - Content may prioritize complete disclosure or dense comparison; decide per content instead of enforcing a universal maximum.
verification:
  - Inspect the longest real lines at supported widths and text scaling.
  - Evaluate comprehension and scanning, not only CSS `ch` values.
confidence: high
```

### `JP-TYPE-004` Japanese line-break integrity

```yaml
source:
  name: W3C Requirements for Japanese Text Layout
  url: https://www.w3.org/International/jlreq/?lang=ja
  section: Character classes and possibilities for line-breaking between characters
  checked_at: 2026-08-09
scope:
  surfaces: [rendered-japanese-text]
rule: Inspect actual breaks around opening and closing brackets, punctuation, small kana, iteration marks, prolonged sound marks, inseparable characters, and mixed-script runs.
rationale: Japanese composition defines character classes and break opportunities that differ from Western text composition.
exceptions:
  - JLReq is a W3C Working Group Note whose main examples include book composition; do not transfer every spacing detail into Web UI without checking browser behavior and product context.
  - Browser support and project CSS determine the implemented result.
verification:
  - Record the actual content, font, viewport, browser, and visible break.
  - Check all supported conditions affected by a manual break.
confidence: medium
```

### `JP-TYPE-005` Text resizing and font substitution

```yaml
source:
  name: Digital Agency Design System, Typography Accessibility
  url: https://design.digital.go.jp/dads/foundations/typography/accessibility/
  section: Viewer font changes
  checked_at: 2026-08-09
scope:
  surfaces: [responsive-web]
rule: Preserve content and function when users change fonts or enlarge the page or text to 200 percent where applicable.
rationale: Users may substitute a readable font or enlarge content, and typography must not be the only condition under which the interface works.
exceptions:
  - A logo may require an image of text; ordinary content does not.
verification:
  - Test 200 percent zoom or the project-equivalent method.
  - Test a plausible fallback or user-selected font when font metrics are material.
confidence: high
```

## Attention and content

### `JP-ATTN-001` Task-led attention order

```yaml
source:
  name: SmartHR Design System, Visual Guidance
  url: https://smarthr.design/products/design-patterns/visual-guidance/
  section: Cautions
  checked_at: 2026-08-09
scope:
  surfaces: [web-page, product-ui]
rule: Derive attention order from the user's task and content priority; do not use F-pattern or Z-pattern as a fixed template.
rationale: Goal-directed users may not follow a general gaze pattern, multiple effects interact, and device width changes the result.
exceptions: []
verification:
  - State the expected task-specific order for each supported device class.
  - Check that headings, grouping, position, and actions support that order.
confidence: high
```

### `JP-CONTENT-001` Purpose-led Japanese copy

```yaml
source:
  name: SmartHR Design System, Clear Writing
  url: https://smarthr.design/basics/text/
  section: Guidelines and checklist
  checked_at: 2026-08-09
scope:
  surfaces: [ui-copy, service-copy, help-copy]
rule: Select information for the reader's purpose, make the subject and relationships clear, shorten overloaded sentences, and use lists for parallel information when useful.
rationale: Concrete structure reduces the work required to identify the intended subject, change, or action.
exceptions:
  - Do not copy SmartHR-specific terminology or brand tone into another project.
verification:
  - Identify the reader, purpose, and action for the reviewed copy.
  - Check long errors, labels, and explanatory text in context.
confidence: high
```

## Interaction and accessibility

### `JP-A11Y-001` Meaningful sequence

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criterion 1.3.2 Meaningful Sequence
  checked_at: 2026-08-09
scope:
  surfaces: [structured-content]
rule: When sequence affects meaning, preserve a programmatically determinable reading sequence.
rationale: Visual placement alone does not communicate order to every user or user agent.
exceptions: []
verification:
  - Compare visual order with DOM and accessibility-tree reading order.
confidence: high
```

### `JP-A11Y-002` Sensory characteristics

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criterion 1.3.3 Sensory Characteristics
  checked_at: 2026-08-09
scope:
  surfaces: [instructions, controls, status]
rule: Do not make understanding or operation depend only on shape, color, size, visual location, direction, or sound.
rationale: Sensory-only instructions exclude users who cannot perceive or interpret that characteristic.
exceptions: []
verification:
  - Review instructions and state cues with color and spatial assumptions removed.
confidence: high
```

### `JP-A11Y-003` Focus order and visibility

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criteria 2.4.3 and 2.4.7
  checked_at: 2026-08-09
scope:
  surfaces: [keyboard-interactive-ui]
rule: Preserve meaning and operation in sequential focus order and provide a visible focus indicator.
rationale: Keyboard users need to locate the active control and move through it in a meaningful sequence.
exceptions: []
verification:
  - Traverse the target with a keyboard.
  - Record focus order, visibility, clipping, and obstruction.
confidence: high
```

### `JP-A11Y-004` Text and non-text contrast

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criteria 1.4.3 Contrast (Minimum) and 1.4.11 Non-text Contrast
  checked_at: 2026-08-09
scope:
  surfaces: [visible-text, interactive-ui, essential-graphics]
rule: Use at least 4.5:1 for ordinary text, 3:1 for large text, and 3:1 against adjacent colors for visual information required to identify controls, states, or essential graphics.
rationale: Low contrast can prevent users from perceiving content, controls, or state changes.
exceptions:
  - Apply the exceptions stated by the success criteria, including logos, incidental text, inactive controls, and essential graphical presentations where relevant.
verification:
  - Measure foreground and adjacent colors in every material state rather than judging by appearance alone.
  - Record the ratio, text size when relevant, and the applicable exception if one is used.
confidence: high
```

### `JP-A11Y-005` Reflow

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criterion 1.4.10 Reflow
  checked_at: 2026-08-09
scope:
  surfaces: [responsive-web]
rule: Preserve information and function without unintended two-dimensional scrolling at a width equivalent to 320 CSS pixels for vertically scrolling content.
rationale: Users who enlarge content or use a narrow viewport must not lose information or operation.
exceptions:
  - Content that requires a two-dimensional layout for use or meaning, such as a data table, may scroll in two dimensions within the necessary region.
verification:
  - Inspect the target at the project-supported narrow width and at the WCAG-equivalent reflow condition when a release claim requires it.
  - Distinguish a justified two-dimensional region from page-level overflow.
confidence: high
```

### `JP-A11Y-006` Programmatic control semantics

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criterion 4.1.2 Name, Role, Value
  checked_at: 2026-08-09
scope:
  surfaces: [interactive-ui]
rule: Make each user-interface component's name and role programmatically determinable, and expose user-settable states, properties, values, and their changes to assistive technology.
rationale: Visual labels and states alone do not make custom or scripted controls operable through assistive technology.
exceptions: []
verification:
  - Inspect native semantics or the accessibility tree for the component and each material state.
confidence: high
```

### `JP-A11Y-007` Error identification and suggestion

```yaml
source:
  name: WAIC Japanese translation of WCAG 2.2
  url: https://waic.jp/translations/WCAG22/
  section: Success Criteria 3.3.1 Error Identification and 3.3.3 Error Suggestion
  checked_at: 2026-08-09
scope:
  surfaces: [forms, validated-input, transactional-ui]
rule: When an input error is detected, identify the affected item and describe the error in text; provide a known correction suggestion unless doing so would compromise security or purpose.
rationale: Users need to locate, understand, and recover from an error without depending on color or position alone.
exceptions:
  - A correction suggestion may be withheld when it would compromise security or the content's purpose.
verification:
  - Trigger each material error and inspect its visible text, association with the affected item, and recovery path.
confidence: high
```

## Project adaptation

### `JP-PROJECT-001` Adapt shared guidance to the project

```yaml
source:
  name: Digital Agency Design System, Style Guides
  url: https://design.digital.go.jp/dads/guidance/style-guides/
  section: Design systems and style guides
  checked_at: 2026-08-09
scope:
  surfaces: [all]
rule: Adapt general components and guidance to the site's content, brand, communication policy, and concrete design specification.
rationale: A platform design system does not supply a project's brand concept or communication policy.
exceptions: []
verification:
  - Identify the project evidence supporting each material visual choice.
confidence: high
```

## Candidate book and example catalog

The entries below are candidate references, not active source cards, and cannot justify a finding by themselves.
They can expand judgment vocabulary after lawful access to their content.
Do not infer detailed rules from titles, publisher marketing, sales counts, awards, or gallery selection.
Before promoting a book-derived rule to an active source card, record the author, full title, edition, ISBN, page or section, and access date.
Paraphrase the rule without storing long quotations, distinctive examples, diagrams, or a summary that substitutes for the source, and do not imply endorsement by the author or publisher.

| Source | Publisher-stated coverage | Allowed role in this skill | Limitation |
|---|---|---|---|
| [なるほどデザイン](https://books.mdn.co.jp/books/3215303004/) | Priority, focal subject, association, translation between words and images, typography, writing, color, photography, charts | Decision-framing supplement | Do not reconstruct chapters from the publisher outline. |
| [デザイン入門教室 増補改訂版](https://www.sbcr.jp/product/4815624309/) | Layout, images, color, type, writing, infographics, exercises | Basic composition supplement | Publisher description is metadata, not the book's full reasoning. |
| [伝わるデザインの基本 増補改訂3版](https://gihyo.jp/book/2021/978-4-297-11985-0) | Japanese and Latin type, punctuation, line composition, lists, headings, breaks, line length | Japanese typography supplement | Much of the stated scope includes documents and presentation material; translate cautiously to Web UI. |
| [改訂新版 オブジェクト指向UIデザイン](https://gihyo.jp/book/2026/978-4-297-15716-6) | Objects, actions, views, navigation, layout patterns, exercises | Conditional product-UI information architecture supplement | Do not apply OOUI to every landing page or editorial site. |
| [Webデザイン良質見本帳 第2版](https://www.sbcr.jp/product/4815609092/) | Examples categorized by impression, color, industry, layout, material, type, motion, program, and parts | Inspiration taxonomy | Selection does not prove usability, accessibility, or conversion. |

Awards and galleries may be added only as annotated examples with:

- the exact aspect being studied;
- why it fits the current project;
- what must not be copied;
- the evidence level;
- site-type suitability.

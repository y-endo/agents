# Review Criteria

Use these criteria only within the approved review scope.
Do not turn a component review into an unrequested site-wide audit.

## Contents

- [Hard gates](#hard-gates)
- [Review dimensions](#review-dimensions)
- [Severity](#severity)
- [Finding format](#finding-format)
- [Release recommendation](#release-recommendation)

## Hard gates

Evaluate each applicable gate as `Pass`, `Fail`, `Not checked`, or `Not applicable`.
Determine `Apply when` from the target and approved scope, never from evidence availability.
When a condition applies but the evidence needed to judge it is unavailable, use `Not checked`.

| ID | Gate | Apply when |
|---|---|---|
| `HG-01` | The primary user, task, and page or feature purpose are known well enough to judge the target. | Every review. For a small component, use the component task rather than requiring the full site strategy. |
| `HG-02` | Real Japanese content is used for every text-related pass claim. | The target displays Japanese text. |
| `HG-03` | The primary information and action have an intentional, discoverable priority. | The target contains more than one information or action level. |
| `HG-04` | No required content clips, overlaps, disappears, requires unintended two-dimensional scrolling, or breaks meaning at supported widths and applicable resize or reflow conditions. | The target renders content in a viewport. |
| `HG-05` | Visual, DOM, reading, and focus order preserve meaning and operation. | The target has structured or interactive content. |
| `HG-06` | Required controls expose an understandable programmatic name, role, state, and value, and required interaction and feedback states remain understandable. | The target is interactive or asynchronous. |
| `HG-07` | Mobile ordering does not demote required information or the primary task. | Mobile or a comparable narrow width is supported. |
| `HG-08` | The design and copy do not invent claims, capabilities, results, or other product facts. | Every review. |
| `HG-09` | Reference use does not copy identity, content, proprietary assets, or a source-identifying combination without authority. | A reference influenced the target. |
| `HG-10` | Text and essential visual information, control boundaries, and state indicators meet the applicable contrast baseline. | The target visually presents text, controls, state, or essential graphical information. |
| `HG-11` | A detected input error identifies the affected item and describes the error in text; a known correction suggestion is provided when doing so does not compromise security or purpose. | The target accepts input and can detect errors. |

`Not checked` is not a defect by itself.
It is a limit on the review claim and may block a complete release recommendation.

## Review dimensions

### 1. User task and information architecture

- Can the intended user identify what the page or feature is, whether it is relevant, and what to do next?
- Can a user with a specific goal reach the target information or action without reading the intended marketing story in full?
- Do labels, navigation, and groupings match the user's objects and tasks?
- Do headings predict their sections instead of using labels such as "Details" or "More" without context?
- Can headings alone provide a useful page outline?
- Are empty, error, loading, success, and recovery paths present when the task requires them?

### 2. Japanese writing and typography

- Does the review use real Japanese copy rather than English placeholders or idealized short samples?
- Do line breaks preserve semantic chunks in headings, labels, names, dates, amounts, and units?
- Do punctuation, closing brackets, small kana, iteration marks, and prolonged sound marks avoid visibly disruptive line starts?
- Do opening brackets avoid stranded line endings?
- Do product names, company names, numbers and units, and mixed Japanese and Latin text remain understandable?
- Are font size, line height, measure, weight, and density appropriate to the content role?
- Are manual line breaks justified across every supported condition where they apply?
- Are labels concrete and consistent, sentences short enough for their context, and parallel items easier to scan as a list when useful?

### 3. Visual hierarchy and attention order

- Does visual strength match the task-specific priority?
- Is there one clear primary action or focal point where the task requires one?
- Do position, size, spacing, contrast, and grouping reinforce the same hierarchy rather than contradict one another?
- Does spacing show containment and section boundaries?
- Does the page remain scannable without assuming one universal F-pattern or Z-pattern?
- Does each device width preserve an appropriate attention order for the task?

### 4. Responsive behavior and UI states

- Does narrow layout reorder information deliberately rather than merely stack desktop columns?
- Does 200% zoom or equivalent text scaling preserve content and operation where applicable?
- Does applicable reflow preserve content and operation without unintended two-dimensional scrolling?
- Do long labels, names, errors, numbers, and empty states fit without destructive truncation?
- Are hover, focus, selected, disabled, loading, empty, error, and success states distinguishable where required?
- Do sticky or fixed regions obscure focused controls or required content?

### 5. Interaction and accessibility

- Does keyboard focus follow a meaningful order and remain visible?
- Do visual and programmatic reading orders agree when sequence affects meaning?
- Are instructions independent of color, shape, size, position, direction, or sound alone?
- Do controls have understandable labels and states?
- Do controls expose an appropriate programmatic name, role, state, and value?
- Do text and essential control or state indicators meet the applicable contrast baseline in every relevant state?
- Do detected input errors identify the affected item, explain the error in text, and provide a known correction suggestion when appropriate?
- Are touch targets and nearby actions separable for the supported device context?
- Does motion respect project accessibility requirements and avoid hiding essential feedback?

This dimension supports design review but does not certify WCAG conformance.

### 6. Brand fit and project-specific originality

- Can each strong visual choice be explained by user, content, domain, or brand evidence?
- Does the target rely on fashionable patterns as defaults without a project reason?
- Does a decorative device compete with the primary task or content?
- Does the target copy a reference's identity rather than translate a principle?
- Does the design remain recognizable as this product when generic decoration is removed?

Common patterns are not failures by category.
Record a finding only when the observed use causes a concrete project problem.

## Severity

Use the highest severity supported by observed user impact.

| Severity | Meaning | Typical consequence |
|---|---|---|
| `Blocker` | Prevents the primary task, comprehension, operation, or a responsible release decision. | Do not recommend release. |
| `Major` | Creates substantial load, error risk, or misunderstanding for affected users. | Correct before release unless an accountable owner accepts the risk. |
| `Minor` | Creates localized friction, inconsistency, or reduced readability. | Schedule a scoped correction. |
| `Suggestion` | Provides a supported improvement without identifying a requirement failure. | Optional. |

Do not inflate severity because a finding is easy to notice.
Do not lower severity because a fix is expensive.

## Finding format

```markdown
### JDR-001 `Major` 見出しがモバイルで意味のまとまりを分断する

- 対象: `/pricing` のプラン見出し、390px
- 観察: 「法人向け」が1行目、「勤怠管理」が2行目に分かれ、対象と製品名の関係が弱く見える
- 影響: 初めて料金を比較する担当者が、対象プランを走査しにくい
- 根拠: `HG-02`, `JP-TYPE-004`, project copy requirement
- 修正方針: 手動改行を外し、見出し幅または語順を対応viewport全体で再検討する
- 再確認: 320pxから対象最大幅、200% zoom、代替fontで同じ見出しを確認する
- 確信度: High
```

Keep observation separate from interpretation.
Point to a precise route, screen, component, state, viewport, or artifact.

## Release recommendation

Use one of these outcomes:

- `Pass for reviewed scope`: every applicable gate passes and no unresolved `Blocker` or `Major` remains.
- `Conditional`: no blocker remains, but accepted major risks or material `Not checked` items limit the claim.
- `Fail`: any gate fails or a blocker remains.
- `Partial review`: evidence permits useful findings but cannot support a release recommendation.

Never generalize a component-level pass into a site-wide pass.

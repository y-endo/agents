# Japanese Content Test Cases

Use real product content first.
Select only the cases that stress the reviewed surface.

## Core strings

```json
{
  "heading_short": "手続きをもっと簡単に",
  "heading_long": "複雑な申請業務をオンラインで一元管理できます",
  "button_short": "申し込む",
  "button_long": "無料相談を申し込む",
  "company_name_long": "株式会社サンプルソリューションズホールディングス",
  "mixed_text": "2026年8月9日時点の契約数は12,500件です",
  "amount_and_unit": "月額12,500円から利用できます",
  "error_message": "入力内容を確認できませんでした。対象期間を変更して、もう一度お試しください。",
  "empty_state": "条件に一致する申請はありません",
  "loading_state": "申請情報を読み込んでいます",
  "success_state": "申請を受け付けました"
}
```

These strings are synthetic boundary cases, not project copy and not facts to publish.

## Line-break risks

Check the rendered target for:

- a closing bracket, comma, full stop, small kana, iteration mark, or prolonged sound mark at a disruptive line start;
- an opening bracket stranded at line end;
- a product, person, company, or place name split into a misleading chunk;
- a number separated from its currency, percentage, date, time, count, or measurement unit;
- a particle or one or two characters isolated on the last line of a prominent heading;
- a manual break that works at one width but fails at another supported width;
- mixed Japanese and Latin text with inconsistent font metrics, baseline, spacing, or emphasis;
- truncation that removes the difference between actions or states.

Browser line breaking is contextual.
Record the actual viewport, font, content, and rendering rather than predicting a failure from source text alone.

## Content-length variants

For each affected component, select at least:

- the shortest real label;
- the longest real label;
- one long proper noun;
- one value with digits and a unit;
- one multiline explanatory or error message;
- one empty, loading, or success message when the state exists.

Do not create every state when the product does not need it.

## Viewport and scaling matrix

Use project-supported widths.
When no exact widths are documented, report that gap before using representative inspection widths.

For a broad web review, useful inspection points are:

- the supported narrow minimum;
- each project-defined breakpoint and one representative width between breakpoints;
- the supported wide maximum or maximum content width;
- 200% browser zoom or the project's equivalent accessibility check.

Representative widths such as 390px, 768px, or 1440px are examples, not hidden project requirements.

## State matrix

Inspect only relevant combinations:

| Surface | Minimum useful states |
|---|---|
| Navigation | default, current, focus, expanded when applicable |
| Form field | empty, filled, focus, invalid, disabled when applicable |
| Submit flow | ready, loading, error, success |
| Data collection | populated, empty, loading, error |
| Destructive action | ready, confirmation, failure, completion |

Avoid an unnecessary Cartesian product.
Add a state-width pair when content or behavior actually changes.

# Reports custom date picker fix — 2026-10-03

## Scope

User-visible Reports fix covering every page that uses the shared custom date-range picker.

## Problem confirmed

- When `period=custom`, the Reports header could show two identical date-range controls.
- The duplication came from both `ReportQueryShortcuts` and `ReportCompactFilters` rendering the same shared `ReportDateRangePicker` in the toolbar.
- `ReportDateRangePicker` only blocked dates after `maxDate` when a caller explicitly supplied one, so report pages that omitted `maxDate` allowed future dates.

## Implementation

Branch: `fix/reports-custom-date-picker`
PR: `#2698`

- `ReportQueryShortcuts` remains the single owner of the toolbar custom date-range control.
- Removed the second inline custom-range trigger from `ReportCompactFilters`; its advanced filter drawer still keeps its custom date-range picker.
- The shared `ReportDateRangePicker` now enforces an effective maximum of today for all report usages. If a caller supplies an earlier `maxDate`, the earlier bound wins; a future caller-provided max cannot enable future report dates.
- Days after today are disabled.
- The next-month navigation button is disabled once moving forward would exceed the effective maximum month.
- Existing selected/query dates later than today are clamped only for the calendar month shown; no report query is silently rewritten until the user selects a valid range.

## Safety / boundaries

- No database, migration, RLS, permission, accounting, report calculation or export logic change.
- No mobile/native/APK/AAB change.
- Existing business, category and advanced filter query preservation remains unchanged.

## Acceptance checks

1. Selecting `Custom` on Reports shows exactly one toolbar date-range trigger.
2. Applying a custom range does not create a second duplicate trigger.
3. Tomorrow and all later dates cannot be selected.
4. Calendar cannot navigate beyond the current month.
5. Past/current dates still complete a range and preserve the existing `period=custom&from=...&to=...` query contract.
6. Advanced Filters custom-date control inherits the same no-future rule.
7. Mandatory `Verify web portal` workflow must pass before merge.

## Verification history

- Verify web portal `#5159` failed before Typecheck because the existing Reports business-type static regression expected compact option literals; no product regression was found.
- The selector literals were kept compatible without restoring the duplicate date picker.
- Verify web portal `#5160` then passed all regressions, Typecheck, Lint and Production build for head `92a4da4f4d1123c108ad4087268065d3cae17de4`.

## Evidence state

**IMPLEMENTED; PR #2698 OPEN; Verify web portal #5160 VERIFIED; merge/deployment pending.**

# Report Custom Calendar Handoff — 2026-10-01

## State

**IMPLEMENTED** on branch `refine/reports-shared-custom-calendar-2026-10-01`. PR/CI/merge/deployment are pending.

## User-visible behavior

- Reports custom date selection uses one compact calendar date-range picker instead of two visible From/To date inputs.
- First date click selects the range start; the second date click selects the range end; the selected interval is highlighted.
- The shared picker closes on outside click or Escape and preserves existing report query/filter parameters.
- Reports Overview uses the shared picker when `Custom` is selected and retains its existing no-future-date rule.
- RM Performance now reuses the same shared picker and keeps the existing Custom auto-open behavior.
- Shared `ReportCompactFilters` uses the same picker for date-range fields and also exposes the compact picker when a report is already in `period=custom`.
- The legacy Business report two-input custom form is visually suppressed because the active Custom range is now edited through the shared calendar control rendered by `ReportCompactFilters`.

## Scope / safety

- No report calculations, finance formulas, permissions, RLS, schema, migration, export contract, mobile runtime, APK or AAB behavior changed.
- Existing `period=custom`, `from`, and `to` URL/query contracts remain unchanged.
- Existing non-date report filters are preserved when a custom range is changed.

## Main implementation files

- `apps/web-portal/components/reports/report-date-range-picker.tsx`
- `apps/web-portal/components/reports/reports-overview-toolbar.tsx`
- `apps/web-portal/components/reports/report-compact-filters.tsx`
- `apps/web-portal/app/rm-performance/rm-performance-filters.tsx`
- `apps/web-portal/app/reports/reporting.css`

## Verification still required

Run the canonical `Verify web portal` PR workflow and require regressions, Typecheck, Lint and Production build to pass before merge. Deployment/runtime verification remains separate.

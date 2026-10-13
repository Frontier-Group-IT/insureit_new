# Partner Business custom range and compact KPI labels — 2026-10-13

Branch: `fix/partner-business-custom-close-single-line-kpis-20261013`

- Business Overview custom range: on successful `PartnerBusinessRangeSummaryCard.onApplied`, update the existing selected range state and close the custom range panel.
- Month-wise Trend custom range: same successful-apply behavior, preserving selected trend data.
- Failed range requests already remain in the date-picker panel and display an error; this change does not close failed requests.
- All four Business Overview KPI labels now render on one line via `numberOfLines={1}` and `adjustsFontSizeToFit`, reduced horizontal padding and compact font sizing. Existing values, trends, navigation targets, backend calls and authorization unchanged.
- Validation required: open each Custom selector, choose a valid From/To, apply and observe panel dismiss and updated data; simulate API failure and confirm panel remains open; test one-line labels on small-screen Android.
- No SQL/database changes, PR, merge, OTA, APK or AAB.

## Trend bar appearance follow-up
- Removed the gray `#EEF3FA` background from `styles.barTrack` in `apps/partner-app/app/(tabs)/business.tsx` on this same branch. The blue premium bars, their scaled heights, labels, months, chart sizes, and compact-mode override remain unchanged. No PR, merge, OTA, APK or AAB was performed; CI and installed-device visual checks are still pending.

## Follow-up: selected Policy and Claims KPI cards
- On the same branch, `apps/partner-app/app/(tabs)/policies.tsx` and `claims.tsx` now apply `summaryCardSelected` based on their existing selected filter state, keeping the light-blue selected surface, navy border, and bottom accent after finger release. Existing transient press feedback remains.
- Rejected Claims does not falsely show a selected rejected-only list; its unsupported-filter notice and All fallback remain intact.
- No API, auth, RLS, database, APK, AAB or OTA change. PR, merge, CI and device verification still pending.

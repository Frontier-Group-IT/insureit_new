# Reports Filter Skeleton Loading Handoff — 2026-10-05

## State

**IMPLEMENTED on branch `fix/reports-filter-skeleton-pending-2026-10-05`; PR/CI/merge/deployment pending.**

## User-visible behavior

- The shared Reports header and primary navigation stay mounted while report data reloads.
- The report body immediately switches to the shared skeleton when a report navigation/filter changes server-backed report data.
- Coverage includes Overview period/business/custom date changes, Business/Portfolio shortcut filters, business-line and advanced filters, Operations horizon/exception filters, and report links that change report query state.
- Export actions are intentionally excluded from the pending skeleton.
- Selecting an already-active value does not enter a stuck loading state.
- A 15-second safety release prevents a permanently hidden report body if a navigation fails to commit.

## Implementation

- Shared skeleton extracted to `components/reports/reports-workspace-skeleton.tsx` and reused by the route `loading.tsx` and client pending overlay.
- `ReportsNavigationPendingProvider` tracks client-side report navigation until pathname/search params commit.
- `ReportsPendingContent` hides only the report body during pending navigation; toolbar portals remain mounted in the persistent header.
- Programmatic `router.push()` filter controls explicitly start pending state before navigation.
- Link/form report navigations are captured centrally; `/reports/export/*` is excluded.

## Safety boundary

No report query logic, calculations, permissions, exports, database schema, RLS, mobile/native runtime, APK or AAB behavior changed.

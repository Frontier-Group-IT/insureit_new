# Reporting UX R2 Handoff

Date: 2026-08-13
Status: IMPLEMENTED / VERIFIED / MERGED. Not intentionally deployed by this phase.

## Scope

Reporting UX Phase R2 standardizes the report page shell and filter behavior. It does not change report calculations, Supabase RPCs, hierarchy/customer scope, Finance billing semantics, Management Pack snapshot rules, or database behavior.

Implemented:
- Shared report page shell: `apps/web-portal/components/reports/report-page-shell.tsx`.
- Shared query-preserving report shortcuts: `apps/web-portal/components/reports/report-query-shortcuts.tsx`.
- Shared report header action area, filter fields, Apply/Reset controls, export control, error banner, and empty state.
- Shared Reports route error boundary: `apps/web-portal/app/reports/error.tsx`.
- Business, Distribution, Finance, Claims, Renewals, Operations, Governance, Readiness, Management Pack, and Management Pack Archive use the R2 shell pattern.
- Existing exportable reports expose Export in the report header action area. Distribution and Governance remain non-exportable in R2.
- Transaction-period reports distinguish `Period`; Renewals/Operations distinguish `Horizon`.
- Period/Horizon shortcuts preserve unrelated active query filters and reset pagination.
- Period reports expose an explicit `Custom` shortcut.
- Applying insurer/RM/status/etc. while a preset period is active preserves that preset. It does not silently convert the resolved dates into a fixed custom range.
- Editing a From/To date switches the submission to `custom` period.
- Preset-period form submissions suppress resolved From/To values from the URL so they are not misrepresented as active custom filters.
- Readiness now has a controlled report-loader error fallback and uses the common error/empty treatment.
- Management Pack retains its existing Archive, Close Month, Frozen Pack, Export, Print, month selection and immutable-snapshot semantics. Close Month confirmation and Live/Frozen workflow refinement remain R5 scope.

## Verification

PR: #314 `R2 shared reporting shell and filters`
Verified feature head: `c34992b13798534e1c4080c12e8b59889c5c1750`
Final PR verification workflow: `31697587949`
Result: SUCCESS
Merge commit: `21bdf6e4dd6f1b4e9d22bf52cc298d0b8c1937a2`

Passed:
- Access Control V2 catalogue regression
- Access Control V2 scope and compatibility regression
- Access Control V2 portal lifecycle regression
- Employee portal governance regression
- Release blocker security regression
- IFFCO structured regression
- IFFCO regression
- Digit regression
- New India regression
- TypeScript typecheck
- lint
- Next.js production build

## Release state

R2 was merged after verification. No R2-specific `.deploy/production-trigger.json` update was made by this work. Do not label R2 DEPLOYED until a later explicitly approved production release is verified on Vercel.

## Next phase

R3 is the report visual system phase:
- typography normalization;
- KPI tier hierarchy;
- exception semantic colors;
- section-header consistency;
- status badges;
- terminology normalization.

R3 must not change report calculations or access scope.

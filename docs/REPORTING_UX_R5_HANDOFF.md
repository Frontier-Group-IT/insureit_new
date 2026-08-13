# Reporting UX R5 Handoff

Date: 2026-08-13
Status: IMPLEMENTED on feature branch; verification pending.

## Scope

Reporting UX Phase R5 refines the Month-End Management Pack workflow without changing report calculations, Supabase RPCs, hierarchy/customer scope, snapshot ownership/privacy, snapshot immutability, month-end eligibility, Finance semantics, or database behavior.

## Implemented

- `Close Month` no longer behaves like an ordinary one-click filter/action.
- When exact month-end capture is eligible, selecting `Close Month` opens a dedicated confirmation dialog.
- The dialog states that the snapshot is immutable and that the Live Management Pack remains separate after capture.
- Confirmation is deliberate before the existing server action is allowed to proceed.
- The existing server-side `captureManagementPackSnapshotAction` remains the write path and continues to call the existing archive loader/capture logic; the browser is not made authoritative for eligibility or authorization.
- Management Pack title now clearly identifies the current state as `Live Pack` or `Frozen Snapshot`.
- Live view has a dedicated state panel showing the selected month and whether a frozen snapshot exists.
- When a frozen snapshot exists for the selected live month, `View Frozen Snapshot` is shown as an explicit state switch rather than a generic header action.
- Frozen view has a dedicated state panel showing capture timestamp and snapshot version, with an explicit `View Live Pack` action.
- General actions (Archive, CSV, Print) remain separate from the Live/Frozen state switch.
- Month selection remains available only in Live mode; frozen snapshots stay bound to their captured month.
- Print behavior remains intact and preserves frozen-state evidence while hiding interactive controls.

## Integrity boundaries preserved

- Close eligibility is still enforced by `isManagementPackCloseEligible(...)` and the server-side capture logic.
- Snapshot creation is still private to the current profile and scoped through `loadManagementPack(...)`.
- One snapshot per owner/month remains enforced by the existing database constraint and capture logic.
- Past months cannot be backfilled as exact month-end truth.
- Current-month snapshots cannot be created before the final calendar day in Asia/Kolkata.
- Frozen snapshot reads remain owner-filtered.
- No snapshot update/delete workflow was added.

## Files

- `apps/web-portal/app/reports/management-pack/page.tsx`
- `apps/web-portal/app/reports/management-pack/close-month-confirmation.tsx`

## Verification state

Run the canonical `.github/workflows/verify-web-portal.yml` gate on the exact R5 feature head before merge. Do not update `.deploy/production-trigger.json` as part of R5 implementation. Production deployment requires a separate explicit request.

## Next phase

R6 remains cross-report reporting-dimension normalization, especially consistent Relationship Manager identity/filter behavior. Treat R6 as a data/result-set phase rather than a purely visual refactor.
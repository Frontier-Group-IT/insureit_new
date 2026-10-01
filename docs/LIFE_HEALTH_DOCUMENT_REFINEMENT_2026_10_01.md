# Life/Health document refinement — 2026-10-01

## Scope

This change is limited to the Life and Health policy workflow in the web portal.

- Add Policy shows: Proposal Form, Illustration Form, Payment Receipt, Other Form.
- Life/Health case detail shows: Policy Copy, Proposal Form, Illustration Form, Payment Receipt, Other Form.
- Issued Life/Health policy edit shows the same five-document set.
- `Mark Policy Issued` uses the approved light-purple/lavender section treatment while its inputs remain white.
- Historical KYC document handling remains supported server-side, but KYC is not shown in the new Life/Health document action sets.

## Technical boundary

- No database migration.
- No RLS change.
- No mobile/native build or APK change.
- Existing `benefit_illustration` and `premium_receipt` Life/Health document types are reused.

## Delivery

Branch: `feature/life-health-document-actions-2026-10-01`

PR: #2634

The canonical web verification workflow must be green before merge to `main` and production deployment.
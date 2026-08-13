# INSUREIT Management Pack Reporting Handoff

Date: 2026-08-13

## Production checkpoint before this phase

The user explicitly requested deployment of the reporting workspace through Governance before starting the next phase.

Production trigger commit:
- `961e9d8a354581fba74a05dec47d6ded553dc35b`
- message: `deploy: release reporting through governance`

GitHub production workflow:
- run `31681237656`
- compulsory verification gate: SUCCESS
- Vercel deploy-hook job: SUCCESS

The Vercel connector returned HTTP 502 while querying deployment metadata, so no Vercel deployment ID was recorded from that connector. Do not invent one.

The release scope through that explicit checkpoint includes:
- Business reporting
- Distribution reporting
- Renewals reporting
- Claims reporting
- Finance reporting
- Operations & Compliance reporting
- restricted Governance reporting

## Management Pack phase

The next reporting phase has been implemented on `main` as a Month-End Management Pack.

Primary route:
- `/reports/management-pack`

CSV export:
- `/reports/export/management-pack`

Core loader:
- `apps/web-portal/lib/reports/management-pack.ts`

Print action:
- `apps/web-portal/app/reports/management-pack/print-button.tsx`

Main Reports page navigation now exposes `Management Pack` directly.

The Governance tab on the main Reports page is now shown only when the viewer has effective `manage_users` access.

## Management Pack behavior

The selected month drives the same existing scoped reporting engines for:
- Business
- Distribution
- Finance
- Claims

For the current month, the end date is capped at today. Historical months use the actual last day of the selected month. Future months are not accepted and fall back to the current month.

The pack intentionally uses current-state snapshots for:
- Renewals: current 90-day renewal exposure
- Operations: current 90-day compliance exposure

These modules do not preserve historical month-end snapshots, so the pack does not pretend that current exposure was the exposure at a historical month end.

Governance is included only when the viewer has effective `manage_users` access. Governance uses the selected month for permission-change and audit-event activity.

## Access control

Entry requirement:
- effective `view_reports`

All business/distribution/finance/claims/renewal/operations data continues to use the existing hierarchy/self/organization authorization logic in the underlying report loaders.

Governance remains organization-sensitive and is added only when the same viewer also has effective `manage_users` permission.

The CSV export calls the same `loadManagementPack()` server loader as the screen; it does not have a separate unrestricted data path.

## Current Management Pack sections

Top KPIs:
- Policies
- Gross Premium
- Net Premium
- Projected PayIn
- Retention
- Claims

Business performance:
- Active policies
- Average premium
- Intermediary count
- Top insurer contribution
- RM production

Distribution:
- Active intermediaries
- Producing intermediaries
- Open onboarding
- RM performance

Finance:
- PayIn after TDS
- Billed amount
- Partner payout
- Billing incomplete
- Pending payout
- Negative retention exceptions
- insurer finance comparison

Claims:
- Open
- Settled
- Average open age
- Estimated loss
- Settlement amount
- document exceptions
- aging buckets

Current renewal exposure:
- Due within 30 days
- Due within 90 days
- Premium at risk
- renewal buckets

Current operations exposure:
- Vehicles
- AuthBridge unverified
- Missing compliance fields
- Expired documents
- Due within 90 days
- customer document exceptions
- compliance document breakdown

Governance, when authorized:
- Active profiles
- Inactive profiles
- Employee overrides
- Role overrides
- Permission changes during selected month
- Audit events during selected month

## Output

The workspace supports:
- month selection
- CSV summary export
- browser Print / Save PDF
- print-friendly layout with navigation/actions hidden when printing

## Verification

Final Management Pack/navigation verification:
- GitHub Actions run: `31681920542`
- result: SUCCESS

Passed:
- Access Control V2 catalogue regression
- Access Control V2 scope and compatibility regression
- Access Control V2 portal lifecycle regression
- Employee portal governance regression
- Release blocker security regression
- IFFCO structured OCR regression
- IFFCO OCR regression
- Digit OCR regression
- New India OCR regression
- TypeScript
- Lint
- Production build

Final feature/navigation head verified by that run:
- `6d2d98583fb050fdcdd5f20ad205f87c7ff8d8e3`

## Deployment boundary

The user explicitly approved deployment only through the Governance checkpoint before this phase began.

Do not create a new production trigger specifically for the Management Pack unless the user explicitly requests deployment of this phase.

Concurrent production workflows from unrelated explicitly approved main-branch work may contain newer commits because the repository's production workflow deploys the latest committed snapshot. If that happens, document it accurately; do not claim the Management Pack was separately approved for deployment.

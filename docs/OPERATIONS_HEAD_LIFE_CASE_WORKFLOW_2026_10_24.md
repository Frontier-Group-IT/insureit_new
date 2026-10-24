# Operations Head – Life: full Life and Health case-processing parity

24 October 2026

## Requested correction
Operations Head – Life users were shown a custom, read-only case-detail page for Life/Health cases outside Gagan Singh's reporting downline. The user explicitly requested the **same existing Life/Health case-processing screen as Super Admin**, with the ability to complete the case and convert it into an issued policy.

## Implementation
- `app/policies/life-health-cases/[id]/page.tsx`: remove the alternate read-only UI. All eligible Life/Health case records render the **standard `LifeHealthCaseDetail`** component with the same steps, edits, document uploads, and issuance actions as the established operations workflow.
- `lib/operations-head-record-authorization.ts`: allow global Life/Health case operations through the existing record-level permission resolver rather than requiring the RM/partner to belong to Gagan's downline.
- `lib/policy-access-scope.ts`: explicitly require business_line Life or Health for case authorization. For policies, allow all Life/Health issued-policy edits; retain Gagan-downline limits for Motor and other verticals. Separately preserve downline-only Policy Intake review/finalization (including final-policy links).
- `app/policies/life-health-case-edit-actions.ts`: use the standard case and associated customer update flow, so case edits made prior to conversion are not blocked on a customer-master comparison.
- `app/policies/life-health-issued-policy-edit-actions.ts` and policy edit page: remove downline-only source restrictions for already-authorized Life/Health issued policies.
- `scripts/operations-head-life-regression.mjs`: asserts standard detail parity, server authorization, Life/Health business-line gate, and Policy Intake downline separation.

## Security and regression cases
- Case belonging to Jayesh Purohit, Sankalp Direct Business, or any other RM opens full standard editing/issuance experience when the record is Life or Health.
- Converted issued policy remains accessible for authorized Life/Health editing.
- Motor/Non-Motor policies outside Gagan's RM/partner downline remain denied.
- Policy Intake records belonging outside Gagan's hierarchy remain denied even when linked to a Life/Health policy.
- Role access still requires an authenticated profile and per-record checks; no generic super-admin privileges added to role capabilities.

No database migration or case reassignment is necessary. Do not alter production data as part of implementation.

# INSUREIT: canonical identity updates without rewriting booked RM history (2026-11-13)

**State:** Implemented on branch; **not applied to production** and **not deployed**.

## Approved business rule

Identity correction is not ownership reassignment.

- Correcting an employee's official name or code updates current labels everywhere their **employee UUID** is stored. Historical booked RM UUIDs stay unchanged.
- Correcting a Partner/POSP/MISP source name or code updates business labels against the **source intermediary UUID**. It never changes a booked RM.
- Reassigning the source's **current** RM affects newly booked policies/cases, not existing booked RM UUIDs.
- Original submitter, reviewer, approver, account, group/financial, and signed-document history is immutable and must not be relabeled as a different actor.

## Code and schema

- `supabase/migrations/20261113111500_employee_source_identity_booked_rm_history.sql` adds `policies.source_intermediary_id` and a `source_partner_id` fallback, resolving existing policies by unambiguous intermediary code or the exact Partner Master UUID. The policy before-insert trigger captures the source UUID and the currently assigned RM at creation.
- Source name/code propagation is keyed by `source_intermediary_id` (or `source_partner_id` for Partner-only historical records) for policies, `intermediary_id` for Life/Health cases, and `lead_source_id` for intakes. The Partner master forwards identity changes to its matching Partner intermediary; child POSP/MISP identities remain separate.
- The `sync_policy_rm_employee_id` update branch no longer reselects the current partner owner when the intermediary code or name changes; existing `rm_employee_id` stays unchanged. Case issuance carries the original case `rm_employee_id` and `intermediary_id`.
- `policies.intermediary_group_*` are booking-time snapshots and no longer recompute merely because the source code changes.
- Employee edits synchronize `profiles`, policy RM labels, case RM labels/codes, onboarding employee names, onboarding drafts and manager codes by employee UUID. The portal does not perform a second independent profile mutation; migration must be applied before shipping that portal change.
- `associate_id` is **a legacy, sometimes distinct commercial identifier**, not an HR code. It is preserved. New `posp_misp_onboarding_profiles.associate_employee_code` and draft `associate_employee_code` carry the current official employee code instead.
- Case and intake pre-write triggers normalize new labels from their immutable RM/source UUIDs.
- The migration captures the original identity fields in the private `identity_maintenance.employee_source_sync_backup_20261113` table. The table has no PUBLIC/anon/authenticated grants.
- Full-table transaction-local signatures abort the migration if unrelated business, financial, compliance, PAN job, document, group, audit, or source-link fields change. All statements run in one transaction.

## Baseline from read-only production inspection (changes over time)

| Data | Previous measured condition |
| --- | --- |
| Employees | 34, 27 active |
| Onboarding profiles | 143 |
| Onboarding name variants | 14 |
| Legacy/different associate codes | 109 (not all errors) |
| Policies | 2,296 |
| Policy RM-name snapshots differing from canonical HR name | 777 |
| Life/Health cases | 23, 2 RM-name variants, 10 differing/missing RM codes |
| Policy Intake requests | 1,159, 102 source-code variants and 228 source-name variants |
| Policy source-code resolution | 12 PT00110 policies have no intermediary row but match one unique Partner Master UUID |
| Other null links | 1 Life/Health case without intermediary UUID; 87 intermediary rows without direct associate employee UUID, with onboarding fallback |

**Partner-only historical source**: PT00110 (Damoh Naka Chetak) exists in `partners` but not in `intermediaries` in the inspected snapshot. Its 12 historical policies are linked by the unambiguous existing `partners.id` through `source_partner_id`, with `source_intermediary_id` intentionally null. No intermediary row is fabricated, and booked RM ownership stays unchanged.

**Special historical ownership**: the earlier explicit HAPPY FINANCIAL SERVICES (PT00036) reassignment changed 4 policies and 4 cases from Lalit to Jyoti. The migration **does not undo or repeat** that exception. Sonia (PT00041) current assignment has moved to Gagandeep while booked policies/cases still belong to Lalit; that historical ownership is intentionally preserved.

## Release gate (production-only environment)

1. Review the complete migration against current production schema and live trigger/function definitions; verify no intervening changes from another PR. There is no staging Supabase DB.
2. Run GitHub PR workflow **Verify web portal**, typecheck, lint, build and `employee-source-identity-history-regression.mjs`. No merge if red.
3. Recheck exact source-code uniqueness and the 12 PT00110 Partner-only fallback links. Confirm all source UUID links and Employee Master spellings with an authorized HR owner.
4. Check baseline: policy/case booked RM UUIDs, group snapshot fields, partner membership, PAN jobs, onboarding documents, nonidentity field signatures. Ensure the transaction abort guard can operate without changing any of these.
5. Schedule an approved controlled production migration, using the existing database backup/recovery process. Apply the schema/database migration **before** deploying portal code. If any assertion fails, PostgreSQL must roll the whole transaction back. Do not bypass an assertion to force completion.
6. Deploy the reviewed website through the approved manual GitHub Actions route; verify on production with authorized read-only users. If a new case is required to test future booking, use an isolated nonproduction test harness; do not create fake live policies.
7. Read back all counts and zero-mismatch canonical display checks by UUID; confirm original RM UUIDs did not move and no financials, IIB, PAN jobs, documents, group assignments, permissions, application stages, or audit actors changed.

## Rollback / recovery

Prior values for identity fields are stored in `identity_maintenance.employee_source_sync_backup_20261113`. If a migration assertion fires, the enclosing transaction rolls back automatically (including trigger definitions and snapshot creation). A **post-release** rollback must use a reviewed, ID-scoped restoration from that snapshot, guarded against legitimate newer edits; never blindly overwrite subsequent partner/RM assignments or policy bookings. Restore the previous trigger definitions from migration history and roll back the portal code together, accounting for the new policy source column. Database recovery is an operator-reviewed action, not automatic.

## Regression acceptance

- Rename employee without changing UUID; existing policy and case displays change to the corrected name/code, booked owner does not.
- Change employee's official HR code; canonical fields update, legacy `associate_id` stays stable.
- Change Partner/POSP/MISP name/code; source identity labels change for linked existing records and future bookings, booked RM does not.
- Move source from RM A to RM B; old policies/cases still link to A; new cases/policies select B.
- Issue a policy from an older case; the issued policy inherits that case's original RM and intermediary UUID.
- No duplicate Gagandeep employee/profile; alias text must not be treated as a distinct employee.

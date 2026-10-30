# Partner → Branch hierarchy: safe phased correction (2026-10-30)

## Confirmed production baseline (read-only)
- Supabase project: `ilzhsfqqjyppzzvfscmh`.
- `partners`: 93 rows, of which 9 have a non-null parent Partner ID.
- `partner_branch_profiles`: 9 records.
- 12 policies are attributed to historical child Partner codes, all under `PT00110` in the inspected cohort.
- `PT00110` is Branch *Damoh Naka Chetak*, under parent Partner `PT00109` *Devendra Bhalla*.
- The earlier RM dashboard investigation found all 12 PT00110 policies have a missing `rm_employee_id`. **This migration does not alter their ownership or financial data.**

## Root issue
`service_create_partner_branch_profile` in `20260914194500_partner_branch_onboarding.sql` inserts a branch into `partners` using `next_partner_code()`, then creates `partner_branch_profiles`. Multiple scope functions therefore consume child Partner IDs and codes for Branch visibility.

## Phase 1 in this PR
- Preserve existing `partner_branch_profiles.id` as canonical Branch UUID.
- Add a separate `branch_code` (legacy `PT00110` maps to `BR00110`) and `parent_partner_id`.
- Keep `partner_id` as a clearly **legacy** association for old logins/policies.
- Backfill with fail-closed structural validation; add a unique index and internal service-only view.
- No production rollout, authorization changes, writes to business/financial tables, or deletions.

## Required subsequent phases **before** claiming full fix
1. Replace Branch onboarding with a **Branch-only** create path that no longer invokes `next_partner_code()` or inserts into `partners`; separate partner and branch role identifiers.
2. Adapt `portal_access_identities`, login resolution, Partner App, Operations Portal, policy intake, claims, renewals, payouts, notifications, and registers to canonical `branch_id` while maintaining legacy fallback during the transition.
3. Introduce explicit `parent_partner_id` and `branch_id` attribution on relevant **new** business records. Backfill historical records by verified legacy mapping without changing policy numbers, premium, pay-in or payout amounts.
4. Revise all scope RPCs to enforce **Branch = self only**, **Partner = own + authorized descendants**. Do not use names as a security scope. Deny cross-branch direct URL/RPC attempts.
5. Repair RM attribution only after audit of policy and employee ownership. RM summaries and breakdowns must use authoritative IDs.
6. Test all nine Branch logins and their cross-branch isolation, parent consolidation with no double-count, migration rollback and accounting reconciliation.
7. Roll out in independent, checked migrations with a backup and deliberate release approval; never delete legacy Partner rows while referenced.

## Explicit safety gates
- All existing 93 Partner rows, 9 Branch profiles and 12 child-coded policies unchanged by Phase 1 except additions to Branch profile metadata.
- No changes to policy, customer, claims, payables, payment allocations, ledger, audit logs, credential or auth data.
- Reconcile counts and amounts before/after every stage.
- Do not deploy this migration separately from a reviewed release procedure. No APK/AAB.

# Group / Branch Portal Access Hardening Handoff

## State

**IMPLEMENTED IN FEATURE BRANCH / PR #1834 OPEN / NOT MERGED / NOT APPLIED / NOT DEPLOYED**

Branch: `fix/group-branch-portal-access-hardening-main`

This follow-up hardens the Group/Branch login architecture introduced by PR #1827 without replacing it and without changing existing Partner credentials.

## Corrected contracts

1. **Policy Intake compatibility**
   - Group and Branch portal users keep the canonical Group/Branch identity everywhere else.
   - Policy Intake calls `partner_policy_intake_current_identity()` so explicit Group/Branch users use their authenticated `profiles.id` as the existing profile submitter/uploader contract.
   - Legacy Partner users continue using `intermediary_portal_accounts` exactly as before.
   - No new Policy Intake submitter columns or backfills are introduced.

2. **Branch -> parent Partner -> Group inheritance**
   - Group membership for a Branch resolves through `coalesce(parent_partner_id, id)`.
   - This applies both to explicit Branch portal access and the legacy Partner fallback path.

3. **Inactive-target enforcement**
   - `partner_portal_access_context()` now requires an active access mapping, active profile, active Group target, or active Branch partner/profile as applicable.
   - Group scope includes only active root Partners and active Branch children.

4. **Reversibility**
   - Forward migration: `20260915170000_group_branch_portal_access_hardening.sql`.
   - Rollback restores the pre-hardening PR #1827 functions and removes only the Policy-Intake-specific identity adapter.
   - No Auth users, Group/Partner/Branch records, memberships, access mappings, existing Partner portal accounts, policies, customers, claims, or renewals are created/deleted/backfilled by the migration.

## Deployment safety

A dedicated protected schema workflow applies and verifies the hardening migration. The canonical production deploy workflow recognizes this migration and waits for that schema workflow before Vercel deployment.

## Required verification before merge

- Canonical `Verify web portal` must be green for the exact PR head.
- Review the migration/rollback pair and unresolved PR #1827 P1 findings against this follow-up.
- Do not merge, apply production schema, or deploy until the user explicitly approves.

# Group / Branch Portal Access Handoff

## Current architecture

INSUREIT uses one authentication system (Supabase Auth) with explicit business-identity mapping for Group and Branch logins through `portal_access_identities`.

- Group login: own active Group, its active member Partners, and active Branches below those Partners.
- Partner login: existing Partner/Employee identity path remains the legacy fallback and must not be recreated or rewritten.
- Branch login: own active Branch Partner record only; Group metadata may be inherited through the Branch's root/parent Partner where required by the existing commercial-scope contract.
- Passwords stay only in Supabase Auth. Business tables never store plaintext passwords.

## 2026-09-15 hardening

Branch: `fix/group-branch-login-scope-hardening`

Evidence state: **IMPLEMENTED; UNMERGED; NOT APPLIED; NOT DEPLOYED**.

The hardening addresses the unresolved P1 findings carried forward from PR #1827:

1. `partner_portal_access_context()` now revalidates the authenticated profile plus current Group/Branch target activity before returning any scope.
2. `partner_app_commercial_scope()` restores Branch -> parent/root Partner -> Group inheritance for explicit Branch access and for the untouched legacy Partner fallback.
3. The legacy employee business-Group security boundary from `20260914183200_business_group_partner_app_scope_compat.sql` is restored.
4. Partner Policy Intake treats explicit Group/Branch users as profile submitters and uses `partner_app_commercial_scope().intermediary_ids` for authorized source selection. It no longer interprets Group/Branch entity UUIDs as legacy `intermediaries.id` or requires a legacy Partner portal-account submitter.
5. A forward migration, verification SQL, rollback SQL, protected schema workflow, and production deployment gate update are included. Existing Partner credentials, hierarchy rows, memberships, policies, customers, claims and renewals are not backfilled or rewritten.

## Safety / rollout

Do not issue or expand real Group/Branch credentials until the corrective PR is green and the migration is explicitly approved for merge/application.

When merged later, use the repository's `Apply Group Branch Portal Access` workflow. It skips already-applied PR #1827 migrations, applies only the missing hardening migration, verifies function ACLs/contracts, and checks that Partner/Group/membership/login counts are unchanged.

Rollback file: `supabase/rollbacks/20260915170000_group_branch_portal_access_hardening.sql`.

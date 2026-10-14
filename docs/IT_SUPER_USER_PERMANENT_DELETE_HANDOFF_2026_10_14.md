# IT Super User permanent deletion — 2026-10-14

## State
**IMPLEMENTED ON BRANCH. NOT MERGED, DEPLOYED, MIGRATED, OR PRODUCTION-TESTED.**

Branch: `feat/it-super-user-permanent-delete-20261014`

## Scope
- Adds a compact professional permanent-delete confirmation modal.
- Adds permanent Delete controls to:
  - User Management (employee portal users)
  - Branch Register
  - Partner Register
- Delete controls are rendered only when the authenticated role is exactly `it_super_user`.
- Server action independently requires `it_super_user`; UI hiding is not the security boundary.
- Existing deactivate/reactivate behavior remains unchanged.

## Safety
- New service-role-only RPC `admin_hard_delete_blockers(text, uuid)` inspects RESTRICT/NO ACTION foreign-key references before hard deletion.
- Employee deletion blocks protected-history records, blocks self-deletion, removes the portal profile, Supabase Auth user, and linked employee directory row only when safe.
- Branch deletion permits removal only when protected Partner references are clear; it also cleans a removable Branch portal login and branch profile.
- Partner deletion blocks business-history references. It may clean hierarchy/onboarding link fields that only point to the Partner record, and removes removable Partner portal login/profile/Auth records.
- Database RESTRICT constraints remain unchanged and are the final safety guard.
- No existing FK protections are weakened.

## Migration
Forward: `supabase/migrations/20261014130500_admin_hard_delete_preflight.sql`
Rollback: `supabase/rollbacks/20261014130500_admin_hard_delete_preflight.sql`

**Production migration NOT APPLIED.**

## Verification still required
- Web CI/typecheck/lint/build.
- Migration review/apply in production only after approval.
- IT Super User UI visibility.
- Non-IT roles must not see Delete.
- Direct server-action call by non-IT role must be rejected.
- Safe test record deletion and protected-history rejection.

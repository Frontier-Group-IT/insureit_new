# Sole IT Super User / IT User role rollout — 2026-10-20

## Goal
Only Nishant Mishra (`it@insureit.in`) retains `it_super_user`. Four former technical admins — Nikhil Awadhwal, Ragini Gupta, Rohit Rajak, Shruti Jain — become `it_user` with business/technical operational access, but without primary identity administration or protected integration configuration. Preserve existing `is_active` values.

## Changes completed in production Supabase
- Successfully applied `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'it_user'`.
- Applied `it_user_operational_compatibility_20261020`: added IT User to 21 operational RPC definitions and 19 non-developer/non-dedicated-delete RLS policies.
- SQL rollback snapshot: `supabase/rollbacks/20261020_it_user_operational_compatibility_rollback.sql`.
- Read-only verification showed 21 RPCs and 19 policies containing `it_user`, five original `it_super_user` profiles, and **zero converted profiles**.
- Protected: role-administration RPC, privileged customer Firebase review, coordinated deletion RPCs, admin-role helper, RLS dedicated DELETE policies, and developer-config policies.
- Optional Access Control V2 shadow tables **do not currently exist in production**. Do **not** run `20261020231500_it_user_v2_shadow_role.sql` alone in production. It is an additive migration for environments where the V2 shadow foundation exists.

## GitHub
- Branch: `feat/sole-it-super-user-it-user-role-20261020`
- PR: #3292
- Role V1/V2 catalogue, permission map, employee scope, governance guards, technical operational modules, and `create-user` Supabase Edge Function updated.
- Roles assigned by the app may not work until the deployment includes these code changes.

## Production release sequence (must maintain order)
1. Get PR #3292 fully green, including Access Control V2, employee portal governance, OCR workflow, TypeScript, lint, and Next.js build.
2. Merge PR #3292 into `main`.
3. **Deploy and verify the updated web portal** at `portal.insureit.in` before converting any user. If Cloudflare preview is used, verify the exact portal endpoint as well. Vercel project `insureit` was **not visible** to the connected Vercel account, so deployment was not performed here.
4. Deploy the updated `supabase/functions/create-user/index.ts` through the project's supported Edge Function deployment flow; verify it rejects a second IT Super User and only the primary administrator can create an IT User.
5. Take a recent backup.
6. Execute **only then** `supabase/release-sql/20261020_convert_secondary_it_accounts_to_it_user.sql`. It verifies that the primary login exists, exactly four other IT Super Users remain, converts precisely four rows, and installs a primary account protection trigger.
7. Verify Nishant remains the only `it_super_user`, the four secondary accounts are `it_user`, and active/inactive values remain identical to baseline. Reauthenticate users to refresh sessions.
8. Smoke test organization-wide business modules, account management reserved for Nishant, and restricted/developer routes denied to IT Users.

## Important rollback
- Do not roll back the operational functions/RLS before secondary profiles are restored to a compatible role, or they may lose access.
- PostgreSQL enum `it_user` addition is intentionally additive and need not be removed.
- The data conversion is **not executed** by the earlier schema compatibility migration or by merging PR #3292; it is an explicitly controlled release step.
- If a later release aborts, leave all five existing `it_super_user` profiles unchanged until the next safe attempt.

## Security invariants
- Exactly one primary `it_super_user` after release.
- No normal admin can grant a second `it_super_user`.
- Only the primary admin may change an `it_user` role/status or reset/remove protected identities.
- Existing policies, claims, customer records, Auth credentials, and account activation states must not be modified during role conversion.

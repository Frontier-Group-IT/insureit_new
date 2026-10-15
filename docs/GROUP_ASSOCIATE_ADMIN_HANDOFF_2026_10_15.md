# Group Associate Administrator Accounts — 2026-10-15

## Status
- Branch: `feat/group-associate-admin-accounts-20261015`
- PR: #3169 (draft)
- Merge: **NO**
- Supabase migration applied: **YES — production, migration version 20261015080033; 2026-10-15**
- Application deployment and end-to-end authenticated tests: **NOT YET**
- Vercel/Cloudflare deployed: **NO**
- Android OTA/APK/AAB: **NONE**

## Requirements
- All existing and new active Business Groups can have multiple Associates without changing their primary login.
- INSUREIT Operations managers with permitted Group scope and active Group Administrators can create/manage associates.
- Group Associate uses independent email + password and inherits the Group portal's existing commercial hierarchy.
- Group Associate can manage other Group Associates; main Group login cannot be edited, disabled or deleted by associates.
- Group Associate identity is labeled distinctly on the Partner profile.
- Each account uses an invitation and controlled lifecycle.

## Implementation surfaces
- `/intermediaries/groups/[id]`: dedicated Group page linked from Groups register.
- `/intermediaries/groups/[id]/associate-accounts`: Operations account management.
- `/partner/group-associates`: external Group portal account management.
- Migration `supabase/migrations/20261015080033_group_associate_accounts.sql` creates independent Associate + audit tables and scoped identity/activation functions.
- Rollback `supabase/rollbacks/20261015080033_group_associate_accounts.sql` refuses deletion while Associates exist.
- Regression `apps/web-portal/scripts/group-associate-accounts-regression.mjs`.

## Before release
1. Run web CI and resolve typecheck/lint/build failures.
2. Applied approved SQL migration in a transaction. Read-only verification confirms Group Associate / audit tables, preservation of prior identity/access/activation functions, zero new Associate rows, and primary Group login + existing Partner Associate row counts unchanged.
3. Verify Group associate invite/password activation, profile labels and inherited commercial scope in a controlled environment.
4. Verify primary login survives associate disable/delete and Group A cannot manage Group B.
5. Test external Group management route, including error/success redirect and login recovery.
6. Confirm account activity/audit and email delivery behavior.
7. Merge / deploy only after explicit user approval.

## Access constraints
- Primary Group credentials stay in `portal_access_identities` and retain unique `(entity_type,entity_id)`.
- Associates exclusively live in `group_portal_associate_accounts`, referencing `auth.users` and a single `intermediary_groups` row.
- No Supabase RLS client-side mutations; lifecycle is mediated by server actions.
- Scoped to authenticated actor's Group; IDs submitted by forms are reauthorized server side.

## Risk
Production SQL wrappers have not been executed yet. Do not present this feature as live or tested end-to-end. Database function dependencies, password activation and all Partner APIs must be exercised before production release.


## Approved production migration evidence (2026-10-15)
- `mcp Supabase apply_migration` returned `success: true` on the existing INSUREIT production project.
- Supabase schema migration history recorded version `20261015080033`, name `group_associate_accounts_20261015`. Repository filenames aligned to this exact version to prevent accidental reapplication.
- Read-only postflight: associate table exists; audit table exists; active-group-id function exists; all three prior login functions preserved; associate table has 0 rows.
- Existing counts after migration: 2 primary Group/Branch identities, 6 Partner Associates, 8 Groups. Do not mistake these as end-to-end behavioral verification.
- Rollback is **code-only and non-destructive** and refuses while Group Associates exist; it preserves audit history. It has not been executed. Before attempting rollback after account creation, plan safe deprovisioning with explicit approval.
- **PR NOT MERGED, PORTAL NOT DEPLOYED, NO ACCOUNT INVITES SENT.**

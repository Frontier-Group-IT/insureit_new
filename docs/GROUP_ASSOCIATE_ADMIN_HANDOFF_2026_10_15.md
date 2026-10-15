# Group Associate Administrator Accounts — 2026-10-15

## Status
- Branch: `feat/group-associate-admin-accounts-20261015`
- PR: #3169 (draft)
- Merge: **NO**
- Supabase migration applied: **NO**
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
- Migration `supabase/migrations/20261015130000_group_associate_accounts.sql` creates independent Associate + audit tables and scoped identity/activation functions.
- Rollback `supabase/rollbacks/20261015130000_group_associate_accounts.sql` refuses deletion while Associates exist.
- Regression `apps/web-portal/scripts/group-associate-accounts-regression.mjs`.

## Before release
1. Run web CI and resolve typecheck/lint/build failures.
2. Review the production SQL migration against live function dependencies and auth-flow compatibility before applying. Migration must NOT be executed without approval.
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

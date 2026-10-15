# Group Onboarding / Details / Associate Roles — 2026-10-15

## Requested change
- Replace Create Group modal with dedicated POSP-style Group onboarding page.
- Fields: Group Name, Admin Name, Admin Email, Admin Mobile, Address, City, State, PIN Code, read-only Group Administrator role; Save/Cancel.
- Save existing Group via safe creation RPC, provision primary login and invitation, save administrator contact metadata and redirect to Group Details.
- Group Details inspired by Partner Application Review: large navy summary header, edit icon, Associate Accounts button, identity/address cards and Partner list.
- Associate create Role dropdown: blocked Group Administrator, selectable Insurance Head, Claim Head, Bodyshop Manager.
- Register shows actual role for each account. Non-admin associates cannot manage associate accounts.
- All existing Groups remain viewable; historic missing contact fields show dashes, not invented data.

## Implementation
- Branch: feat/group-onboarding-review-role-options-20261015
- New route: apps/web-portal/app/intermediaries/groups/new/page.tsx
- Review and Edit: apps/web-portal/app/intermediaries/groups/[id]/page.tsx and /edit
- Migration: supabase/migrations/20261015160000_group_admin_contacts_and_associate_roles.sql
- Rollback: supabase/rollbacks/20261015160000_group_admin_contacts_and_associate_roles.sql
- Schema migration must be applied BEFORE deploying new feature, only after approval.

## Release safeguards
- Separate branch and PR, no automatic database migration, no deployment.
- Primary Group credential unique mapping remains intact; existing Group associate/Partner accounts remain intact.
- Role selector blocks creation of secondary Group Administrator. New non-admin roles keep Group commercial-scope access but cannot administer Group Associate accounts.
- Rollback refuses removal if contact data exists or non-admin role is assigned, preserving records. It restores previous identity resolver only if safe to do so.
- Existing user/Partner account emails must stay unique and not be reassigned.
- The creation RPC commits Group before invitation is sent; failed invites must be handled via recovery, not silent deletion.

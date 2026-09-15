# Group Portal Invitation Onboarding Handoff

## Status

**IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / NOT DEPLOYED**

Branch: `feat/group-invite-onboarding`

This change intentionally does not add or change database schema. Existing Groups are not backfilled or modified automatically.

## User-approved workflow

New Business Group onboarding follows the existing Partner-style invitation pattern:

1. Admin opens **Create Business Group**.
2. Admin enters Group name, Group email, phone number, description, and optional initial Partner.
3. The business Group is created through the existing `service_create_business_intermediary_group` RPC.
4. Supabase Auth sends an invitation to the Group email using `inviteUserByEmail`.
5. A normal `profiles` row is prepared for the invited Auth user and stores the Group contact email/phone.
6. `portal_access_identities` links that Auth/profile identity to the Group.
7. The invited user follows the email link and chooses their own password.
8. The administrator never creates, receives, stores, or communicates the Group password.

The invitation callback uses the same production-origin selection and `/auth/callback?next=/intermediary-portal` pattern as existing Partner portal invitations.

## Login Access workspace

`/intermediaries/groups/login-access` is now intended primarily as lifecycle management and recovery:

- **No Access** — no explicit Group/Branch access identity exists; admin may enter email + phone and send an invitation.
- **Invitation Sent** — Auth user exists but has not signed in yet; admin may resend the invitation.
- **Active** — invited Auth user has signed in; admin may send a password-reset email.
- **Disabled** — mapping/profile access is disabled; hierarchy/business records remain unchanged.
- **Access Issue** — mapping exists but its Auth user cannot be resolved.

No admin-set temporary password field is used in the new workflow.

## Safety / failure behavior

- Existing Partner authentication is unchanged.
- Existing Group and Branch hierarchy/scope logic is unchanged.
- No plaintext password is accepted or persisted.
- Existing Groups are not automatically provisioned.
- If Group creation succeeds but Auth invitation/profile/mapping provisioning fails, the Group is kept rather than silently deleting or rewriting hierarchy. The UI reports the partial failure, and Login Access can be used to send an invitation afterward.
- Disable/enable continues to affect only the access mapping/profile state, not Group/Partner/Branch memberships or business data.

## Primary files

- `apps/web-portal/app/intermediaries/groups/business-group-workspace.tsx`
- `apps/web-portal/app/intermediaries/groups/business-group-actions.ts`
- `apps/web-portal/app/intermediaries/groups/login-access/page.tsx`
- `apps/web-portal/app/intermediaries/groups/group-branch-login-actions.ts`

## Verification required before merge

Run the canonical **Verify web portal** GitHub Actions workflow on the feature PR. Merge/deploy only after explicit user approval.
# Branch Portal Invitation Onboarding Handoff

## Status

**IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / NOT DEPLOYED**

Branch: `feat/branch-auto-login-invite`

No database schema change is required. The existing Branch onboarding RPC already returns the newly-created Branch Partner UUID and already stores Branch email/phone/contact details.

## User-approved workflow

New Branch onboarding now follows the same invitation-first credential pattern as Business Group onboarding:

1. Admin opens **Add Branch**.
2. Admin enters Branch name, phone, email, contact name, address, and parent Partner.
3. The existing `service_create_partner_branch_profile` RPC creates the Branch and returns its Partner UUID.
4. The Branch email is checked against existing portal-access/profile email ownership before creation.
5. Supabase Auth sends a password-setup invitation to the Branch email with `portal_account_type = branch`.
6. A normal `profiles` row is prepared for the invited Auth user using the Branch email/phone.
7. `portal_access_identities` links the invited identity to the newly-created Branch.
8. The recipient follows the email link and creates their own password.
9. Admin never creates, receives, stores, or communicates a Branch password.

The callback uses the canonical `/auth/callback?next=/intermediary-portal` production-origin pattern already used by Group and Partner invitation flows.

## Failure safety

- Branch hierarchy creation is authoritative and is not rolled back merely because email/Auth provisioning fails.
- If invitation, profile preparation, or access mapping fails after Branch creation, the Branch is retained.
- The user is redirected to **Login Access** with a clear partial-failure message and can retry from there.
- When profile/mapping setup fails after an Auth invite was created, the incomplete Auth/profile artifacts are cleaned up before redirecting.
- Existing Partner login behavior and Group/Partner/Branch scope rules are unchanged.
- Existing Branches are not backfilled or automatically invited.

## Files

- `apps/web-portal/app/intermediaries/groups/branches/new/actions.ts`
- `docs/BRANCH_PORTAL_INVITE_ONBOARDING_HANDOFF.md`

## Verification required before merge

Run the canonical **Verify web portal** GitHub Actions workflow on the feature PR. Merge/deploy only after explicit user approval.

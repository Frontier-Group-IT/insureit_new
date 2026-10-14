# User Management customer/intermediary hard-delete support — 2026-10-14

## State
**IMPLEMENTED ON BRANCH. NOT MERGED, DEPLOYED, MIGRATED, OR PRODUCTION-TESTED.**

Branch: `fix/user-management-delete-customer-intermediary-20261014`

## Requirement
IT Super User must be able to use the existing User Management permanent Delete flow for:
- internal employee/staff profiles
- customer profiles
- intermediary profiles

## Behavior
- The existing Delete button remains IT Super User-only.
- Server-side role enforcement remains exact `it_super_user`; UI visibility is not the security boundary.
- Customer and intermediary profiles are no longer rejected merely because of their role.
- User Management deletion removes the login/profile identity, not the underlying customer/intermediary master business record.

## Customer safety
Before deleting the profile/Auth identity:
- protected profile/business history is preflighted;
- Firebase identity links are removed;
- nullable onboarding-contact profile links are cleared;
- customer onboarding applications are preserved by setting `profile_id = null` rather than allowing their FK CASCADE to delete them;
- customer master records are preserved; existing `customers.profile_id` uses SET NULL;
- business-history cascade tables remain protected.

## Intermediary safety
- protected profile/business history is preflighted;
- `intermediary_portal_accounts.auth_user_id` is cleared;
- profile/Auth login is removed;
- the underlying `intermediaries` business/master row is left intact;
- full Partner/intermediary master deletion remains available only from its dedicated Partner delete flow.

## Cascade guard
Migration `supabase/migrations/20261014142000_admin_hard_delete_cascade_guards.sql` upgrades `admin_hard_delete_blockers` so selected business-history CASCADE relationships are treated as blockers:
- customer_onboarding_applications (customer flow explicitly preserves/unlinks it)
- management_pack_snapshots
- policy_ocr_document_staging
- renewal_voice_agent_sessions

Rollback: `supabase/rollbacks/20261014142000_admin_hard_delete_cascade_guards.sql`.

The original hard-delete preflight migration from PR #3144 is also still required in production.

## Pending
- CI/typecheck/lint/build
- migration application
- merge/deploy
- live verification using one safe customer/intermediary test profile

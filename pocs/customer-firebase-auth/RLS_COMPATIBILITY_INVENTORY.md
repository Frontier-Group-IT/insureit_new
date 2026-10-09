# Customer Firebase auth — policy compatibility inventory

Generated from read-only inspection of connected Supabase project on 2026-10-08.
**Informational, not a runnable migration.**

RLS policies directly referring to `auth.uid()` (counted from `pg_policies.qual` and `with_check`):
- `storage.objects`: 18 of 32 policies
- `public.policies`: 7 of 9
- `public.vehicles`: 7 of 9
- `public.customers`: 6 of 9
- `public.claims`: 5 of 9
- `public.claim_documents`: 7 of 15
- `public.customer_memberships`: 2 of 3
- `public.profiles`: 2 of 4

Inherited authorization dependencies include:
- `public.can_access_customer(uuid)`, recursively resolving membership using `auth.uid()`
- `public.can_access_customer(uuid,uuid)` requiring passed viewer == `auth.uid()` in ordinary caller context
- `public.can_access_policy(uuid,uuid)` and `public.can_access_vehicle(uuid,uuid)`
- `public.current_app_role()` querying `profiles` by `auth.uid()`
- `public.claim_pending_customer_memberships()` reading phone from `auth.users` by `auth.uid()`
- `public.ensure_customer_signup_profile(...)` creating profile/customer/membership through Supabase Auth user ID

The current app's startup routing, saved-account vault and customer context also assume Supabase Auth sessions. Firebase's `sub` cannot be treated as an existing Supabase user UUID.

## Security proof checklist
- Verify exact Firebase issuer/audience and third-party JWT trust configuration.
- Review Firebase identity linkage admin approval, uniqueness, revocation and active customer checks.
- Update every relevant RLS policy and SECURITY DEFINER RPC to derive canonical profile through a reviewed trusted mapping.
- Verify old Supabase authenticated customers, partners and operations staff retain access.
- Test cross-customer denial for Customers, Vehicles, Policies, Claims, Storage and signed URLs.
- Test multiple customer memberships, inactive profiles, duplicate phones, account recovery and signup.
- Ensure no client-controlled canonical user IDs and no service-role key in app.

## Rollout blockers
No migration should be executed before exact issuer configuration, function grants, and full SQL/RLS testing are complete. The earlier `REVIEW_ONLY.sql` is a non-deployable draft with a placeholder issuer. Do not import it into automated migrations.

## Preserved restrictions
No production auth edits, database writes, merge, deployment, OTA or APK/AAB build.

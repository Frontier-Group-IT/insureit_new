# Firebase customer authorization migration — review-only design

**Original 2026-10-08 draft NOT applied as written; later separate production migrations were historically reported applied.**

## 2026-10-12 evidence override — DO NOT TREAT THIS AS AN UNAPPLIED CURRENT DESIGN

The original text below is an October 8 **review-only blueprint**, and the original status sentence applies to THAT draft SQL, not all subsequent migrations. Later commits in PR #2979 and previous connected Supabase work recorded additive identity mapping/resolver, customer SELECT policies and a guarded `pgrst.db_pre_request` hook applied to production. The last SQL simulation reportedly resolved Firebase UID to existing UUID, denied wrong-account reads and rolled back temporary mapping writes. These are **not real Firebase signed-token security proofs**. Current Supabase access returned permission denied on 2026-10-12; live settings/function versions cannot be asserted from today's audit.

**Critical cutover requirement:** validate the actual signed Firebase token over PostgREST and verify every required RPC and Storage read/write against two controlled customer identities, including direct malicious cross-customer access. PostgREST pre-request hooks **do not protect Supabase Storage automatically**: separately verify deployed Firebase signed read and upload services and their metadata ownership. Treat the Firebase-only switch as blocked until proven. Never modify the managed `auth.uid()` function or give Firebase users generic service-role access. Preserve staff, partner and web Supabase sessions.

The exact three-step cutover and release stop conditions are pinned at the top of `docs/CUSTOMER_FIREBASE_OTP_AGENT_HANDOFF_2026_10_08.md`.

## Verified blocker (2026-10-08 snapshot)

The existing `profiles.id`, `customers.profile_id` and customer-membership
columns reference Supabase Auth UUIDs. A Firebase ID token uses the Firebase
UID as `sub`. Existing policies and several SECURITY DEFINER RPCs use
`auth.uid()` and would therefore break or reject Firebase identities.

Do not cast arbitrary Firebase UID to UUID, impersonate a Supabase user by
editing JWT claims, or trust a caller-supplied customer/profile ID.

## Proposed additive server-side mapping

In a separately reviewed migration, store an administrator-approved mapping
from the Firebase *issuer/project + UID* to the existing Supabase profile UUID.
Require uniqueness on the Firebase principal. To prevent one Firebase UID from
being silently assigned conflicting Supabase identities, review and document
one-to-one account-binding rules, account recovery and revocation.

A narrowly scoped SECURITY DEFINER helper should derive the Firebase subject
and issuer from **validated provider JWT claims** supplied by the Supabase
request authentication layer. It must enforce the expected issuer/project,
authenticated database role, active mapping and active customer profile.
It must also support original Supabase users through their existing `auth.uid()`
paths. Never grant ordinary users INSERT/UPDATE access to the mapping table.

## Scope that must be migrated together

1. `can_access_customer` (both overloads), `can_access_profile`,
   `current_app_role`, `can_access_vehicle`, `can_access_policy`.
2. All direct comparisons against `auth.uid()` for customer RLS in
   `customers`, `profiles`, `customer_memberships`, `vehicles`,
   `policies`, `claims`, onboarding, documents and related tables.
3. SECURITY DEFINER signup and membership functions, including
   `claim_pending_customer_memberships`,
   `ensure_customer_signup_profile`, customer-account selection/linking,
   customer-context selection, and all dependent helpers.
4. Storage object policies and Realtime authorization.
5. Existing Supabase session and multi-account vault behavior across
   new Android auth mode, login, signup and startup routing.

## Mandatory sandbox/prerelease assertions

- Firebase token for customer A may read A data but never B data.
- Unmapped/revoked Firebase identity gets zero customer access.
- Wrong project, invalid audience, inactive/ambiguous mapping rejected.
- Existing Supabase customer, partner and staff sessions still work.
- Direct RPC and Storage calls cannot bypass mapping.
- Customer signup cannot duplicate or attach the wrong customer.
- Token refresh, logout and account switching do not leak sessions.

Do not merge or deploy the Firebase provider until these assertions are
proved against a test environment. This document is an implementation
blueprint, not evidence that any RLS migration is complete.

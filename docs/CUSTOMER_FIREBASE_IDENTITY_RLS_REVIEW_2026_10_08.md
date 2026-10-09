# Firebase customer authorization migration — review-only design

**NOT applied to a database. NOT safe to run without full security review.**

## Verified blocker

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

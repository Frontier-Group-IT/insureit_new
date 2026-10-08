# Firebase OTP → Supabase identity-preserving POC (2026-10-08)

**Status: ISOLATED CONTRACT ONLY. NO SESSION ISSUANCE. NO PRODUCTION INTEGRATION.**
Branch: `poc/firebase-supabase-identity-bridge-2026-10-08`.

## Source-backed findings
- Customer Expo app: `apps/mobile-app` SDK 54; current `lib/auth.ts` uses Supabase SMS OTP and persists Supabase sessions.
- `profiles.id`, `customers.profile_id`, `customer_memberships.profile_id`, customer access functions and startup routing assume `auth.uid()` is the **existing Supabase Auth UUID**.
- Read-only database inspection: `current_app_role()` reads `profiles` by `auth.uid()`; `can_access_customer` has two overloads; `claim_pending_customer_memberships()` resolves phone through `auth.users` and links pending records. `ensure_customer_signup_profile()` may create a canonical customer and membership. Never call these during mere Firebase verification.
- Firebase third-party auth (official Supabase integration) accepts signed Firebase JWTs with custom `role: authenticated`, but `auth.uid()` is derived from the Firebase `sub`, not a previously existing Supabase UUID. This is NOT a transparent drop-in for the current schema.
- Supabase Auth Admin `generateLink` supports email magic links; it is **not** a documented general-purpose Firebase-phone-verified exchange, and must not be used as a secret session bypass.
- Neither `auth.admin.updateUserById()` nor `setSession()` can mint a valid existing user's Supabase refresh token from a Firebase identity.
- Do not mint a Supabase JWT with a signing secret or use a service-role key in the mobile client.

## POC contract
`identity-contract.ts` is deliberately independent, side-effect-free and fail-closed. It receives **already-verified** Firebase claims from a trusted server verifier, and an **already-authorized uniquely resolved** Supabase customer identity. It ensures an exact Firebase project, a recently authenticated Indian phone, active UUID candidate, and phone equality. Its only successful result is `identity_verified_only`; it **never issues** or claims to have issued a Supabase Auth session.

**Blocked pending architecture decision:** Select and prove a documented identity-preserving Supabase session issuance method in an isolated test environment. Possible secure directions are (1) keep Supabase Auth OTP/session issuance and have Firebase perform an additional verification step (not a complete provider swap), or (2) adopt Firebase third-party Auth with explicit, carefully migrated identity mappings/RLS and rewired clients. The second requires database/auth changes and migration, expressly prohibited in this POC.

## Remaining read-only security coverage
Before any live bridge, audit all transitive security functions (`can_access_customer`, `can_access_profile`, `can_access_vehicle`, `can_access_policy`, `current_app_role`, membership and onboarding RPCs), every customer Storage and Realtime policy, grants, all customer access paths, external/customer claims, auth triggers, duplicate-phone behavior and authenticated account binding. Runtime RLS assertions need an isolated environment; inspecting policies alone is insufficient.

## Acceptance requirements for subsequent POC
1. Token verification must be done on the backend using official Firebase Admin with issuer/audience/signature, expiration, revocation, phone and recent-login checks; never trust raw client claims.
2. Resolve pre-existing user UUID under strict uniqueness/authorization; never auto-link solely from an unverified or ambiguous number.
3. Prove genuine Supabase refreshable sessions, matching `auth.uid()` and authorization with service-role absent from client.
4. Negative tests: expired/wrong-project/stale tokens, spoofed phone, duplicate/inactive profiles, replay, unauthorized membership, revoked tokens, session refresh, logout and multiple remembered accounts.
5. No database or auth-config mutations without separate explicit approval. No merge, deploy, OTA, APK or AAB from this POC.

## Follow-up verification (2026-10-08)
- The initial PR CI `Verify web portal #5675` succeeded. A separate Vercel status reported a build-rate-limit failure; that is not a test failure.
- Official Supabase docs confirm that Firebase third-party JWTs authenticate Data API/Storage/Realtime via a client `accessToken` callback, **not** by creating Supabase Auth refresh tokens. Their `sub` is Firebase UID; `auth.uid()` cannot be assumed to equal the existing Supabase UUID. Reference: https://supabase.com/docs/guides/auth/third-party/firebase-auth .
- Supabase Custom Access Token Hook runs **after** Supabase Auth already identifies the user and therefore cannot establish a new external OTP sign-in method. Reference: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook .
- The Supabase Admin generateLink API documents email link/OTP generation, not a supported general-purpose exchange of Firebase phone proof for an existing user's refreshable Supabase session. Reference: https://supabase.com/docs/reference/javascript/auth-admin-generatelink .
- Wider read-only RLS inventory found `storage.objects` has RLS and 32 policies, and major customer/claim/vehicle/policy tables have RLS enabled. Several secondary public tables have RLS enabled but zero policies; do not infer they are externally accessible or inaccessible without grants and runtime tests. Realtime partition tables are not standalone evidence of a bypass.
- `identity-contract.test.cjs` includes positive-but-not-session-issued and negative tests (wrong audience/issuer, stale verification, expired token, future timestamps, missing/mismatched phone, missing/inactive/malformed Supabase ID). Run `node --test pocs/firebase-supabase-bridge/identity-contract.test.cjs` after workspace dependencies are installed. GitHub's general portal CI does not necessarily run this POC-specific test.
- **Decision gate:** Do not advance to customer app implementation or call this an operational OTP provider migration. A genuinely supported session path preserving original `auth.uid()` must be demonstrated in an isolated environment, or a separate explicitly approved Firebase-third-party-Auth identity/RLS migration must be designed.

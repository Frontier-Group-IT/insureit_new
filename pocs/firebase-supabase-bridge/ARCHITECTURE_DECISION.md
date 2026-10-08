# Customer Firebase OTP authentication — architectural decision record
Date: 2026-10-08
Status: **DESIGN SELECTED FOR ISOLATED DEVELOPMENT; NOT APPROVED FOR PRODUCTION OR DATABASE ALTERATIONS**

## Decision
**Select official Firebase third-party authentication for eventual Customer App migration, with an explicit identity mapping and RLS/client transition.** Do **not** build a homemade Firebase-token-to-existing-Supabase-Auth refresh-token issuer. There is no documented, approved universal exchange to mint an existing user's Supabase Auth session from an independently verified Firebase phone token.

Official supported mechanism: https://supabase.com/docs/guides/auth/third-party/firebase-auth
Firebase ID token via Supabase JS `accessToken` callback for Data API, Storage, Realtime and Functions; Supabase Auth `getSession()`/`setSession()` are **not** the Firebase session source. Use Firebase SDK for sign-in, token refresh, sign-out and saved accounts.

## Non-negotiable migration constraints
- **No production implementation currently:** current POC is pure offline contract only.
- Original `auth.users.id` is a UUID; Firebase token `sub` normally differs, may be non-UUID. Existing `auth.uid()` and `profiles.id`/membership references cannot be assumed to work and may fail UUID conversion. Do not hack Firebase UID to equal an existing UUID.
- Future RLS must resolve authenticated Firebase identities via a carefully reviewed identity mapping, **without taking any caller-supplied profile ID as trusted**. Prefer security-definer mapping with fixed search_path, exact Firebase issuer/audience, trusted server-admin-provisioned mapping, scoped grants; preserve old Supabase user policies for existing web/partner clients during coexistence. Verify feasibility of safe JWT identity extraction in a sandbox first.
- Resolve verified phone to identity with uniqueness, conflict and takeover review; never auto-bind to the first matching customer, and never hand out profiles/policies before authorization.
- Preserve existing `customers`, `profiles`, `customer_memberships`, role hierarchy and customer data; no destructive customer migration.
- Mobile `lib/supabase.ts` must eventually use `accessToken` for Firebase-backed API requests; Firebase SDK manages sessions, not Supabase Auth. Isolate changes to customer routes so agent/admin roles remain unaffected. Rewrite login/signup, startup routing, multi-account vault and account selection accordingly. Treat new native SDK integration as an APK/native build requirement requiring explicit approval.
- Evaluate and test Storage object policies, Realtime, all table RLS and RPCs (including SECURITY DEFINER calls) under both auth modes, including explicit denial for another customer's data.
- Rollout: sandbox DB and auth project; then controlled opt-in, security regression and rollback; only after explicit approval add config/schema/backend/native changes. No merge/deploy/OTA/APK/AAB in this phase.

## Why the alternatives were rejected
1. **Custom session minting**: Firebase token verification does not create a Supabase refresh token; manually signed JWTs bypass supported session issuance and risk security.
2. **Send SMS hook**: Supabase sends and verifies Supabase-generated OTP; Firebase Phone Authentication does not expose a general SMS delivery API for Supabase's arbitrary OTP (https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook). Thus not the tested Firebase Phone Auth provider switch.
3. **Custom Access Token hook**: runs after Supabase authentication and cannot substitute for it (https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).
4. **Web reCAPTCHA proof**: works in web browser but does not certify Android native behavior.

## Implementation preparation — NOT implementation authorization
1. Create a read-only inventory of all customer auth callers, route guards and storage/realtime listeners.
2. Define a threat model and account linking rules; explicit conflicts and multi-account ownership.
3. Prototype Firebase JWT -> exact verified principal in an isolated Supabase instance; test `auth.uid()` compatibility and safe claim extraction; do not mutate production config.
4. In sandbox, design additive mapping table/RLS helper with separate grants, covering Supabase and Firebase token coexistence. Include migrations and reversals but never apply without approval.
5. Prototype native Firebase SDK in separate branch; Android SHA-1/SHA-256 registration; signing certificates, app check/Play Integrity checks; no binary builds until requested.
6. Build precise regression suite for current Supabase customers, invited memberships, account vault, customer signup, inactive user, RLS, policies, vehicles, claims, Storage and Realtime.
7. CI, explicit review, rollout gate and documented rollback plan.

## Verification evidence
- Existing main code `apps/mobile-app/lib/auth.ts`: `supabase.auth.signInWithOtp()`/`verifyOtp()`; `apps/mobile-app/lib/supabase.ts`: persistent Supabase session with AsyncStorage.
- Live read-only DB functions: `current_app_role()`, `can_access_customer()`, `can_access_profile()`, `claim_pending_customer_memberships()`, `ensure_customer_signup_profile()` use `auth.uid()`/existing users.
- Prior portal PR CI #5679 SUCCESS; POC-specific test workflow introduced in separate draft PR; await workflow result.
- External provider implementation is currently **not demonstrated**, and this ADR does not claim otherwise.

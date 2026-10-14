## 2026-10-14 — DISPOSABLE SUPABASE AUTH END-TO-END SESSION PROOF: PASSED

- **PASS** GitHub Actions [#38518326907](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38518326907), SHA `f5729eda473610a43255bf769c116d9338a18cd8`. Workflow step **"Prove same Auth UUID, supported one-use magiclink session, refresh, A/B isolation"** succeeded after all local Docker/CLI setup steps passed. No production Supabase keys, records, database, Auth users or Firebase secrets used; workflow expressly restricted to localhost 127.0.0.1, generated temporary local Auth users and used reserved-domain synthetic aliases.
- Confirmed against REAL LOCAL GoTrue/Auth (not mocks): two originally phone-only, phone-confirmed synthetic Auth users successfully got admin-updated verified email aliases on the **same Auth UUIDs** without changing phones; `admin.generateLink(magiclink)` returned matching existing Auth UUIDs; `verifyOtp(token_hash,'magiclink')` returned genuine Supabase access/refresh sessions; `getUser()` and `refreshSession()` preserved each identity; replayed magiclink challenge was rejected; A and B remained distinct.
- **Meaning:** Same-UUID Supabase session issuance for existing phone-only users through carefully controlled Auth email identity provisioning is **technically feasible with supported Supabase APIs**. This removes the previous *unproven-API-feasibility* blocker, but **does not prove or authorize production provisioning**, email alias deliverability/recovery safety, collision/cross-account controls, ongoing revocation/rate limiting, phone-confirmation edge cases, Firebase native Android SMS or real two-customer private storage/RLS outcomes.
- **Production status:** 24/24 active Customer Auth identities still have NO Auth email and have not been changed; 8 Customer profiles have unrelated contact emails, which must never be promoted automatically; 22/24 Auth phones confirmed and 2 unconfirmed. The production Android app remains 0.3.0 (9); never merge old 0.3.1 Firebase auth data architecture. Future 0.3.2 (11) not built or released.
- **Next controlled step before production:** independently review/protect service-owned internal Auth alias namespace, email recovery and OTP attack vectors; perform an authorized narrowly scoped dry-run/provisioning rehearsal on isolated synthetic identity, ensure `auth.users.id` unchanged and Alias never rendered as contact email; add authenticated Firebase token→approved identity→Supabase one-use challenge rate-limit/replay gates. Only after that and Android signed-token/device tests decide when 0.3.2 can be built. Preserve fallback Supabase/2Factor OTP until full end-to-end production proof.


---

## 2026-10-14 — Phase 2 deeper integration / protected disposable Supabase proof

- Kept `apps/mobile-app/app.json`, login/signup, existing Supabase storage/RPC/RLS, and package/lockfile at production **0.3.0 (9)**; proposed **0.3.2 (11)** remains unbuilt. No native package introduced.
- Ported **ONLY** tested native-independent Firebase OTP pieces from retired 0.3.1 draft PR #3123: `firebase-native-phone-flow.ts`, `firebase-otp-errors.ts`, `firebase-android-auth-adapter.ts` and 3 matching tests. Invalid code can be retried; expired confirmation requires new SMS; Firebase phone/UID must match; logging never includes raw OTP/phone/token. SDK itself is not installed or wired, so no Android Firebase OTP cutover.
- Added **real runtime-mock tests** `apps/mobile-app/lib/customer-firebase-session-exchange.test.cjs`: Supabase one-time challenge->real-shaped session orchestration, `auth.getUser` checks, Customer active profile checks, A/B account rollback on mismatch, malformed/failed challenge rejection, local signout on uncertain identity, Android flag. Wired to Mobile CI. Previously observed complete Mobile CI success at **#38518130686** on source `d3f11cb8`; latest branch includes further OTP-only tests, final Mobile CI needs a new pass.
- Added standalone **NO PRODUCTION CONNECTION** integration test `apps/mobile-app/scripts/customer-firebase-supabase-local-integration.mjs` and branch-only workflow `.github/workflows/prove-customer-supabase-auth-local.yml`, [run #38518326907](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38518326907) **RUNNING at last observation, not yet a pass**. Workflow uses disposable `supabase init/start` in temporary GitHub runner Docker (NOT project production Supabase), no production secret, synthetic phone-only Auth users. Tests ADMIN update of synthetic existing UUID to reserved-email alias, unchanged UUID/phone, ADMIN generateLink magiclink, `auth.verifyOtp({token_hash,type:'magiclink'})`, `auth.getUser`, refresh token, single-use replay rejection, second-user isolation and cleanup. A passing LOCAL test only validates a supported GoTrue **session path**, not whether internal-email aliases are safe or deployed, nor Firebase SMS or production account conditions.
- Separate production read-only audit found **22 / 24 active Customer Auth users have `phone_confirmed_at` and 2 do not**. Profiles/Auth stored phone digits do match, but no Auth email for all 24. **8 active Customer profiles have contact emails**; these MUST NOT be promoted automatically to Auth email. No user/profile/Auth write performed.
- **Release BLOCKED:** alias domain/OTP/recovery takeover threat model and explicit controlled Auth identity approval; validated same-UUID account safety; approved Firebase link for each target; cross-account claims/KYC/Storage/device tests; backend rate limits/replay; verified Android build after session proof. Production 2Factor/Supabase Customer login is unchanged and working. No PR merge, deployment, OTA, AAB, APK, Play Store or production migration.


---

# Customer Android 0.3.2 — Firebase SMS OTP as verification gate, Supabase Auth as the session
**Date:** 2026-10-14 · **Decision:** APPROVED · **Implementation:** PHASE 1 DONE / PHASE 2 PROTOTYPE ONLY · **Release:** BLOCKED

## 1. Exact approved architecture

- **Source of truth** = latest released Customer 0.3.0 source from repository `main`. Preserve all later merged fixes, especially Start Claim protected header and entire-field vehicle selector. Do NOT base release on stale 0.3.1 Firebase draft code.
- **Firebase Phone Auth** performs send / resend / confirm of Customer Android SMS OTP. It returns a Firebase ID token proving a phone user only; the Firebase UID is NOT the Supabase Auth UUID.
- **Secure backend** independently verifies Firebase JWT signature, revocation, project, current SMS provider and verified phone, requires recent `auth_time`, checks exactly one approved immutable Firebase UID→canonical Customer profile link, and resolves the **existing** `auth.users.id` without changes.
- **Supabase Auth** alone issues the Customer's actual refreshable session. A server-mediated *Supabase-issued one-use challenge* is a **candidate**; must show end-to-end supported behavior first. Existing `supabase.auth.getSession()/refreshSession()` and login routing must remain valid. Firebase JWT must NEVER be set as a Supabase session or used with a second Firebase data client in this design.
- **Supabase** handles the exact current Customer master, policies, claims, KYC, Storage, RLS, RPCs, multi-account vault and web/staff/partner login without migrations.
- **Rollback** = preserve legacy Supabase/2Factor Customer SMS flow, keep it available for gated rollback, do not remove the provider before installed-device production proofs.

## 2. Current production read-only evidence (NO data exported or changed)

2026-10-14 Supabase aggregate SELECTs on project `ilzhsfqqjyppzzvfscmh`:

| Check | Result |
|---|---:|
| Auth users with non-empty phone, all roles | 35 |
| Auth users with phone but no email, all roles | 32 |
| Profiles joined to existing `auth.users`, role Customer | 33 |
| Active Customer Auth profiles | 24 |
| Active Customer Auth profiles with phone | 24 |
| Active Customer Auth profiles with Auth email | **0** |
| Active Customer Auth profiles with approved/active Firebase UID link | 2 |
| Stored phone format for active Customer Auth users | **all 24 are 12 digits prefixed with `91`, no `+`** |

**Meaning:** The documented `supabase.auth.admin.generateLink({ type:'magiclink', email })` cannot currently handle ANY active Customer Auth identity because all 24 lack an Auth email. It only generates EMAIL links and must not be mistaken for a Firebase ID token exchange or a native phone magic-link API. The proposed Edge prototype therefore **FAILS CLOSED for all current active Customers** and must NEVER be deployed or enabled in Android until the phone-only identity issue is solved safely. The production 2Factor/Supabase login remains the functional system.

## 3. Findings verified against current official docs

- Firebase third-party auth in Supabase trusts Firebase JWTs for Data API/Storage, using `createClient(...,{accessToken:async()=>firebaseToken})`, but does **not** create a normal Supabase Auth session. This is the old full-migration design, now explicitly rejected for INSUREIT.
- `auth.signInWithIdToken` supports enabled OIDC identity providers and is not documented as a generic Firebase Phone OTP → existing Supabase Auth user sign-in.
- `auth.admin.generateLink` is officially an **email** magic-link/OTP generator; `auth.verifyOtp({token_hash,type:'magiclink'})` may create a normal Supabase session when the challenge belongs to an existing Auth user, but **this exact combination needs live proof** with an eligible, user-authorized test account.
- Do not issue custom project-secret-signed JWTs or invent refresh tokens.
- Docs: https://supabase.com/docs/guides/auth/third-party/firebase-auth ; https://supabase.com/docs/reference/javascript/auth-admin-generatelink ; https://supabase.com/docs/reference/javascript/auth-verifyotp ; https://supabase.com/docs/guides/auth/jwts

## 4. GitHub implementation records

**Clean branch:** `feature/customer-firebase-otp-gateway-0-3-2-20261014` from current `main`.
**Historical WIP:** PR #3123 (0.3.1(10) full provider, draft, do not merge); PR #2979 stale.

Source introduced ONLY to investigate Phase 2, NOT connected to app login and NOT deployed:
- `supabase/functions/_shared/customer-firebase-session-policy.mjs`: pure fail-closed principal→profile→existing Supabase Auth identity validator. Checks Firebase issuer, audience, phone provider, freshness, exact immutable link, active Customer, matching UUID and phone. Explicitly **rejects** Auth user without verified email.
- `supabase/functions/customer-firebase-session-bridge/index.ts`: **undeployed prototype** that verifies Firebase signature/revocation through Admin SDK, checks approved identity, then conditionally calls documented `admin.generateLink` for an existing verified email and checks the generated Auth user ID matches the canonical Customer. Returns one-use token hash, not a fabricated session. It is nonfunctional on actual phone-only customers by design. Deployment would need `verify_jwt=false` at the Edge gateway and mandatory Firebase Admin checks in function.
- `apps/mobile-app/scripts/customer-firebase-session-bridge-policy.test.mjs`: isolated deny cases (wrong Firebase project/UID/phone, stale auth, inactive link, staff account, wrong UUID, unprovisioned email and stored 91-prefix matching). CI must run and pass.
- `apps/mobile-app` login/signup, app.json, package/lockfile and native Android Firebase plugins deliberately **NOT MODIFIED** until the session gate clears; proposed new version 0.3.2 (11) is not staged in production.

## 5. Phone-only account problem — controlled investigation, not permission to modify Auth

A *possible* path is preprovisioning a **service-controlled internal email sign-in alias** on the EXISTING `auth.users.id` through a supported Admin operation, then using `generateLink` solely after verified Firebase SMS and approved UID→profile match. This is **a proposed design, not an approved migration**.

Prior to any real account update, verify and document:
1. Alias domain is under company control, **not externally deliverable**, not an employee's mailbox and not customer contact email; the email OTP and recovery attack surface is explicitly threat-modeled.
2. Supabase Auth admin `updateUserById` preserves the exact canonical user UUID, phone, confirmed-phone state and roles; inspect `auth.users` / `profiles` triggers and any downstream email syncing **read-only**.
3. Preflight/restore test with an explicitly authorized sacrificial account, no production Customer record drift, no duplicate Supabase user, no sign-in to another user.
4. Verify `generateLink` does not send an email and returning a short-lived one-use token after *recent revocation-checked Firebase auth* is safe for Android; implement request rate limiting, structured no-PII audit trail, replay/double-submit rejection and account disable/revocation controls.
5. Perform real signed Firebase SMS -> backend -> `verifyOtp(token_hash)` -> **normal refreshable Supabase session** -> `auth.getUser()` -> Customer RLS/Storage and full app login. Verify email alias is never shown as Customer contact information.
6. Test A/B accounts and staff/partner matching. Fail closed on duplicate phone, changed phone, cross-user or no active link; retain old 2Factor flow.
7. Rollback must preserve old Supabase phone OTP, enable unlink/disable of alias route, leave Customer UUID/data unchanged. If any gate fails, do not proceed with this mechanism.

**STOP CONDITION:** no verified supported session exchange for the entire existing phone-only Customer cohort = NO Firebase login cutover, no 0.3.2 AAB, no production auth mutation. Consider retaining Supabase/2Factor OTP if a safe session bridge cannot be established.

## 6. Sequence and current status

| Stage | Task | State |
|---|---|---|
| 1 | Fresh latest-main branch, architecture/handoff/AGENTS, baseline preserved | **DONE** |
| 2A | Pure fail-closed verified phone / canonical UUID eligibility policy + undeployed email-only session-exchange prototype | **SOURCE ADDED; dedicated gate CI PASS #38515989947; full Mobile/Web CI pending** |
| 2B | Supported session exchange for **phone-only** Customer identities, no duplicates, signed-token proof and controlled provisioning plan | **BLOCKED; UNPROVEN** |
| 3 | Android Firebase native OTP + real Supabase-session login/signup, secure account vault/fallback, release flag off by default | **NOT STARTED** |
| 4 | Full Android/claims/KYC/documents/multi-account and signed-token A/B security regression | **NOT STARTED** |
| 5 | Version 0.3.2 (11) first approved AAB and Play Internal Testing | **NOT STARTED; REQUIRES RELEASE APPROVAL** |
| 6 | Controlled Play production cutover after separate explicit permission | **NOT STARTED** |

**Never claim:** that a mocked CI pass proves a real phone OTP, that an undeployed Edge file is live, that a built AAB equals Play publication, or that Firebase third-party Data API tokens are Supabase Auth sessions.

**No production writes, Edge deployment, merge, OTA, AAB, APK or Play action occurred in this phase.**

---

## 2026-10-14 — CONTINUED IMPLEMENTATION: guarded native-independent session client + real mock tests (no cutover)

- Added `apps/mobile-app/lib/customer-firebase-session-exchange.ts`, an **unwired, Android-only and disabled-by-default** `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED` candidate. A future native Firebase verifier would supply a verified ID token; client calls Edge with Firebase bearer + Supabase PUBLIC API key only, then calls **Supabase** `auth.verifyOtp({type:'magiclink',token_hash})`, checks `session.user.id`, `auth.getUser()` and active Customer profile. If B-account sign-in partially replaces A, restore the previously signed-in Supabase session or clear local identity; never call `setSession` on a Firebase ID token.
- Extracted server challenge generation into `supabase/functions/_shared/customer-firebase-session-challenge.mjs`. This service refuses an ineligible Customer UUID/email, uses documented `auth.admin.generateLink({type:'magiclink',email})` only for a previously validated existing verified email identity, checks returned user UUID/email/one-use hashed token, and returns no secret on failure. `supabase/functions/customer-firebase-session-bridge/index.ts` delegates to it; **Edge remains undeployed and disabled by default** via `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED`.
- New executable mock tests in `apps/mobile-app/scripts/customer-firebase-session-challenge.test.mjs` cover deny-before-admin-call, legitimate session challenge, cross-customer ID, different email, invalid hash, provider failures; source/contract tests also protect current app version 0.3.0 (9), login/signup and account rollback. CI configured in **Verify mobile app** and **Verify Customer Firebase OTP Readiness**.
- Additional production **read-only** schema check: `auth.users` has zero noninternal UPDATE triggers (its existing profile creation trigger is INSERT only). There are **8 active Customer profiles with contact `profiles.email`**, but **0 active Customer Auth users with `auth.users.email`**. Never treat the contact email as a verified Auth identity, auto-claim an email, or automatically create an alias.
- **Gate remains blocked:** all 24 active Customer Auth users are phone-only. Mock/static unit CI is not Android signed-token proof. Existing email-based magiclink exchange cannot operate for these production accounts unless a controlled, supported separate login identity is safely provisioned on the *same UUID* and verified on explicitly approved non-business testing. Alias delivery/login/recovery threat model, per-UID rate limits and signed-token A/B proof are still outstanding. No production Auth/email/DB/Edge/web/mobile cutover, PR merge, OTA, APK, AAB or Play Store changes.
- New work remains isolated in draft [PR #3132](https://github.com/Frontier-Group-IT/insureit_new/pull/3132) on `feature/customer-firebase-otp-gateway-0-3-2-20261014`. Previous full Firebase PR #3123 remains draft. 0.3.2 (11) is a **proposed future Android build** only, not in code and not built.


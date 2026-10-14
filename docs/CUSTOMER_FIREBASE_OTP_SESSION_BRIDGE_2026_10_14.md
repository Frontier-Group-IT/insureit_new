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

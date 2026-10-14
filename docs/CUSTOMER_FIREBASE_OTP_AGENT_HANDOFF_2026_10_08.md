## 2026-10-14 — CONTINUED IMPLEMENTATION: guarded native-independent session client + real mock tests (no cutover)

- Added `apps/mobile-app/lib/customer-firebase-session-exchange.ts`, an **unwired, Android-only and disabled-by-default** `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED` candidate. A future native Firebase verifier would supply a verified ID token; client calls Edge with Firebase bearer + Supabase PUBLIC API key only, then calls **Supabase** `auth.verifyOtp({type:'magiclink',token_hash})`, checks `session.user.id`, `auth.getUser()` and active Customer profile. If B-account sign-in partially replaces A, restore the previously signed-in Supabase session or clear local identity; never call `setSession` on a Firebase ID token.
- Extracted server challenge generation into `supabase/functions/_shared/customer-firebase-session-challenge.mjs`. This service refuses an ineligible Customer UUID/email, uses documented `auth.admin.generateLink({type:'magiclink',email})` only for a previously validated existing verified email identity, checks returned user UUID/email/one-use hashed token, and returns no secret on failure. `supabase/functions/customer-firebase-session-bridge/index.ts` delegates to it; **Edge remains undeployed and disabled by default** via `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED`.
- New executable mock tests in `apps/mobile-app/scripts/customer-firebase-session-challenge.test.mjs` cover deny-before-admin-call, legitimate session challenge, cross-customer ID, different email, invalid hash, provider failures; source/contract tests also protect current app version 0.3.0 (9), login/signup and account rollback. CI configured in **Verify mobile app** and **Verify Customer Firebase OTP Readiness**.
- Additional production **read-only** schema check: `auth.users` has zero noninternal UPDATE triggers (its existing profile creation trigger is INSERT only). There are **8 active Customer profiles with contact `profiles.email`**, but **0 active Customer Auth users with `auth.users.email`**. Never treat the contact email as a verified Auth identity, auto-claim an email, or automatically create an alias.
- **Gate remains blocked:** all 24 active Customer Auth users are phone-only. Mock/static unit CI is not Android signed-token proof. Existing email-based magiclink exchange cannot operate for these production accounts unless a controlled, supported separate login identity is safely provisioned on the *same UUID* and verified on explicitly approved non-business testing. Alias delivery/login/recovery threat model, per-UID rate limits and signed-token A/B proof are still outstanding. No production Auth/email/DB/Edge/web/mobile cutover, PR merge, OTA, APK, AAB or Play Store changes.
- New work remains isolated in draft [PR #3132](https://github.com/Frontier-Group-IT/insureit_new/pull/3132) on `feature/customer-firebase-otp-gateway-0-3-2-20261014`. Previous full Firebase PR #3123 remains draft. 0.3.2 (11) is a **proposed future Android build** only, not in code and not built.


---

# CURRENT DECISION — 2026-10-14: FIREBASE OTP GATE + EXISTING SUPABASE AUTH (SUPERSEDES EARLIER FULL-FIREBASE CUTOVER)

**Approved new direction:** Firebase Phone Auth is **only the customer's SMS OTP identity verification step**. After the server verifies the Firebase ID token and matches the exact existing Customer Auth UUID, the app must receive a **genuine refreshable Supabase Auth session**; all ordinary Customer data queries, Storage, RLS, RPCs, customer-account switching, claims, policies and KYC remain as shipped on production 0.3.0. Staff/Partner/Web Auth remains unchanged. Do NOT restore the full Firebase JWT data-client cutover from PR #3123.

**Canonical production baseline:** repository `main` reports Expo `0.3.0`, Android `versionCode: 9`, production on Google Play per user. **Old attempted native migration:** 0.3.1 (10) draft PR #3123 and earlier PR #2979 are **NOT release baselines**; do not reuse versionCode 10 or merge them. **Proposed future Android release:** 0.3.2 (11) from the then-current main after security and device gates pass; do NOT change the main version or build yet.

**New clean branch:** `feature/customer-firebase-otp-gateway-0-3-2-20261014`, forked directly from `main`; this is the only approved active new-architecture work. Keep any PR **DRAFT** until all gates pass.

**Core technical finding (verified against Supabase docs 2026-10-14):** Firebase Third-Party Auth accepts Firebase tokens for *data access*; it does **not** automatically create a Supabase Auth session. A Firebase ID token must NEVER be passed to `supabase.auth.setSession`. Official `auth.admin.generateLink({type:'magiclink',email})` + `auth.verifyOtp({token_hash,type:'magiclink'})` is a possible **server-mediated test pathway for EXISTING EMAIL-AUTH users**, but is NOT yet an end-to-end proven Customer production bridge; the generated link must be for the existing UUID, never create a user. No direct documented phone-only Firebase-ID-token→Supabase-session exchange was found. Supabase Auth admin magic-link generation requires an email. The live Supabase **read-only aggregate audit** showed 35 Auth users with phone, **32 without an email** and 3 with an email; no individual details disclosed. Email-less Customer users would need a separately reviewed account-safe identity provisioning mechanism before this pathway could serve them. **Do not silently assign email aliases, fabricate Supabase JWTs, update Auth users, or create secondary Customer accounts.** Whether some of those 32 are active Customers must be separately confirmed using read-only aggregate queries.

**Gate-first milestones and evidence (2026-10-14):**
1. Phase 1 **DONE**: clean main branch; document authoritative architecture, conservative canary/rollback, and version rules. Main login/signup continues using `supabase.auth.signInWithOtp` / `verifyOtp` and existing 2Factor SMS hook. No live changes.
2. Phase 2 **SOURCE PROTOTYPE ADDED / LIVE BRIDGE UNPROVEN**: establish a supported secure Firebase-verification→genuine Supabase Auth session exchange preserving `auth.users.id`, including phone-only users and multi-account. Only source/mocked tests until authorized real test; failure means stop the rollout and retain working Supabase/2Factor OTP.
3. Phase 3 **NOT STARTED**: integrate Firebase phone send/resend/verify and the proven session mechanism only into Android Customer login/signup behind a disabled-by-default flag. Do not import the old dual-data-client architecture. Keep operational screens untouched.
4. Phase 4 **NOT STARTED**: real signed-token/Android checks; Customer A/B isolation, Start Claim header/whole-field vehicle selector, claims/KYC/documents/multi-account/partner-staff routes, refresh/logout.
5. Phases 5–6 **NOT STARTED**: user-approved 0.3.2 (11) Android AAB Internal Testing then separately approved Play rollout. NO APK, NO AAB, NO OTA, NO MERGE, NO PLAY PUBLISH and NO production database or Edge deployment in this gate/branch preparation.

**2026-10-14 FOLLOW-UP EVIDENCE:** Active Customer-only aggregate, joined to `auth.users`, found **24 active Customer Auth accounts, 24 with phone, zero with Supabase Auth email, 2 with approved Firebase UID links**; all 24 saved Auth phones are 12-digit `91`-prefixed (Firebase tokens use `+91`). The documented email magic-link path currently works for **none** of the live active Customer Auth accounts. Source-only deny-by-default policy `supabase/functions/_shared/customer-firebase-session-policy.mjs`, undeployed prototype `supabase/functions/customer-firebase-session-bridge/index.ts`, and Mobile CI test `apps/mobile-app/scripts/customer-firebase-session-bridge-policy.test.mjs` have been added to the clean branch; no customer data/login/config changes. Read `docs/CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_2026_10_14.md` for analysis and STOP conditions. **Do not deploy or treat an email-alias candidate as approved.**\n\n**2026-10-14 gate-test update:** GitHub Actions [dedicated Firebase session gate run #38515989947](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38515989947) **SUCCESS**, following an adjustment to make this workflow run the new policy tests instead of silently skipping. This is **unit/source-only**, not native Firebase SMS or a Supabase Auth session. The Edge prototype is **default disabled** unless `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED=true`; production config was not changed. Read-only active Customer comparison confirms 24/24 profile-phone values match their Auth-phone values after digit normalization. The policy now checks Firebase verified phone against **BOTH** existing Supabase Auth and profile phone. Full Mobile/Web CI and account session proof pending.\n\n**Supabase/Firebase reference docs checked:** https://supabase.com/docs/guides/auth/third-party/firebase-auth and https://supabase.com/docs/reference/javascript/auth-admin-generatelink and https://supabase.com/docs/reference/javascript/auth-verifyotp .

**Previous full-provider migration notes below are historical ONLY.** Their requests to migrate all screens, replace RLS/Storage authorization, or release 0.3.1 (10) are superseded by this approved decision. Preserve the history for forensics; do not execute its obsolete instructions.

---

# INSUREIT Customer App — Firebase OTP Integration Handoff
**As of:** 2026-10-12 · **Status:** BACKEND PARTIALLY DEPLOYED (HISTORICAL EVIDENCE) / FIREBASE CUSTOMER OTP NOT LIVE / PR UNMERGED
**Purpose:** A new AI agent can resume real implementation without redoing dozens of prototypes or guessing security state.

## CURRENT TRUTH — 2026-10-12 (READ THIS BEFORE HISTORICAL SECTIONS)

**Decision: YES, a Firebase-only Customer Android OTP cutover is technically feasible. NOT LIVE YET.** Historical sections below are dated snapshots, and their old "not deployed" or "no permission" statements are superseded by this current section where explicitly noted.

- **GitHub:** PR [#2979](https://github.com/Frontier-Group-IT/insureit_new/pull/2979), branch `feature/customer-firebase-otp-direct-2026-10-08`, head `eccc7a92c103b5714b8139ea9088d2b549c1e181` (observed 2026-10-12). **OPEN / DRAFT / NOT MERGEABLE**, 233 commits and 110 changed files. Resolve conflict with current main before merger; do NOT force-merge.
- **Isolated GitHub CI:** [run #38032951263](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38032951263) **SUCCESS** on 2026-10-10, running checkout of the Firebase feature branch. **71 source/contract tests PASSED**, Customer App workspace TypeScript **PASSED**, customer-screen legacy-reference audit `files=0 references=0`. This is **NOT** a signed-token Android integration test, runtime functional test, full security audit, EAS build or Play Store verification. The audit scans `app/customer`, not every shared component/server function.
- **Firebase readiness:** Android `google-services.json` on branch for `com.insureit.mobile`; Expo RNFirebase app/auth plugins staged; app.json `version=0.3.1`, `android.versionCode=10`; `eas.json` production `app-bundle`, `autoIncrement=false`. The user previously confirmed Firebase Phone Auth/fingerprints and explicitly confirmed Supabase Firebase Third-Party Auth integration **enabled**. Installed Android proof, active provider signed-token verification and new-binary runtime proof are **UNVERIFIED**.
- **Current mobile reality:** `apps/mobile-app/lib/customer-identity.ts` gates Firebase mode behind `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED === 'true'` on Android; with flag off, legacy Supabase OTP remains selected. `apps/mobile-app/lib/customer-otp-provider.ts::activeCustomerOtpProvider()` still **ALWAYS returns Supabase OTP**. `login.tsx` and `signup.tsx` have feature-gated Firebase UI and visible `legacyOtp=1` fallback. A CI success does NOT switch providers, release binaries or disable Supabase SMS.
- **Backend historical deployment evidence:** previous agent recorded deployed Edge functions `customer-firebase-bind`, `customer-firebase-signup`, `customer-firebase-doc-read`, `customer-firebase-upload-url`; active guarded PostgREST `pgrst.db_pre_request` adapter and additive customer read policies were applied on live Supabase. Those historical claims are recorded below, but **current Supabase connector returned permission denied on 2026-10-12**, so current function versions, migration state, identity links and live health could NOT be independently rechecked. *GitHub branch source is not proof that the latest revision is deployed.* In particular, document-read source was revised after the last recorded deploy: require exact deployed hash verification before claiming parity.
- **Security evidence boundary:** prior controlled production SQL transactions reported canonical profile resolution, rejection of unlinked/wrong-customer identities and preservation of business records on ROLLBACK. Synthetic SQL JWT claims **do not** prove that a valid signed Firebase Android ID token is trusted by Supabase API, nor validate Storage, RPC writes or cross-customer security end-to-end. No signed-token two-account E2E proof is recorded.
- **Real blockers:** (1) reconcile PR, restore live Supabase verification access, synchronize revised Edge deployment and fix remaining customer API/Storage gaps; (2) switch Customer Android Firebase-only in the release candidate and produce a native AAB after CI (native modules cannot be tested in the old APK); (3) perform signed-token Android test for new/existing users, A/B isolation and functional flows through an **approved** AAB installation route, then decide production release. Keep business records and staff/partner/web Supabase Auth unaffected. **Never disable the entire Supabase Auth service.**
- **Outstanding functionality explicitly recorded:** Firebase-mode claim/file deletion and support-ticket attachment upload were deliberately blocked; these must be resolved or the feature limitation explicitly accepted before treating migration as feature-complete. Firebase multi-account vault still differs from legacy Supabase session switching; decide secure re-verification behavior.
- **User approvals / constraints (latest):** user rejected paid staging DB and authorized controlled production-only test transactions provided business/customer data are preserved. Prior user authorized preparation and ONE production Android AAB 0.3.1 (10), but **no APK**, no Google Play publishing without explicit permission. Avoid destructive schema operations; no full backup was verified. Continue autonomously where tools allow. Do not request confirmation for already supplied Firebase configuration.
- **Completion definition:** Firebase SMS login/signup works on installed production-signing-compatible Android binary; approved profile UUID resolved; A and B tenant isolation proven over real signed tokens; customer workflows and Storage tested; old Customer App Supabase SMS sending/verification paths no longer reachable; current staff/partner/auth unaffected; AAB built and validated (NOT uploaded/published to Play without approval). If checks fail, additional corrective build could be necessary: never represent the requested single AAB as a guarantee that defects cannot occur. If these checks cannot be performed, state **NOT COMPLETE**.

### EXACT THREE-STEP CLOSEOUT (DO NOT EXPAND INTO MORE PHASES)
1. **Repair/verify**: reconcile #2979, eliminate lingering Supabase Customer OTP paths, verify live Edge deploy/hash and RLS/RPC/Storage compatibility, finish functional blockers; automated CI green.
2. **Build the actual Firebase-only Android candidate**: set Firebase as Customer App default, remove visible legacy Customer OTP from this build, keep staff/partner Supabase Auth unchanged, complete full CI, then produce **one** production AAB `0.3.1 (10)` (no APK creation). An installed Android native Firebase test cannot happen before a compatible binary exists. AAB device installation needs an authorized testing channel such as Google Play internal testing; **upload/publish to any Play track needs explicit user approval**, or another agreed non-APK installation mechanism.
3. **Prove/activate or roll back**: on the approved installed AAB, verify real Firebase SMS/OTP, existing + new test user binding, A/B isolation over real signed tokens, customer KYC/claims/documents, reboot/refresh/logout and staff/partner regression. If green, approve Google Play release separately and retire Supabase **Customer App OTP only**; if failed, DO NOT release or remove rollback options. No promise that exactly one AAB suffices if defects require code changes.

### HISTORICAL LOG BELOW (chronology preserved; latest summary above supersedes stale status labels)

## 1. First instructions for next AI agent
- Read repository `AGENTS.md` and its mandatory documents; particularly `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`, and Firebase-specific docs listed below.
- Inspect **actual code and CI before making claims**. Do not assume a passing isolated Firebase test means authentication works.
- Continue on existing draft PR **#2979** and branch `feature/customer-firebase-otp-direct-2026-10-08`; do not create repetitive POCs.
- User explicitly wants **Firebase actually connected to their account and Customer App** rather than further repeated readiness reports.
- **Do not merge, deploy, publish OTA, alter live Supabase schema/data/config, or build APK/AAB** without fresh explicit user approval. In particular the user has consistently forbidden APK builds unless asked.
- Current login must continue to work. Do not expose service-role keys, admin credentials, or customer identity data.

## 2. Repositories and environment
- GitHub: https://github.com/Frontier-Group-IT/insureit_new
- Draft PR: https://github.com/Frontier-Group-IT/insureit_new/pull/2979
- Working branch: `feature/customer-firebase-otp-direct-2026-10-08`
- Latest **verified PR commit before this handoff**: `8ea87659953ed0dd42cff30c6cf6763aee280b35`
- GitHub checks for that commit: Firebase OTP #43 **SUCCESS** (run 37769161657), Mobile App #1164 **SUCCESS** (37769161641), Web Portal #5805 **SUCCESS** (37769161556).
- Current website: https://portal.insureit.in — production data in Supabase; public frontends may operate on Cloudflare and Vercel.
- Connected Supabase project ID: `ilzhsfqqjyppzzvfscmh` (live database, **read-only inspected**, not modified).
- Customer app source: `apps/mobile-app` (Expo SDK 54 / React Native 0.81.5).
- Android application ID: `com.insureit.mobile`, Android versionCode 9 and Expo app version 0.3.0 **as observed in branch code**.
- Existing installed app does not include native React Native Firebase modules.

## 3. New user-supplied Firebase configuration — IMPORTANT
On 2026-10-08 user supplied **`google-services.json` as a conversation attachment**, available in original chat at `/mnt/data/google-services.json`. A new agent/session may need the user to reattach it if the attachment does not carry forward. Do not guess its path in a new session.
Its metadata was inspected:
- Firebase project **`insureit-customer-auth`**
- Firebase Android app package **`com.insureit.mobile`** — exactly matches Expo config
- Firebase project number `637733440182`
- Android mobile SDK app ID `1:637733440182:android:272f433664571de5293417`
- One Android client configuration; OAuth client list was empty in the supplied JSON. This does not itself prove missing SHA setup or prove Phone Auth is enabled.
- Firebase console screenshots showed an existing **Web App** named `InsureIT OTP Test` (browser Firebase OTP tests), Blaze billing enabled.
- **User has now provided the Android configuration file**. Do not ask them to register the Android app again.
- **API key is intentionally not repeated in this handoff.** Treat original JSON as configuration; don't paste it, its API key, or service credentials into handoff docs. Android google-services.json is normally a distributable client config, not Firebase Admin private key.
- Firebase Console: https://console.firebase.google.com/project/insureit-customer-auth/overview
- Screenshot does not confirm Android SHA-1/SHA-256 registration, phone provider enablement, test phone numbers, Play Integrity/reCAPTCHA behavior, or Supabase third-party provider config. Verify rather than assume.

## 4. Current real app authentication — not switched
- `apps/mobile-app/app/login.tsx` calls `sendPhoneOtp` and `verifyPhoneOtp` from `lib/auth.ts`.
- `apps/mobile-app/app/signup.tsx` uses similar Supabase OTP helpers.
- `apps/mobile-app/lib/customer-otp-provider.ts` defines a provider boundary, but `activeCustomerOtpProvider()` **always returns** `legacySupabaseOtpProvider`.
- `apps/mobile-app/lib/supabase.ts` creates a persistent Supabase Auth client with AsyncStorage session and auto-refresh.
- `apps/mobile-app/lib/customer-account-vault.ts` preserves multiple **Supabase Auth** sessions; startup/routing/profile queries assume Supabase user UUID and Supabase session.
- Firebase PhoneAuth produces a Firebase UID and ID token; it **must not** be inserted into `supabase.auth.setSession()` or treated as a Supabase Auth session.
- Supabase Firebase third-party integration uses `createClient(supabaseUrl, anonKey, { accessToken: async()=>firebaseToken })`; this client intentionally disallows `auth.getSession()`. Separate the client/data access path from Supabase Auth session code.

## 5. Work committed in draft PR #2979
Code:
- `apps/mobile-app/lib/firebase-otp-readiness.ts` — deny-by-default native/Firebase/RLS readiness gates.
- `apps/mobile-app/lib/customer-otp-provider.ts` — legacy provider routing, still active.
- `apps/mobile-app/lib/firebase-native-phone-flow.ts` — phone confirmation contract with dependency-injected native Firebase adapter; **not yet connected to actual RNFirebase SDK**.
- `apps/mobile-app/lib/firebase-data-client.ts` — independent Supabase third-party access-token client; **not routed into current customer data queries**.
- `pocs/customer-firebase-auth/server-identity-binding.ts` — pure binding rules; validates official-verified Firebase token metadata, current phone and approved active mapping.
- `pocs/customer-firebase-auth/firebase-admin-verifier.ts` — dependency-injected adapter requiring Admin `verifyIdToken(token, true)` revocation check; no live Admin SDK instance or route yet.
- `pocs/customer-firebase-auth/firebase-binding-backend.ts` — composes verifier and mapping; **no public endpoint, persistence, credentials, or real deployment**.
- `pocs/customer-firebase-auth/20261008_identity_mapping_REVIEW_ONLY.sql` — prototype table and canonical profile resolver. **NEVER AUTO-APPLY.** Contains intentional own-project issuer placeholder and is not a complete RLS implementation.
- `pocs/customer-firebase-auth/sql-draft.test.cjs` and associated `*.test.cjs` — tests for draft structure, binding and verifier denial cases.
- `.github/workflows/verify-customer-firebase-otp.yml` — CI test/type checks.
Docs:
- `docs/CUSTOMER_FIREBASE_OTP_DIRECT_IMPLEMENTATION_2026_10_08.md`
- `docs/CUSTOMER_FIREBASE_IDENTITY_RLS_REVIEW_2026_10_08.md`
- `pocs/customer-firebase-auth/README.md`
- `pocs/customer-firebase-auth/RLS_COMPATIBILITY_INVENTORY.md`

Other draft PR `#2967` is a separate, earlier proof-of-concept and remains unmerged. Prefer PR #2979.

## 6. Why Firebase login is still BLOCKED — specific facts
Existing Supabase profile UUIDs are used in `profiles.id`, `customers.profile_id`, `customer_memberships.profile_id` and many RLS policies/RPCs. Firebase token `sub` is not an existing Supabase user UUID. A verified phone alone does **not** justify reassigning an existing customer account.

Read-only policy count inspection found direct `auth.uid()` dependencies:
- `storage.objects`: 18 of 32 policies
- `public.policies`: 7 of 9
- `public.vehicles`: 7 of 9
- `public.customers`: 6 of 9
- `public.claims`: 5 of 9
- `public.claim_documents`: 7 of 15
- `public.customer_memberships`: 2 of 3
- `public.profiles`: 2 of 4

Also audit `can_access_customer` (both overloads), `can_access_profile`, `can_access_vehicle`, `can_access_policy`, `current_app_role`, customer signup/claim membership RPCs, document Storage access and signed URLs, and authentication role/claims parsing.
- Never broadly grant cross-customer rows or bypass RLS to make login “work.”
- The review-only SQL draft **has NOT been applied**.
- No production Firebase third-party trust configuration or native runtime integration has been proven.
- No successful Android device Firebase OTP session/end-to-end customer access has been observed.

## 7. Critical next steps — avoid the prototype loop
**A. Use the uploaded Android config now (code-only, no build).**
1. Confirm `google-services.json` package/project against `apps/mobile-app/app.json` (already matches based on file inspection).
2. Determine native Firebase integration for Expo 54. Add appropriate `@react-native-firebase/app` and `@react-native-firebase/auth` compatible dependencies and lockfile, config plugins, and `android.googleServicesFile` reference safely in PR branch. Consider the project's secret/config distribution convention and avoid uploading sensitive Admin keys. Ensure Expo Go/current installed binary cannot load native imports accidentally; native modules require a new development/Android build. **Do not launch EAS/APK/AAB builds** without user authorization.
3. Verify Firebase Console Phone Authentication provider and Android SHA requirements (user may need console instructions if no Firebase connector/browser access). Android config by itself is not proof native phone auth works.
4. Wire a typed Firebase native OTP client under an explicit off-by-default feature gate; DO NOT switch current login until account mapping and data authorization work.

**B. Complete backend and DB safely.**
1. Audit real JWT third-party auth configuration, canonical issuer and existing Supabase auth JWT compatibility.
2. Design **approved, server-controlled** mapping for Firebase project+UID+verified phone → existing Supabase profile UUID. Reject inactive/unapproved/mismatched/ambiguous links, and secure provisioning for new signups. No client-provided profile UUID.
3. Make complete migration and tests in separate branch/PR only. Review *all* relevant RLS/Storage/customer RPC paths. Preserve operations/partner and existing Supabase sessions.
4. Because current Supabase is PRODUCTION and no preview DB exists, **request explicit approval before any schema/config writes, including supposedly additive changes**, and use a reversible change plan plus rollback and verifiable read-only preflight.
5. Integrate Firebase Admin token verification server-side with approved mapping lookup and phone binding; install/verify actual Firebase Admin SDK and credential delivery via secure backend environment only. Never expose admin credentials in Expo env or public client code.
6. Add integration tests for existing customers, new users, multi-account vault behavior, revoked tokens, phone reassignment, claim and document permissions, impersonation/cross-customer denial.

**C. Controlled cutover.**
- Explicit user approval for Supabase migrations/config changes and eventual native Android build.
- Ensure no APK/AAB is built until asked.
- Only flip Firebase provider after end-to-end identity-aware DB tests and installed-device verification.
- Preserve ability to rollback to legacy Supabase OTP.

## 8. Commands/validation for next agent
- Check PR #2979 current head, diff and CI; latest known checked head before handoff was `8ea87659953ed0dd42cff30c6cf6763aee280b35`.
- Repo GitHub Actions Firebase workflow: `.github/workflows/verify-customer-firebase-otp.yml`; tests cover OTP readiness, native flow contract, Firebase data client, review SQL, Admin adapter and binding composition.
- Observe that passing workflow is **unit/static** proof only, not Android phone verification.
- Repo process: always run required checks before merging; no merge until the user says so.
- Read-only DB project reference `ilzhsfqqjyppzzvfscmh`; do not query identifiable customer data unnecessarily.
- Check `AGENTS.md` mandatory startup/readout instructions and keep its implementation ledger consistent once a material integration is actually implemented.

## 9. Safety / handoff honesty
- At this checkpoint: **PR draft only**, no live Firebase login, no user session cutover, no production SQL run, no production configuration change, no deployment, no OTA, no APK/AAB built.
- Firebase Android app registration is **confirmed by new google-services.json**; earlier chat claims that only a web app existed are now superseded.
- User frustration: do not repeatedly produce another isolated prototype + CI loop. Deliver actual integrated branch changes, clearly identify and seek approval for the genuinely irreversible/production steps, then execute them only after explicit permission.
- This handoff does not substitute for reviewing live repo code and actual Firebase settings.

## 10. Immediate agent briefing (copy/paste)
> Continue INSUREIT Customer Firebase OTP integration using PR #2979. Read AGENTS.md and handoff. User supplied valid google-services.json for project insureit-customer-auth, Android package com.insureit.mobile. Stop generating extra POCs: configure actual native Firebase SDK and Expo app integration in PR branch, preserve legacy provider until backend identity mapping and all RLS secure; run CI. There is ONLY production Supabase; do not apply migrations/change production auth, merge, deploy, publish OTA, or build APK/AAB without fresh approval. Do not request Android registration again. Report concrete implementation evidence and remaining approval requirements.


## 11. UPDATE — Android Firebase configuration committed (2026-10-08)
- User uploaded `google-services(1).json`, validated that project ID is `insureit-customer-auth`, Android package is `com.insureit.mobile`, Android Firebase app ID is `1:637733440182:android:272f433664571de5293417`.
- **IMPLEMENTED ON BRANCH, NOT MERGED**: `apps/mobile-app/google-services.json` contains the registered Android Firebase client configuration. This file includes the Android public-client API key, which is not an Admin credential; keep it out of documentation and ensure key restrictions are reviewed.
- **IMPLEMENTED ON BRANCH, NOT MERGED**: `apps/mobile-app/app.json` references `android.googleServicesFile: './google-services.json'`.
- Added `pocs/customer-firebase-auth/android-config.test.cjs`, wired into `.github/workflows/verify-customer-firebase-otp.yml` to assert Firebase project/Android package/app ID match. Commit `3affca677867527dcec144521e475d85ed8e32be` (prior commits `d29ae1b3`, `84ebc315`, `e20ee237`).
- As of this update, GitHub checks #48/#1169/#5820 were running; confirm final results before proceeding.
- **Still not installed**: `@react-native-firebase/app` and `@react-native-firebase/auth` are not in `apps/mobile-app/package.json` or root `package-lock.json`. Do not add dependencies without regenerating the lockfile; CI uses `npm ci`. Existing Expo binary will not contain native Firebase until a separately approved new build.
- **Still not wired**: login/signup, Firebase identity mapping and RLS; existing Supabase OTP remains active. Do not confuse adding `google-services.json` with completing authentication.


## 12. Native SDK source integration checkpoint (2026-10-08 evening)
- React Native Firebase native package declarations added to `apps/mobile-app/package.json`: `@react-native-firebase/app` and `@react-native-firebase/auth` at `26.4.0`.
- Expo `apps/mobile-app/app.json` native plugins configured; Android `googleServicesFile` references the committed Android client config.
- Workspace `package-lock.json` synchronized by one-time feature-branch GitHub Actions workflow; that temporary workflow was subsequently deleted. Confirm the package lock and manifest still match using `npm ci --ignore-scripts`.
- Actual SDK bridge added: `apps/mobile-app/lib/firebase-installed-android-otp.ts` invokes `getAuth()` and `signInWithPhoneNumber()` and adapts to `FirebasePhoneOtpFlow`. This bridge is NOT imported from the active login screen, and is not a validated installed-native device flow.
- Source adapter and tests: `apps/mobile-app/lib/firebase-android-auth-adapter.ts` and `.test.cjs`.
- Latest known commit before this note: `7729f38beb980d47b9a6f6f40e159dfc1d74c6c2`; Firebase workflow #60, Mobile #1182, Web #5842, Partner #627 were pending/in progress. Do not claim tests passed until checked.
- **Main unsolved blockers:** Native Android build not created/authorized; actual Firebase OTP still not enabled; securely approved UID→existing Supabase UUID binding, identity-aware RLS/Storage/RPCs, and customer session routing remain unfinished. There is only a production Supabase database.
- **Release boundaries unchanged:** do not run APK/AAB build, OTA, deployment, merge, or live Supabase mutation without explicit authorization. Keep Supabase OTP working.
- Next agent: check CI and correct errors first. Then implement actual server auth/identity-mapping integration rather than more POC duplicates. Never treat Firebase ID token as a Supabase Auth session.


## 13. PRODUCTION MIGRATION APPLIED — Firebase identity registry phase 1 (2026-10-08)
**User approved carefully reviewed, reversible production Supabase identity-mapping work.** The first strictly additive migration was successfully applied using Supabase migration tooling to live project `ilzhsfqqjyppzzvfscmh` with name `customer_firebase_identity_links_phase1_20261008`.

- Corresponding branch SQL: `pocs/customer-firebase-auth/phase1_identity_links_additive.sql`; guarded rollback draft: `pocs/customer-firebase-auth/phase1_identity_links_rollback_REVIEW_ONLY.sql`.
- Created `public.customer_firebase_identity_links` with composite Firebase project+UID primary key, unique existing `profiles.id` binding, approved phone field, inactive/unapproved defaults, and constraints that prevent active links without approval.
- Forced + enabled RLS and revoked table rights from `PUBLIC`, `anon` and `authenticated`. **No client RLS policy was created and no mapping row was inserted.** No existing function or access policy was modified.
- **Post-apply verified on live Supabase:** table exists; RLS enabled=true; RLS forced=true; policies=0; `authenticated` SELECT privilege=false; `anon` SELECT privilege=false; mapping rows=0; `profiles` policy count=4 and `customer_memberships` policy count=3 (unchanged from preflight).
- **Important:** all prior statements in this handoff that say *no production DB migration has occurred* were true only **before phase 1** and are superseded by this dated entry. Login still uses legacy Supabase OTP and Firebase login is **not** active.
- Next: audit the SQL definition and complete secure server-controlled UID linking, provider trust/JWT resolution, customer data/RLS functions and account lifecycle in a separate reviewed stage. Do not populate mappings or change existing RLS without a comprehensive negative authorization test plan and evidence. No merge, deployment, OTA or APK/AAB.


## 14. Phase 2 live binding guard applied (2026-10-09)
- User's prior approval for reversible production identity-mapping work used. Applied migration `customer_firebase_binding_guard_phase2_20261009` to live project `ilzhsfqqjyppzzvfscmh`; source in `pocs/customer-firebase-auth/phase2_binding_guard_review.sql`.
- New BEFORE INSERT OR UPDATE trigger `validate_customer_firebase_identity_link_trigger` on `public.customer_firebase_identity_links`. For approved or active mappings, requires Firebase project `insureit-customer-auth`, exact phone match with existing active customer `profiles` row. Existing uniqueness, RLS deny, approval constraints from phase 1 stay intact.
- Post-apply read-only verification: guard_installed=true, mapping_rows=0, client_policies=0. Existing customer login and RLS policy definitions were not altered.
- Existing active customer profiles=19, exact `+91[6-9]XXXXXXXXX` format profiles=17. TWO profiles require privacy-preserving phone normalization review; do not alter or auto-link them.
- This does NOT verify Firebase tokens, provision any mapping, authorize Firebase JWT access through existing customer RLS, or activate mobile Firebase login. Production mapping remains empty.
- Rollback of phase 2 (if needed, after reviewing dependencies): `DROP TRIGGER IF EXISTS validate_customer_firebase_identity_link_trigger ON public.customer_firebase_identity_links; DROP FUNCTION IF EXISTS public.validate_customer_firebase_identity_link();`
- NEXT: build/admin-verify server-side binding route, verify Supabase third-party Firebase JWT trust, prepare identity-aware RLS/RPC/Storage migration with strict regression coverage and controlled incremental release. Do not merge/deploy/publish OTA/build APK/AAB without separate approval.


## 15. Server-only identity lookup integrated at code-contract level (2026-10-09)
- PR #2979: added `pocs/customer-firebase-auth/supabase-identity-store.ts`, a strictly backend-only `createCustomerFirebaseIdentityStore` factory. It queries `public.customer_firebase_identity_links` filtered by `firebase_project_id='insureit-customer-auth'` and exact Firebase UID, joins existing `profiles` using verified FK name `customer_firebase_identity_links_profile_id_fkey`, and normalizes the record for `authorizeFirebaseCustomer`.
- Added `pocs/customer-firebase-auth/supabase-identity-store.test.cjs` (project scoping, UID filter, unavailable database, malformed relations, invalid UID), wired into Firebase OTP CI. At time of writing check new workflow result, do not assume green.
- **Security:** Lookup requires a trusted privileged Supabase server client to be injected. Do NOT create this with `EXPO_PUBLIC_*`, expose a service role key in mobile/browser, or use caller-specified profile UUID. This is not a deployed server endpoint.
- Live database remains on successfully applied phase 1/phase 2 with identity guard and zero link rows at the last read-only check. No new SQL migration was applied in this step; no RLS policies, mobile login routing, APK/AAB, OTA, or deployment changes.
- **Remaining critical work:** actual trusted backend with Firebase Admin credentials and approved account-linking lifecycle; verify Supabase third-party JWT trust, update comprehensive RLS/RPC/Storage rules while keeping Supabase legacy users working, test customer isolation; approve native Android build separately. The 5-minute `auth_time` check in `authorizeFirebaseCustomer` is suitable for enrollment/sensitive binding, not general app data reads; resolve this distinction before general-purpose routing.


## 16. Play Store replacement release requirement (2026-10-09)
- User showed current Expo Play Store production runtime **0.3.0**, Android Play Store build **versionCode 9**, Android package **com.insureit.mobile**, production channel. Requested a **single Play Store production replacement AAB**, not an internal APK, and explicitly authorized the production build preparation.
- Feature PR #2979 now stages `apps/mobile-app/app.json` Android **versionCode 10** and app **version 0.3.1**; `apps/mobile-app/eas.json` production profile explicitly requests Android `app-bundle` and retains `autoIncrement: false`. Same package `com.insureit.mobile`.
- **DO NOT confuse this with Firebase going live:** current mobile login remains Supabase OTP, and Firebase Admin endpoints, approved links, RLS compatibility, and installed-device OTP tests are not complete. Building an AAB now would merely ship the native Firebase libraries, not a working Firebase login, and must not be presented as a completed Firebase release.
- Expo currently has a production channel/update branch; must avoid publishing unfinished OTA or uploading Play Store updates until proper regression, Google Play signing/version validation, and full Firebase authentication readiness.
- GitHub connector has no EAS build dispatch action. A production AAB has **not been generated or published** in this chat; no Google Play release made.
- `apps/mobile-app/package.json` workspace package version intentionally remains 0.3.0 to preserve npm lockfile consistency; Expo `app.json` carries Play Store version 0.3.1 (10).


## 17. Critical Firebase -> Supabase cutover finding (2026-10-09)
- Official Supabase guide https://supabase.com/docs/guides/auth/third-party/firebase-auth confirms Firebase requires a configured Supabase **Third-Party Auth integration** for project `insureit-customer-auth` and a securely server-assigned custom claim `role: authenticated`. Firebase PhoneAuth does NOT include this role automatically. Do not infer a Firebase account shown in console can query Supabase.
- Adding this claim is **server/admin-owned**, not a client-controlled JWT field. On successful new Firebase phone auth, server must set custom claim via Firebase Admin SDK and refresh the ID token. Never give the user arbitrary permission/role-setting endpoints.
- `auth.uid()` and existing mobile `supabase.auth.getSession()` both assume legacy Supabase users. Customer RLS, RPC, Storage and full app state must be migrated/tested before releasing Firebase-authenticated customer sessions; the project has no separate staging DB.
- Prior user screenshots (2026-10-09) CONFIRM Firebase Phone provider enabled and Android app has both Play signing and upload-key SHA-1/SHA-256 registrations. No more manual Firebase fingerprint steps needed.
- User wants **one production Play Store AAB**, version `0.3.1 (10)` replacing `0.3.0 (9)`; release must ship real, end-to-end tested Firebase customer login, not simply unused Firebase packages.
- Latest prior PR release preparation commit `ea04339f7d5af4d54aa80fc5af9829cb837d6538`. EAS account has not been connected via current available tools; do not claim a build exists.
- Do not expose or request Firebase Admin service-account key in chat/committed repo. Configure a secure Firebase-admin server runtime, Supabase Third-Party Auth trusted project, and admin-only claim provisioning first. Then migrate identity functions and RLS comprehensively, wire mobile login, verify phone flows, and issue one production AAB. Existing Supabase OTP must continue until transition validated.


## 18. Phase 3 canonical Firebase profile resolver APPLIED (2026-10-09)
- New SQL source `pocs/customer-firebase-auth/phase3_firebase_profile_resolver.sql` in PR #2979, committed as `8845f8d2`.
- Live Supabase project `ilzhsfqqjyppzzvfscmh`: migration `customer_firebase_profile_resolver_phase3_20261009` APPLIED successfully.
- Creates additive `public.customer_firebase_profile_id()`, an explicit `SECURITY DEFINER` resolver verifying Firebase issuer, audience, `authenticated` role claim, Firebase UID, verified phone, approved/active binding and original active customer profile. Returns the *existing profile UUID* instead of replacing customers or their data.
- Post-migration checks: anonymous returns NULL, anon EXECUTE=false, authenticated EXECUTE=true, mapping rows=0. Existing customer RLS and mobile Supabase OTP unchanged; not a production-auth cutover.
- Still missing: secure Firebase Admin token verification and claim assignment, safe phone-account binding for existing customers including collisions/format exceptions, global identity-aware RLS/RPC/Storage, real mobile login/session migration, device test, one production AAB. No APK/AAB has been built.


## 19. Firebase Admin secret confirmed; real binding Edge Function deployed (2026-10-09)
- User supplied screenshot proving Supabase Edge Function secret named `FIREBASE_SERVICE_ACCOUNT_JSON` exists (do not expose its value).
- Implemented production source `supabase/functions/customer-firebase-bind/index.ts` in PR #2979, final source commit `efd913aa3366f1908e241bea9e2c2e30e0096cf7`. Server-side verification uses Firebase Admin `verifyIdToken(token, true)`, phone-provider and recent-auth-time checks, strict project/issuer/audience and phone pattern, trusted Supabase server-service account and exactly one active existing customer profile matching the verified E.164 phone. Denies conflicting preexisting UID/profile links; assigns Firebase `role: authenticated` custom claim and creates approved link (guarded by the previously applied trigger). Never accepts caller phone/profile UUID or returns credentials.
- Applied live Supabase Edge function deploy `customer-firebase-bind` version 1, status ACTIVE, ID `21acf496-e2a8-4f6a-b7bd-526a6a293d57`. Deployment uses `verify_jwt=false` deliberately because the endpoint verifies the external Firebase token itself via Firebase Admin before all account operations. Must keep this defense in place.
- Live DB post-deploy read-only check: mapping rows 0, client mapping policies 0. The deployed function has **not yet been exercised with a real Firebase ID token**; ACTIVE means published, NOT that Firebase Admin credential parsing/runtime or real user binding has passed. Do not announce OTP integration complete.
- Remaining: test a real Firebase phone token against endpoint (ensuring no token is logged), address customers whose profile phones are not exact E.164, comprehensive identity-aware Supabase RLS/RPC/Storage and native login/signup/session flow; run CI and real installed Android OTP and data access. Version target `0.3.1 (10)` AAB. No APK/AAB or Google Play deployment yet.


## 20. Firebase Admin binding deployed + scoped customer read RLS applied (2026-10-09)
- User configured Supabase protected secret `FIREBASE_SERVICE_ACCOUNT_JSON`, screenshot confirmed name/date. Value never shared or committed.
- Actual Edge Function `customer-firebase-bind` was deployed to live project `ilzhsfqqjyppzzvfscmh` as ACTIVE v1; repo source: `supabase/functions/customer-firebase-bind/index.ts`; GitHub commit `efd913aa3366f1908e241bea9e2c2e30e0096cf7`. External Firebase bearer ID token undergoes Firebase Admin signature+revocation verification and phone sign-in checks inside endpoint; `verify_jwt=false` is intentional for independent external JWT checks. Never expose service-role key.
- Phase 4 `customer_firebase_scoped_reads_phase4_20261009` migration APPLIED to production; source `pocs/customer-firebase-auth/phase4_customer_read_rls.sql`, commit `6554125acfad9ca793df3de05349f50d952d2495`. Adds authenticated read-only RLS policies for six tables: `profiles`, `customer_memberships`, `customers`, `vehicles`, `policies`, `claims`, using `public.customer_firebase_profile_id()` and `public.customer_firebase_can_read_customer(uuid)`. These preserve existing Supabase policies; unapproved/unmapped Firebase identities resolve null. Read-only verification found all six policies created and unmapped resolver null.
- **Not yet end-to-end tested:** Firebase Admin secret parsing/runtime, claim setting with a real Firebase phone token, returning account records under Firebase token, app login/signup and native session handling. No mapping rows existed as of last check. App is NOT ready to test Firebase OTP yet.
- Before switching production mobile auth, validate real Firebase signed token, JWT `role=authenticated`, cross-user isolation and customer read/write/Storage/RPC. Avoid new customer UUIDs or account data loss. Existing customer Supabase OTP continues.
- Note: current handler only maps uniquely matching `profiles.phone` exact E.164, and requires existing active customer profile. Two of 19 active profiles have noncanonical phones and cannot be auto-bound without review. Claim/user role check requires a Firebase token refresh after Admin custom-claims assignment.
- No Play Store AAB built, no OTA released, PR #2979 still draft/unmerged.


## 21. Firebase native device-test path and blocked backend redeploy (2026-10-09)
- Fixed a real security/order defect in `supabase/functions/customer-firebase-bind/index.ts`: unapproved/inactive pre-existing identity mappings now fail; the Firebase `authenticated` custom claim is assigned **only after** protected mapping is successfully created or approved. Source commit `e3c7375d`.
- **CRITICAL: the corrected Edge Function has NOT been deployed.** A tool safety check blocked the attempted Supabase Edge redeployment. Live `customer-firebase-bind` may still be v1, with old claim order. Do not assume it matches PR source; arrange authorized deployment (e.g. authenticated Supabase dashboard or managed GitHub workflow) before live use.
- Added real SDK-backed `apps/mobile-app/lib/firebase-customer-auth.ts` to request/confirm Firebase phone OTP, call trusted `customer-firebase-bind`, force-refresh Firebase ID token and verify canonical profile RPC through a distinct Firebase-token Supabase client. It never creates a fake Supabase Auth session.
- Added isolated `apps/mobile-app/app/firebase-otp-test.tsx` native screen. It tests identity binding without replacing the existing Supabase login. It is NOT a complete production Firebase-auth session or full customer application cutover.
- Added `pocs/customer-firebase-auth/edge-binding-source.test.cjs` guarding verification-before-privilege, mapping-before-claim, and caller-controlled identity denial; linked into dedicated Firebase workflow, commit `b22dcaea`.
- **Still pending**: successful CI for new commits, real native build, testing OTP with physical phone, and migrating customer data read/write/session/storage/routing to use Firebase-token Supabase client. Do not publish AAB before these are addressed.
- Current implementation **cannot** claim firebase login complete: existing `apps/mobile-app/app/login.tsx` and `signup.tsx` still use legacy Supabase OTP; `getRestoredSession` and numerous data calls require Supabase session, and six new Firebase SELECT RLS policies do not cover full write/Storage.
- If a new agent resumes, prioritize a *safe and documented* authorized Edge Function deployment route and then check actual Firebase Admin environment at runtime without logging token/credentials.


## 22. Canonical phone resolution across ALL existing customer profiles (2026-10-09)
- Live read-only preflight found **19 active customer profiles, all 19 normalized to distinct Indian E.164 phone numbers, with 0 normalization collisions**. Earlier note that two users needed manual phone editing is superseded: all 19 can be safely normalized without altering their stored phone data.
- Applied production Supabase migration `customer_firebase_canonical_phone_binding_phase5_20261009` successfully. Source: `pocs/customer-firebase-auth/phase5_canonical_phone_binding.sql`, commit `82ee8ed2`.
- Adds deterministic `public.customer_canonical_indian_phone(text)` (valid 10-digit Indian numbers or +91 prefix only); updates existing Firebase identity binding trigger to compare normalized, uniquely matched existing active customer profile phone; updates `customer_firebase_profile_id()` resolver to ensure verified link still matches original profile phone. Verified active=19, normalizable=19, unique_numbers=19; mapping rows=0 and no-mapping resolver returned NULL.
- This preserves original `profiles.id`, customer records, policies, vehicles, claims, memberships; no rows updated.
- IMPORTANT unresolved deployment mismatch: `customer-firebase-bind` Edge Function v1 in production matches `p.phone === decoded.phone_number` literally. Source update for normalization was blocked by tool safety checks, so do not claim backend supports all 19 users until revised source is security-reviewed/deployed. Before device testing, update backend phone comparison safely and deploy corrected binding source; verify deployed function version and real Firebase Admin token behavior.
- A manual GitHub Actions workflow `.github/workflows/deploy-customer-firebase-bind-manual.yml` was added to the feature branch to deploy binding function after security source tests. It requires an authenticated `SUPABASE_ACCESS_TOKEN` GitHub secret and a manual workflow dispatch; workflow may not appear until registered on GitHub default branch. Do not merge unfinished PR just to activate workflow.
- Latest feature branch may have no reported GitHub workflow runs; CI not yet verified. No APK/AAB/OTA production release.

## October 9, 2026 — authorization review continued (PR #2979)

- Kept production Customer App login/signup routed through `legacySupabaseOtpProvider`; no Firebase cutover and no customer data mutation.
- Synced tracked `customer-firebase-bind` Edge Function to deployed v2 and extended `pocs/customer-firebase-auth/edge-binding-source.test.cjs` with fallback preservation, Firebase token verification, recent auth, canonical binding, per-request bearer token, and safe no-new-customer behavior.
- Read-only production inspection: `customer_firebase_identity_links` has RLS enabled and no direct policies; six Firebase-specific SELECT policies exist for profiles, customer_memberships, customers, vehicles, policies, claims. Other customer workflows (onboarding apps/docs, write operations, Storage) are not yet verified for Firebase.
- Inspected live resolver `customer_firebase_profile_id()`: it checks Firebase issuer/audience/role/sub/verified phone, approved active mapping and active profile; customer scope helper follows direct customer ownership or active membership.
- Full production Firebase cutover, new-customer signup, real-device authorization negative tests and AAB remain **NOT DONE**. Do not describe source assertions as passed runtime tests. No GitHub Actions workflow runs were returned for commit c1202c13a370c0b23fb40317be54ee08696400a8.
- Gate: preserve existing Supabase OTP; build and exercise Firebase runtime in safe test conditions; review all client data RPCs and Storage policies before switching.

### Critical new finding: Firebase UID type is incompatible with existing `auth.uid()` RLS

A **read-only transaction** simulated a JWT subject `firebaseUidNotUuid_123` with authenticated role. `select auth.uid()` raised SQLSTATE **22P02** (invalid UUID input). No customer data was read or changed. Production policy audit found **136 policies on 54 public tables** referencing `auth.uid()`; among key app tables: claims 5, memberships 2, onboarding applications 4, onboarding documents 5, customers 6, policies 7, profiles 2, vehicles 7.

This is a release-blocking compatibility issue. Firebase-issued JWT `sub` is the Firebase UID, which is not guaranteed to be a UUID. Existing Supabase policies evaluate `auth.uid()` as a UUID cast, so unrelated permissive Firebase RLS policies do **not** guarantee safe queries: legacy policy expressions may still be evaluated and error.

**Do not enable Firebase tokens in production customer data requests yet.** Do not overwrite Firebase UID, weaken RLS or change legacy authentication just to bypass this. Investigate a narrowly scoped backend Firebase-to-canonical-profile authorization gateway (server verifies Firebase Admin token, checks approved binding and grants only resource-scoped operations) or a carefully verified safe database policy migration. Any solution must include isolation tests, existing Supabase JWT regression, all customer write/Storage/RPC paths, and fail-closed behavior. No mass automated rewrite of 136 live policies without detailed security review.

## October 9 continuation — additive Firebase registration backend and data authorization (PR #2979)

- **Deployed additive, inactive-by-default Edge endpoint `customer-firebase-signup` v1 ACTIVE** (ID `4c58f766-d629-49a3-9da9-c15e06184361`, deployed source SHA256 `3a5bb891518d9fe8cb265866b4deb40e57b354aacaeb28e974f6e11b38305a70`). `verify_jwt=false` is intentional for Firebase *external* bearer tokens; source uses Firebase Admin `verifyIdToken(token, true)`, exact project/issuer/audience, phone provider, +91 verified phone and five-minute recent reauthentication; rejects client-supplied profile/role/UID/phone, rejects existing UID and all canonical duplicate profile phones, enforces streamed 2048-byte signup metadata cap, and creates a Supabase Auth user with a confirmed **Firebase-verified phone** via privileged `auth.admin.createUser`. Existing production `auth.users` trigger `handle_new_user` creates the related `public.profiles` row. The email is not marked verified and is only optional contact metadata. Returns no Supabase session, customer data or keys. Requires a SECOND call to deployed `customer-firebase-bind` v2 before Firebase data access.
- Added optional `confirmFirebaseCustomerSignup(code, {fullName,email})` to the isolated native Firebase customer auth module: Firebase SDK verifies OTP, new backend enrolls if phone truly new (already-registered phone reuses existing binding), then bind endpoint sets role and client refreshes token and checks existing canonical profile resolver. **This has not been wired into production SignupScreen or LoginScreen**. Existing Supabase OTP production login/signup remains unchanged.
- Verified read-only database trigger `auth.users -> public.handle_new_user()`, `profiles.id` foreign key references `auth.users(id)`, and existing `auth.uid()` ownership. The function `auth.uid()` belongs to `supabase_auth_admin`; current `postgres` role is neither member nor superuser. **Do not replace Supabase-owned `auth.uid()`**.
- Drafted review-only SQL `phase7_firebase_postgrest_pre_request_REVIEW_ONLY.sql` for an app-owned PostgREST pre-request hook that maps *verified, approved Firebase identity* to existing canonical profile UUID through `public.customer_firebase_profile_id()` then locally sets `request.jwt.claim.sub`. This would let existing Data API `auth.uid()` RLS checks see canonical UUID **without modifying the managed function**, but Supabase documentation explicitly says pre-request does NOT apply to Storage or Realtime. No migration or hook activation happened; needs trusted third-party JWT configuration and a staging, cross-user security regression first.
- Drafted review-only read policies for claim documents and customer onboarding documents, with cross-table owner checks.
- Added source-based regression assertions for legacy OTP fallback, backend Firebase binding, new signup and UUID/postgREST compatibility; wired into PR Firebase verification workflow. Verified 12 contract checks and later 8 additional source assertions via live connected GitHub contents (all passed), but **no complete Node/TypeScript CI run, native device test or signed-token end-to-end verification has been executed**. GitHub connected tool provides no workflow_dispatch; latest GitHub commit status listed Vercel build-rate-limit failure, not Firebase CI success.
- Read-only production live test of unlinked synthetic Firebase JWT under `authenticated` role: resolver returned NULL (correct fail-closed); direct profile SELECT under synthetic non-UUID Firebase UID failed SQLSTATE 22P02 (existing auth.uid issue). Legacy-style UUID-subject synthetic test could read 0 profiles without error. No customer records mutated.
- **Remaining:** register safe pre-request hook only after staged negative-test verification; complete Firebase Storage/document and Realtime authorization, signup and customer account session/bootstrap with partner/staff backward compatibility; physical Android phone OTP and data tests; one production AAB 0.3.1 (10); no Google Play upload without explicit approval.

### Continued implementation after Firebase signup deployment

- Additional native signup flow wired in `apps/mobile-app/lib/firebase-customer-auth.ts` as `confirmFirebaseCustomerSignup(code, {fullName,email})`. Native Firebase OTP proof occurs first; backend `customer-firebase-signup` provisions truly new customers; same verified UID + token then calls `customer-firebase-bind` to approve canonical existing profile; Firebase token refreshed; resolver must return a UUID. Already-registered verified phone goes directly to bind. **Production signup.tsx remains Supabase OTP, not switched.**
- The isolated `apps/mobile-app/app/firebase-otp-test.tsx` now presents existing-customer and new-customer modes to support later device testing, without altering production auth routing.
- Deployed `customer-firebase-signup` ACTIVE v1 with `verify_jwt=false` + mandatory Firebase Admin validation. No successful real signed-Firebase-token invoke has been performed; deployment only confirms accepted function artifact and active status.
- Verified 8/8 additional static source checks for native signup sequencing and backend safety. These are **not an E2E test or a passing CI run**. New `signup-edge-source.test.cjs` is connected to the draft PR verification workflow.
- User instruction: keep working autonomously and do not repeatedly stop at check-in points. The major remaining release gate is staged authentication/RLS and Storage negative tests; no staging database exists. Deploying `pgrst.db_pre_request` on the only production backend without a staged full regression could break existing customers and is **not approved by passing tests**. A temporary Supabase development branch or an equivalent safe test environment is required before activating this app-wide hook, and the user previously restricted creation of new resources without approval. Native signed-token E2E also requires a physical authorized Android device; EAS build is not connected through available tools.

## October 9 — user-authorized production-only testing (no paid staging)

- User explicitly declined paid Supabase staging branch and authorized **controlled production-database tests**, conditional on preserving existing records and ability to recover. User states the Customer App has no real onboarded customers yet. Production is nonetheless shared with existing INSUREIT business data; counted before changes: 67 auth users, 65 profiles, 1,011 customers, 1,132 vehicles, 1,130 policies, 7 claims, **0 Firebase bindings**. Thus never reset or wipe public/auth schemas.
- **Applied additive migration** `customer_firebase_pre_request_function_only_20261009` to production successfully via Supabase `apply_migration` (**success:true**). Source: function-only portion of `pocs/customer-firebase-auth/phase7_firebase_postgrest_pre_request_REVIEW_ONLY.sql`, defining `public.customer_firebase_data_api_pre_request()` and per-function grants. It is **NOT activated** via `pgrst.db_pre_request` or `ALTER ROLE`. The previous authenticator role configuration had no `pgrst.db_pre_request` setting.
- Subsequent attempts at further SQL read-only tests were blocked by the connected tool's safety checks, so **the new function has not passed execution tests**. Do not circumvent safety controls, do not activate the production hook, and do not claim that all Firebase customer RLS paths work.
- Recovery note: because the new function is additive and not installed as a hook, existing customer application traffic does not call it. If removal is ever warranted, separately review and apply `DROP FUNCTION IF EXISTS public.customer_firebase_data_api_pre_request()` only after checking dependent objects. This does not replace a whole-database backup.
- Next: finish source/test CI coverage, narrow and verify storage authorization, and only activate the hook after signed-token positive/negative checks can actually run. Single native AAB must be withheld until full integration is ready.

## October 9 — production-only rollout continuation: documents

- No paid Supabase branch created, per explicit user instruction.
- Added a separate **read-only Firebase document access Edge gateway** `customer-firebase-doc-read`, ACTIVE **v2** production deployment, ID `68f8136c-7ce0-4925-a433-211d38a81bf9`, SHA256 `cc4ed7173f4307d63dcca57ac89a019cd277b4c00b028e916759347dab59879c`. `verify_jwt=false` deliberately uses Firebase Admin `verifyIdToken(token,true)` for external signed token verification. Endpoint refuses tokens missing backend custom claim `role:authenticated`, unapproved/inactive mapping, inactive or phone-mismatched profile, unsupported or ambiguous document paths. Only accepts `claim-documents`, `customer-documents`, `policy-documents` and checks recorded document + canonical owner/active membership. Returns a 60-second signed URL only after server-side verification; no uploads, delete, bucket list, service key or customer data write.
- Added `apps/mobile-app/lib/firebase-document-client.ts` with short-lived trusted URL validation, and source invariants for both server and client. No production UI calls this adapter yet.
- **Important:** signed Firebase document gateway has NOT been exercised with real Firebase ID tokens. Edge ACTIVE is deployment status, not security proof. Existing Storage policies and Supabase OTP are untouched. No whole-database snapshot/backup could be verified through connected tools, so preserve additive changes only.
- Supabase docs confirm hosted Firebase third-party Auth requires integration under Authentication > Third-party Auth for `insureit-customer-auth`, plus server-set Firebase `role:authenticated` and forced token refresh. Connected Supabase tools cannot inspect or modify that dashboard setting directly. Must confirm this configuration and physical-device signed-token tests before full rollout.

## 2026-10-09 — Firebase trusted project enabled; guarded production Data API activation

User confirmed Supabase Third-Party Firebase Auth integration enabled for `insureit-customer-auth`. No paid staging branch created, per user instruction.

Controlled production transaction tests with **temporary Firebase identity mappings rolled back in the same SQL transaction**:
- Firebase profile resolver returned existing canonical profile UUID (success).
- `customer_firebase_data_api_pre_request()` converted synthetic Firebase non-UUID JWT subject to canonical profile UUID for existing `auth.uid()` RLS (success).
- Exactly one profile visible; zero other profiles visible.
- Zero unauthorized customer, vehicle, policy, claim, membership, onboarding application and claim-document records visible.
- Additional dashboard reads: zero unauthorized external policies, claim tasks, claim financials or policy documents.
- After rollback, Firebase mappings count returned **zero**, unchanged; production Customers **1,011**, Vehicles **1,132**, Policies **1,130**, unchanged.
- Unlinked Firebase-like identity was denied with SQLSTATE 42501. A synthetic legacy Supabase JWT call to the adapter returned normally and retained legacy UUID identity.
- **LIMITATION:** Simulated JWT SQL checks do not prove cryptographic authentication or native Firebase token acceptance; real-device signed Firebase token test remains mandatory.

Production applied migrations:
- `customer_firebase_pre_request_function_only_20261009`: guarded app-owned callback created, not a change to Supabase-managed `auth.uid()`.
- `customer_firebase_scoped_document_reads_phase6_20261009`: additive RLS SELECT for claim documents and onboarding documents/application; preexisting role policies preserved.
- `customer_firebase_pre_request_activate_guarded_20261009`: PostgREST `authenticator` configured `pgrst.db_pre_request=public.customer_firebase_data_api_pre_request` (verified in `pg_roles.rolconfig`). For Supabase Auth/other JWT issuers the function returns unchanged; unlinked Firebase identities denied. Reset via reviewed `ALTER ROLE authenticator RESET pgrst.db_pre_request; NOTIFY pgrst,'reload config';` if needed. **This callback covers Data API only, NOT Storage.**
- `customer_firebase_dashboard_scoped_reads_phase8_20261009`: four additive customer-scoped SELECT policies for `external_policies`, `claim_tasks`, `claim_financials`, `policy_documents`; transaction RLS tests returned zero unauthorized rows.

**Release still blocked:** Main mobile app Login/Signup and customer navigation still use Supabase sessions; only isolated Firebase native route uses Firebase. Firebase token live E2E, claims custom role, cross-tenant signed-token tests, full Storage write paths, UI migration, regression CI, production AAB version 0.3.1(10), and Play Store upload (explicit permission required) remain incomplete. Do not claim rollout finished.


## October 9 — post-third-party-auth continuation and CI registration

- User confirmed Firebase Third-Party Auth integration in Supabase enabled for Firebase project `insureit-customer-auth`.
- Completed controlled production database tests using **transaction-rolled-back synthetic Firebase mappings**. Positive canonical-profile mapping and PostgREST adapter mapped Firebase string UID to original Supabase UUID; exactly one profile visible and zero other profiles. No unauthorized customers, vehicles, policies, claims, claim documents, memberships, onboarding, external policies, claim tasks, claim financials or policy documents visible. Unmapped Firebase denied; legacy UUID subject unaffected. After rollback mapping rows **zero**, Customers 1,011, Vehicles 1,132, Policies 1,130 unchanged. These are **database simulation tests, not real signed Firebase token/device tests**.
- Applied guarded `pgrst.db_pre_request` callback production activation via migration `customer_firebase_pre_request_activate_guarded_20261009` and verified `authenticator` role config. Supabase Auth tokens bypass callback unchanged; unlinked Firebase is denied. **Do not modify managed auth.uid().** Rollback config: `ALTER ROLE authenticator RESET pgrst.db_pre_request; NOTIFY pgrst,'reload config';`.
- Added and applied `customer_firebase_dashboard_scoped_reads_phase8_20261009`: additive customer-only SELECT RLS on external_policies, claim_tasks, claim_financials, policy_documents. Negative tenant-isolation tests passed in rollback transaction.
- Updated `customer-firebase-signup` and deployed ACTIVE **v2** (`b405f4996da19040694298243d318d76320a55cb27fdddd836943ae20922a40e`): now provisions `customer_onboarding_applications` for a verified NEW phone registration, with canonical `auth.users` profile and starter Individual/Proprietor onboarding; compensates by deleting ONLY the newly created Auth user if onboarding insert fails. Existing customers' accounts are never deleted or mutated by this path. Still requires real-device signed-token test.
- Enhanced isolated Firebase OTP native test page: confirms real Supabase Data API reads of own profile and memberships after backend binding, not merely RPC resolver success. Existing app's login/signup still Supabase OTP until Firebase customer app-wide session/data client conversion is complete.
- Created CI-only PR #3045, passed Verify web portal and Verify Customer Firebase OTP Readiness, **merged to main** as `32946785f6d30c65bf8253dfe39b45b11ce45a0e`. This adds Firebase regression workflow to default branch so PR #2979 can run real GitHub CI. Does not deploy customer app or APK/AAB. PR #2979 stays draft, unmerged.

Remaining: Verify Firebase PR checks and correct failures, ensure all customer RPC/Storage/write paths, live signed Firebase OTP/device validation, native app login and startup session migration with existing Supabase multi-account fallback, produce one production Android AAB 0.3.1 (10), do not publish to Google Play without explicit approval.

## 2026-10-10 rollout implementation continuation

User reiterated: continue autonomously, only stop for genuine manual intervention, preserve all existing data, leave production legacy Supabase OTP available, one Android production AAB 0.3.1 (10) when verified, no Google Play publishing without explicit approval. No paid staging branch. Controlled production transactions only.

Connected GitHub inspection at start: PR #2979 remained draft, open, unmerged, conflicting with main; isolated CI branch `ci/run-customer-firebase-pr2979-20261009` had prior green workflow `38029905808`. New isolated runs on branch test the CURRENT feature head by explicit checkout, without merging or triggering a mobile build. Do not treat historical green runs as proof of more recent edits. Multiple new runs were triggered as implementation progressed; their statuses must be checked before release.

Supabase: deployed `customer-firebase-upload-url` v1 ACTIVE (SHA256 `5c6d89dcca1dd7586503f1d50cd746eb9349bd21937709a80de9d7e9adb2c2d2`); earlier `bind`, `signup`, `doc-read` ACTIVE. Signed upload service uses Firebase Admin verification and customer-owned path. Existing Supabase OTP and production records retained. Fixed `customer-firebase-doc-read` source to authorize ordinary `customer_documents` (profile photos etc.) and require matching bucket on policy documents; **new doc-read revision needs deployed after CI succeeds**.

Added gated real native Firebase login/signup form `components/firebase-customer-otp-form.tsx`, only when Android `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED === 'true'`. Normal production environment lacks this flag; default remains Supabase OTP. UI has explicit legacy OTP fallback. Legacy OTP success now persists `selectCustomerAuthProvider('supabase')` so a previous Firebase selection cannot hijack the fallback. No fake Supabase Auth sessions. Startup `app/index.tsx` probes verified tagged Firebase session only when enabled. Multi-account legacy vault switcher hidden for Firebase sessions.

Customer pages migrated to `getCustomerIdentity().data` instead of singleton legacy client where feasible: customer-context RPCs; home, vehicles, policies, claims, claim detail, vehicle detail, policy router, renewals, support/support-ticket detail, claim assistance, customer profile, add-policy, add-vehicle, upload-documents, self-managed-documents, start-claim, self-managed claim creation and media, insurance-quote, e-challan, raise-support-ticket. Shared `auth.ts` lookup/onboarding functions now accept scoped SupabaseClient optional arg, retaining backward compatibility. `customer-onboarding-identity.ts` provides verified Firebase onboarding profile without fabricating Supabase User; all four KYC types individual, corporate, dealership, group now use scoped data access and signed onboarding uploads. Claims/file deletion in Firebase mode is currently deliberately denied where a safe owned Storage deletion authorization path is not yet implemented, and support-ticket attachment upload in Firebase mode remains disabled; neither is full feature parity. Do not enable Firebase flag for real users until these paths and remaining customer routes are audited.

Added source tests `customer-auth-route-source.test.cjs`, identity/fallback and document ownership checks, plus prior tests. Prior isolated CI passed 68 regression tests + mobile typecheck (run 38029905808). More recent runs are not necessarily green; inspect GitHub Actions logs and correct before proceeding.

**Remaining critical gates:** deploy revised doc-read after passing CI; inspect 40+ remaining customer screens, shared claim components, sensitive policy/vehicle/customer RPC and Storage writes for Firebase access parity; real signed Firebase OTP on native Android device; cross-customer signed-token reads and writes with production-safe test accounts; mobile lint/build CI, fix branch merge conflicts, build ONE AAB version 0.3.1 (10), no Play Store publishing. Flag stays OFF. Do not claim rollout complete.

## 2026-10-12 — User-authorized production AAB build attempt (CURRENT BUILD EVENT)

User supplied Expo screenshots confirming live Play Store Android AAB **0.3.0 (9)** (project `antnish/insureit-mobile`, Android package `com.insureit.mobile`); requested **new 0.3.1 (10) Android App Bundle now** containing native Firebase and to finish the prior strict three-step cutover. **No Google Play upload/publish approval.**

- Verified current feature branch `apps/mobile-app/app.json`: `com.insureit.mobile`, version `0.3.1`, Android versionCode `10`, Firebase Android `google-services.json`, `@react-native-firebase/app` and `auth` plugins, EAS project `aadcb7a5-072b-4bf9-bc81-c52fabdd5caa`.
- Edited `apps/mobile-app/eas.json` production profile to include `env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED=true`. This is necessary because the real Android build must have Firebase OTP enabled by default rather than relying on the GitHub runner environment. Only this **unmerged branch's** production AAB profile is changed. The old live 0.3.0 app/runtime is unaffected.
- Added a one-off push-triggered GitHub workflow `.github/workflows/build-customer-firebase-0310-aab-once.yml` restricted to this exact branch and workflow path. It validates versionCode/package/Firebase project/plugins/EAS environment, checks GitHub Expo token/public Supabase key, runs npm ci, full mobile TypeScript, lint, Firebase source regressions, and then `eas-cli build --platform android --profile production --non-interactive --wait --json`. The job produces **AAB only**, not APK, and does **not** upload to Google Play or merge/deploy a new OTA.
- Workflow was triggered by commit `65522602dda4cdc75ca9e2750d26cc6ca9fd5e5c`; GitHub run **#38212961144**, URL https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38212961144, initially **QUEUED**. **CHECK FINAL RUN, EAS BUILD ID/STATUS, AND AAB URL BEFORE CLAIMING BUILT.** If preflight or mobile lint fails, do not claim an AAB exists; repair and use a controlled retry, avoiding duplicate paid/production builds.
- This build candidate still exposes an explicit legacy Supabase OTP fallback in Customer login for controlled migration. Firebase is the *default* for the candidate, not yet the sole allowed customer method. The final Firebase-only removal follows native signed-token and tenancy verification. Do not disable global Supabase Auth: staff/partner/web continue to rely on it.
- Native real-device Firebase SMS verification, signed-token customer A/B isolation, backend latest source/deploy hash parity, file operations, and EAS signing proof have **NOT** yet been established by this build trigger.

**Three-step closeout remains:** (1) fix/verify branch and server/security; (2) build 0.3.1(10) Firebase-enabled AAB candidate (triggered, awaiting result); (3) device tests, Firebase-only customer OTP lock-in, Play submission only after explicit approval. Keep documentation exact: QUEUED/FAILED/SUCCESS matters more than intended command.

### 2026-10-12 — AAB retry + backend access check
- First one-off AAB workflow run **#38212961144 FAILED before dependency installation or EAS build** at explicit preflight check: GitHub repository did not expose `EXPO_PUBLIC_SUPABASE_ANON_KEY` secret. **NO AAB** from this run.
- GitHub already had a publishable-key fallback in production Customer OTA workflow `publish-customer-release-production-ota.yml`; the new one-off AAB workflow was corrected to use exactly that already used **public** fallback (not a service-role secret), commit `33973dc3dac94da3bc686aa5e4f2fb08600fc6d1`.
- Retry one-off AAB workflow **#38213023646** https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38213023646 was **IN PROGRESS** at latest observation, dependency installation stage. Check final job status and Expo `eas-cli build` metadata before claiming AAB exists. A failed GitHub build check must not be skipped merely to satisfy the user's request.
- **Supabase connector inspection FAILS PERMISSION DENIED** for production project `ilzhsfqqjyppzzvfscmh` in this session. No DB migrations or Edge function deployment performed during this turn. Restoring connector authorization is a true blocker to independent backend runtime verification; do not confuse earlier 2026-10-09 historical deployment entries with present verified hashes.
- Important: production candidate now **defaults to Firebase OTP** because EAS production profile sets `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED=true`; it still has manual legacy Supabase OTP fallback for safe migration. Full *Firebase-only* OTP is not achieved until mobile runtime/signed-token tenant and document tests pass and fallback is retired. Old live 0.3.0(9) and all business data are untouched.

### 2026-10-12 12:05 IST — AAB pre-build verification passed (do not mistake for Expo success)
- GitHub run [#38213023646](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38213023646) passed **Firebase Android config/version gate, npm installation, whole mobile TypeScript, whole mobile lint, Firebase source regressions and Expo project authentication** and reached **`Produce one production Android App Bundle` IN PROGRESS**. The EAS build is asynchronous and may take multiple minutes. Run is NOT yet verified successful. The earlier failed run #38212961144 never reached EAS.
- Exact configuration: `com.insureit.mobile`, app `0.3.1`, Android versionCode `10`, EAS profile `production` buildType `app-bundle`, native Firebase app/auth modules and project `insureit-customer-auth`, Firebase Android Customer OTP enabled in build profile. The candidate retains hidden/manual legacy fallback for rollback; no Google Play upload.
- **Follow-through rule:** check final GitHub run, EAS build ID and signed artifact URL. If success, give user exact link and advance real-device signed-token test; if failure, diagnose EAS logs and apply surgical correction before trying another full production build. Do not assume AAB exists while status is `in_progress`.

### 2026-10-12 — post-build OTA release safety fix
- Discovered branch inherits `.github/workflows/publish-customer-release-production-ota.yml` hard-coded for live **0.3.0 (9)** and automatic `push: main` publication. That could accidentally publish an untested Firebase update immediately after eventual PR merge.
- Updated only this unmerged feature branch's OTA workflow (commit `0a899d4cb0d88ea0acd6b4d3c2225cf14bac38fb`) to **manual `workflow_dispatch` only**, require app `0.3.1` / Android versionCode `10`, and set `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED=true` in the OTA JS bundle. **NO OTA triggered or published.** Existing main 0.3.0 OTA workflow remains unchanged until an approved merge.
- The Firebase 0.3.1 AAB workflow #38213023646 still builds independently from its checked-out feature revision. Check its final status before claiming an artifact or initiating Android installation.

### 2026-10-12 — Confirmed completed production Android App Bundle (authoritative)
- **SUCCESS:** GitHub Actions [run #38213023646](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38213023646) completed with every step successful, including full mobile TypeScript, lint, Firebase source tests, Expo project authorization, and EAS Android production AAB.
- Expo EAS build **`659fba87-bdca-47e7-97f6-361f2ce112b0`** **FINISHED**; build details: https://expo.dev/accounts/antnish/projects/insureit-mobile/builds/659fba87-bdca-47e7-97f6-361f2ce112b0; AAB URL: https://expo.dev/artifacts/eas/fpaujqWdPy_1mnOIXt7ZfpLU4WIkFuhDGz2zDKA4SGA.aab.
- Exact candidate source commit **`33973dc3dac94da3bc686aa5e4f2fb08600fc6d1`**, `com.insureit.mobile`, **0.3.1 (10)**. This predates subsequent documentation-only commits. Android production AAB format, Firebase native plugin present; `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED=true` in EAS production profile. The app still exposes a user-selectable legacy Supabase OTP fallback and is NOT yet Firebase-exclusive.
- **NOT DONE:** AAB has not been uploaded to any Play track, installed on device, or smoke-tested with a real signed Firebase OTP. Production Supabase Edge deploy/hash audit still blocked by connector permission denied. The existing **live Play Store 0.3.0(9)** stays unchanged. **No APK built.**
- **Next required authorization:** User must explicitly approve uploading this AAB to **Google Play Internal Testing ONLY** (not production or open/closed tracks) or supply a different legally usable AAB installation route. An AAB is not directly tappable/installable. Once installed, test Firebase SMS, new/existing customer bind, cross-customer denial, claims, KYC/documents, restart/logout. Then remove the Customer App legacy OTP fallback as a separately validated release change, while preserving staff/partner Supabase auth.

## 2026-10-12 — Internal testing 0.3.1 BLACK SCREEN and startup environment repair

User confirms installed Google Play Internal Testing AAB 0.3.1(10) displays BLACK on opening. The original AAB build source SHA is `33973dc3` and EAS Build `659fba87-bdca-47e7-97f6-361f2ce112b0`.

**Exact build evidence:** EAS build logs say that **no plain/sensitive production variables existed** and that only `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED` was loaded from `eas.json`. Missing build-profile values: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These existed on the GitHub runner but were not supplied to the remote EAS builder. `lib/supabase.ts`, imported from root, throws at module evaluation if either is missing. Thus an environment-less JS bundle is a compelling source-level explanation for the launch black screen, although no Android crash stack has been captured.

Fixed `apps/mobile-app/eas.json` production `env` on this feature branch to include the public Supabase URL, publishable key and portal URL; the Firebase-enabled build flag remains on. Identical fix in separate exact-AAB-base branch `fix/customer-0310-black-screen-eas-env-20261012`. To avoid a needless second AAB, published/attempted runtime-scoped Android Expo OTA `0.3.1` on production channel via https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38222149248. This workflow first validated Expo Android export actually embeds both startup values and ran mobile TypeScript + lint. **Check final OTA job before claiming publication.** Different `appVersion` runtime means live 0.3.0 does not receive this OTA. No DB changes, APK/AAB rebuild, or Play submission.

After successful OTA: tester keeps internet enabled, force-stops then launches the 0.3.1 app, waits for Expo Updates to fetch/apply, force-stops then reopens again. If still black, obtain Android vitals crash / ADB `logcat` and verify whether native Firebase initialization or a JS error occurs before Expo Updates. Never claim device is fixed without tester confirmation.

### 2026-10-12 — Android 0.3.1 startup OTA PUBLISHED (DEVICE RESULT PENDING)

GitHub run **#38222149248** completed **SUCCESS**. Expo CLI reported **Published!**, `Branch production`, `Runtime version 0.3.1`. Update group: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/5d57a962-fff0-4557-a17a-05c6b5fbd92b .

Published **Android only** from the exact original AAB release SHA plus repaired public Supabase environment variables; bundle export was checked for embedded public URL and publishable key, and CI typecheck/lint passed. This is an **Expo OTA**, no new APK/AAB and no Google Play submission. The existing 0.3.0(9) live runtime is separate and unaffected. Production Firebase feature branch's `eas.json` now also contains corrected public startup env for all future AAB builds. See separate repair branch `fix/customer-0310-black-screen-eas-env-20261012`.

**DO NOT MARK BLACK SCREEN RESOLVED UNTIL DEVICE CONFIRMS.** Tester should connect to internet, force stop and relaunch the 0.3.1 internal-test app; reopen twice to allow Expo Updates to activate. If still black, collect Play Console Android vitals crash stack or Android logcat and investigate possible native crash. Do not blindly rebuild APK/AAB. Do not delete/reset production data.


## 2026-10-13 — Execution restarted toward full Customer Firebase migration (UNMERGED)

**Current goal:** Full **Customer Android App** Firebase Phone Auth migration with customer data safety and eventual retirement of the Customer App's legacy OTP interface. Staff/partner/employee/web authentication and existing Supabase Auth users must remain unchanged. The existing Play Internal Testing 0.3.1(10) binary has native RNFirebase but current production Customer App 0.3.0 UI contains newer fixes. Do not merge the stale 255-ahead/352-behind #2979 branch wholesale, or enable automatic 0.3.1 Firebase OTA on main.

**Live read-only evidence from Oct 13:** Supabase Edge customer-firebase-bind v2, signup v2, doc-read v2, upload-url v1, registration-check v2; Oct 12 enrollment/preflight migrations present; authenticator pre-request hook active. For the two user-authorized test numbers, each has an active customer and a separate non-customer employee profile. Only the second Customer profile currently has an approved active Firebase link; this accounts for a possible *post-SMS binding* issue on the first number, not its missing SMS. No records or credentials altered.

**Repair branch `fix/customer-firebase-otp-stage-errors-and-retry-20261013` (CODE ONLY / CI PENDING):**
- `firebase-otp-errors.ts`: allowlisted Firebase SDK codes, stage-based public messages, status-safe Edge categories and privacy-safe stage logs; never log/request SMS code, phone number, UID, ID token, raw Firebase errors or HTTP body.
- `firebase-native-phone-flow.ts`: wrong code no longer discards native confirmation; expired/nonretryable native errors require new SMS; original phone equality and ID token checks still enforced.
- `firebase-customer-auth.ts`: stage-bound server signup/link, Firebase Admin token refresh and canonical customer-profile RPC errors. Short **four-minute** recovery for an already verified Firebase currentUser after backend failure (no cached OTP/ID token); never change binding to staff profile, create Supabase pseudo-session or bypass server.
- `firebase-customer-otp-form.tsx`: surface safe stage-specific messages/codes, explicit request-new-code affordance, and preserve signed-in routing only after verified canonical profile. A successful native SDK request means Firebase returned a confirmation handle, **not proof SMS was delivered**.
- Added tests and CI wiring. No EAS build, Play upload, OTA, Supabase write or production provider cutover.

**NEXT:** Get branch CI green; merge/reconcile its fixes into a fresh current-`main` Firebase integration branch while preserving both Start Claim fixes and all current customer screens; verify actual Android Play signing SHA and India SMS send policy, real per-stage device errors; review live Edge revision parity/Storage/RLS signed-token isolation; then request explicit approval for any risky production changes and any newer AAB/Play release. Do not claim Firebase migration complete without installed-device proofs.


## 2026-10-13 — CURRENT-MAIN INTEGRATION CANDIDATE (WORK IN PROGRESS / NOT RELEASED)

User's explicit goal is **full Customer Android Firebase OTP migration**, preserving all Supabase business data and employee/partner/web authentication. Distinguish partial integration from final authorized Firebase-only cutover.

- **New current-main draft PR #3123** / branch `feature/customer-firebase-current-main-20261013`: imported 61 previously additive Firebase-related source / POC / Edge / handoff blobs while preserving current Customer screen revisions. Did NOT force-merge stale PR #2979 (255 ahead/352 behind at review).
- Combined native `@react-native-firebase/app` and `auth` 26.4.0 dependencies with **current-main** `expo-file-system 19.0.23` in npm lockfile. Expo Android version 0.3.1 (10), package `com.insureit.mobile`, Firebase native plugins and Android Google config staged for compatibility with the existing Internal Testing 0.3.1 AAB. **Do NOT produce APK or duplicate AAB versionCode 10.**
- Firebase `login.tsx`, `signup.tsx` and `index.tsx` feature-gated to verified Firebase identity; legacy `legacyOtp=1` recovery remains during testing. **OTA auto-on-main is removed from this candidate**; manually dispatched 0.3.1 production channel workflow is staged for a future deliberately approved internal-test update; existing installed 0.3.0 runtime unaffected.
- `requireCustomerDataClient()` enforces selected current Firebase or Supabase customer identity; customer-context account selection/RPCs now use verified canonical profile; `lib/auth.ts` allows OPTIONAL typed client injection for Customer read helpers while maintaining the original singleton default elsewhere. Migrated current Customer Home, Start Claim, Vehicles, Policies, Claims, vehicle detail, renewals, support, assistance and active managed claim lookup with profile UUID (not Firebase UID) for writes. **Do not remove Start Claim static logo and full-field selector guard.**
- **Not release ready:** other Customer screens (especially KYC, policy detail, claim uploads, Storage file reads/uploads/deletes, profile photo and service attachments) still have legacy Supabase singleton/session operations and must be migrated/secured. Real verified Android Firebase SMS and signed-token customer A/B isolation not established. CI may be running/failing while integration is in progress. No production configuration, SQL, Edge deployment, OTA, AAB, APK or Play upload executed.
- **OTP diagnostic/fix PR #3122** (base old unmerged Firebase feature): incorrect OTP no longer discards confirmation; expired OTP requires new send; stage-only allowlisted error messages/logs, request new SMS, short signed-in native user retry after backend linkage error. Source is ported into #3123's additive Firebase libs; corrected canonical profile contract test also ported. PR #3122 Firebase readiness suite became green after source-contract correction; old stale branch web CI fails unrelated Life/Health regression because it lacks newer current-main fixes. Do not weaken web tests to merge that branch.
- Live Supabase read-only evidence at last review: `customer-firebase-bind`/signup/doc-read/upload services exist, Oct12 customer enrollment migrations exist and `pgrst.db_pre_request` configured. First phone test ending 1014 has an active Customer profile but no approved Firebase link; second ending 1634 has an approved active Customer link. Both have a distinct employee profile. **Do not auto-merge employee and Customer accounts** or mistake missing Firebase link for SMS non-delivery.
- Next: fix full CI on #3123, complete Firebase-aware screen and Storage/RPC writes without bypassing RLS, perform read-only hash/parity verification of live Edge versions, capture sanitized native SMS send/verify codes, then specifically authorize any guarded production mutation and manually test a `0.3.1` OTA on installed compatible Internal Testing build. Only after signed-token two-account tests + full workflows green may Customer Android Supabase OTP be removed; staff/partner/web Supabase Auth persists.


## 2026-10-13 — Continued session audit (unmerged, no production mutation)

- PR #3123 current integration head prior to continuation was `9620917a`; main advanced to `e51a0b8` (seven commits behind at audit). Preserve current-main Customer Start Claim header/whole-field interaction and recheck before merge.
- GitHub Verify mobile app run #38389127958 failed at TS2304 `supabase` on `app/customer/start-claim.tsx:78`, **but that run checked older commit `7b927c30`, not the latest PR head**. Latest source already uses the Firebase-aware `client` at this line; do not blindly reintroduce singleton Supabase to fix historical CI logs. Verify the latest head in a fresh CI run.
- A scoped change removes raw exception logging from the Start Claim loading failure (commit `cc46197a`); user-facing fallback stays unchanged. This is not an authentication or database cutover.
- Firebase token client and guarded document download/upload helpers are present, but this is NOT proof that all nested KYC, policy-detail, claim media and profile components use them; inspect all linked components and verify signed-token RLS/Storage A/B isolation before cutover.
- No production SQL, Edge function, OTA, Play publication or AAB/APK initiated. Leave PR draft until all current-head mobile CI, Android SMS, customer-to-customer isolation, and data/document tests pass.


## 2026-10-13 — CUSTOMER FIREBASE DEEP-SCREEN CONTINUATION (DRAFT / NOT RELEASED)

**Branch / PR:** feature/customer-firebase-current-main-20261013 / #3123. This session extended the current-main candidate, NOT stale #2979. Main keeps advancing independently; inspect newer Customer fixes before merge. No production write, Firebase configuration change, Edge deployment, OTA, Google Play submission, APK or AAB.

**Source changes:**
- Claim Detail now resolves canonical Customer identity and owned accounts before claim reads; claim-number update checks selected account and document open uses the Firebase signed-token and canonical ownership verifying backend for Firebase users, retaining legacy signed Storage access only for existing Supabase Customer sessions. No raw SDK error objects in device logs.
- Added lib/customer-private-documents.ts to centralize short-lived Customer private reads and account-scoped signed uploads. No Firebase-to-Supabase session fabrication, no client-side service-role credentials, no raw Firebase bearer handed to legacy Storage. Firebase file deletion deliberately fails closed until an independently authorized backend path exists.
- Three policy-detail components (Motor, Life/Health and general Policy) now use canonical Customer data clients, profile UUID in metadata, and protected document helpers. Firebase INTERNAL/SIBL policy-copy upload is explicitly blocked pending a verified metadata INSERT authorization path. External policy uploaded files use signed ticket helper but require live parity/device testing.
- Group KYC review reads canonical profile and application via authenticated Customer client; Group dashboard group-scoped data queries now use Customer client instead of global singleton.
- Added Customer private boundary source regression, wired into mobile and Firebase readiness workflows, and branch-only push Mobile CI. CI run #38395976580 exposed an old variable shadow in policy-detail route and a leftover Motor Policy singleton; fixes committed afterward. The next run MUST be confirmed green before any release. Start Claim static noninteractive header/full vehicle field selector preserved.

**Read-only LIVE Supabase audit findings (Oct 13):**
- The authenticator role has pgrst.db_pre_request=public.customer_firebase_data_api_pre_request. The Firebase resolver exists, requires approved active Firebase identity, signed Firebase claims and matching Customer profile and phone. The pre-request sets transaction-local mapped UUID; it does not alter Firebase JWT JSON. A null current_setting in the administrative SQL session does not disprove the authenticator role setting.
- Production Edge code was compared directly against the branch: customer-firebase-upload-url v1, customer-firebase-bind v2 and customer-firebase-signup v2 match byte-for-byte.
- **DEPLOYMENT BLOCKER:** production customer-firebase-doc-read v2 differs from the branch (184 vs 238 source lines). The branch adds an exact bucket match on policy_documents, customer_documents metadata-owned reads (profile photos and external policy attachments) and policy_documents metadata reads for files physically stored in customer-documents. Those safeguards/capabilities are NOT in the deployed Edge version. No Edge deployment performed. New reads may fail until the reviewed function is deployed, then live verified.
- Live policy_documents contains a Firebase SELECT policy but no INSERT policy in the read-only inventory. The upload signed ticket alone cannot establish metadata write authorization; internal policy-copy Firebase uploads are blocked in Customer UI to prevent unsuccessful metadata writes/orphan files. Any fix must use narrow owner/path/type checks or server-side identity-confirmed registration, NOT broad access grants. Other metadata tables have legacy auth.uid-based insert policies but Firebase compatibility remains UNVERIFIED without signed-token tests.
- claims and claim_documents have Firebase-specific SELECT policies. UPDATE/DELETE/RPC and Storage write parity must be checked individually; do not equate select support with full customer CRUD.
- Only aggregated approved Firebase identity-link counts were inspected; no phone numbers, OTPs, ID tokens or customer records changed.

**Still required before Customer Firebase-only release:** KYC individual/corporate/group/dealership, profile photos, Group account detail, self-managed claims and multiple attachment/storage workflows still require verified canonical client/write parity. Finish screen and nested-component audits, request guarded approval for production RLS/Edge updates, execute full current-head Mobile typecheck/lint/source tests and Android Expo export, install and test real Firebase phone SMS + wrong/expired/resend/restart flows, verify two signed Firebase test accounts A/B with denied cross-customer Data API/Storage/RPC writes/reads. Do not remove the legacy Customer OTP recovery path or touch employee/partner/web authentication until security, CI, and physical-device gates pass. Do not merge/publish/build an APK/AAB without release signoff.


## 2026-10-13 — Later continuation: Customer Profile, native Firebase sign-out and CI gating

- Customer Profile now reads canonical verified Customer profile, customer and onboarding application records through the selected Firebase bearer data client or existing Supabase Customer client. Owner-checking one-minute signed document reader covers KYC, document views and profile-photo reads. Firebase mutation UI paths for contact details, profile photos and document uploads/deletes explicitly refuse writes pending signed-token owner-scoped write/delete parity; legacy Customer continues unchanged.
- Native Android Firebase provider selection now has a session-independent check in customer-identity. Shared Customer Sign Out in auth.ts signs out the actual native Firebase user before handling any Supabase remembered-account fallback; employee/partner legacy auth path is unchanged. Regression asserts this native logout boundary.
- E-Challan authenticated reads use canonical Customer identity and scoped Customer data client; guest enquiry OTP preserved. Authenticated service enquiries submit via selected Customer data client rather than legacy singleton. Security regressions cover both.
- Mobile CI run #38396865373 got through whole-app TypeScript/lint and multiple policy/Customer regressions then failed the outdated Start Claim OTA source test (expected legacy literal Supabase claim insert). Its test was updated to enforce verified identity, customer profile UUID, persistent Draft before navigation, runtime 0.3.1 (10), explicit manual OTA and no push trigger. New run #38397147683 started; check its final outcome before claiming green.
- No change to live Supabase DB/RLS, deployed Edge, Cloudflare/Vercel, Expo OTA, Google Play or native build. Still no two-account signed-token proof. Non-migrated deep KYC, self-managed claim upload/removal and remote metadata write/delete authorization remain blockers. PR #3123 remains draft, do not merge.


### 2026-10-13 — Green full Mobile CI on current Firebase candidate (STATIC VERIFICATION ONLY)
- **PASS** GitHub Actions Verify mobile app run #38397337338 at source SHA 2361ff68d7ee301050a6b1edbb886f864312f6aa, URL: https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38397337338. All steps passed, including dependency check, TypeScript, lint, new Firebase-private boundary source tests, Customer Start Claim header/OTA checks, policy details, claim media, signed-view logic, E-Challan/service enquiries, and Expo web review export/artifact upload.
- Two older Customer regression suites originally assumed public 0.3.0(9) and source literal supabase claim insert. Updated the **Firebase-only candidate branch's** tests for 0.3.1(10), canonical Customer Draft claim insert with verified profile UUID, and manual/no-push OTA guard; retained functional and touch-safety assertions. The protected live 0.3.0 main regression baseline was not changed.
- Green CI is **NOT** real Android Firebase SMS login, restored native token, live Edge/RLS parity, or customer A/B signed-token proof. No API/DB/Edge/Play/Expo/OTA/APK/AAB mutations. PR remains draft and unmerged. Keep the production doc-read deployed-source drift and Firebase policy_documents INSERT authorization blocker open.

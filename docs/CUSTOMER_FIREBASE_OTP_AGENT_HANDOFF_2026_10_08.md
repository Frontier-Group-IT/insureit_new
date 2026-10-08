# INSUREIT Customer App — Firebase OTP Integration Handoff
**As of:** 2026-10-08 · **Status:** UNMERGED / NOT DEPLOYED / FIREBASE LOGIN NOT ACTIVE
**Purpose:** A new AI agent can resume real implementation without redoing dozens of prototypes or guessing security state.

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

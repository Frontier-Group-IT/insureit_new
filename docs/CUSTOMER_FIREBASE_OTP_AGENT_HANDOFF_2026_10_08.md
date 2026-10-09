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

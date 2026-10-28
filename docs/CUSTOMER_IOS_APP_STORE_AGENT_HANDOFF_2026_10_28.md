# INSUREIT Customer — iOS App Store publication handoff (living document)
Last updated: 2026-10-28. Owner: INSUREIT project. **Update this file after EVERY subsequent verified publishing step** in the same release branch, with the date, evidence, status and next action. Do not state success solely based on a screenshot of an unsubmitted wizard.

## Objective and non-negotiable constraints
- First-ever INSUREIT **Customer** iOS build and eventual App Store publication under Sankalp Insurance Brokers Private Limited Apple Developer team.
- Preserve **all features actually shipped to Android production through Expo OTA** plus reviewed later improvements. Do not revert to the original Android native binary source.
- **No Firebase OTP** added to iOS. Customer currently uses Supabase SMS OTP; preserve production auth behavior.
- Do not modify Android production, existing Partner app, its distribution certificate or provisioning profile. Do not publish/upload Customer to Apple without reviewed signed binary and QA.
- Avoid repeated Apple rejections: ensure reviewer account/OTP, insurance authorization, privacy, deletion, metadata, assets and native QA before submission.

## IDs, accounts, canonical sources
- GitHub: `Frontier-Group-IT/insureit_new`
- iOS preparation draft PR: https://github.com/Frontier-Group-IT/insureit_new/pull/3508
- Release branch: `release/customer-ios-current-ota-20261024`. Earlier PR #3425 is older-base and superseded.
- Customer Expo account/project: `antnish/insureit-mobile`; EAS project id `aadcb7a5-072b-4bf9-bc81-c52fabdd5caa`
- Partner Expo account/project DIFFERENT: `insureitapp/insureit` (Partner `com.insureit.partner`), same Apple Developer team.
- Apple Developer legal team: Sankalp Insurance Brokers Private Limited; team id `455GGC36YS`.
- Customer bundle ID `com.insureit.mobile`; iOS version `0.3.0`; first iOS build `1`.
- Customer source `apps/mobile-app`. Expo app.json and eas.json prepared in release PR: app display name `INSUREIT Customer`, store distribution, real-device build, production channel.
- Android LIVE Play binary: version 0.3.0 (9), original EAS build `d937d9ff-a28e-422b-b926-1fc2c07bd73d`, source `ac806be` (2026-09-05). Original build is not the latest OTA functionality.
- Latest user-confirmed production OTA (as of 2026-10-23 13:09): update group `23672b89`, runtime `0.3.0`, source commit `38608fe5009e4c5365a7a800e6efa64db0bc2edd`, production branch/channel. Expo update screen showed Android and iOS OTA artifacts, but no first iOS binary was installed.
- Compare already verified: release branch built from current main containing that OTA commit and later main commits. Reconfirm latest OTA and source SHA at release freeze.

## Completed and verified repository work
- PR #3508 created, remains **draft**; source-level iOS preparation committed without Android release changes.
- GitHub CI mobile run #1626 and web run #7093 PASSED at release-candidate snapshot, covering typecheck/lint, customer regressions and Expo web export. These are NOT native iOS build evidence.
- Manual iOS-only EAS GitHub Actions workflow added inside PR: `.github/workflows/customer-ios-eas-manual.yml`. Needs to be present on default branch for ordinary Actions workflow_dispatch selection, proper `EXPO_TOKEN` secret and Apple signing setup; was not triggered. Non-interactive production build command used is `eas build --platform ios --profile production --non-interactive --no-wait`.
- Account-deletion UI verified in `apps/mobile-app/app/customer/profile.tsx` and `app/customer/account-deletion.tsx`; confirmation leads to high-priority `support_tickets` insertion with tracking and public fallback. End-to-end deletion fulfillment still requires verification.
- Authentication source `apps/mobile-app/app/login.tsx`, `signup.tsx`, `lib/auth.ts` shows **Supabase phone OTP**, not Firebase; reviewer OTP access must be arranged securely in App Store Connect.
- Customer current `apps/mobile-app/package.json` does NOT declare `expo-notifications`; notification provider `components/realtime-notifications.tsx` uses Supabase Realtime + in-app banner/bell. No verified iOS APNs push implementation or broadcast Live Activities. Therefore default recommendation for CURRENT App ID registration: **leave both Push Notifications and Broadcast Capability unchecked**. If implementing remote iOS push before release, first add and validate native entitlement/token registration/backend handling, then enable standard Push Notifications only; Broadcast is exclusively for Live Activities and unnecessary here.

## Apple / Expo signing progress (screenshots/user-reported)
1. Apple Developer team signed Partner app already; Partner Expo credentials showed VALID Apple Distribution Certificate (same team) and a Partner-only provisioning profile.
2. Customer Expo credentials page initially showed **no iOS credentials**, Android application identifier existed.
3. User used Partner Expo credentials menu and downloaded distribution certificate export as three files: `DistCert_232YMQ9GTV.p12`, `DistCertCredentials_232YMQ9GTV.md`, `DistCertPrivateKey_232YMQ9GTV.txt`. Never upload these files to GitHub/ChatGPT; handle securely. Existing valid Apple Distribution Certificate may be reused across same team; Partner provisioning profile may NOT be reused.
4. Customer Expo new bundle identifier wizard: bundle ID `com.insureit.mobile`, distribution **App Store** selected. User reached step 5/8 (choose provisioning profile). This suggests certificate wizard step was passed, but DO NOT assert import successful until credentials overview confirms.
5. Apple Developer Identifiers list showed ONLY Partner `com.insureit.partner`. User proceeded to register a NEW explicit App ID `INSUREIT Customer` / `com.insureit.mobile` under team `455GGC36YS`.
6. **CURRENT SCREEN (2026-10-28):** Apple Developer > Register an App ID > Capabilities, before clicking Continue/Register. In screenshot **Push Notifications CHECKED, Broadcast Capability CHECKED**; other visible capabilities unchecked. Guidance: **uncheck Broadcast Capability** for sure; since Customer code currently lacks native APNs push, **also uncheck Push Notifications** for now. Confirm bundle identifier, then Continue and Register.
7. NEXT: Apple Developer Profiles > create **App Store Connect** distribution profile for Customer `com.insureit.mobile`; choose already-existing same-team Apple Distribution Certificate, generate/download .mobileprovision; upload in Customer Expo step 5. Check final credentials overview.
8. Other iOS credentials: APNs push key only if future native push implementation; App Store Connect API key for automated submission can be configured later. Do not alter Partner credentials.

## IMPORTANT security rules
- Never expose/share .p12, private-key TXT, .mobileprovision, export passwords, Apple ID password, EXPO_TOKEN, API key private material in chat or GitHub.
- Apple distribution cert can sign multiple apps on SAME team; provisioning profile is specific to Customer bundle identifier.
- Do not revoke existing Partner certificate.
- Expo Customer project is under personal account `antnish`, GitHub repo under `Frontier-Group-IT` org. Expo direct GitHub linking UI requested an Expo organization. Workaround is manual GitHub Actions EAS workflow using existing personal Expo project, NOT moving repositories/accounts.

## Pending gates to release
- [x] Register Customer App ID in Apple Developer: screenshot 2026-10-28 confirms INSUREIT Customer / com.insureit.mobile listed under Sankalp Insurance Brokers team 455GGC36YS. Capabilities (Push/Broadcast disabled) still to inspect.
- [ ] Generate Customer App Store Connect provisioning profile for `com.insureit.mobile`, using same-team distribution certificate.
- [ ] Verify Customer Expo stored signing certificates and profile in project credentials.
- [ ] Check latest OTA/channel and freeze verified release candidate commit, ensure no Firebase OTP or inadvertent Android changes.
- [ ] Validate latest CI/Expo doctor, ios signing/native EAS build succeeds; capture EAS build ID and signing logs, not secrets.
- [ ] Test actual iPhone/TestFlight binary: Supabase OTP, persistent sessions, policy/vehicles/claims, uploads, voice, location, permissions, support, deletion request, auth, privacy/links.
- [ ] Prepare and verify screenshot sizes, app icon, privacy answers, legal company/insurance authorization docs, age rating, support/privacy URLs and reviewer credentials.
- [ ] App Store Connect Customer app record, TestFlight validation then first submission. Apple approval cannot be guaranteed.
- [ ] Keep PR #3508 draft until stipulated native checks and real-device QA verified.

## Next agent instructions
Read this file first and verify latest GitHub/EAS/Apple state rather than relying on stale assumptions. Append a dated change log after each actual step, marking its evidence and the next action. Do not claim asynchronous/background monitoring. If a step requires a user action in Apple UI, provide exact scoped steps and continue from resulting screenshot. Do NOT repeatedly ask for information already recorded here.

## Proposed native push expansion — 2026-10-28
User requested native push for BOTH currently-live Android and first upcoming iOS binary. Status: **approved in principle for planning; NOT implemented or deployed**.
- Preserve Supabase SMS OTP; FCM for Android push is NOT Firebase Auth/OTP.
- Proposed shared `expo-notifications` client, ExpoPushToken registration per user/device (secure RLS), scoped server-side dispatch from approved notification events, foreground handling, tap/deep-link routing, deduplication and send receipt cleanup.
- Android: FCM V1 service-account credential in EAS, explicit user consent, notification channel, NEW Android AAB with version code >9; do not modify current live production until tested.
- iOS: ENABLE standard Push Notifications capability for `com.insureit.mobile` if implementing now; DISABLE Broadcast Capability (Live Activities are not used). Create APNs key under team 455GGC36YS and configure EAS; recreate/regenerate App Store provisioning profile after capability changes if required, then first signed iOS build.
- Existing Customer app currently uses Supabase Realtime in-app notifications; `expo-notifications` not in package.json. No actual native push implementation yet.
- Before build: audit duplication, authorization boundaries, notification data minimization, foreground/background handling, opt-out, simulator/device tests, token expiry and delivery receipts.
- Separate test/release gates for Android AAB and iOS TestFlight. Keep Customer iOS PR #3508 draft until native QA.
- Reference: https://docs.expo.dev/push-notifications/push-notifications-setup/ .

## Decision update — 2026-10-28 (latest)
User explicitly deferred native push notifications for both Android and first iOS release. **Do not add expo-notifications, APNs, FCM, Push Notifications entitlement, or Broadcast Capability in the first iOS build**. Keep existing Supabase Realtime/in-app bell only. Native push is a separate future release proposal. On Apple Developer App ID registration, leave Push Notifications and Broadcast Capability unchecked. If Apple App ID was already registered with push, remove unnecessary push capabilities before generating the definitive distribution provisioning profile and avoid any push entitlement in the binary.
User's Apple session timed out and screenshot shows Certificates list, with one valid same-team iOS Distribution certificate expiring 2027-10-14. Exact status of Customer App ID registration remains **unconfirmed**; next visit Apple Developer > Identifiers and check for INSUREIT Customer / com.insureit.mobile; register if missing, then create App Store Connect provisioning profile. Do NOT create/revoke a distribution certificate or reuse Partner provisioning profile.

## Change log
- 2026-10-28: Created comprehensive first-iOS publishing handoff on OTA-inclusive release branch. Identified current App ID capability selection and recommended disabling Broadcast and standard Push Notifications pending verified native APNs support. Apple App ID registration not yet confirmed complete.

- 2026-10-28: Native cross-platform push requested. Documented revised iOS App ID capability recommendation (standard Push ON, Broadcast OFF) conditional on implementation, and Android native AAB requirement. No signing changes performed by assistant.

- 2026-10-28: User deferred native push. Reverted first-iOS capability recommendation to Push OFF and Broadcast OFF; Certificates screenshot shows existing certificate, but Customer App ID registration is unconfirmed. Next check Identifiers.

- 2026-10-28: User screenshot confirms Customer App ID successfully registered in Apple Developer identifiers alongside Partner. Next inspect capabilities, then generate Customer-specific App Store Connect provisioning profile and import into Customer Expo. Native push deferred.

- 2026-10-28: Apple provisioning wizard reached Select Certificates. Screenshot shows Sankalp Insurance Brokers Private Limited iOS Distribution certificate selected, expires 2027-10-14. User instructed to Continue, name profile INSUREIT Customer App Store, Generate and download; not yet confirmed generated. Verify profile bundle ID com.insureit.mobile before import into Expo.

- 2026-10-28: Apple Developer confirmation screenshot shows INSUREIT Customer App Store provisioning profile GENERATED and downloaded as INSUREIT_Customer_App_Store.mobileprovision, App Store type, App ID 455GGC36YS.com.insureit.mobile, expiry 2027-10-14. Next: upload to Expo Customer credentials wizard Step 5, verify certificate/profile association and wizard completion. Expo import not confirmed yet. Native push deferred for first iOS build.

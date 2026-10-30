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
- Release branch: `release/customer-ios-current-main-20261028`. Earlier PR #3425 is older-base and superseded.
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
- [x] Verify Customer Expo stored signing certificate and provisioning profile: screenshot 2026-10-28 17:29 shows both Valid under iOS com.insureit.mobile; profile team 455GGC36YS.
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

- 2026-10-28: Expo Customer credentials wizard screenshot reached Step 6/8 'Choose push key' after provisioning-profile upload, indicating Step 5 advanced. Native push postponed for first iOS build: instructed user to select 'Skip this step' and Next. Certificate/profile validity not yet independently verified on final credentials summary; Step 6 completion not yet confirmed.

- 2026-10-28: Expo Customer iOS credentials wizard reached Step 7/8, 'Choose App Store Connect API Key for EAS Submit', after skipping APNs key. ASC key is optional for first signed compilation; instructed user to choose 'Skip this step' and Next, then verify Step 8 and completed credentials. Step 7 completion and final saved credentials not yet confirmed.

- 2026-10-28: Expo credentials wizard reached Step 8/8 'Confirm changes'. Screenshot contains standard warning and Submit button. User advised Submit only after ensuring imported .p12 and Customer App Store .mobileprovision match. Submission and credential validity NOT yet confirmed; next verify Expo iOS credentials overview shows valid certificate and provisioning profile. No app build or Apple App Review submission has occurred.

- 2026-10-28 17:29 IST: Expo Customer project iOS credentials configuration submitted successfully. Screenshot confirms App Store distribution certificate serial 7F76D79307BB308BBF11A4DBEF769163 status VALID and provisioning profile UUID 33be6e5d-1710-498d-952a-cc74661baa16 status VALID under com.insureit.mobile; profile Apple team 455GGC36YS. APNs and ASC submit key intentionally omitted. Signing setup completed; signed IPA build, device testing and App Store upload remain pending. Certificate Team UI shows None, but profile team present; validate native signing at EAS build. Next verify fresh PR CI, make manual iOS build workflow runnable in GitHub without prematurely merging draft PR, start signed iOS EAS build when ready.

- 2026-10-28: Refresh: original PR #3508 release branch was 274 commits behind current main, so an updated release branch release/customer-ios-current-main-20261028 has been created from current main. iOS name/buildNumber and EAS store settings reapplied. Any iOS build must use this fresh branch; older PR #3508 should not be built. Native credentials have been verified in Expo. Full iPhone QA remains pending.

- 2026-10-28: GitHub workflow-only PR #3703 passed web CI and was SQUASH MERGED into main at 90d51ac. The main workflow .github/workflows/customer-ios-eas-manual.yml now exists and dispatches only on BUILD_IOS. It checks out release/customer-ios-current-main-20261028, runs npm ci, typecheck/lint, and queues EAS iOS production via EXPO_TOKEN (secret presence not independently verifiable). App release PR #3702 mobile/web CI passed and remains DRAFT; no iOS build triggered. Connected GitHub integration has no workflow_dispatch action, so user must initiate GitHub Actions > Customer iOS EAS Build (Manual) > Run workflow > main > BUILD_IOS. Review run and EAS logs before advancing. Do not merge #3702 or submit to Apple without native QA.

- 2026-10-29: First manual iOS GitHub Actions run FAILED before EAS build: expo/expo-github-action@v8 attempted to install eas-cli 26.0.0; transitive @oclif/plugin-autocomplete@3.3.0 requires Node >=22, workflow was Node 20.20.2; yarn exit 1. Cache 400, punycode and other dependency warnings were non-fatal. Opened CI-only fix PR #3713 (branch fix/customer-ios-eas-node22-20261029), changing actions/setup-node to Node 22. MUST verify CI before merging and rerun manual build. First signed iOS binary still not created. No Android/Apple submission changes.

- 2026-10-29: PR #3713 CI Verify web portal passed; Node 22 workflow-only fix squash MERGED to main at 97ce1f375173cc6c423a47ec62823cbe94933088. Main workflow verified using node-version 22. No exposed GitHub workflow_dispatch connector capability, so user must manually run GitHub Actions Customer iOS EAS Build (Manual) on main with BUILD_IOS, then share run status; iOS binary has not yet been confirmed generated. Release PR #3702 remains draft.

- 2026-10-29 17:40 IST: User reports successful completion of first INSUREIT Customer iOS EAS build and download of resulting artifact (presumed .ipa). This is user-reported, not independently verified from EAS build ID/logs. Next: open latest successful Customer iOS build in Expo, verify com.insureit.mobile and version 0.3.0 (1), submit to App Store Connect via EAS Submit (may require ASC API key, intentionally skipped during initial credential setup). Submission sends binary to TestFlight processing, NOT public App Review. Keep app PR #3702 draft; do not modify live Android. Ask user to share Expo submit screen / build page for exact next steps.

- 2026-10-29 17:42 IST: User screenshot verified Expo successful iOS App Store production IPA build ID caaa8af4-2b41-4a0d-9354-b87b1d3e4c84 (5m17s, downloadable IPA). Expo Submit popup suggests 'eas submit --platform ios'; not yet sent to Apple. Created draft CI-only PR #3753, .github/workflows/customer-ios-eas-submit-manual.yml guarded by SUBMIT_TESTFLIGHT; uses Node 22 and exact build ID with eas submit --platform ios --id caaa8af4-2b41-4a0d-9354-b87b1d3e4c84 --profile production --non-interactive. ASC submission authentication was intentionally skipped during initial credentials; must configure before noninteractive workflow can succeed. Keep #3753 draft until ASC creds and CI verified, #3702 still draft; no Apple upload has occurred.

- 2026-10-29 17:49 IST: User opened Expo Customer iOS credentials 'Change App Store Connect API Key' modal; selected default Upload new ASC API key, Team key recommended; key file and identifier blank. Recommended first inspecting 'Choose saved ASC API key' since Partner shares Apple developer team, if a valid team key is available and authorized. Otherwise generate a new App Store Connect Team API key (.p8, key id, issuer id), upload only through Expo secure UI. No key uploaded or ASC submission yet; awaiting next screenshot.

- 2026-10-29 17:50 IST: Screenshot of Expo Customer Change ASC API Key > Choose saved ASC API key explicitly reports 'There are no saved ASC API keys'. Next action: open App Store Connect Users and Access > Integrations > App Store Connect API > Team Keys under Sankalp Insurance Brokers Private Limited, verify team and permissions, generate dedicated App Manager team key if necessary. Download .p8 privately once, retain Key ID and Issuer ID, upload securely to Expo Customer only. No key generated/added yet, no TestFlight submission.

- 2026-10-29 17:52 IST: Apple App Store Connect screenshot confirms correct Sankalp Insurance Brokers Private Limited team, Team Keys page, one active Partner key 'INSUREIT Partner Expo EAS' with App Manager role. Recommended dedicated Customer Team API key named 'INSUREIT Customer EAS Submit' with App Manager access; do not revoke/modify Partner key. User to click + under Active, generate new key and privately download .p8, then import key with Key ID and Issuer ID into Expo. No new Customer key generated yet and no ASC submission.

- 2026-10-29: User confirms downloading newly created Customer ASC Team API .p8 key. Key's ID and Expo upload/save not verified yet. Next: Expo Customer iOS credential config > Change ASC API Key > Upload new Team key, provide .p8, new key's Key ID, Apple team Issuer ID, and descriptive name; Save. Never share key content in chat/GitHub or modify Partner key. Verify saved status before merge/run TestFlight submit workflow draft PR #3753.

- 2026-10-29 17:57 IST: Expo Customer screenshot confirms saved ASC API Team key 'INSUREIT Customer EAS Submit', Key ID R489LJAGMM and Issuer ID present; Expo Team/Roles displayed None (not proof of invalidity). Customer profile still shows Valid. GitHub PR #3753 CI Verify web portal PASSED and workflow-only change was squash MERGED into main at bb8faccfd4b8075b1c4b00fcd1764c98d3607574. Manual workflow 'Customer iOS EAS Submit (Manual)' targets existing successful IPA EAS build caaa8af4-2b41-4a0d-9354-b87b1d3e4c84 with guarded input SUBMIT_TESTFLIGHT on main. Not yet dispatched; user must run from GitHub Actions UI, then verify upload/Apple processing. Release PR #3702 still draft, no App Review submission.

- 2026-10-29 17:59 IST: TestFlight manual workflow run 40873575736 failed in Submit step (exit 1): 'Failed to resolve plugin for module expo-router ... Do you have node modules installed?' The submit workflow had checked out release source and set up Node/EAS CLI but lacked npm ci. Opened workflow-only fix PR #3754 adding 'Install workspace dependencies: npm ci' before EAS Submit, leaving exact IPA build ID caaa8af4-2b41-4a0d-9354-b87b1d3e4c84 unchanged. CI in progress; merge only after success, then rerun manual SUBMIT_TESTFLIGHT. No new build and no Apple upload yet.

- 2026-10-29: PR #3754 workflow-only missing-dependency fix CI 'Verify web portal' completed SUCCESS. Squash MERGED into main commit f644b9ffe5fb1d85226cf6fe056e19fe4930f548. Submit workflow now runs npm ci before EAS submit, addressing expo-router resolution failure from run 40873575736. Next user action: rerun GitHub Actions 'Customer iOS EAS Submit (Manual)' on main with input SUBMIT_TESTFLIGHT; verify latest run logs and App Store Connect TestFlight processing. Existing signed IPA remains the same; no Apple upload yet confirmed. Release PR #3702 stays draft.

- 2026-10-29: Second GitHub TestFlight submit retry run 40874794856 passed npm ci / EAS setup but failed immediately with 'Missing submit profile in eas.json: production'. Inspected release apps/mobile-app/eas.json: build.production exists but no submit config. Expo official docs require submit.production.ios.ascAppId numeric App Store Connect Apple ID for noninteractive EAS Submit. Opened CI-only PR #3755 (fix/customer-ios-submit-profile-20261029) adding required manual workflow input asc_app_id, validating digits, and injecting temporary submit.production.ios {ascAppId,appleTeamId:'455GGC36YS'} into runner copy of eas.json before exact-IPA EAS Submit; no app code/IPA changes. CI pending. Next: have user find INSUREIT Customer numeric Apple ID under App Store Connect > Apps > Customer > App Information, create app record if necessary, then once CI passes merge #3755 and dispatch workflow from main using SUBMIT_TESTFLIGHT and asc_app_id. No Apple upload yet.

- 2026-10-30 10:15 IST: App Store Connect Apps screenshot under Sankalp Insurance Brokers displays only INSUREIT Partner (iOS 0.2.0 Waiting for Review), no INSUREIT Customer app record. User instructed to click Apps + > New App and create separate iOS app with name INSUREIT Customer, primary language English US, existing bundle ID com.insureit.mobile, unique SKU INSUREIT-CUSTOMER-IOS-001. Once created, obtain numeric Apple ID for guarded EAS Submit workflow PR #3755. Banner warns updated Apple Developer Program License Agreement requires Account Holder acceptance, potentially blocking submission. Do not change Partner app. Customer app record not yet created.

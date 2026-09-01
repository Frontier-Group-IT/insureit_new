# INSUREIT Partner — Google Play Release Readiness & Device UAT

Date: 2026-09-01

## Release rule

This checklist is the current continuation point after the OTA-safe Partner refinement sequence R3–R8.

- Do **not** create a new Partner APK/AAB during this checklist unless the user explicitly authorizes that exact native build.
- Use the existing Partner preview binary for installed-device UAT.
- Fix JavaScript / TypeScript / UI defects by OTA when safe.
- Keep native dependency, native configuration and final Google Play AAB work for the explicitly approved final native-build stage.

## Exact installed-device UAT baseline

Current Partner preview source:

- Git commit: `c48e5803aec3f455100cefcdc146cd4cc32d3692`
- Runtime: `0.1.0`
- Channel / branch: `preview`
- Partner preview OTA workflow: #29
- GitHub Actions run: `33472570374`
- Result: **SUCCESS**
- Expo update group: `f5ab58ca-176c-4c22-82d7-ce24432ae6fd`
- Android update: `01a05b62-8253-7f5d-a5c2-18e105f44a19`
- iOS update: `01a05b62-8253-7ea4-a9b4-54cda0616aae`

Feature verification immediately before this OTA:

- Privacy-link PR #954 merged as `0a09d2d9cc2d7923244009fd4edb9f591f045d23`
- Partner Verify #109 / run `33472394033`: SUCCESS
- Web Verify #2504 / run `33472394139`: SUCCESS
- public `https://portal.insureit.in/privacy-policy`: HTTP 200 verified through Vercel
- no new native dependency/configuration
- no APK/AAB

## Current production UAT identity state

Read-only production verification on 2026-09-01:

- `intermediary_portal_accounts`: 1 active account
- active account intermediary type: Partner
- active Partner family: standalone
- active POSP children under that family: 0
- active MISP children under that family: 0

Implication:

- standalone Partner device UAT can proceed with an existing real account;
- linked POSP/MISP-family behavior is **not** covered by that account;
- do not fabricate another production/test portal account without explicit approval.

## Automated readiness already green

- Partner route-integrity guard
- Partner release identity guard
- Phase 5 resilience/accessibility contracts
- runtime `0.1.0` native-date-picker block
- Partner TypeScript
- Partner lint
- Expo web review export
- Web portal regression suite
- Web TypeScript
- Web lint
- Web production build
- R4–R8 preview OTA publication
- Privacy Policy link in Partner Settings

Static Partner source audit also found no Partner-app hits for:

- TODO
- FIXME
- `console.log`
- `@react-native-community/datetimepicker`
- localhost
- example.com placeholders

## Installed-device UAT — current preview binary

For OTA activation, fully close and reopen the installed Partner app. If the first launch downloads the update, fully close and reopen it once more before recording results.

### A. Startup and session

- [ ] App cold-starts without blank/error screen.
- [ ] Existing valid session restores correctly.
- [ ] Expired/invalid session returns to sign-in safely.
- [ ] Sign out confirmation works.
- [ ] Sign out removes authenticated access.
- [ ] Re-login succeeds.

### B. Home and primary navigation

- [ ] Home renders greeting, My Business, Quick Actions, Your Impact and INSUREIT Stories in the approved hierarchy.
- [ ] Home monetary values remain readable and correctly formatted.
- [ ] Bottom tabs work: Home / Business / Policies / Claims / More.
- [ ] Back navigation from secondary screens returns to the expected context.

### C. Universal search / preserved context

- [ ] More → Work → Search all business opens.
- [ ] Search requires at least 2 characters.
- [ ] Customer search returns only authorized records.
- [ ] Policy search returns only authorized records.
- [ ] Claim search returns only authorized records.
- [ ] Customer result opens Customer Detail.
- [ ] Policy result opens Policy Detail.
- [ ] Claim result opens Claim Detail.
- [ ] Returning from a detail preserves the universal search term.
- [ ] Existing Customer / Policy / Claim list filters remain unchanged after using universal search.
- [ ] No stale result replaces a newer query when typing quickly.
- [ ] A failed section does not hide successful sections.

### D. Customer / Policy / Claim detail

- [ ] Customer Detail progressive disclosure works.
- [ ] Policies / Vehicles / Claims show compact initial rows and Show all / Show less when applicable.
- [ ] Policy Detail shows essential identity/status first.
- [ ] Premium and commercial detail disclosures expand/collapse correctly.
- [ ] Claim Detail shows attention only when relevant.
- [ ] Claim journey shows latest events first and can expand full history.
- [ ] Policy Intake Detail extracted-policy/vehicle sections expand/collapse correctly.

### E. Policy Intake transaction journey

Use an explicitly designated safe UAT document/record and define cleanup before creating persistent test data.

- [ ] Lead source selection works.
- [ ] Customer mobile validation works.
- [ ] Document picker opens and selected file is retained.
- [ ] Ready to submit summary matches selected source/mobile/file.
- [ ] Rapid repeated taps cannot double-submit.
- [ ] Upload progress is visible.
- [ ] Successful submission opens/tracks the correct Intake record.
- [ ] Network failure leaves the selected file available for retry.
- [ ] Retry does not create an accidental duplicate submission.
- [ ] If a test record requires replacement, rapid repeated replacement taps cannot create duplicate uploads.
- [ ] Operations attention response remains authoritative.
- [ ] Final booked policy navigation works when a final policy exists.

### F. Business / Payout / Network

- [ ] Business summary loads and current-month premium/trend are readable.
- [ ] Renewals and Active Claims shortcuts navigate correctly.
- [ ] Payout visibility follows the logged-in account's server authorization.
- [ ] Restricted payout state never exposes amounts/records.
- [ ] Allowed payout summary is compact and recent records expand/collapse.
- [ ] Network loads using the authorized scope.
- [ ] Current standalone Partner family displays correctly with zero child POSP/MISP.
- [ ] Group/owner fields are shown only when returned by the authorized server scope.

### G. Account / Profile / Settings / Support

- [ ] Profile & registration values render legibly.
- [ ] Commercial access card matches the account scope.
- [ ] Settings & app info opens.
- [ ] Version/runtime show `0.1.0`.
- [ ] Privacy Policy opens the live portal privacy page.
- [ ] Support opens.
- [ ] Relationship contact appears only when authorized/available.
- [ ] Call action opens the device dialer where a phone is present.
- [ ] Email action opens the email composer where an email is present.
- [ ] Need your attention is prioritized above in-progress Policy Intakes.

### H. Weak-network / recovery

- [ ] Load Home/Policies while online first.
- [ ] Disable network and revisit/refresh cached screens.
- [ ] Previously loaded usable data remains visible where cache support exists.
- [ ] Cached/offline warning is shown without duplicate generic error banners.
- [ ] Re-enable network and pull-to-refresh recovers.
- [ ] A recoverable error can return to Home without restarting the app.

### I. Layout / accessibility smoke

Check at least one smaller Android phone and one normal/large Android phone before final build.

- [ ] No clipped bottom actions.
- [ ] No text overlaps at normal font scale.
- [ ] 48px-class touch targets remain usable.
- [ ] Search/filter controls are tappable.
- [ ] Status is not conveyed by color alone.
- [ ] Screen-reader labels exist on primary interactive controls.
- [ ] Keyboard/input focus does not hide the active critical field/action.

## Role-coverage status

### Available now

- Standalone Partner portal identity: available for real-device UAT.
- Employee self/hierarchy/organization contracts: previously verified by production contract testing and CI.

### Still requires explicit UAT arrangement

- [ ] Partner family with active POSP child.
- [ ] Partner family with active MISP child.
- [ ] Dedicated reusable Google Play reviewer/demo account.

Do not use a real production user's credentials as the Google Play reviewer account.

## Google Play requirements — verified 2026-09-01

### Technical

- [x] Android target API requirement: API 36. Expo SDK 54 targets API 36.
- [ ] Final Google Play artifact: Android App Bundle (AAB), not preview APK.
- [ ] Final production build must be created only after explicit native-build authorization.
- [ ] Confirm the generated AAB target SDK / permissions in Play Console after upload.
- [ ] Use EAS remote app-version source / autoIncrement; do not assume `app.json` `versionCode: 1` is the final Play version code.
- [ ] Run Play pre-review checks on the uploaded final AAB.

Official references:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://docs.expo.dev/versions/v54.0.0/
- https://support.google.com/googleplay/android-developer/answer/9844679

### Privacy / App content

- [x] Public privacy policy exists and is live.
- [x] Partner Settings exposes Privacy Policy in-app.
- [ ] Enter the privacy-policy URL in Play Console.
- [ ] Complete Data Safety accurately against the final binary and actual backend behavior.
- [ ] Declare whether the app contains ads.
- [ ] Complete target audience/content declaration.
- [ ] Complete IARC content-rating questionnaire.
- [ ] Complete any permission declarations Play Console surfaces from the final AAB.
- [ ] Provide app-access/sign-in instructions for review.
- [ ] Supply a dedicated reusable test/demo account; do not supply a production user's credentials.
- [ ] If the Play developer account is a personal account created after 13 Nov 2023, confirm whether the 12-testers-for-14-days production-access rule applies and complete it before production application.

Official references:
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/9859455
- https://support.google.com/googleplay/android-developer/answer/15748846
- https://support.google.com/googleplay/android-developer/answer/9859655
- https://support.google.com/googleplay/android-developer/answer/14151465

### Store listing assets

Current repository Partner assets contain only `partner-app-icon.jpg`.

Still required/prepared separately:

- [ ] Google Play store icon: 512 × 512, 32-bit PNG, max 1024 KB.
- [ ] Feature graphic.
- [ ] Minimum two compliant phone screenshots.
- [ ] App name/store title review.
- [ ] Short description.
- [ ] Full description.
- [ ] Support/contact details.
- [ ] Store category/tags.
- [ ] Verify screenshots match the final UAT-approved UI.

Official reference:
- https://support.google.com/googleplay/android-developer/answer/9866151

## Native-build-only / final-stage bucket

Do not implement or build these merely to continue UAT.

- final signed production Android AAB;
- any newly approved native date-picker package;
- any newly approved native push-notification capability/configuration;
- native permission/config changes identified from final release needs;
- final version-code/build-number generation;
- any app-signing / Play App Signing setup that requires the release artifact.

Before the final native build:
1. close installed-device UAT;
2. resolve all OTA-safe P0/P1 findings;
3. freeze final native scope;
4. explicitly authorize the Partner production AAB build;
5. build once from exact verified `main`;
6. inspect target SDK, permissions, version code, signing and bundle in Play Console;
7. use that exact artifact for the appropriate Play testing/release track.

## Current release decision

**NOT READY FOR FINAL AAB YET — UAT / Play preparation in progress.**

The OTA-safe application refinement is complete and the current preview build is suitable for device UAT. Remaining blockers are device evidence, child-family role coverage, dedicated Play reviewer access, store-listing assets/declarations, and the explicitly deferred final native AAB stage.

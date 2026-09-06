# INSUREIT Partner — Phase 6 native build review

> Date: 2026-09-06 IST
> Scope: pre-build dependency / runtime / permission review only
> Status: REVIEW COMPLETE / NATIVE IMPLEMENTATION NOT YET AUTHORIZED

Read this with:

- `AGENTS.md`
- `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`
- `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`
- `docs/PARTNER_APP_POLICY_INTAKE_CRASH_HOTFIX_2026_09_06.md`

## Current accepted OTA baseline

The latest installed Partner preview baseline that was device-confirmed for the New Policy Intake regression is:

- root-cause fix PR: #1375
- root-cause merge: `27a7dd42c96c05e34a0fec8ad86a4470e040a269`
- Partner Verify: #200 / `34046543932` — success
- Web Verify: #3065 / `34046543931` — success
- corrective Partner preview OTA: #48 / `34046755723` — success
- OTA trigger: `774ba2932c52678a8851f9eb5ed054e1545017d0`
- device result: user confirmed New Policy Intake is fixed

A compare from OTA #48 trigger to later `main` showed no changes under `apps/partner-app`; later commits were web/schema/docs only. Therefore OTA #48 remains the current Partner mobile source baseline until a later Partner OTA/native change is intentionally published.

## Current Partner native identity

Current config:

- app name: `INSUREIT Partner`
- Android package: `com.insureit.partner`
- iOS bundle: `com.insureit.partner`
- Expo owner: `insureitapp`
- slug: `insureit`
- EAS project: `8ade82c1-4c96-4f09-b90b-802270fb406d`
- app version: `0.1.0`
- Android version code: `1`
- iOS build number: `1`
- runtime policy: `appVersion`
- preview channel: `preview`
- production channel: `production`

The pre-APK guard intentionally blocks native dependency drift and requires 0.1.0 during the OTA-only phase.

## Recommended Phase 6 native bundle

The objective is one deliberately batched preview binary, not one build per feature.

### Include in the batch

1. **Native date picker**
   - package: `@react-native-community/datetimepicker`
   - SDK 54 recommended line: `8.4.4`
   - purpose: replace deferred manual/date-input UX with native date selection where the Partner app already has date-filter/date-entry requirements.

2. **Push notifications**
   - package: `expo-notifications`
   - SDK 54 recommended line: `~0.32.17`
   - purpose: renewal due, claim updates, Policy Intake attention/approval/rejection, missing document, payout events.
   - requires new native binary and notification credentials/config.
   - Android remote push cannot be validated in Expo Go; installed build testing is required.

3. **Network-state awareness**
   - package: `expo-network`
   - SDK 54 recommended line: `~8.0.8`
   - purpose: distinguish offline / reconnect from server failures and drive the existing Partner stale/offline UI.
   - Android network/Wi-Fi state permissions are added by the module.

4. **Biometric local re-entry**
   - package: `expo-local-authentication`
   - SDK 54 recommended line: `~17.0.9`
   - purpose: optional local privacy gate after a defined background interval.
   - this must never replace Supabase/server authentication.
   - iOS Face ID requires an explicit usage description in native config.

5. **Selective screen privacy**
   - package: `expo-screen-capture`
   - SDK 54 recommended line: `~8.0.10`
   - purpose: protect only approved PII/document-heavy routes.
   - do not globally disable screenshots.
   - avoid screenshot-listener permissions on older Android unless there is a real product requirement; blocking capture itself does not require adding broad photo permissions.

6. **Haptics**
   - package: `expo-haptics`
   - SDK 54 recommended line: `~15.0.8`
   - purpose: lightweight success/error/selection feedback on a small number of high-value actions.
   - Android vibration permission is handled automatically by the library.

### Crash telemetry — conditional, not automatically bundled

Recommended platform: Sentry via `@sentry/react-native` / Expo-supported setup.

Do **not** install it blindly in the same commit until the project has:

- a Sentry organization/project;
- DSN;
- source-map upload auth token stored as a secret;
- privacy/redaction rules agreed;
- OTA source-map upload integrated into the Partner update workflow.

If those prerequisites are ready before the one native build, include Sentry in the same Phase 6 binary. Otherwise do not delay the native bundle merely to add an unconfigured crash SDK; the current app-level recovery boundary remains in place and Sentry can be handled as a separately approved native change later.

## Notification configuration requirement

Phase 6 push configuration should use the `expo-notifications` config plugin and define:

- Android notification icon;
- brand-safe notification tint color;
- default notification channel;
- deep-link handling through the existing `insureit-partner` scheme / Expo Router paths;
- credentials through EAS / platform push configuration.

### Missing asset — blocker before the native build

No dedicated notification tray icon was found in the repository during this review.

Do **not** use the full-color JPG app icon as the Android notification small icon. Prepare a brand-approved monochrome notification glyph as a transparent PNG suitable for Android notification rendering before the Phase 6 binary is built.

This asset should be derived from official INSUREIT brand artwork, not invented or AI-redesigned.

## Runtime/version strategy for the one Phase 6 preview build

Because runtime policy is `appVersion`, the native-capability build should move the Partner app off 0.1.0 so old 0.1.0 OTA updates cannot target the new native binary accidentally.

Recommended preview-native identity:

- app version: **0.2.0**
- Android versionCode: **2**
- iOS buildNumber: **2**
- runtime policy: keep **`appVersion`** for this controlled build
- EAS preview channel: keep **`preview`**

Do not change package/bundle IDs, Expo owner, slug or EAS project ID.

After the 0.2.0 native preview is installed, all later JS/TS updates for that binary must be published against runtime 0.2.0. The 0.1.0 installed binary remains on its own compatible OTA runtime.

## Pre-APK guard transition

`verify-pre-apk-freeze.mjs` currently correctly blocks:

- `@react-native-community/datetimepicker`
- `expo-notifications`
- `expo-local-authentication`
- `expo-screen-capture`
- `expo-haptics`

When Phase 6 implementation is explicitly approved, do not simply delete the guard.

Replace it with a **Phase 6 native manifest contract** that requires the exact approved dependency set, exact app/runtime version, package identity, notification plugin configuration and EAS channel mapping. This prevents silent native scope growth after approval.

## Implementation order after explicit approval

1. Create one dedicated Phase 6 branch from exact current `main`.
2. Bump Partner app/runtime identity to 0.2.0 / versionCode 2 / buildNumber 2.
3. Install only the approved native packages with `npx expo install` so SDK-compatible versions are selected.
4. Add notification plugin/config + approved notification icon asset.
5. Implement native date-picker integration on the already-deferred Partner date flows.
6. Add shared network-state provider and connect it to existing offline/stale UI.
7. Add optional biometric re-entry setting + background-duration policy.
8. Apply screen-capture prevention only to approved sensitive routes.
9. Add restrained haptics to selected success/error/selection actions.
10. If Sentry prerequisites are ready, add Sentry with PII redaction and EAS Update source-map upload.
11. Replace pre-APK freeze with exact Phase 6 native-manifest CI.
12. Run Partner typecheck/lint/route/security/native-manifest checks.
13. Review generated native config (`expo config` / prebuild inspection) before consuming an EAS build.
14. Create **one** preview APK only after explicit user authorization for that exact build.
15. Install and complete the Phase 6 device matrix.
16. Publish a small 0.2.0 preview OTA afterward to prove OTA compatibility with the new binary.

## Device acceptance matrix for the one native preview build

### Startup / auth

- cold start
- warm start
- background > configured biometric interval
- biometric success
- biometric cancel/failure/passcode fallback policy
- sign out / sign in
- no cross-user protected cache

### Network

- normal Wi-Fi/mobile data
- airplane mode
- network lost while viewing list/detail
- reconnect
- network lost during Policy Intake preparation/upload/submission
- stale/offline state must be distinguishable from server error

### Push

- foreground notification
- background notification
- killed-app notification open
- notification permission denied
- notification permission later enabled
- deep link to authorized Policy Intake / Claim / Renewal destination
- unauthorized/stale deep link must fail safely

### Privacy

- screenshot allowed on ordinary screens
- screenshot blocked only on approved sensitive screens
- app switcher/background appearance reviewed

### Date picker

- open/cancel/select
- minimum/maximum date constraints where applicable
- Android back gesture
- selected date survives navigation as designed

### Haptics

- no continuous/noisy feedback
- success/error feedback only at defined actions
- app remains fully understandable with haptics disabled/unavailable

### Regression smoke

- Home
- Business
- Policies
- Claims
- Customers
- Renewals
- New Policy Intake complete submission
- Policy Intake detail/replacement
- Search
- Support
- Settings
- Profile
- session/OTA refresh behavior
- historical vehicle-selector and claim-number popup regressions remain protected

## Explicitly not authorized by this document

This review does **not** authorize:

- package installation;
- app.json native plugin changes;
- version/runtime bump;
- Sentry setup;
- push credentials;
- APK/AAB creation;
- production-channel build;
- Play Store release.

The master-plan build gate remains unchanged: a new Partner native binary requires explicit user approval for that exact build.

## Current decision

Recommended native Phase 6 preview bundle:

**Date picker + Notifications + Network + Biometrics + Selective Screen Privacy + Haptics**, with Sentry included only if its external project/secret prerequisites are ready before the build.

Before implementation/build, obtain:

1. explicit user approval to start Phase 6 native implementation;
2. explicit approval for the exact first 0.2.0 preview APK build before triggering EAS Build;
3. official monochrome Android notification small-icon asset.

# INSUREIT Partner — Pre-APK OTA Freeze

> Date: 2026-09-04  
> Status: IN PROGRESS — OTA-compatible scope being finalized  
> Current runtime: `0.1.0`

## Hard rule

Do not start a fresh Partner APK/native build until all reasonable work that can safely ship through the existing runtime has been completed, verified and visually accepted.

## Already completed without a new APK

- Phase 0–5 production refinement and resilience work;
- action-first Home and grouped More navigation;
- shared loading/error/retry/empty states;
- custom Partner feature artwork and compact icon/title layout;
- Activity / Your Week / Impact / Journey / Recognition polish;
- Partner query cache, stale-data and auth lifecycle hardening;
- Partner OTA publish/rollback workflow protection;
- explicit Phase 6 native-capability review;
- visual-readiness Partner OTA published on 2026-09-04.

## Current pre-APK readiness batch

- explicit in-app **Check for updates** control using the already embedded `expo-updates` runtime;
- fixed Partner notification/deep-link destination contract without adding a notifications native module;
- CI pre-APK freeze guard that blocks unapproved native dependencies while runtime `0.1.0` is frozen.

## Remaining OTA-safe audit buckets

These must be checked before the native phase is opened:

1. visual acceptance on the current installed preview app;
2. route/deep-link contract review for future notification destinations;
3. UAT/security checklist for login, customers, policies, claims, renewals, Policy Intake, business, support and scope boundaries;
4. final accessibility/state audit for any P0/P1 issue that is JS/style-only;
5. final OTA publish + rollback verification evidence;
6. final documentation checkpoint declaring runtime `0.1.0` OTA scope frozen.

## Explicitly native-only / deferred to fresh APK phase

- native date picker;
- native device network-state module;
- biometric re-entry/app lock;
- selective screen-capture/privacy controls;
- `expo-notifications` client integration and notification channel/icon configuration;
- native crash-reporting SDK;
- haptics.

Push-notification backend/token preparation may be designed before the native build, but the native client module itself remains outside the OTA freeze.

## Exit gate for OTA phase

The current OTA-only phase may be declared frozen only when:

- current visual-readiness OTA is accepted or its defects are fixed through OTA;
- all Partner verification gates are green;
- pre-APK freeze verification is green;
- no known P0/P1 OTA-fixable defect remains;
- remaining work is explicitly classified as native-build-required or post-build UAT/release work.

Only after this gate is met should the exact native dependency batch be approved and a fresh Partner preview APK be created.

# INSUREIT Partner — Phase 6 Native Capability Review

> Date: 2026-09-03  
> Status: REVIEW COMPLETE — EXACT NATIVE BATCH / BUILD APPROVAL REQUIRED  
> Applies to: `apps/partner-app`  
> Current runtime: `0.1.0`

## Current verified native baseline

The Partner runtime currently uses `expo-secure-store`, `expo-document-picker`, `expo-updates`, Expo Router and React Native core modules.

Already present:
- AppState-driven auth/session refresh;
- scope-isolated JS query cache;
- stale/offline fallback based on request-failure classification;
- sanitized `reportPartnerError()` observability seam;
- Partner-specific Expo/EAS identity;
- protected exact-main Partner preview APK and OTA workflows.

Not declared in the current Partner package:
- `@react-native-community/datetimepicker`
- `expo-notifications`
- `expo-local-authentication`
- `expo-screen-capture`
- `@react-native-community/netinfo`
- `expo-haptics`
- a native crash-reporting SDK

## Prior native work

The Partner app icon is already configured in `app.json` for Android, iOS and the Expo icon field. Repository history shows an approved Partner native icon-build trigger on 2026-08-30.

This review does not treat any new APK/native build as authorized merely because that prior build was approved.

## Candidate matrix

| Capability | Native dependency | Value | Build / backend impact | Recommendation |
| --- | --- | --- | --- | --- |
| Native date picker | `@react-native-community/datetimepicker` | High | Requires new binary; already intentionally deferred from runtime 0.1.0 | **Include in next approved native batch** |
| Network state | `@react-native-community/netinfo` | Medium/High | Requires new binary; can feed the existing query/offline layer | **Include in next approved native batch** |
| Biometric re-entry | `expo-local-authentication` | Medium | Requires new binary; local privacy gate only, not server auth | **Include only if local app lock is desired** |
| Selective screen privacy | `expo-screen-capture` | Medium | Requires new binary; should apply only to sensitive PII/document screens | **Include only if privacy shielding is desired** |
| Push notifications | `expo-notifications` | High | Requires new binary plus token registration, credentials, event delivery and authorized deep-links | **Prepare first; build only when backend delivery is ready** |
| Native crash reporting | provider-specific SDK | High | Requires provider selection, privacy/redaction review and native build | **Defer until provider is explicitly selected** |
| Haptics | `expo-haptics` | Low | Native capability in the binary | **Defer** |

## Recommended next native batch

To protect build quota, the next Partner preview APK should be one deliberate batch.

Minimum recommended set:
1. native date picker;
2. native network-state integration;
3. Partner app icon remains configured;
4. biometric re-entry only if explicitly desired;
5. selective privacy shielding only if explicitly desired.

Push notifications should join the same build only if token storage, event delivery and notification credentials are ready before the build. Adding only the client module would create a half-finished native capability and increase the chance of another rebuild.

## Push notification readiness requirements

Before adding `expo-notifications`:
- dedicated Partner device-token storage scoped to authenticated user/device;
- token registration/update/revocation lifecycle;
- no Customer-app token/project reuse;
- notification payload contract using authorized route identifiers;
- destination authorization when a notification is opened;
- event sources for renewal due, claim status change, Policy Intake attention/result, missing document, and authorized payout events where applicable;
- Android notification channel/icon decision;
- FCM/APNs/Expo credential readiness;
- no sensitive identifiers in notification preview text beyond the approved minimum.

## Build gate

This review does **not** authorize dependency additions, runtime compatibility changes, APK/AAB triggers or native builds.

The exact package set must be explicitly approved before implementation. Any preview build must originate from exact current `main` through the protected Partner build workflow.

## Next actions after exact native-batch approval

1. create one Phase 6 implementation branch;
2. add only the approved native dependencies;
3. change runtime/version only as required by the approved compatibility strategy;
4. wire date picker and network state into the existing UI/data abstractions;
5. add any approved biometric/privacy/notification capabilities;
6. run Partner verification;
7. merge only after exact checks are green;
8. trigger exactly one protected Partner preview APK;
9. verify native behavior on the installed app;
10. verify OTA compatibility after installing the new binary.

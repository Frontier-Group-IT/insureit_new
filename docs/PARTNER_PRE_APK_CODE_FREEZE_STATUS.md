# INSUREIT Partner — Pre-APK Code Freeze Status

> Date: 2026-09-04  
> Runtime: `0.1.0`  
> Status: CODE-SIDE FREEZE READY — INSTALLED-APP VISUAL/UAT ACCEPTANCE PENDING

## Verified code-side readiness

The current Partner runtime now has:

- action-first Home and grouped More navigation;
- shared loading, empty, offline, error and unauthorized states;
- error-boundary recovery and sanitized observability seam;
- scope-isolated query caching and foreground/background session refresh;
- Policy Intake draft/retry/replacement protections;
- shared accessibility/touch-target contracts;
- explicit Settings → Check for updates using the already embedded `expo-updates` runtime;
- a constrained internal Partner destination contract for future notification/deep-link use;
- a CI pre-APK freeze guard that blocks unapproved native dependencies from runtime `0.1.0`;
- critical-flow UAT/security contracts for scoped Customers, Policies, Claims, Support, sign-out, OTA/privacy and Policy Intake routing;
- exact-main Partner preview OTA publishing with Partner/Customer EAS identity separation;
- manual-only Partner preview rollback to the embedded runtime, protected by exact-main and Partner identity checks.

## Current release evidence

- visual-readiness Partner preview OTA #42 published successfully on 2026-09-04;
- Partner verification after the pre-APK readiness hardening passed route, Phase 5, freeze, typecheck, lint and Expo web-review build;
- Partner UAT/security verification passed before merge;
- Customer preview OTA was not published as part of the Partner visual-readiness OTA;
- no fresh Partner APK/AAB was created during this freeze work.

## Remaining acceptance before native phase

Only installed-app acceptance remains for the current OTA runtime:

1. complete the visual-readiness review on the installed Partner preview app;
2. run the manual critical journeys in `PARTNER_PRE_APK_UAT_CHECKLIST.md`;
3. record/fix any P0/P1 defect that can still be corrected by OTA;
4. confirm that remaining items are native-only or post-native installed-device checks.

## Native-only batch remains locked

No dependency addition or new Partner APK/AAB is authorized by this status document.

Still deferred to the separately approved native phase:

- native date picker;
- native network-state module;
- biometric re-entry, if selected;
- selective screen privacy, if selected;
- push-notification client/channel/icon integration when backend readiness is complete;
- native crash-reporting provider, if selected;
- haptics, if justified.

The next native build should remain one deliberate batch after installed-app acceptance and explicit build approval.

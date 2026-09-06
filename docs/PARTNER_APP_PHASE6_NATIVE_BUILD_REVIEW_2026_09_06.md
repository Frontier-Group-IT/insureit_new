# INSUREIT Partner — Phase 6 native build review and implementation handoff

> Date: 2026-09-06 IST
> Scope: Phase 6 dependency / runtime / permission review + approved native-foundation implementation
> Status: FOUNDATION MERGED / NATIVE APK NOT YET AUTHORIZED OR BUILT

Read this with:

- `AGENTS.md`
- `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`
- `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`
- `docs/PARTNER_APP_POLICY_INTAKE_CRASH_HOTFIX_2026_09_06.md`

## Accepted pre-Phase-6 installed baseline

The last installed Partner preview binary/runtime confirmed on-device before the native transition remains 0.1.0 with corrective OTA #48:

- Policy Intake root-cause PR: #1375
- merge: `27a7dd42c96c05e34a0fec8ad86a4470e040a269`
- Partner Verify #200 / `34046543932` — success
- Web Verify #3065 / `34046543931` — success
- corrective Partner preview OTA #48 / `34046755723` — success
- OTA trigger: `774ba2932c52678a8851f9eb5ed054e1545017d0`
- device result: user confirmed New Policy Intake is fixed

The existing installed 0.1.0 binary remains on runtime 0.1.0. Do not publish 0.2.0 OTA work as a substitute for the required 0.2.0 native build.

## Phase 6 implementation authorization and foundation merge

The user explicitly approved continuing Phase 6 implementation on 2026-09-06, while the actual EAS native APK build remained separately gated.

Foundation branch:

`partner/phase6-native-foundation`

Foundation PR:

**#1383 — Prepare Partner 0.2.0 Phase 6 native foundation**

Final PR head:

`1f8c592de255651692f11343bf80dcbbcd444454`

Merge:

`4b814396c3d0a23f8f2391c9be9a2de49df06eeb`

Final exact-head gates:

- Partner Verify #204 / `34050214704` — success
- Customer mobile Verify #664 / `34050214734` — success
- Web Verify #3078 / `34050214683` — success
- Phase 6 native-manifest/foundation contract — success
- pre-APK UAT/security contract — success
- Partner typecheck — success
- Partner lint — success
- Expo web review export — success

One earlier validation run found only a TypeScript narrowing issue in the NetInfo status helper. It was corrected before merge. The canonical runner also generated the exact dependency lockfile once; temporary write-enabled bootstrap permission was removed before the final green head. Final CI is read-only again.

No Partner OTA, APK or AAB was triggered by the foundation merge.

## Partner 0.2.0 native identity now in source

Merged source baseline:

- app name: `INSUREIT Partner`
- Android package: `com.insureit.partner`
- iOS bundle: `com.insureit.partner`
- Expo owner: `insureitapp`
- slug: `insureit`
- EAS project: `8ade82c1-4c96-4f09-b90b-802270fb406d`
- app version: **0.2.0**
- Android versionCode: **2**
- iOS buildNumber: **2**
- runtime policy: **appVersion**
- preview channel: `preview`
- production channel: `production`

Because runtime policy is `appVersion`, future 0.2.0 OTA updates target only a compatible 0.2.0 binary. The current installed 0.1.0 binary cannot consume them.

## Approved and merged native dependency set

Exact merged SDK 54 dependency versions:

1. `@react-native-community/datetimepicker` — `8.4.4`
2. `@react-native-community/netinfo` — `11.4.1`
3. `expo-notifications` — `~0.32.17`
4. `expo-local-authentication` — `~17.0.9`
5. `expo-screen-capture` — `~8.0.9`
6. `expo-haptics` — `~15.0.8`

Sentry was intentionally not added because a configured Sentry project, DSN, upload token and redaction/source-map policy were not established. Do not add it blindly later.

## Foundation behavior now merged

### Network awareness

`providers/partner-network-provider.tsx`

- listens to NetInfo;
- distinguishes unknown / online / offline;
- `PartnerScreen` and `PartnerListScreen` show a shared warning banner when offline;
- no business/data query authorization logic was changed.

### Optional biometric re-entry

`providers/partner-biometric-lock-provider.tsx`

- disabled by default;
- user enables it explicitly from Settings;
- enablement itself requires successful local authentication;
- uses SecureStore only for the local setting;
- re-entry is requested after two minutes away from a ready authenticated Partner session;
- device credential fallback remains available;
- local biometric lock never replaces Supabase/server authentication;
- lock overlay offers Unlock or Sign out.

### Notifications foundation

`lib/partner-notifications.ts` and `providers/partner-native-runtime-provider.tsx`

- no permission prompt occurs on install/startup;
- Settings contains the user-triggered notification permission action;
- Android channel ID is `partner-updates`;
- notification response navigation is constrained by an internal Partner-route allowlist;
- no arbitrary/external notification URL is accepted;
- push-token persistence/server delivery pipeline is not yet implemented.

### Selective privacy helpers

`lib/partner-native-security.ts`

- screen-capture and app-switcher helpers exist;
- no global screenshot ban was introduced;
- route-level application is still a later Phase 6 slice and must remain selective.

### Haptics

`lib/partner-haptics.ts`

- safe best-effort selection/success/warning/error helpers;
- haptic failure can never block a business action;
- currently used only in selected native settings/biometric interactions.

### Native date picker

`components/ui/partner-date-picker.tsx`

- reusable native date control exists with Android/iOS handling, en-IN display and min/max support;
- it has not been forced into an unrelated screen merely to consume the dependency;
- wire it only where a real existing Partner date input/filter is identified.

## Native APK build safety — hardened

`.github/workflows/build-partner-preview.yml` is now manual-only.

The build requires the exact workflow input:

`BUILD_PARTNER_0_2_0`

It also verifies:

- exact current `main`;
- Partner EAS identity is separate from Customer;
- version/runtime is 0.2.0 / code 2 / build 2 / appVersion;
- official notification icon exists at `apps/partner-app/assets/notification-icon.png`;
- Phase 6 verification/typecheck/lint pass before EAS build.

A committed `.trigger-preview-build` file cannot auto-trigger the Partner native build anymore.

**Do not dispatch this workflow until the user explicitly approves that exact 0.2.0 preview APK build.**

## Notification small-icon blocker

No suitable Android monochrome notification small icon exists yet at the required Partner path.

Do not use the full-color JPG app icon as the Android notification tray icon and do not invent an AI/redesigned mark.

Repository audit found official web brand artwork at:

`apps/web-portal/public/assets/brand/insureit-mark.webp`

This may be used as the source for a brand-approved monochrome transparent notification glyph, but the derivative must still satisfy Android notification-icon requirements and should preserve the official INSUREIT mark. Until `apps/partner-app/assets/notification-icon.png` is intentionally prepared and reviewed, the native build workflow remains blocked by design.

## Remaining Phase 6 work before requesting native-build approval

1. Apply screen-capture protection only to clearly approved sensitive Partner routes; ordinary screens must remain screenshot-capable.
2. Design/implement secure Partner push-token registration and revocation without exposing service-role credentials or weakening Partner scope.
3. Define which server-side events actually produce Partner notifications and preserve scope/deep-link authorization.
4. Wire the native date picker only into genuine existing date fields/filters if present.
5. Prepare/review the official monochrome Android notification icon.
6. Decide whether Sentry prerequisites are ready; otherwise keep Sentry out of 0.2.0.
7. Run final native-config/source checks.
8. Obtain separate explicit user approval for the exact 0.2.0 preview APK build.
9. Build one internal preview APK.
10. Complete installed-device Phase 6 matrix.
11. Only after the 0.2.0 binary is installed and accepted, publish a small 0.2.0 preview OTA to prove post-build OTA compatibility.

## Device acceptance matrix for the future native preview build

### Startup / auth
- cold start
- warm start
- background > two-minute biometric interval
- biometric success
- biometric cancel/failure/device-credential fallback
- sign out / sign in
- no cross-user protected cache

### Network
- normal Wi-Fi/mobile data
- airplane mode
- network loss while viewing list/detail
- reconnect
- network loss during Policy Intake preparation/upload/submission
- offline state distinguishable from server error

### Push
- foreground notification
- background notification
- killed-app notification open
- permission denied
- permission later enabled
- deep link to authorized Policy Intake / Claim / Renewal destination
- unauthorized/stale deep link fails safely

### Privacy
- screenshots allowed on ordinary screens
- blocked only on approved sensitive screens
- app-switcher/background appearance reviewed

### Date picker
- open/cancel/select
- min/max date constraints where relevant
- Android back gesture
- selected date survives navigation as designed

### Haptics
- no continuous/noisy feedback
- feedback only at defined high-value actions
- app understandable when haptics unavailable

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

## Explicit build boundary

Phase 6 implementation is authorized and foundation code is merged.

The **actual Partner 0.2.0 native APK/AAB build is still NOT authorized** by this handoff or the prior user message. It requires a separate explicit approval before the manual build workflow is dispatched.

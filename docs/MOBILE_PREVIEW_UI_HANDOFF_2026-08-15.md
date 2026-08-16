# Mobile Preview UI Handoff - 2026-08-15

> **Scope:** Customer mobile app UI/workflow fixes completed around the Expo preview rebuild and GitHub `main` push on 2026-08-15.
>
> Future agents working on `apps/mobile-app` should read this with `docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md`, `docs/MOBILE_PREVIEW_RELEASE_STATE.md`, and `docs/CURRENT_CHAT_HANDOFF.md`.

## Verified Current State

**GitHub:** The completed mobile work was pushed to `origin/main`.

```text
Latest pushed main commit: 010359e20e0d530554fc24d8e5a874ed726dd277
Pushed range: 5aad21b9..010359e2
Branch used for repair work: repair/corrected-mobile-preview-20260814
```

**Crash repair:** A later SDK 54 preview APK built from `54d30cdd` opened for less than one second and closed on Android. The verified repository issue was an Expo SDK native dependency mismatch: `apps/mobile-app/package.json` and `package-lock.json` allowed a nested `react-native-safe-area-context@5.9.0` while Expo SDK 54 expected `5.6.2`.

```text
Fix commit: 5b3e31a0254a657363af5c55735fa8613256a189
Build trigger commit: 1754b679a8ac2345d03f1ce6c1b53de7073f3c17
Fixed OTA update group: 4f483072-05e0-4490-9cfa-836cd012a3d9
Replacement APK build ID: 18ee5654-d79b-4d87-b2da-58ce4315c1ee
Replacement APK versionCode: 4
Replacement APK URL: https://expo.dev/artifacts/eas/iDjBu-_QDD50SJjKzVde9h47HUiOZrHAoZ9elpw8hXU.apk
```

Do not use the broken APK build `b7e2f7a2-e0f0-4622-af9e-95e579448f9e` from commit `54d30cdd`.

**OTA-only crash mitigation:** The user reported the versionCode 4 standalone APK still opened for less than one second and closed, while the app opened inside Expo Go. Per user instruction, do not build another APK until explicitly told. Commit `194d14b1` removed the Gluestack/Uniwind startup path from `_layout.tsx` and replaced the Home screen Gluestack text/layout components with plain React Native primitives. This was published as Expo preview OTA runtime `0.2.0`.

```text
OTA fix commit: 194d14b1
Latest OTA update group: 5397a572-6ebf-40ee-a29d-7cde018cf3ac
Earlier duplicate OTA update group: c8027fb4-6743-4086-a70c-cc32e4d09a46
Message: Remove Gluestack startup path OTA 2026-08-15
```

If the standalone APK still closes before applying this OTA, get Android `adb logcat` from package `com.insureit.mobile`. Do not queue or build a new APK unless the user explicitly approves it.

**Safe-startup OTA diagnostic:** After the first OTA mitigation still did not recover the standalone APK, commit `b94be884` replaced the mobile root with a minimal Expo Router stack and changed `app/index.tsx` to a plain React Native diagnostic screen (`InsureIT` / `Safe startup diagnostic loaded.`). No APK build was triggered. The OTA-only GitHub workflow succeeded and published runtime `0.2.0` update group `c7e0cf80-db9b-4530-9fa9-cd8f2ff10a4f` with message `Safe startup diagnostic OTA 2026-08-15`.

If this safe-startup OTA also does not appear on the standalone APK after multiple opens, the installed binary is crashing before it can load/apply OTA JS. The next required evidence is Android `adb logcat`; do not keep shipping speculative OTA updates.

**VERIFIED native crash root cause:** ADB on the connected Nothing Phone (2a), Android 16, reproduced the standalone APK crash for package `com.insureit.mobile` versionCode `4`. The Android crash buffer showed:

```text
java.lang.NoSuchMethodError: No static method getDirectConverter(...)
at expo.modules.font.FontLoaderModule.definition(FontLoaderModule.kt:98)
```

This is an Expo native dependency mismatch: `expo-font@57.0.1` was resolved in the install tree while the APK used Expo SDK 54 native modules (`expo-modules-core@3.0.30`). OTA cannot repair this binary because the app dies while native Expo modules are registered, before OTA JavaScript can run. The repository dependency fix pins `expo-font` to SDK 54's `14.0.12` explicitly in the mobile app and via root npm overrides. The next APK build must use the cleaned lockfile; do not treat another OTA publish as a fix for this specific crash.

**IMPLEMENTED restore before next APK:** After the safe-startup diagnostic confirmed the binary was crashing before JS, the mobile root was restored to the full app startup shell: `AppLoadingProvider`, animated `SplashIntro`, `RealtimeNotificationProvider`, route-session redirect, and the Add Vehicle modal route are back in `apps/mobile-app/app/_layout.tsx` and `apps/mobile-app/app/index.tsx`. Android adaptive launcher icon foreground now uses the padded transparent `assets/brand/insureit-adaptive-foreground.png` instead of the full square icon, so the shield should not be cropped by Android circular masks. This icon change requires the next APK build; OTA cannot change the installed launcher icon.

**DEPLOYED preview APK rebuild:** EAS preview Android APK build `16a2b597-47f2-4d5d-805b-22bc235c596f` finished successfully from commit `01263bed261f2151afce31d0661914ecbbc91cf4`, runtime `0.2.0`, versionCode `4`, fingerprint `d2d351215ec052afec94b873767ad192a20055d9`. APK URL: `https://expo.dev/artifacts/eas/t-sie-tZlXQSJdjW7Jmwme8VP4kfWIQ1ybsQkOrMO44.apk`. Pre-build checks passed: mobile typecheck, `expo install --check`, Android export. ADB install verification was not completed because the device disconnected and `adb` reported no devices.

**IMPLEMENTED pending next APK:** The Android adaptive launcher foreground was regenerated from the clean InsureIT shield at smaller scale on a 1024x1024 transparent canvas, with a local circular preview confirming the shield sits within the Android circular mask. This launcher icon change requires a new APK. The in-app `SplashIntro` was redesigned to use the real auth brand assets (`wave-top-right`, `wave-bottom-left`, `shield-watermark`, `pay-challan-logo`, `get-quote-logo`) with subtle animated floating, pulse, and progress motion. The splash animation is JS and can ship by OTA; the launcher icon cannot.

**DEPLOYED preview OTA:** The refined splash animation was published to Expo `preview` runtime `0.2.0` from commit `ccaee6ab78a78c3143671abb62767acd2795bcf0`. Update group `5f8ee107-f6ad-4434-9a52-4e177121a6cd`; Android update `01a00674-4274-72a9-b945-64de6e33147d`; iOS update `01a00674-4274-788d-8a3a-06d792902b55`. Pre-publish checks passed: mobile typecheck and Android export. Launcher icon padding remains pending next APK because launcher icons cannot change by OTA.

**IMPLEMENTED simplified splash:** Per user direction, `SplashIntro` now shows only the InsureIT shield, brand name, and `YOUR SAFETY, OUR PROMISE` tagline on a light screen with subtle zoom/glow/pulse. Removed service tiles, wave decorations, progress track, loading copy, and all "getting ready" style text. This is JS-only and can ship by OTA.

**DEPLOYED simplified splash OTA:** Published to Expo `preview` runtime `0.2.0` from commit `ca2d7695a017e0645d889ae2a43fac9ef4ade61d`. Update group `71db15f1-c620-4eea-8e0c-ea7642f27dbe`; Android update `01a00681-48b0-73fd-892a-86bede51b03b`; iOS update `01a00681-48b0-7126-b2f9-99c2f2657284`. Message: `Simplified brand splash OTA 2026-08-15`.

**DEPLOYED startup loading-copy removal OTA:** After the simplified splash, the app still showed the shared `LoadingState` text `Getting things ready` and placeholder cards during auth routing. Commit `b84bcc3191d3340d7a9b6384a5021e81999a7eca` removed the intermediate index loading screen and stripped the shared loader copy/placeholders so startup transitions from the branded splash directly to the app/login screen. Published to Expo `preview` runtime `0.2.0`; update group `5af673f3-a709-4448-aac5-6a094c0d7ffd`; Android update `01a00691-dc75-7ce6-bf18-a6a747c6df66`; iOS update `01a00691-dc75-7392-acd7-3635b07ba2f0`. Message: `Remove startup loading copy OTA 2026-08-15`.

**DEPLOYED individual dashboard redesign OTA:** Commit `196724b7847e93efaa7ac0160598d2aab1cc393a` redesigns the individual customer home dashboard only. It preserves the existing routes and adds a state-driven live hero, attention rail, fleet/protection snapshot, contextual quick actions, claim journey card, support action center, pull-to-refresh, synced time, and dashboard inclusion of customer-added `external_policies` in policy/renewal/protection counts. Published to Expo `preview` runtime `0.2.0`; update group `9f877078-dc12-43e4-a2ec-64a09739c83a`; Android update `01a006bc-f842-724c-b321-36e4493dbe63`; iOS update `01a006bc-f842-72c1-862a-9f41949b81f1`. Message: `Redesign individual customer dashboard 2026-08-16`.

**DEPLOYED compact individual dashboard refinement OTA:** Commit `4bf2f6956e7cdb777729f8929ac071849c26df92` compacts the individual customer dashboard after user review. It removes the large renewal/live hero and the separate Renewals/Claims/KYC attention cards, replaces `Synced` text with a small cloud-check timestamp pill, makes the attention count look actionable, moves the compact `YOUR FLEET SUMMARY` section directly under the greeting, removes vehicle RC plates from the dashboard, replaces the single-claim journey card with an all-claims summary card that opens `/customer/claims`, and simplifies Claims Desk with compact Call/WhatsApp/Ticket action tiles. Published to Expo `preview` runtime `0.2.0`; update group `27cf7eb4-f8d0-4b6a-b45e-d6deac1eb38d`; Android update `01a006e5-089c-7d99-85c9-f353a665fd36`; iOS update `01a006e5-089c-762b-a427-8c0063985bb3`. Message: `Compact individual customer dashboard 2026-08-16`.

**DEPLOYED final individual dashboard fleet refinement OTA:** Commit `0e8c96e7ce318ab63c9cbdd2ef84a4a487741efe` refines the same individual customer dashboard after user review. It removes button-like backgrounds from the attention and sync metadata, keeps the attention count as colored clickable text, rebuilds `YOUR FLEET SUMMARY` with the title at top-left, vehicle count and protection copy on the left, larger fleet sketch in the top section, segmented green/red visual coverage ring, and a bottom ticker row for renewal due/expired counts instead of KPI cards. Published from current clean `main` commit `4966843b1c58352d11d8d921352b674c7732c618` to Expo `preview` runtime `0.2.0`; update group `f5909686-6b1c-42b2-b2d5-0844c5f159bd`; Android update `01a00901-6983-7486-b3f6-c757f7e06fd0`; iOS update `01a00901-6983-781e-b04d-edd72906614e`. Message: `Final customer dashboard fleet refinement 2026-08-16`.

**Expo preview:** The installed preview APK follows Expo branch/channel `preview`, runtime version `0.1.0`. The user does not need a new APK for these JS/layout changes unless the installed APK cannot consume OTA updates or a future change modifies native/runtime dependencies.

Published preview updates from this work:

```text
Rollback known-good external-policy state:
Update group ID: 47e3613e-916e-4992-b9a6-54402ff76d66

Safe mobile UI fixes after rollback:
Source commit: 14386b6e1845cd69db01be4f273acd97f295e06f
Update group ID: 3df274ee-c06b-4688-ab2e-f2b8dd8b82be

Universal bottom tabs and compact detail screens:
Source commit: ec286da421c3062d9faad8caf3c270c3b8aa5906
Update group ID: 0d4cdae8-3cc2-43f9-9d76-661bb0c2fb58

My Policies redesigned like Claims:
Source commit: 8b423a7eb6c9be60589f6b67c8c594d1f0c03cd8
Update group ID: 44cd3fd2-0898-4776-ab20-ac69cb277915

Global customer screen top spacing:
Source commit: a448b38268a216fd2c780d894f0cd8caec268a37
Update group ID: 54587825-98d0-44d4-bb78-a57238f6bfa0
```

The final Expo update was published before the commits were replayed onto `main`, so some Expo source commit hashes are from the repair branch. Equivalent changes now exist on `main` through the pushed commits listed below.

## Main Commits

```text
9f0e3371 Reapply mobile preview UI fixes safely
38101244 Record mobile preview recovery
383b8908 Unify mobile bottom tabs and detail screens
9055fca8 Record Expo preview mobile update
d8fa6e9f Redesign mobile policies list
c9449417 Record policies preview update
3bf6b89f Normalize mobile screen top spacing
010359e2 Record mobile top spacing preview update
```

Verification run before pushing to GitHub `main`:

```text
npm --workspace apps/mobile-app run typecheck
npm --workspace apps/mobile-app run build:web
```

Additional focused ESLint checks were run before the final Expo publish for the touched mobile files.

## What Was Changed

- Restored and preserved external-policy/self-managed-claim behavior after rollback.
- Reapplied the approved Add Policy, Add Vehicle, self-managed claim, and mobile UI fixes without removing the useful post-migration work.
- Added one shared `UniversalBottomTabs` implementation and routed customer/group tab bars through it.
- Hid the universal bottom bar while the keyboard is open to prevent the menu from lifting and getting stuck mid-screen.
- Redesigned Vehicle Detail and Policy Detail into compact app-like pages matching the current customer theme.
- Redesigned My Policies to visually match the current Claims page: search section, counted filter chips, colored cards, status badges, number boxes, warning strip, and footer CTA.
- Added shared `Screen` `topSpacing` variants and reduced the global gap below the fixed brand/logo header.
- Removed manual first-section negative top margins from major customer screens.

## Important Safeguards

- Do not remove or simplify external policy handling. Vehicle and policy screens must keep support for `external_policies`, `externalPolicyId`, and `source=external`.
- Self-managed claim flow is not a decorative UI state. Preserve `claim_service_mode`, `assistance_status`, and the external-policy source boundary.
- Do not replace `UniversalBottomTabs` with per-page bottom bars. Any new customer/group page should use the shared screen/page shell behavior.
- For new screens, do not compensate for header spacing with negative `marginTop`. Use `Screen topSpacing="default" | "compact" | "tight" | "legacy"` and only add local spacing inside the page content.
- Tiny internal negative offsets that belong to suggestion/helper panels are currently intentional and are not global header-gap fixes.
- Do not build a new APK for ordinary JS/layout updates. Use Expo preview OTA unless native dependencies, app config requiring a new binary, runtime version, package identifiers, permissions, or splash/native assets require a fresh build.
- After publishing an Expo OTA, testers should fully close and reopen the preview app. A second close/reopen may be needed after the update downloads.

## Actionable Follow-Ups

1. Real-device smoke test the latest preview update group `9f877078-dc12-43e4-a2ec-64a09739c83a`.
2. Check header spacing on Home, Vehicles, Vehicle Detail, Add Vehicle, Add Policy, Policies, Policy Detail, Claims, Support, Profile, and self-managed claim pages.
3. Confirm the bottom bar hides while typing and returns correctly after dismissing the keyboard.
4. Confirm vehicle cards still show external policy details where external policies exist.
5. Confirm Add Policy opened from a vehicle card keeps the vehicle number prefilled and non-editable.
6. Before the first production APK, do a full UI/UX pass for empty/loading/error states, text overflow, date/premium/IDV form behavior, and low-end Android keyboard behavior.
7. When the user asks for the final APK, run typecheck, focused lint, mobile web export, and a real-device preview smoke test first. Build a new APK only after those pass.
8. If the versionCode 4 replacement APK still closes instantly, connect the Android device with USB debugging and capture `adb logcat` for package `com.insureit.mobile`; do not continue guessing from EAS build success alone.

## Files To Inspect First For Related Work

```text
apps/mobile-app/components/ui.tsx
apps/mobile-app/app/customer/policies.tsx
apps/mobile-app/app/customer/vehicles.tsx
apps/mobile-app/app/customer/vehicle-detail.tsx
apps/mobile-app/app/customer/policy-detail.tsx
apps/mobile-app/app/customer/add-policy.tsx
apps/mobile-app/app/customer/add-vehicle.tsx
apps/mobile-app/app/customer/self-managed-claim.tsx
apps/mobile-app/app/customer/self-managed-claim-detail.tsx
apps/mobile-app/app/customer/self-managed-documents.tsx
apps/mobile-app/app/customer/self-managed-milestone.tsx
apps/mobile-app/app/customer/self-managed-spot-status.tsx
```

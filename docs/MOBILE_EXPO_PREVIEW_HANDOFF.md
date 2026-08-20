# Mobile Expo Preview Handoff

> **Created:** 2026-08-17 (IST)
>
> Mandatory read before any agent modifies `apps/mobile-app`, publishes to Expo, builds an APK/AAB, changes mobile runtime/native config, or verifies the installed mobile preview app.
>
> Never store secrets, Supabase anon key values, tokens, credentials, complete customer data, policyholder PII, private vehicle identifiers beyond already visible test labels, or `.env` values in this file.

## 1. Current Preview Contract

The customer mobile app is under:

```text
apps/mobile-app
```

Current Expo project:

```text
Account/project: antnish/insureit-mobile
Branch/channel: preview
Runtime version: 0.2.0
Android package: com.insureit.mobile
Installed preview APK version: versionName 0.2.0, versionCode 4
```

The installed preview app follows Expo Updates for branch/channel `preview` and runtime `0.2.0`. Ordinary JavaScript/layout changes can ship as OTA updates when they do not require native/runtime changes.

Do not change `app.json`, native dependencies, permissions, package/bundle identifiers, runtime version, SDK version, splash/native assets, or Expo plugins and then claim OTA is enough. Those changes can require a new preview build.

## 2. Mandatory Source-State Rule

Before publishing to Expo preview:

1. Inspect the current mobile diff.
2. Run focused validation for the changed files.
3. Commit the intended mobile source changes to `main`, unless the user explicitly asks for a temporary dirty publish.
4. Publish from the intended committed source state.
5. Confirm EAS metadata shows the expected commit and `isGitWorkingTreeDirty: false`.

Dirty publishes are discouraged because Expo shows the commit with `*` in the dashboard and future agents cannot reproduce the exact bundle from Git. If a dirty publish is unavoidable, record the exact dirty files and verify the phone UI directly before claiming success.

Use commands like:

```powershell
git status --short apps/mobile-app
npm --workspace apps/mobile-app run typecheck
npx eslint <changed-mobile-files> --quiet
npm --workspace apps/mobile-app run build:web
```

`npm audit` warnings from existing dependency state are not proof that the mobile change failed. Do not run broad dependency repairs during an OTA publish unless dependency work is the actual task.

## 3. Environment Rule

Expo public mobile environment values must be present when publishing. Missing `EXPO_PUBLIC_*` values can produce a bundle that crashes at startup with:

```text
Missing mobile app environment configuration.
```

When publishing from a temporary or clean worktree, ensure the existing mobile `.env` from the normal workspace is available to the publish command before `eas update`. Prefer copying the ignored `.env` file into the temporary worktree's `apps/mobile-app/.env` so Expo CLI logs `env: load .env` and exports the expected `EXPO_PUBLIC_*` names. Do not print, paste, commit, or document the values.

Safe pattern:

```powershell
$envFile = 'C:\Users\HP\Desktop\Codex-Projects\InsureIT\apps\mobile-app\.env'
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}
```

Then run `eas update` from `apps/mobile-app`. If Expo CLI does not show `env: load .env` / `env: export EXPO_PUBLIC_*` before bundling, stop and fix the publish environment before creating an update.

## 4. Publish Command

Use the existing preview branch/channel and keep runtime `0.2.0` unless a reviewed native/runtime change intentionally requires a new runtime/build.

```powershell
npx eas-cli update --branch preview --message "<clear release message>" --non-interactive --json
```

After publishing, verify the latest group:

```powershell
npx eas-cli channel:view preview --json
npx eas-cli update:list --branch preview --limit 1 --json
```

The expected fields are:

```text
branch: preview
runtimeVersion: 0.2.0
platforms: android, ios
gitCommitHash: expected committed source commit
isGitWorkingTreeDirty: false
```

## 5. Device Verification Is Mandatory

An Expo dashboard update with Android `Downloads > 0` and `Known launches: None` means the phone has fetched the update but has not launched that bundle yet.

Do not claim the change is reflected on the installed app based only on:

- Expo dashboard publish success
- `eas update:list`
- update group ID
- Android download count
- successful web export/build

Expo Updates commonly downloads a bundle on one cold start and applies it on the next cold start. After every preview publish, force-stop and relaunch the installed package twice over ADB, then inspect the affected screen and logs.

Required ADB flow:

```powershell
adb devices -l
adb logcat -c
adb shell am force-stop com.insureit.mobile
adb shell monkey -p com.insureit.mobile -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 15
adb shell am force-stop com.insureit.mobile
adb shell monkey -p com.insureit.mobile -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 10
adb shell pidof com.insureit.mobile
adb logcat -d -v time -s ReactNativeJS:V AndroidRuntime:E ExpoUpdates:V Expo:V
```

Then navigate to the actual changed screen and capture a screenshot:

```powershell
adb shell screencap -p /sdcard/insureit-mobile-verify.png
adb pull /sdcard/insureit-mobile-verify.png insureit-mobile-verify.png
```

Use visual inspection for the changed UI. If the relevant screen is blocked by data state, say that clearly and verify the closest reachable changed screen. Do not claim an unreachable downstream screen was verified.

## 6. Common Failure Modes

**Dirty update published but not reproducible**

- Symptom: Expo dashboard shows commit with `*` or `isGitWorkingTreeDirty: true`.
- Fix: commit the intended source changes, publish again from a clean source state, verify `isGitWorkingTreeDirty: false`.

**Downloaded but not applied**

- Symptom: Expo dashboard Android downloads increase, but known launches are missing or the UI still looks old.
- Fix: force-stop and relaunch the installed app twice. Confirm logs and screenshot.

**Wrong source state published**

- Symptom: app appears to go backwards or misses recent UI work.
- Fix: identify the latest intended mobile commit, publish from that state, and verify on-device.

**Missing environment**

- Symptom: startup crash with `Missing mobile app environment configuration`.
- Fix: republish from the intended source with mobile `.env` available to Expo CLI; verify Expo logs `env: load .env`, then verify two cold launches.

**Native/runtime mismatch**

- Symptom: app closes before OTA JavaScript can run, native module error, runtime mismatch, or changed native config is not reflected.
- Fix: OTA is insufficient. Build a new preview APK/AAB only after user approval.

## 7. Current Recent Preview Evidence

Latest verified preview OTA for the refined customer Start Claim screen:

```text
Source commit: cb3a5aa1de9c134f62f5fa5ff5f035af21e0c183
Message: Merge mobile Start Claim refinement
Update group ID: 3ba0c189-d6ac-4efc-8d30-d10d84c56d79
Android update ID: 01a01d3c-c4fb-799e-be08-e8dd10386091
iOS update ID: 01a01d3c-c4fb-7089-8b71-a07bed8a84c9
Runtime version: 0.2.0
GitHub Actions run: 32328604314
```

The OTA publisher checked out the exact merged source commit and completed successfully for both Android and iOS on the existing `preview` branch/runtime. Installed-device cold-launch and screenshot verification remained blocked because no Android device was connected through ADB in the publishing session.

Latest verified preview OTA wiring the previously unused Start Claim artwork into the live route:

```text
Source commit: 4aedc96e4c9dee6f6beb270ae993e25d06c25a66
Message: Render Start Claim artwork
Update group ID: e1cad678-a328-44cd-ba9f-b147fb1657d8
Runtime version: 0.2.0
GitHub Actions run: 32247962686
```

The route now imports and renders `assets/brand/start-claim/start-claim-hero.png` and `assets/brand/start-claim/start-claim-footer-scene.png`. Typecheck, focused ESLint, web export, and `git diff --check` passed. Android device `00078344S000834` completed a cold launch and displayed the Start Claim screen with the supplied hero artwork; the downstream claim-intimation flow also opened without matched fatal/runtime errors. The temporary authenticated publisher workflow was removed after publication.

Latest republished preview OTA for the current `main` claim workflow source:

```text
Source commit: 5335457b155f66e0a9176616628daa20a469a8de
Message: Republish current main claim workflow refinements
Update group ID: e3bb930a-e969-436e-9558-f74fa57f8f25
Android update ID: 01a019c5-5f37-79d8-a5ce-7553b6f6b54a
iOS update ID: 01a019c5-5f37-7899-93a9-e1c99c80a7f4
Runtime version: 0.2.0
GitHub Actions run: 32247346118
```

The external workspace supplied for comparison contained the same hashes as the committed `main` files for Start Claim, Spot Intimation, Spot Status, Claim Intimation/Claim Detail, and the supplied `spot-intimation` / `start-claim` artwork. The current OTA was republished from `main` to ensure those screens and assets are included in a fresh bundle. Android device `00078344S000834` completed two cold launches, logged `Running "main"` both times, remained alive, and showed no matched fatal/runtime or missing-environment errors. The fresh device screenshot rendered the restored fleet dashboard with the custom fleet and quick-action artwork; downstream claim-screen navigation was not re-run after the cold launch.

Latest verified preview OTA restoring the committed mobile preview source:

```text
Source commit: 8816aad97cde2e839980dd943e7757c0ce86c636
Message: Restore mobile preview app state
Update group ID: 22f4d8ae-3416-44e1-a406-aec9d412d00a
Android update ID: 01a019b8-b75b-79b4-a874-25b5b9a438f2
iOS update ID: 01a019b8-b75b-7b78-b08a-c8de53f3b653
Runtime version: 0.2.0
GitHub Actions run: 32246220731
```

The update was published from the exact clean source commit through the protected GitHub Actions Expo credential and EAS `preview` environment. Android device `00078344S000834` completed two cold launches, logged `Running "main"` both times, remained alive, and showed no matched fatal/runtime or missing-environment errors. A fresh screenshot verified the restored external Claim Journey at Claim Intimation with the shared navy customer bottom navigation.

Latest preview OTA continuing from the accident-time-picker baseline:

```text
Source branch: mobile/timepicker-spot-actions
Source commit: 2a442b90a7ed9c14d496ff432e698ccef9b64edc
Base commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Message: Refine external claim spot status actions
Update group ID: 7e49b25d-f0f6-4993-b630-6d072d29b192
Android update ID: 01a00e9b-4074-7469-b4f3-1b94da589f4f
iOS update ID: 01a00e9b-4074-7335-838a-c3b8be8e28a0
Runtime version: 0.2.0
EAS metadata: isRollBackToEmbedded false
Verification before publish: `npm --workspace apps/mobile-app run typecheck` passed; focused ESLint for `claim-detail.tsx`, `self-managed-spot-status.tsx`, and `request-claim-assistance.tsx` passed.
Publish environment: Expo CLI logged `env: load .env` and exported the expected `EXPO_PUBLIC_*` names.
Device verification: blocked because `adb devices` showed no connected device immediately after publish.
```

Included change:

- External/self-tracked claim detail now removes the `Get Help` quick action and lays out `Update Current Stage` plus `Request Assistance` as two equal side-by-side columns. Sankalp-managed claim actions are unchanged.

Latest approved preview OTA rollback to the user-requested accident-time-picker state:

```text
Source commit shown by EAS: 82780eb19151fc8acda6525489bd4bd18ea04687
Original source group republished: 662027d5-685b-4032-a1ab-7adca9b43ec1
Message: Rollback preview to accident time picker state
Update group ID: 41f252be-a386-4107-99a1-3078d283003a
Android update ID: 01a00e5c-f990-7740-82a6-e4eb0042ba9f
iOS update ID: 01a00e5c-f990-7a0b-9cef-dd9ac1a44579
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty true because this is an exact republish of the prior dirty OTA bundle.
Device verification: ADB two cold launches on Android device 00078344S000834 completed without a React Native startup crash; the installed app rendered the recovered time-picker-era dashboard.
```

**LEARNING:** after the user explicitly requested rollback to the accident-time-picker state, update groups `4e75c429-aa00-4477-bf78-7099897d13ce` and `720ee831-f0ee-4a64-a266-bdd267cffad3` are superseded. Do not republish them unless the user explicitly asks to move forward again.

Latest APK baseline build for this rollback point:

```text
Build type/profile: Android internal APK, EAS profile `preview`
Build ID: 2a32890c-3ffe-464c-8efa-5452937cd675
Source commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Git message: Refine external claim steps and time picker
Channel: preview
Runtime version: 0.2.0
App version: 0.2.0
Android build versionCode: 6
Artifact URL: https://expo.dev/artifacts/eas/R20RhbUSXx3qWoUpWlc6IdSqMtX5hZqH1WSt98lMik8.apk
Local artifact: apps/mobile-app/insureit-timepicker-preview-v6.apk
Build completed: 2026-08-17T06:43:04Z
```

This APK follows the `preview` channel, whose current latest OTA group is `41f252be-a386-4107-99a1-3078d283003a`. Build submission loaded EAS preview environment variables and used remote Android credentials. Device install verification was not completed in the same session because ADB disconnected after the artifact download.

Superseded preview OTA republished from current `main` after the policy-detail hero fix:

```text
Source commit: 5ee08148681f649a14e1844e74a9b9a2e6a4d1a2
Message: Republish current main with policy hero fix
Update group ID: 4e75c429-aa00-4477-bf78-7099897d13ce
Android update ID: 01a00e58-10b9-7cf2-bb4c-a3fca32464fe
iOS update ID: 01a00e58-10b9-7824-99d6-f2a69bca8022
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty false
Device verification: ADB two cold launches on Android device 00078344S000834 completed without a React Native startup crash; current dashboard rendered from the installed app. Source-state verification confirmed this publish includes the Policy Detail hero cap and the external-claim Spot Intimation accident time picker.
```

**LEARNING:** update group `720ee831-f0ee-4a64-a266-bdd267cffad3` was published from commit `00ab7309`, which fixed the hero but missed later `origin/main` work that arrived while publishing. It was superseded by `4e75c429-aa00-4477-bf78-7099897d13ce`, published from current commit `5ee08148`. Do not use `720ee831` as the current recovery target.

Superseded preview OTA with policy-detail hero fix reapplied on top of the time-picker/mobile UI state:

```text
Source commit: 00ab7309e26cead1d46b4c7d2967e31c98c5e247
Message: Fix policy detail hero on approved time picker state
Update group ID: 720ee831-f0ee-4a64-a266-bdd267cffad3
Android update ID: 01a00e4a-58de-7f51-b7bf-f33598088760
iOS update ID: 01a00e4a-58de-7aac-a1c7-984463678fc5
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty false
Device verification: ADB two cold launches on Android device 00078344S000834 completed without a React Native startup crash; the newer external-policy list UI rendered; Policy Detail for policy `4578` rendered with the hero content capped to the filled area and without the prior large blank expanded section.
Source-state verification: `apps/mobile-app/app/customer/self-managed-claim.tsx` still contains the external-claim Spot Intimation accident time picker (`TimePickerField`, `TimePickerModal`, `timePickerOpen`).
```

**LEARNING:** the earlier `Apply policy detail hero fix on time picker state` update group `2db69525-5f5d-4bc5-a08f-b9c2ae1b3c5b` did not fix the real blank-space issue on device. The actual working fix caps the Policy Detail hero layout height in `apps/mobile-app/app/customer/policy-detail.tsx` while preserving the restored time-picker state. Do not republish `2db69525` as a fixed point.

Latest user-intended external claim time-picker recovery publish:

```text
Source commit shown by EAS: 82780eb19151fc8acda6525489bd4bd18ea04687
Original source group republished: 662027d5-685b-4032-a1ab-7adca9b43ec1
Message: Restore working external claim time picker state
Update group ID: 5a9329d3-536f-4cba-b8b4-90fb9f41446f
Android update ID: 01a00e24-411a-7e2b-916f-661d370bef09
iOS update ID: 01a00e24-411a-72e3-bc14-ce4fd40a95ee
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty true because this is an exact republish of the prior dirty OTA bundle.
Device verification: ADB two cold launches on Android device 00078344S000834 completed without `Missing mobile app environment configuration`; dashboard rendered; external claim tracker opened and showed the current Spot Status stage.
```

**LEARNING:** when the user says the mobile app had later UI updates that were erased, do not rebuild only from the commit shown beside a dirty Expo update. Use `eas update:republish --group <original-group>` to preserve the exact OTA bundle. Group `e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5` and rebuilt group `6dd3e7da-86e4-4bf0-8287-a372f6233ec4` led to `Missing mobile app environment configuration` on the connected Android device. Exact republish group `f88a9bef-e9e3-40a1-b907-9e34994c5449` restored an earlier external-claim refinement, but the user identified the intended final working state as the later time-picker update. The current recovery point is `5a9329d3-536f-4cba-b8b4-90fb9f41446f`, exact republish of original group `662027d5-685b-4032-a1ab-7adca9b43ec1`.

Previous policy-detail hero-height recovery publish, superseded by the rollback above:

```text
Source commit: 15d87986e1264a1ab8b7e5a58b9d9723823c53c4
Message: Hotfix policy detail hero env publish
Update group ID: 8739257d-7689-48f3-aae7-bf0537a438fb
Android update ID: 01a00e0e-c852-72df-a9d1-3dd5cf893bae
iOS update ID: 01a00e0e-c852-739b-99fc-b92ee521668a
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty false
Device verification: ADB two cold launches on Android device 00078344S000834, app remained alive, current dashboard/policies UI rendered, and Policy Detail hero card rendered compact without the prior blank expanded area.
```

**LEARNING:** update group `252d828a-aa21-43af-ad3d-25a209e84955` was published from the same source commit but without the clean worktree `.env` file being loaded by Expo CLI. It crashed with `Missing mobile app environment configuration` and was superseded by `8739257d-7689-48f3-aae7-bf0537a438fb`. If a device launches the bad cached update once, force-stop and relaunch twice so Expo Updates can recover and apply the superseding group.

Previous clean external-claim refinement publish:

```text
Source commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Message: Clean worktree: external claim steps and time picker
Update group ID: e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5
Android update ID: 01a00c6d-e57a-7ce3-9d97-9ba72f1e69cb
iOS update ID: 01a00c6d-e57a-7532-9394-aaa12c76b1aa
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty false
```

The first Start Claim screen was verified to show the duplicate `Vehicle` section label removed. The deeper Spot Intimation/time-picker screen requires selecting a vehicle with an external policy; if the selected vehicle shows `No policy recorded for this vehicle`, the downstream time-picker screen is not reachable from that data state.

## 8. Handoff Updates

Latest verified self-managed claim tracker UX OTA:

```text
Source commit: b594c3ba479af19ecf155031fa83a6d269ab1dc8
Message: Publish self-managed claim tracker UX
Update group ID: 7fa30f15-623e-49a7-a25a-b1ffa9b36d28
Android update ID: 01a0196d-f2c4-7e2d-a097-86328d71382f
iOS update ID: 01a0196d-f2c4-7bbb-894f-f6ee2d29d1ab
Runtime version: 0.2.0
EAS metadata: gitCommitHash matched the clean current-main source commit
Publish note: EAS reported ECONNRESET while uploading asset metadata and the runtime fingerprint; both platform bundles uploaded and the update was published.
Device verification: ADB device 00078344S000834 completed two cold launches; package com.insureit.mobile remained alive and emitted no ReactNativeJS, AndroidRuntime, ExpoUpdates or Expo errors.
```

Update this file after material changes to:

- Expo runtime/channel/branch/build profile
- preview APK version/runtime compatibility
- mobile publish or verification protocol
- durable OTA failure lessons
- current clean preview update evidence

Latest external claim stage visual hierarchy OTA:

```text
Source commit: 5a29351fef7ec68bb9c6b25797fe88f8aadd2ac7
Message: Refine external claim stage visual hierarchy
Update group ID: 1de9d0d4-e1c9-44c1-b9d3-f3c4afd2e086
Android update ID: 01a019f6-141d-7dd3-8bd2-b423a1292389
iOS update ID: 01a019f6-141d-74d5-9fa0-273aee6901e3
Runtime version: 0.2.0
GitHub Actions run: 32251824563
EAS metadata: gitCommitHash matched the committed source; workflow checkout was clean.
Device verification: BLOCKED; `adb devices -l` returned no connected device after publication. Perform two cold launches and visual verification when the Android device reconnects.
```

Latest external claim contrast correction OTA:

```text
Source commit: 671aa9b1a7d4a8e075375913ede95f210206d1f6
Message: Improve contrast for external claim stages
Update group ID: 2bd4c38e-651d-4950-89a9-a60dbda9bf6f
Android update ID: 01a01a03-06b5-7406-94fb-74802dbb5455
iOS update ID: 01a01a03-06b5-7ca9-803c-29d6a7404d3f
Runtime version: 0.2.0
GitHub Actions run: 32253021080
Device verification: two cold launches completed on Android device 00078344S000834; app remained alive and emitted only normal `Running "main"` startup entries. A fresh stage-route capture verified the white shield logo and navy header treatment. The requested real milestone form was unavailable for the supplied deep link ID, so field-level stage content was not claimed verified.
```

Use `docs/CURRENT_CHAT_HANDOFF.md` only for short active continuation status. Keep the durable mobile publishing rules here.

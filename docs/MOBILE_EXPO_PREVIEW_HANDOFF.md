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

Latest user-requested rollback to external-claim refinement publish:

```text
Source commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Message: Rollback to external claim steps and time picker
Update group ID: 6dd3e7da-86e4-4bf0-8287-a372f6233ec4
Android update ID: 01a00e18-a8f5-7470-a763-70efa215d60c
iOS update ID: 01a00e18-a8f5-771e-bdf7-746152cf2c63
Runtime version: 0.2.0
EAS metadata: isGitWorkingTreeDirty false
Device verification: ADB cold launches on Android device 00078344S000834; app remained alive after recovery from the previously bad cached bundle, dashboard rendered, and Start Claim rendered the external-claim refinement flow from commit 82780eb1.
```

This rollback was explicitly requested by the user on 2026-08-17 (IST) to restore the update shown in Expo as group `e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5` / commit `82780eb`. The new group `6dd3e7da-86e4-4bf0-8287-a372f6233ec4` republishes that same source commit with `.env` present.

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

Update this file after material changes to:

- Expo runtime/channel/branch/build profile
- preview APK version/runtime compatibility
- mobile publish or verification protocol
- durable OTA failure lessons
- current clean preview update evidence

Use `docs/CURRENT_CHAT_HANDOFF.md` only for short active continuation status. Keep the durable mobile publishing rules here.

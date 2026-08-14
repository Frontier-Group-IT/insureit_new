# InsureIT Mobile Preview Release State

> **Released:** 2026-08-14 (IST)
>
> Read together with `docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md`.

## Current preview release

The mobile workflow/UI state described in `docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md` was successfully published to the existing Expo **preview** channel.

```text
Expo owner: antnish
Expo project: insureit-mobile
Expo project ID: aadcb7a5-072b-4bf9-bc81-c52fabdd5caa
Channel / branch: preview
Runtime version: 0.1.0
Platforms: Android, iOS
Update group ID: 869427d9-d743-4d75-a8e9-0715f4ad7085
Android update ID: 019ffff8-0e26-7282-9150-a8cc09263ec3
iOS update ID: 019ffff8-0e26-7161-9d80-b37cd17306ff
Message: Functional Add Vehicle and mobile UI refinement 2026-08-14
Published source commit: e098aae5f9f69c83f69164ec18134f11808271f3
GitHub Actions run: 31795060218
GitHub Actions job: 94750227740
Result: SUCCESS
```

The EAS publish step reported `Published!` and uploaded Android/iOS app bundles. No new APK was built, no Play Store submission was made, and no web production deployment was triggered by this mobile release.

The live Supabase backend migration required for the functional Add Vehicle form was already applied before this preview publish:

```text
Live Supabase migration: 20260814105907 customer_vehicle_full_form_alignment
Repository migration: supabase/migrations/20260814163000_customer_vehicle_full_form_alignment.sql
```

The temporary Expo publish workflow `.github/workflows/tmp-expo-preview-mobile-ui-release.yml` was deleted after the successful release. Cleanup commit:

```text
a947ebca6a5aee75ab25421719f61cb41bb6db2e
```

## Tester behavior

The currently installed preview APK follows the `preview` channel. Because `updates.checkAutomatically` is `ON_LOAD`, the update should be downloaded/applied through the normal Expo update lifecycle. For testing, fully close and reopen the app; if the first open downloads the bundle, a second full close/reopen may be needed to activate it.

Do not reinstall or build a new APK merely because an OTA update does not appear on the first launch. Diagnose preview update compatibility/cache first. A fresh preview APK is the fallback only if the existing preview binary cannot consume the update or there is a native/runtime compatibility issue.

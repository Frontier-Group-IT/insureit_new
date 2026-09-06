# INSUREIT Partner — New Policy Intake open-crash hotfix

> Date: 2026-09-06 IST
> Scope: `apps/partner-app/app/policy-intake-new.tsx`
> Severity: release-blocking installed-app regression

Read this with `AGENTS.md`, `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`, and `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`.

## User-reported symptom

After the final consolidated Partner preview OTA, opening **New Policy Intake** immediately showed the app-level recovery screen: `We could not open this screen`. The session remained intact; the route itself failed to render.

## Isolation / root-cause boundary

The last known-good New Policy Intake source is commit `1f215486f8f337f389dd75eb13fc6b5fbc984743`.

A compare from that commit to current `main` showed only 23 changed lines in `policy-intake-new.tsx` (13 additions / 10 deletions), all from the later visual slice. The intake data, draft, validation, upload, submit and routing logic were not changed in that interval. The route-opening regression therefore isolates to the new local `Image` + `PartnerAssets.status.documentUpload` / `PartnerAssets.status.verified` render points added by PR #1347.

## Hotfix strategy

Branch: `fix/partner-policy-intake-open-crash`
Exact base: current `main` `9610eb08d735787d000aad8a694490828f21e586`.

The hotfix restores the proven New Policy Intake upload/ready controls from the last known-good source:

- upload state → `cloud-upload-outline`
- selected / ready state → `checkmark-circle-outline`
- removes New Policy Intake local `Image` / `PartnerAssets` render usage

This exception is intentional. It prioritizes route stability over using 3D artwork for these two local controls. The rest of Policy Intake history/detail keeps semantic Partner artwork.

## Regression protection

`apps/partner-app/scripts/verify-visual-system-completion.mjs` now:

- requires the stable upload/check vector controls on New Policy Intake;
- fails if `PartnerAssets.status.documentUpload` or `PartnerAssets.status.verified` is reintroduced on the New Policy Intake route;
- continues protecting `submitPartnerPolicyIntake`, draft save, and draft restore paths;
- continues requiring Partner artwork on Policy Intake history/detail states.

## Explicitly unchanged

- `listPartnerPolicyIntakes()`
- `submitPartnerPolicyIntake()`
- `loadPartnerPolicyIntakeDraft()`
- `savePartnerPolicyIntakeDraft()`
- `clearPartnerPolicyIntakeDraft()`
- DocumentPicker type/size rules
- customer-mobile validation
- lead-source behavior
- upload progress / submit lock
- submitted-detail routing
- backend / Supabase / schema / RLS
- Expo runtime / native dependencies
- unrelated Claim work currently on `main`

## Release procedure

1. Open PR from the hotfix branch to current `main`.
2. Require exact-head Partner Verify and Web Verify success.
3. Merge only after both are green.
4. Publish a fresh Partner preview OTA from exact current `main`.
5. Cold-launch the installed Partner app twice and re-test New Policy Intake before continuing visual acceptance.
6. No APK/AAB/native build is authorized by this hotfix.

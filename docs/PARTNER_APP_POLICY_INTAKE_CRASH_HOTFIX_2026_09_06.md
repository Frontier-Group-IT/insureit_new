# INSUREIT Partner — New Policy Intake open-crash hotfix

> Date: 2026-09-06 IST
> Scope: `apps/partner-app/app/policy-intake-new.tsx`
> Severity: release-blocking installed-app regression
> Status: FIX MERGED / CORRECTIVE PREVIEW OTA PUBLISHED / DEVICE RE-TEST PENDING

Read this with `AGENTS.md`, `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`, and `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`.

## User-reported symptom

After the final consolidated Partner preview OTA, opening **New Policy Intake** immediately showed the app-level recovery screen: `We could not open this screen`. The session remained intact; the route itself failed to render.

## Isolation / root-cause boundary

The last known-good New Policy Intake source is commit `1f215486f8f337f389dd75eb13fc6b5fbc984743`.

A compare from that commit to then-current `main` showed only 23 changed lines in `policy-intake-new.tsx` (13 additions / 10 deletions), all from the later visual slice. The intake data, draft, validation, upload, submit and routing logic were not changed in that interval. The route-opening regression therefore isolated to the new local `Image` + `PartnerAssets.status.documentUpload` / `PartnerAssets.status.verified` render points added by PR #1347.

## Hotfix strategy

Branch: `fix/partner-policy-intake-open-crash`
Exact base: `main` `9610eb08d735787d000aad8a694490828f21e586`.

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
- unrelated Claim work already present on `main`

## Completed release evidence

- PR: **#1361 — Fix Partner New Policy Intake open crash**
- PR head: `eae9d1efbb7a930a4cb89e48975cd94debe8501a`
- Merge commit: `4ae76184700724dd898595ea8625087be8cc3539`
- Partner Verify: **#199** / run `34041393887` — success
- Web Verify: **#3052** / run `34041393878` — success
- Corrective OTA trigger commit: `57aa1a3d8d84cbec93574a4c54dd6bc5533337f9`
- Workflow: `Publish Partner preview OTA`
- OTA run: **#47** / `34041555389`
- Channel: `preview`
- Exact-current-main guard: success
- Partner OTA linkage: success
- Expo project access: success
- Actual Expo publish step: success
- OTA summary: success
- Result: **SUCCESS**
- No APK/AAB/native build was created.

## Device acceptance still required

1. Cold-launch the installed Partner app twice so OTA #47 is definitely active.
2. Open **New Policy Intake** and confirm the route loads normally instead of showing the recovery screen.
3. Verify lead source, mobile input, policy-copy picker, selected-file state, Submit to Operations, and successful detail redirect.
4. If this route is green, resume the remaining installed-app visual acceptance audit from `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`.
5. Native Phase 6 remains blocked until installed-app acceptance is completed.

# INSUREIT Partner — New Policy Intake open-crash hotfix

> Date: 2026-09-06 IST
> Scope: `apps/partner-app/app/policy-intake-new.tsx` + `apps/partner-app/lib/policy-intakes.ts`
> Severity: release-blocking installed-app regression
> Status: CONFIRMED ROOT-CAUSE FIX MERGED / CORRECTIVE PREVIEW OTA #48 PUBLISHED / DEVICE ACCEPTED

Read this with `AGENTS.md`, `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`, and `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`.

## User-reported symptom

After the final consolidated Partner preview OTA, opening **New Policy Intake** immediately showed the app-level recovery screen: `We could not open this screen`. The session remained intact; the route itself failed to render.

## First attempted diagnosis — disproven by device re-test

PR #1361 reverted the two New Policy Intake artwork render points to the proven vector controls. CI was green and corrective preview OTA #47 published successfully, but the user confirmed the route still crashed.

Therefore the artwork render path was **not** the root cause. Future agents must not repeat that diagnosis.

First-attempt release evidence:

- PR: **#1361 — Fix Partner New Policy Intake open crash**
- Merge: `4ae76184700724dd898595ea8625087be8cc3539`
- Partner Verify: #199 / `34041393887` success
- Web Verify: #3052 / `34041393878` success
- OTA trigger: `57aa1a3d8d84cbec93574a4c54dd6bc5533337f9`
- OTA #47 / `34041555389` success
- Result on device: **still broken**

## Confirmed root cause — API/client contract drift

The current portal API intentionally splits Policy Intake data into two GET modes:

- `GET /api/partner/policy-intakes` → intake list / totals / counts
- `GET /api/partner/policy-intakes?view=sources` → authorized lead sources

The Partner mobile client had not been updated for that split.

`listPartnerPolicyIntakes()` still declared the ordinary list response as containing `sources`, and New Policy Intake called the list endpoint and immediately executed array operations such as `result.sources.some(...)` and `result.sources.length`.

Because the ordinary list response no longer contains `sources`, the installed app dereferenced `undefined`, causing a synchronous JavaScript initialization failure caught by the app-level recovery boundary.

Why Policy Intake history continued to work: it consumes only `result.intakes`, so the stale `sources` declaration did not affect that screen.

## Correct fix

Branch: `fix/partner-policy-intake-sources-contract`  
Branch creation base: `5e70b028718c735e5d711ea454bc2307e3708e93`  
PR base after preserving concurrent main work: `0fe12c6aed85f8712f507c87d64aae5553a4ecbc`

Implementation:

1. `listPartnerPolicyIntakes()` now models only list/totals/counts and defensively normalizes `intakes`.
2. New `listPartnerPolicyIntakeSources()` calls the dedicated `?view=sources` endpoint.
3. The source loader defensively returns `[]` unless `result.sources` is actually an array.
4. New Policy Intake loads `listPartnerPolicyIntakeSources()` together with its saved draft; it no longer depends on the intake-history endpoint.
5. New Policy Intake normalizes the returned source array before `.some()`, `.length`, `.find()`, or `.map()` can operate on it.
6. Upload, draft, mobile validation, submit, signed upload, OCR, routing, backend/schema/RLS and native/runtime behavior remain unchanged.

## Regression protection

New script:

`apps/partner-app/scripts/verify-policy-intake-source-contract.mjs`

It verifies:

- the dedicated source loader exists;
- it calls `/api/partner/policy-intakes?view=sources`;
- both source and intake responses are array-normalized;
- New Policy Intake uses the dedicated source loader;
- New Policy Intake cannot return to `listPartnerPolicyIntakes()` for source initialization;
- stale `result.sources.some()` / `result.sources.length` usage cannot return;
- submit and draft paths remain present.

`.github/workflows/verify-partner-app.yml` now runs this contract in canonical Partner CI.

## Completed correct-fix release evidence

- PR: **#1375 — Fix Partner Policy Intake source API contract**
- Final PR head: `6273a28d5a235595687d7d860e34762a1946b5a4`
- Merge commit: `27a7dd42c96c05e34a0fec8ad86a4470e040a269`
- Partner Verify: **#200** / run `34046543932` — success
- Web Verify: **#3065** / run `34046543931` — success
- New Policy Intake source-contract CI step: success
- Corrective OTA trigger commit: `774ba2932c52678a8851f9eb5ed054e1545017d0`
- Workflow: `Publish Partner preview OTA`
- Partner OTA run: **#48** / `34046755723`
- Channel: `preview`
- Exact-current-main guard: success
- Partner OTA linkage: success
- Expo project access: success
- Actual Expo publish step: success
- OTA summary: success
- Result: **SUCCESS**
- No APK/AAB/native build was created.

## Device acceptance — completed

The user subsequently confirmed that **Policy Intake is fixed** on the installed Partner app after OTA #48.

Therefore the release-blocking New Policy Intake open-crash is closed and the API/client source-contract fix is live-verified on device.

A later compare from OTA #48 trigger `774ba2932c52678a8851f9eb5ed054e1545017d0` to then-current `main` showed no changes under `apps/partner-app`; later commits were web/schema/docs only. OTA #48 therefore remained the valid Partner mobile baseline at this acceptance point.

## Next boundary

Do not reopen the artwork diagnosis unless new direct evidence proves a separate render issue.

The next planned Partner step is the Phase 6 native dependency/build-impact review documented in `docs/PARTNER_APP_PHASE6_NATIVE_BUILD_REVIEW_2026_09_06.md`.

No native package installation, runtime/version bump, APK/AAB or production build is authorized merely by completion of this hotfix. The Phase 6 build gate still requires explicit user approval for the exact native build.

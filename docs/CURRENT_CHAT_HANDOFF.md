# Current Chat Handoff

> **Consolidated:** 2026-08-24 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

## External policy claim linking

**IMPLEMENTED / APPLIED / DEPLOYED:** Operations claim details now resolve the claim's direct `external_policy_id` alongside ordinary `policy_id`, showing policy number, coverage dates, premium/IDV when present, and an authorized policy-copy link. New mobile external-policy uploads persist `customer_documents.external_policy_id`; older rows remain supported through `external_policies.document_storage_path`. Migration `202609030001_external_policy_document_link.sql` adds the nullable relationship and index. The isolated migration workflow applied and verified the relationship/index. Production deployment was completed for the merged queue release; latest GitHub deployment `6222655881` reports success at `https://insureit-fyg7hg0l8-insureit.vercel.app`.

Policy Onboarding OCR hardening remains an active workstream. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production. After explicit `deploy now` or `finish and deploy` approval, dispatch the protected production workflow with the already-successful feature-PR verification run ID and verified commit; do not create a deployment-trigger commit/PR or repeat the full gate.

## Claim process redesign — first slice implemented

**IMPLEMENTED, NOT DEPLOYED:** Sankalp-managed customers remain limited to Spot Intimation input; post-Spot operational handling remains unchanged. The web Spot Documents Verification checklist now aligns to the mobile Spot Intimation document contract: Accident Photo, RC Copy, Insurance Copy, Driver Licence, GR / Load Bill, and Accident Video. Legacy document labels remain recognized. Missing documents can be uploaded by operations through an **Upload** action; replacement remains available for existing files. Portal upload limits are 5 MB for documents and 50 MB for video.

This is intentionally a narrow step. No claim ownership, status-transition, RLS, migration, customer post-Spot permissions, or deployment behavior was changed.

**DEPLOYED / VERIFIED:** The follow-up visibility/recovery slice is merged and deployed. Operations renders every matched Accident Photo/Video/document row with its own preview and actions, recognizes legacy bulk attachment labels for classification, and removes the reupload action's stuck `Sending...` state by resetting explicit submission state on success or failure. Reupload writes surface stage/history/activity persistence errors instead of returning success-shaped responses. The mobile claim detail reads reupload activity and shows the affected document, reason, and an Upload replacement action. PR #1043 and deployment workflow `33603275421` delivered this slice.

**DEPLOYED / VERIFIED:** Claim-detail server rendering was hardened in PR #1045 and follow-up PR #1050. The remaining production crash was caused by interactive client forms using the React `form action` prop with inline callback functions; these were changed to explicit `onSubmit` handlers while preserving server-action calls. PR #1050 merged as `f51d367e48df35d122b86884fa00d12ee8498412`, canonical verification run `33609915719`, and production deployment workflow `33610213675`. Authenticated browser verification now successfully renders `/claims/8864a09a-d5b0-424f-8cd4-3b7deb877583` with multi-file accident photos and unclassified bulk attachments visible.

**DEPLOYED / VERIFIED:** Internal and external claims are now available through top-level Operations queue tabs, with only the selected type visible. Internal claims remain the default; external claims prioritize assistance requests. Search, status filtering, counts, and pagination are preserved. PR #1077 merged as `24c199a1863060add555f305fb59fdbf0b241d25`; canonical verification run `33631214420`; production workflow `33631556961`; GitHub deployment `6222655881` reports a completed production deployment.

**APPLIED / VERIFIED 2026-09-03:** The `claim-documents` Supabase Storage bucket now accepts the supported claim video MIME types (`video/mp4`, QuickTime, WebM, Matroska and AVI) while retaining the 50 MB limit. Migration `202609030002_allow_claim_video_uploads.sql` was applied and verified by protected workflow `33718163048`; the workflow was added in PR #1092 and merged as `0e4fc4675102e29d149a5a2f2e1c35483dd916ac`.

## Active performance remediation

**IMPLEMENTED, NOT DEPLOYED:** feature branch `perf/safe-remediation-foundation` adds Vercel Speed Insights, replaces the 224 KB remote GitHub brand mark with a local 14.5 KB WebP, and adds hover/focus prefetch only for common read routes. Typecheck, lint (zero errors; existing warnings), production build, and `git diff --check` passed locally. No production data, Supabase schema/RLS/storage, Vercel region, environment, permission, or business workflow was changed.

The current audit baseline, staged fix order, safety gates, and deferred region/database/upload/query work are in `docs/PERFORMANCE_REMEDIATION_PLAN_2026_08_24.md`. The short user actions are in `docs/PERFORMANCE_OWNER_TODO_2026_08_24.md`. Do not deploy without the canonical feature-PR verification gate and explicit user instruction.

## Mobile Expo preview

**DEPLOYED / DEVICE-VERIFIED:** External claim contrast was corrected and published. Dark external-claim headers now use a generated white variant of the existing INSUREIT shield asset, `STEP X OF 9`/stage title/subtitle use light colors, and the decorative diagonal backdrop is disabled only for these stages so the header text is not obscured.

```text
Source commit: 671aa9b1a7d4a8e075375913ede95f210206d1f6
Update group ID: 2bd4c38e-651d-4950-89a9-a60dbda9bf6f
Android update ID: 01a01a03-06b5-7406-94fb-74802dbb5455
iOS update ID: 01a01a03-06b5-7ca9-803c-29d6a7404d3f
Runtime version: 0.2.0
GitHub Actions run: 32253021080
```

Android device `00078344S000834` completed two cold launches with no matched fatal/runtime errors. Captures were saved as session artifacts `insureit-external-claim-current.png`, `insureit-external-claim-contrast.png`, and `insureit-external-claim-stage-contrast.png`; the last reached the stage route but showed an unavailable milestone because the test deep-link claim ID was not valid.

**DEPLOYED / DEVICE VERIFICATION BLOCKED:** The external claim stage UI refinement was published to Expo `preview` runtime `0.2.0`. The shared stage header now supports the navy reference treatment, claim-update context is a navy banner, and the same visual hierarchy is applied across the nine stages and document vault without changing claim persistence or navigation.

```text
Source commit: 5a29351fef7ec68bb9c6b25797fe88f8aadd2ac7
Message: Refine external claim stage visual hierarchy
Update group ID: 1de9d0d4-e1c9-44c1-b9d3-f3c4afd2e086
Android update ID: 01a019f6-141d-7dd3-8bd2-b423a1292389
iOS update ID: 01a019f6-141d-74d5-9fa0-273aee6901e3
Runtime version: 0.2.0
GitHub Actions run: 32251824563
```

Typecheck, focused ESLint, web export, and `git diff --check` passed. Device verification is pending because `adb devices -l` currently reports no connected Android device.

**DEPLOYED / DEVICE-VERIFIED:** Start Claim artwork was wired into the live route and published to Expo `preview` runtime `0.2.0`.

```text
Source commit: 4aedc96e4c9dee6f6beb270ae993e25d06c25a66
Message: Render Start Claim artwork
Update group ID: e1cad678-a328-44cd-ba9f-b147fb1657d8
GitHub Actions run: 32247962686
```

The previously present `start-claim-hero.png` and `start-claim-footer-scene.png` assets were not referenced by `app/customer/start-claim.tsx`; the route now renders both. Typecheck, focused ESLint, web export, and diff checks passed. Android device `00078344S000834` displayed the Start Claim hero artwork after the OTA and reached Claim Intimation without matched fatal/runtime errors. The temporary publish workflow was removed after use.

**DEPLOYED / DEVICE-VERIFIED:** The current `main` mobile source was republished to Expo `preview` to ensure the refined Start Claim, Spot Intimation, Spot Status, Claim Intimation/Claim Detail, and supplied artwork are in the active update bundle.

```text
Source commit: 5335457b155f66e0a9176616628daa20a469a8de
Message: Republish current main claim workflow refinements
Update group ID: e3bb930a-e969-436e-9558-f74fa57f8f25
Android update ID: 01a019c5-5f37-79d8-a5ce-7553b6f6b54a
iOS update ID: 01a019c5-5f37-7899-93a9-e1c99c80a7f4
Runtime version: 0.2.0
GitHub Actions run: 32247346118
```

The external workspace comparison found no separate page or artwork hashes missing from committed `main`; the republish ensured the current source is the active preview bundle. Android device `00078344S000834` completed two cold launches without matched fatal/runtime or missing-environment errors and rendered the restored dashboard with custom artwork. Claim-screen navigation was not re-run after this cold launch.

**DEPLOYED / DEVICE-VERIFIED:** The committed mobile preview state was restored and published to Expo `preview` from runtime-compatible source commit `8816aad97cde2e839980dd943e7757c0ce86c636`.

```text
Message: Restore mobile preview app state
Update group ID: 22f4d8ae-3416-44e1-a406-aec9d412d00a
Android update ID: 01a019b8-b75b-79b4-a874-25b5b9a438f2
iOS update ID: 01a019b8-b75b-7b78-b08a-c8de53f3b653
Runtime version: 0.2.0
GitHub Actions run: 32246220731
```

The protected GitHub Actions publish used the EAS `preview` environment. Connected Android device `00078344S000834` completed two cold launches without matched fatal/runtime or missing-environment errors, and a fresh screenshot verified the restored external Claim Journey at Claim Intimation with the shared navy customer bottom navigation.

**DEPLOYED / ADB VERIFICATION BLOCKED:** The external-claim Spot Status/Claim Tracker action row was refined as the next OTA after the accident-time-picker baseline.

```text
Source branch: mobile/timepicker-spot-actions
Source commit: 2a442b90a7ed9c14d496ff432e698ccef9b64edc
Base commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Message: Refine external claim spot status actions
Update group ID: 7e49b25d-f0f6-4993-b630-6d072d29b192
Android update ID: 01a00e9b-4074-7469-b4f3-1b94da589f4f
iOS update ID: 01a00e9b-4074-7335-838a-c3b8be8e28a0
Runtime version: 0.2.0
```

Included change: for external/self-tracked claim detail, the `Get Help` quick action was removed and `Update Current Stage` plus `Request Assistance` now render as two equal side-by-side columns. Sankalp-managed claim actions are unchanged.

Verification:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/claim-detail.tsx app/customer/self-managed-spot-status.tsx app/customer/request-claim-assistance.tsx --quiet
npx eas-cli update:list --branch preview --limit 2 --json --non-interactive
```

Expo publish succeeded and loaded mobile `.env`. ADB device verification is still pending because `adb devices` showed no connected device immediately after publish.

**DEPLOYED / VERIFIED:** At the user's explicit request, Expo preview was rolled back to the exact accident-time-picker OTA state. Later hero-fix groups are superseded for now.

```text
Source commit shown by EAS: 82780eb19151fc8acda6525489bd4bd18ea04687
Original source group republished: 662027d5-685b-4032-a1ab-7adca9b43ec1
Message: Rollback preview to accident time picker state
Update group ID: 41f252be-a386-4107-99a1-3078d283003a
Android update ID: 01a00e5c-f990-7740-82a6-e4eb0042ba9f
iOS update ID: 01a00e5c-f990-7a0b-9cef-dd9ac1a44579
Runtime version: 0.2.0
EAS metadata: `isGitWorkingTreeDirty: true` because this is an exact republish of the prior dirty OTA bundle.
```

Verification:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/policy-detail.tsx app/customer/self-managed-claim.tsx --quiet
npx eas-cli update:list --branch preview --limit 2 --non-interactive
ADB two cold launches on Android device 00078344S000834
```

ADB verification confirmed the installed app starts cleanly and renders the recovered time-picker-era dashboard. Superseded groups `4e75c429-aa00-4477-bf78-7099897d13ce` and `720ee831-f0ee-4a64-a266-bdd267cffad3` were later hero-fix attempts; do not treat them as current unless the user explicitly asks to move forward again.

**BUILT / DOWNLOAD VERIFIED:** An Android internal APK baseline was built from the time-picker source point so future preview OTA updates can continue from this runtime/channel baseline.

```text
EAS build ID: 2a32890c-3ffe-464c-8efa-5452937cd675
Build profile: preview
Distribution: internal
Artifact type: APK
Source commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Channel: preview
Runtime version: 0.2.0
Android build versionCode: 6
Artifact URL: https://expo.dev/artifacts/eas/R20RhbUSXx3qWoUpWlc6IdSqMtX5hZqH1WSt98lMik8.apk
Local artifact: apps/mobile-app/insureit-timepicker-preview-v6.apk
```

The APK artifact was downloaded locally. ADB install verification was blocked because the connected Android device disconnected after the download; reconnect USB debugging before installing/verifying this APK on-device.

**DEPLOYED / VERIFIED:** After failed rebuild-style rollbacks, the `preview` channel was recovered to the user-identified intended mobile state: external claim Spot Intimation/Incident Report refinement with accident time picker. This was restored by republishing the exact prior dirty OTA bundle, preserving dirty-only mobile changes that are not reconstructible from the displayed Git commit alone.

```text
Source commit shown by EAS: 82780eb19151fc8acda6525489bd4bd18ea04687
Original source group republished: 662027d5-685b-4032-a1ab-7adca9b43ec1
Message: Restore working external claim time picker state
Update group ID: 5a9329d3-536f-4cba-b8b4-90fb9f41446f
Android update ID: 01a00e24-411a-7e2b-916f-661d370bef09
iOS update ID: 01a00e24-411a-72e3-bc14-ce4fd40a95ee
Runtime version: 0.2.0
EAS metadata: `isGitWorkingTreeDirty: true` because this is an exact republish of a prior dirty OTA bundle.
```

Verification:

```text
npx eas-cli channel:view preview --json
ADB cold launches on Android device 00078344S000834
```

ADB two-launch verification completed without `Missing mobile app environment configuration`; dashboard rendered; external claim tracker opened and showed the current Spot Status stage. Rebuilt/exact groups tied to `e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5` showed `Missing mobile app environment configuration`; do not use that group as the stable recovery point even though it appears later in Expo history than `662027d5`.

**SUPERSEDED BY ROLLBACK ABOVE:** Policy Detail hero-height fix was committed and published to Expo preview on 2026-08-17 (IST), branch/channel `preview`, runtime `0.2.0`.

```text
Source commit: 15d87986e1264a1ab8b7e5a58b9d9723823c53c4
Message: Hotfix policy detail hero env publish
Update group ID: 8739257d-7689-48f3-aae7-bf0537a438fb
Android update ID: 01a00e0e-c852-72df-a9d1-3dd5cf893bae
iOS update ID: 01a00e0e-c852-739b-99fc-b92ee521668a
Runtime version: 0.2.0
EAS metadata: `isGitWorkingTreeDirty: false`
```

Included changes:

- Policy Detail content is wrapped in a non-flex content stack so the hero card no longer inherits spare ScrollView height.
- The hero action row is content-sized and full-width without stretching the card.
- The latest external-claim refinement from commit `82780eb19151fc8acda6525489bd4bd18ea04687` remains in history before this fix.

Verification:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/policy-detail.tsx --quiet
npm --workspace apps/mobile-app run build:web
npx eas-cli channel:view preview --json
ADB two cold launches on Android device 00078344S000834
```

ADB screenshots confirmed the current dashboard, policies list, and Policy Detail screen render on the installed preview app. The Policy Detail hero now renders compactly without the prior large blank expanded area.

**LEARNING:** bad update group `252d828a-aa21-43af-ad3d-25a209e84955` was published from the same source commit before the ignored mobile `.env` was present in the clean worktree. It crashed with `Missing mobile app environment configuration` and caused the device to recover through cached/older bundles until a second cold-launch cycle applied the superseding group `8739257d-7689-48f3-aae7-bf0537a438fb`. Future clean worktree publishes must ensure Expo CLI logs `env: load .env` / `env: export EXPO_PUBLIC_*` before bundling.

**DEPLOYED / VERIFIED:** Expo preview OTA was restored on 2026-08-17 (IST) to the latest `main` mobile state for project `antnish/insureit-mobile`, branch `preview`, runtime version `0.2.0`. This supersedes the temporary hotfix group `eb212c22-3ab5-4c40-9703-49c3c33934e1`, which was valid for crash recovery but was behind later mobile UI work.

**DEPLOYED / PARTLY DEVICE-VERIFIED:** The external claim step/header/time-picker refinement was committed and republished from a clean worktree on 2026-08-17 (IST), superseding dirty update group `6e438b8d-e179-4729-97a6-47005efa298a`.

```text
Source commit: 82780eb19151fc8acda6525489bd4bd18ea04687
Message: Clean worktree: external claim steps and time picker
Update group ID: e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5
Android update ID: 01a00c6d-e57a-7ce3-9d97-9ba72f1e69cb
iOS update ID: 01a00c6d-e57a-7532-9394-aaa12c76b1aa
Runtime version: 0.2.0
EAS metadata: `isGitWorkingTreeDirty: false`
```

Included changes:

- Removed the duplicate Start Claim `Vehicle` section label below `Select the vehicle`.
- Removed `EXTERNAL CLAIM` from self-managed claim step headers.
- Shortened Spot Intimation copy and changed the policy context label to `EXTERNAL POLICY`.
- Replaced manual `HH:MM` accident-time entry with a modal hour/minute picker while preserving stored `HH:MM`.

Verification before publish:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/start-claim.tsx app/customer/self-managed-claim.tsx app/customer/self-managed-milestone.tsx app/customer/self-managed-spot-status.tsx --quiet
git status --short
```

ADB verification before the clean re-publish confirmed the dirty OTA had applied the visible Start Claim label removal on the connected device. Final ADB verification after clean group `e68ed658-b0a0-4b3a-a6a5-2b66e42f67a5` was blocked because the Android device disconnected from ADB during the two-launch verification step. Reconnect USB debugging and run the required two cold launches before claiming on-device verification for the clean group.

```text
Source commit: 7395d226db77790da26746e9b0d958379a2d7946
Message: Restore preview to latest mobile main
Update group ID: ac47a84f-fd32-4c6e-9010-aebcac01e21e
Android update ID: 01a00c3d-db88-7936-83d4-41543d8a72f8
iOS update ID: 01a00c3d-db88-721f-9d6c-5069b6a90c07
EAS Dashboard: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/ac47a84f-fd32-4c6e-9010-aebcac01e21e
```

Included changes:

- Latest committed mobile dashboard, vehicle art, My Vehicles, empty-policy CTA, and claims/policy flow refinements from `main`.
- Policy Detail mobile hero layout no longer expands into a tall blank card below its filled content.
- External Start Claim vehicle/policy selection refinement is present in the installed preview app, including the newer dropdown vehicle selector, Add Policy action, no-policy state, and disabled continue action.

Verification:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/add-policy.tsx app/customer/add-vehicle.tsx app/customer/claim-detail.tsx app/customer/home.tsx app/customer/policies.tsx app/customer/policy-detail.tsx app/customer/request-claim-assistance.tsx app/customer/self-managed-claim.tsx app/customer/self-managed-documents.tsx app/customer/self-managed-milestone.tsx app/customer/self-managed-spot-status.tsx app/customer/start-claim.tsx app/customer/vehicle-detail.tsx app/customer/vehicles.tsx --quiet
npm --workspace apps/mobile-app run build:web
npx eas-cli update:list --branch preview --limit 1 --json
adb shell monkey -p com.insureit.mobile -c android.intent.category.LAUNCHER 1
```

ADB verification on connected Android device `00078344S000834` confirmed the installed app opens after the restored OTA, two fresh launches log `Running "main"` without `Missing mobile app environment configuration` or `AndroidRuntime` fatal exceptions, the later dashboard renders with fleet summary/coverage ring/quick actions/claims card, and the refined Start Claim screen renders with dropdown vehicle selector, Add Policy action, no-policy state, and disabled continue action.

**LEARNING:** publishing a clean Expo OTA from an isolated worktree without injecting the mobile `EXPO_PUBLIC_*` environment produced bad update group `a72bd2f4-83ee-4a50-840e-55196b419296`, which crashed on first launch with `Missing mobile app environment configuration`. The follow-up crash hotfix group `eb212c22-3ab5-4c40-9703-49c3c33934e1` restored environment config but was behind later mobile UI work. When publishing from a clean/temporary worktree, load the same mobile public environment used by the normal `apps/mobile-app` workspace and publish from the intended latest source state. Do not commit or record the actual values.

**LEARNING / REQUIRED MOBILE OTA VERIFICATION:** An Expo dashboard update with Android `Downloads > 0` and `Known launches: None` means the installed app has fetched the update but has not launched that bundle yet. Do not tell the user a preview OTA is reflected on-device based only on the dashboard, `eas update:list`, or a download count. After publishing to `preview`, verify the latest group, then force-stop and relaunch the installed package twice over ADB (`com.insureit.mobile`) and inspect the affected screen or logs. Expo Updates commonly downloads a bundle on one cold start and applies it on the next cold start. Prefer publishing from a committed mobile source state so EAS shows `isGitWorkingTreeDirty: false`; if a dirty publish is unavoidable, record exactly which local files were dirty and verify the device UI directly.

**DEPLOYED:** Expo preview OTA update published on 2026-08-15 for project `antnish/insureit-mobile`, branch `preview`, runtime version `0.1.0`.

```text
Source commit: ec286da421c3062d9faad8caf3c270c3b8aa5906
Message: Unified bottom tabs and compact detail screens
Update group ID: 0d4cdae8-3cc2-43f9-9d76-661bb0c2fb58
Android update ID: 01a003f4-89f9-741a-a116-22c8ec1b1e52
iOS update ID: 01a003f4-89f9-747b-a2a8-804a11bb6171
EAS Dashboard: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/0d4cdae8-3cc2-43f9-9d76-661bb0c2fb58
```

Included changes:

- Vehicle Detail and Policy Detail were redesigned into compact app-style pages.
- Customer bottom navigation now uses one shared `UniversalBottomTabs` component across shared `Screen`, customer Home, group Home, and group page shell.
- Individual customer bottom tabs are `Home / Policies / Vehicles / Support / Profile`.
- The universal bottom bar hides while the keyboard is open to avoid the previous lifted/stuck bottom-menu behavior.
- External policy flows remained intact: `external_policies`, `externalPolicyId`, and `create_self_managed_external_claim` references were verified after the change.

Verification before publish:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint components/ui.tsx app/customer/home.tsx components/group/group-home-screen.tsx components/group/group-page-shell.tsx components/customer-dashboard/index.tsx app/customer/vehicle-detail.tsx app/customer/policy-detail.tsx --quiet
npm --workspace apps/mobile-app run build:web
```

**DEPLOYED:** A follow-up Expo preview OTA update published on 2026-08-15 redesigned My Policies to match the current Claims page visual pattern.

```text
Source commit: 8b423a7eb6c9be60589f6b67c8c594d1f0c03cd8
Message: Redesign My Policies like Claims
Update group ID: 44cd3fd2-0898-4776-ab20-ac69cb277915
Android update ID: 01a00401-60c1-7ba2-b46a-842b384896b8
iOS update ID: 01a00401-60c1-7507-81ee-46d80fe8f995
EAS Dashboard: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/44cd3fd2-0898-4776-ab20-ac69cb277915
```

Included changes:

- `apps/mobile-app/app/customer/policies.tsx` now uses the Claims-style search section, counted filter chips, tone-colored cards, accent bar, status icon, status badge, number boxes, info rows, warning strip, and footer CTA.
- The policy data flow was preserved: SIBL policies and `external_policies` are still merged, sorted by `end_date`, and detail navigation still passes `{ id, source }`.

Verification before publish:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/policies.tsx --quiet
npm --workspace apps/mobile-app run build:web
```

**DEPLOYED:** A follow-up Expo preview OTA update published on 2026-08-15 normalized the global customer screen top spacing.

```text
Source commit: a448b38268a216fd2c780d894f0cd8caec268a37
Message: Normalize mobile top spacing
Update group ID: 54587825-98d0-44d4-bb78-a57238f6bfa0
Android update ID: 01a0043d-6ae0-7c26-89a5-3224cf208123
iOS update ID: 01a0043d-6ae0-79d2-8a11-189ac0c4e24d
EAS Dashboard: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/54587825-98d0-44d4-bb78-a57238f6bfa0
```

Included changes:

- Shared `Screen` now supports global `topSpacing` variants (`default`, `compact`, `tight`, `legacy`) and the default branded-header gap was reduced.
- Manual first-section negative top margins were removed from major customer pages, including Policies, Claims, Vehicles, Vehicle Detail, Policy Detail, Support, Add Vehicle, Add Policy, Renewals, Profile, support-ticket pages, and self-managed claim pages.
- Tiny internal negative offsets for suggestion/helper panels were intentionally left unchanged because they are not header-gap compensation.

Verification before publish:

```text
npm --workspace apps/mobile-app run typecheck
npx eslint components/ui.tsx app/customer/claims.tsx app/customer/policies.tsx app/customer/support.tsx app/customer/vehicle-detail.tsx app/customer/policy-detail.tsx app/customer/vehicles.tsx app/customer/help-faqs.tsx app/customer/raise-support-ticket.tsx app/customer/support-ticket-detail.tsx app/customer/add-policy.tsx app/customer/add-vehicle.tsx app/customer/renewals.tsx app/customer/profile.tsx app/customer/request-claim-assistance.tsx app/customer/report-accident.tsx app/customer/upload-documents.tsx app/customer/start-claim.tsx app/customer/self-managed-documents.tsx app/customer/self-managed-milestone.tsx app/customer/self-managed-spot-status.tsx --quiet
npm --workspace apps/mobile-app run build:web
```

**DEPLOYED:** An Expo preview OTA update published on 2026-08-16 refined the mobile app's external/self-managed claims UI only. Sankalp-managed claim rendering and all claim workflow logic, statuses, and RPCs were left unchanged.

```text
Source commit: 00c1069cd0a4936e94c7efe94778e0e3ac7d0285
Message: External claims UI: consistent self-tracked identity, reduced Sankalp comparisons, simplified document vault
Update group ID: d11876b5-c137-452e-97c5-dce068619f51
Android update ID: 01a00be1-921f-7c59-aff7-9223943999af
iOS update ID: 01a00be1-921f-7048-bac5-0b01ce056f4a
Runtime version: 0.2.0
EAS Dashboard: https://expo.dev/accounts/antnish/projects/insureit-mobile/updates/d11876b5-c137-452e-97c5-dce068619f51
```

Included changes (external/self-managed claims screens only):

- `apps/mobile-app/app/customer/self-managed-claim.tsx` — restructured Spot Intimation header (`External Claim · Step 1 of 9`), policy-context card, and form section styled through `AppBadge`/`Card` instead of inline hex styles.
- `apps/mobile-app/app/customer/claim-detail.tsx` — added an external-claim-only visual branch (`selfManaged` flag) with its own tone/badge/copy; Sankalp-managed rendering path is unchanged.
- `apps/mobile-app/app/customer/self-managed-milestone.tsx`, `self-managed-spot-status.tsx` — replaced repeated "Sankalp Managed" comparison copy with milestone-focused guidance; standardized the Self Tracked badge via `AppBadge`.
- `apps/mobile-app/app/customer/request-claim-assistance.tsx` — header now reads "External Claim" with an `AppBadge`.
- `apps/mobile-app/app/customer/self-managed-documents.tsx` — Document Vault now renders only milestones that accept documents (removed empty stage cards) and visibly locks uploads once claim assistance is accepted.

Because the working tree also contained unrelated in-progress policy/vehicle edits, this release was built from an isolated detached `git worktree` (`../InsureIT-claims-release`, based on commit `00c1069c`) containing only the six files above, with its own clean `npm ci` install, so the OTA published exactly the reviewed external-claims scope and nothing else. That temporary worktree has been removed after publishing; the main workspace's other in-progress changes were not touched, committed, or reverted.

Verification before publish (isolated release worktree):

```text
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/self-managed-claim.tsx app/customer/claim-detail.tsx app/customer/self-managed-milestone.tsx app/customer/self-managed-spot-status.tsx app/customer/request-claim-assistance.tsx app/customer/self-managed-documents.tsx --quiet
npm --workspace apps/mobile-app run build:web
npx eas-cli update:list --branch preview --limit 1 --json
```

A separate master-data administration change was added on 2026-08-12: protected deletion controls for existing customers, vehicles, policies, and claims are available only to the `it_super_user` role in the Customers, Vehicles, Policies, and Claims registries. Customer/vehicle/policy deletion and the later claim-delete extension are both deployed to production.

Insurance Company master-data navigation was added and deployed on 2026-08-12. The canonical insurer master route is now under Master Data at `/master-data/insurance-companies`, with the create route at `/master-data/insurance-companies/new`; legacy `/insurance-companies` routes still exist for compatibility.

Production evidence:

```text
Feature commit: d57a8c65ad82e902ef6e79d4b9b264f30b37cdbd
Production trigger commit: 5f84ad14368cbaa9d70c2990d1794499d4aa609b
GitHub Actions production run: 31588015641
Verification gate: success
Deploy hook job: success
Vercel deployment: dpl_CWAT5kA1msyNUkhjguAHPcUPkq17
Vercel state: READY
Vercel URL: insureit-5ro2cs638-antnish1s-projects.vercel.app
Production alias: portal.insureit.in
Production smoke: unauthenticated GET /master-data/insurance-companies and /master-data/insurance-companies/new returned 307, expected auth redirect.
Runtime errors: no route-scoped Vercel runtime errors found in the selected post-deploy window.
```

Live Supabase readiness was verified before deployment: `insurance_companies` and `insurance_company_aliases` exist with RLS policies and indexes, with 37 companies, 35 active companies and 50 aliases. No database migration was required for this feature.

Policy Onboarding registration-pending vehicle support was implemented and deployed on 2026-08-12. Section 02 now has a compact `Registered / Unregistered` toggle in the top-right header, defaulting to `Registered`. In `Unregistered` mode, the registration field is disabled/optional, AuthBridge lookup is disabled, and chassis plus engine numbers are required.

Supabase project `ilzhsfqqjyppzzvfscmh` has the backend RPC support applied:

```text
20260812170500_policy_onboarding_unregistered_vehicle_mode.sql
20260812171500_fix_unregistered_vehicle_chassis_lookup.sql
20260812173500_fix_unregistered_vehicle_validation.sql
```

Live function verification confirmed `onboard_motor_policy(jsonb)` reads `vehicle.registrationMode`, stores `REGISTRATION PENDING` in the non-null policy snapshot registration field, preserves registered lookup by `vehicle_no_normalized`, uses chassis lookup for unregistered vehicles, and no longer contains the old `Insured name, valid 10 digit phone and registration number are required.` validation message. The Supabase connector rejected a longer cleanup-in-same-statement smoke query, so no live create/delete data smoke was completed.

Production deployment evidence:

```text
Feature commit: d2b52254a54b780e4f94c9f0d625013014101137
Supabase validation hotfix commit: 38468e18be13d2b5f7e6e395bc49b708ab7175ab
Production trigger commit: 0aa17920483cb37ec6794d0109ad2a9c1a00b7dc
GitHub Actions production run: 31595290043
Verification gate: success
Deploy hook job: success
Vercel deployment: dpl_ELqa7BwMfx7ccYuC4rHkK9VjMrso
Vercel state: READY
Vercel URL: insureit-9827schml-antnish1s-projects.vercel.app
Production alias: portal.insureit.in
Production smoke: unauthenticated GET /policies/new returned 307 to /login?next=%2Fpolicies%2Fnew.
Runtime errors: no /policies/new route-scoped Vercel runtime errors found in the selected post-deploy window.
```

## Sales hierarchy portfolio visibility

**IMPLEMENTED / VERIFIED:** reporting-hierarchy access now resolves business through assigned intermediaries instead of stopping at employee-owned customers.

Required business rule:

```text
employee reporting hierarchy
  -> intermediary/Partner assigned to any employee in scope
  -> intermediary-linked customers OR customers on policies carrying that intermediary code
  -> related vehicles, policies and claims
```

This means a Sales Head can see portfolio records generated by a Partner assigned to an RM anywhere below the Sales Head in the employee reporting tree. The RM can see the same Partner portfolio within the RM's own scope. Organization-wide access is not granted by this rule.

Implementation:

- `apps/web-portal/lib/employee-access-scope.ts`
  - hierarchy employees are still resolved recursively from `employees.reporting_manager_id`;
  - accessible intermediaries are resolved from both direct intermediary assignments and `posp_misp_onboarding_profiles` associate assignments;
  - accessible customers are the union of employee-owned/assigned customers, `intermediary_customer_links`, and policy customers whose `policies.intermediary_code` belongs to an accessible intermediary.
- Customers already consume this common customer resolver.
- Vehicles now filter by accessible `customer_id` using capability `view_vehicles`.
- Policies now filter by accessible `customer_id` using capability `view_policies`.
- Claims register now filters by accessible `customer_id` using capability `view_claims`.
- Claim detail and claim-document open routes independently re-check the same hierarchy scope server-side before using the admin client.
- Relationship Manager role defaults now include `view_vehicles`, `view_policies`, and `view_claims` so an RM can open the portfolio pages without separate manual grants. Custom access overrides can still narrow scope/capability.

Feature commits:

```text
89b0dd5d454a5d87c254942444f7f6905901a098  resolver
69595a39aaf19d4fd37456d826766b10628175b7  RM view capabilities
4db02f78b13dea2bcfc9b063707415902604e3f2  vehicles scope
4a427f8f74d3b95ee6ee75e2e2d3f2e2da6dd001  policies scope
48f6a5f51b877266e2d5ce2b7aaaac3c030f21a8  claims register scope
969565b5131f8ff766a1c4b4be0e7e181ea6f93c  claim detail authorization
838d283eefe2c52c4b35f54b13e11437ed79e200  claim-document authorization
```

Live Supabase validation of the user-provided hierarchy example confirmed:

- Sales Head Jatin -> RM Parsottam through `employees.reporting_manager_id`.
- Anmol Wadhwa's onboarding profile is assigned to Parsottam.
- Anmol's intermediary/partner code is present on four policies.
- Jatin hierarchy resolution: Anmol in scope, 4 portfolio customers, 4 Anmol-linked policies, 4 vehicles, 0 current claims.
- Parsottam self resolution: Anmol in scope, the same 4 portfolio customers, 4 Anmol-linked policies, 4 vehicles, 0 current claims.
- There is currently no Anmol-linked claim to use as a positive live claim-row example; claim authorization uses the same customer-scope resolver.

Final verification for complete feature head `838d283eefe2c52c4b35f54b13e11437ed79e200`:

```text
GitHub Actions: Verify web portal
Run: 31593047827
Result: SUCCESS
Access Control V2 catalogue regression: passed
Access Control V2 scope/compatibility regression: passed
Access Control V2 portal lifecycle regression: passed
Employee portal governance regression: passed
IFFCO structured regression: passed
IFFCO regression: passed
Digit regression: passed
New India regression: passed
Typecheck: passed
Lint: passed
Production build: passed
```

Production concurrency note:

- No hierarchy-specific production trigger was intentionally created in this work.
- While the feature was being implemented, another already-approved production release created trigger commit `024e4dfcf06c013d1d0ae60d1cb072e06d995057` as a child of hierarchy commit `48f6a5f51b877266e2d5ce2b7aaaac3c030f21a8`.
- That unrelated production workflow `31592731421` passed and Vercel deployment `dpl_7tJswnmWByGdtqRZ327VsLxtfaCV` reached READY on `portal.insureit.in`.
- Therefore production currently includes the hierarchy resolver, RM role capabilities, and scoped Customers/Vehicles/Policies/Claims-register behavior through `48f6a5f...`.
- Production does **not** yet include the later claim-detail and claim-document authorization commits `969565...` and `838d283...` unless a subsequent deployment includes them.
- Do not trigger another production release for these final two commits without a new explicit user `deploy now` / `finish and deploy` instruction.

## IT Super User master-record and claim deletion controls

Implemented on `main` on 2026-08-12.

Files:

```text
apps/web-portal/app/master-record-delete-actions.ts
apps/web-portal/components/it-super-user-delete-panel.tsx
apps/web-portal/app/customers/page.tsx
apps/web-portal/app/vehicles/page.tsx
apps/web-portal/app/policies/page.tsx
apps/web-portal/app/claims/page.tsx
```

Security and behavior rules:

- The deletion panel renders only when the authenticated server profile role is exactly `it_super_user`.
- The server action independently re-authenticates and rejects every role except exact `it_super_user`; UI visibility is not the security boundary.
- Deletion uses the server-only Supabase admin client only after this exact role check.
- The UI requires selecting the exact record and typing `DELETE` before permanent deletion.
- Customer deletion is blocked while linked vehicles, policies, or claims exist.
- Vehicle deletion is blocked while linked policies or claims exist.
- Policy deletion is blocked while linked claims exist.
- Claims can be explicitly deleted by `it_super_user` so the dependency chain can be cleared before deleting a policy, vehicle, or customer.
- Claim deletion deletes only the selected claim as the root record. Existing database `ON DELETE CASCADE` relationships remove linked claim metadata rows; linked policy, vehicle, and customer remain intact.
- Before claim deletion, claim-document storage bucket/path metadata is collected. After database delete succeeds, the server makes a best-effort cleanup of corresponding stored files.
- Successful deletion writes an `audit_logs` entry with actor, table, record id, and deletion source.
- Customer Auth/profile identities are intentionally not deleted by this feature; Auth identity removal remains a separate explicit operation.
- Do not weaken customer/vehicle/policy dependency checks or convert them to broad cascade deletion without explicit product approval.

Original customer/vehicle/policy implementation commits:

```text
f928a951fbca0504499ebcfb2903203a94b2c19c
e23f0a98cb2b2f2af52823cf6c5b15aab89d9cba
bd0a8d6e57503552f14d5813b003acf683eac0de
2e1e7f907fbaac888941e5ffe0a1ecbb441163df
87e59f659c050d8d447d4f8a44a0dace8a5fac15
```

Original feature verification: GitHub Actions run `31571721254`, SUCCESS.

Production deployment of original customer/vehicle/policy controls:

```text
Deployment trigger commit: 0b74c06dbeb678a55299c0ec3031645ba4a4412c
GitHub Actions production run: 31572246538
Vercel deployment: dpl_CaJm81BXrJ4FXpMUnya74ti33A6m
Production state: READY
Alias: portal.insureit.in
```

Claim-delete extension commits:

```text
a104a5ebf1d7bb93bedb42339fe02ff38c87c103
ed9549d35a46d43c2a36cd62a5686629804a3770
ae67335110df70884d4724005bcd39551b1bc7ce
```

Claim-delete feature verification: GitHub Actions run `31573206603`, SUCCESS.

Claim-delete production deployment:

```text
Deployment trigger commit: 2b8852469fcb1fe5232a1ce5f18686c2b08e9c7b
GitHub Actions production run: 31573488279
Vercel deployment: dpl_5w8MUsVTEZK4wEubL4TtJMybofWM
Production state: READY
Alias: portal.insureit.in
```

## Customer deletion cascade hotfix

On 2026-08-12, live production testing showed a dependency-free customer could still fail deletion with a generic foreign-key message.

Root cause found in the live Supabase Postgres log:

- deleting a customer cascades deletion into `customer_documents`;
- `trg_capture_customer_document_delete_activity` is an `AFTER DELETE` trigger on `customer_documents`;
- its function attempted to insert a `customer_activity_events` row using `old.customer_id` even though the parent customer was being deleted;
- PostgreSQL rejected that insert on `customer_activity_events_customer_id_fkey`, rolling back the customer deletion.

Production database fix applied through Supabase migration:

```text
20260812073421_fix_customer_document_delete_activity_on_customer_cascade.sql
```

The function `capture_customer_document_delete_activity()` now first checks whether the customer still exists. If the customer row no longer exists because the document deletion is part of a parent-customer cascade, it skips creation of the activity event. Explicit individual customer-document deletion still creates the activity event while the customer exists.

The same migration is committed to the repository in:

```text
supabase/migrations/20260812073421_fix_customer_document_delete_activity_on_customer_cascade.sql
```

Validation performed against the affected live customer inside a transaction:

```text
BEGIN;
DELETE customer;
confirmed delete_would_succeed = true;
ROLLBACK;
```

The rollback preserved the live customer while proving the exact deletion now succeeds at database level. No portal code deployment is required for this database-only hotfix.

## Existing Intermediary Migration Fix

**IMPLEMENTED / APPLIED / DEPLOYED:** the partial-save risk in `apps/web-portal/app/intermediaries/applications/[id]/existing-intermediary-migration-actions.ts` was removed. The action now calls the Supabase RPC `sync_existing_intermediary_migration(...)` instead of updating application draft JSON, profiles, assignments and registers through separate unchecked Supabase calls.

New migration:

```text
supabase/migrations/20260812120000_atomic_existing_intermediary_migration_sync.sql
```

Supabase project `ilzhsfqqjyppzzvfscmh` confirmed the function was applied on 2026-08-12 with signature:

```text
sync_existing_intermediary_migration(p_application_id uuid, p_actor_id uuid, p_migration jsonb, p_registration_status text)
```

The RPC updates, in one transaction:

- application `draft_data` and linked account `registration_status`
- `posp_misp_onboarding_profiles` Partner/POSP/MISP identifiers and raw migration data
- `partners.partner_code`
- `intermediaries.intermediary_code` / `onboarding_id`
- `intermediary_registrations.registration_code` and historical statuses
- `intermediary_training_exam_assignments` historical statuses

The RPC temporarily moves family intermediary/registration codes to generated `SYNC-*` values inside the transaction before writing final IDs. This is required so a correction can safely swap Partner and POSP/MISP IDs under unique indexes.

Affected live-family diagnosis for application `8cfae297-39d6-4f6a-aa09-5267177d6ed1` showed the draft migration values already differed from canonical Partner/profile/register rows. No direct data repair was run because the intended Partner ID vs POSP ID needs explicit confirmation from the user; re-saving the Existing Intermediary Migration section after confirming the visible values should invoke the new atomic sync.

Verification run:

```text
npm run typecheck  # passed
npm run lint       # passed with existing warnings only
npm run build      # passed after rerun with elevated spawn permission
```

Production deployment evidence:

```text
Fix commit: 33109ffd2ed089d56600cc09e7a7d435810a21ba
Production trigger commit: 0d48d1c750ec7d1e26697391e370eaecb36b5fed
GitHub Actions production run: 31581565649
Verification gate: success
Deploy hook job: success
Vercel deployment: dpl_6eBut6oTAU4r4KZJPrAtftMYmB96
Vercel state: READY
Vercel project: insureit
Production target: production
```

Supabase rollback-only RPC smoke test could not be completed because the SQL tool rejected the multi-statement transaction wrapper with `INVALID_ARGUMENT`; function installation was verified by querying `pg_proc`.

### Existing Intermediary Migration profile-ID swap hotfix

**APPLIED 2026-08-12:** live production retry for application `8cfae297-39d6-4f6a-aa09-5267177d6ed1` still failed when correcting the visible IDs to Partner `PT00003` and POSP `SIB/2026/05/0010`.

Root cause: the previous RPC temporarily moved `intermediaries.intermediary_code` and `intermediary_registrations.registration_code`, but did not temporarily move `posp_misp_onboarding_profiles.external_onboarding_id`. The profile table has a row-level duplicate trigger, so a valid parent/child family ID swap could still fail while a sibling profile retained the old target ID during the statement.

New migration:

```text
supabase/migrations/20260812153000_fix_existing_intermediary_profile_id_swap.sql
```

Supabase project `ilzhsfqqjyppzzvfscmh` recorded the migration as `20260812094322_fix_existing_intermediary_profile_id_swap`. Verification query confirmed the live function now includes:

- profile duplicate guard for Partner/POSP/MISP IDs outside the current family
- temporary `SYNC-*` move for `posp_misp_onboarding_profiles.external_onboarding_id`

No direct data repair was run. The deployed portal already calls the RPC, so the user should retry `Save & Exit` from the Existing Intermediary Migration section.

## Previous OCR Track

## Verified pre-change parser baseline

User-local baseline before the latest structured-table architecture work:

```text
IFFCO regression:    10/10 passed
Digit regression:     5/5 passed
New India regression: 5/5 passed
Typecheck:             passed
Lint:                  0 errors
Build:                 passed
```

Do not reuse this as proof that newer structured-table commits pass.

## Live production findings

Repeated live tests with IFFCO policy `N8109328` established:

- insurer detection fixed: IFFCO-TOKIO
- product fixed: Package
- policy number fixed
- IDV fixed
- valid from/upto fixed and apply correctly
- CPA later read correctly as 330
- flattened OCR premium interpretation remained unsafe, producing OD `1` and TP values such as `997134`/`22409`

Durable learning: flattened table reading order must not be used as the sole financial evidence.

Known correct accounting target:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## Current implementation

A second IFFCO financial pass consumes Google Document AI table cell anchors (`pages[].tables[]`) instead of relying only on flattened page text.

New file:

```text
apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts
```

Server action extracts structured table rows and runs the structured IFFCO refiner after the existing text refiner. The structured pass rebuilds OD/TP/CPA from labeled premium rows and only returns them when the complete financial equation reconciles to printed net. If evidence is incomplete, financial fields are withheld rather than guessed.

Regression:

```text
npm run policy-ocr:iffco-structured-regression
```

Relevant commits:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec
6e3b37af37b254de367707f5d99cad96816c997b
f16058c0c159ec90f46d4b28a718d3205ab82a7b
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2
22d62f0387368ff8d0f1725321e0a286b2b9f5df
```

## Immediate next step

For sales hierarchy visibility, the core portfolio lists are already included in production because of the concurrent unrelated deployment described above. The final claim-detail and claim-document hierarchy authorization is verified on `main` but requires a future explicit production deployment request before it can be claimed live.

For deletion administration, use the dependency order claim -> policy -> vehicle -> customer when those linked records actually exist. If a dependency-free customer still fails deletion, inspect current Postgres logs before altering dependency rules. The customer-document activity cascade bug described above has already been fixed in production.

For OCR deployment, continue to follow the regression and explicit-deploy gate in `AGENTS.md`.

United India remains deferred.

## Mobile Expo Preview Recovery

**APPLIED:** on 2026-08-14 the Android Expo `preview` channel was rolled back to the last known good external-policy preview commit `d4fe10f42c42180fc7365b42107a94d35cb7bb8c` with EAS update group `47e3613e-916e-4992-b9a6-54402ff76d66`.

**APPLIED:** after rollback, a corrected Android Expo `preview` update was published from local repair branch `repair/corrected-mobile-preview-20260814`, commit `14386b6e1845cd69db01be4f273acd97f295e06f`, EAS update group `3df274ee-c06b-4688-ab2e-f2b8dd8b82be`, message `Safe mobile UI fixes after rollback 2026-08-14`.

The corrected update intentionally keeps the last-good preview claim and external-policy logic intact: `external_policies` remains the customer-added policy source, Start Claim still routes external policies with `externalPolicyId`, and self-managed claim creation still uses `create_self_managed_external_claim`. It reapplies only the approved mobile UI/UX changes: Add Policy redesign with locked vehicle from vehicle-card entry, insurer search-first behavior, web-aligned policy type dropdown, auto end-date calculation, optional premium/IDV, active-policy duplicate guard, Policy Wallet redesign with external policies included, shared pressed/loading/search-clear states, Android keyboard/bottom-tab behavior fixes, KYC local keyboard behavior fixes, Metro/ESLint generated-output exclusions, and `android.softwareKeyboardLayoutMode: pan`.

Verification before corrected publish: mobile typecheck passed, focused ESLint passed for the touched mobile files, and `npm --workspace apps/mobile-app run build:web` passed. The native Android keyboard mode still requires a fresh APK build to affect installed binaries; the JS/tab hiding portion is available through OTA.

## Policy OCR training corpus — corrected continuation handoff

**USER-OBSERVED:** production `/policies/ocr-training` displays “Showing 281 policy copies linked to policy records” but the tabs display `All · 9` and every row is exhausted with “Not proposed”. This is not a Storage-count problem. The page intentionally renders only `policy_documents` rows that have a related `policy_ocr_training_labels` row.

### Intended architecture

```text
private Storage object
  -> policy_documents (policy_copy, policy_id)
  -> policy_ocr_training_labels (one queue row per document)
  -> leased server worker
  -> Google Document AI + INSUREIT parser/refiner
  -> Section 03 proposal only
  -> compare to existing policies/policy_premium_details
  -> operator comparison review -> one-click sanitized candidate approval
```

Google is only the reading layer. Parser “training” means human-approved, sanitized Section 03 regression cases; production must never self-modify parser source. OCR must not extract customer, insured, vehicle, PAN, address, chassis or engine identity fields.

### The precise failure

The original queue requires three database layers, in order:

1. `202608210001_policy_ocr_training_labels.sql` creates the label table only.
2. `20260821153000_premium_ocr_training_workflow.sql` adds processing columns, triggers, worker functions, **and backfills one label for every existing `policy_documents.document_type = 'policy_copy'` row**.
3. `20260821220000_link_legacy_policy_copies_to_ocr.sql` links only unambiguous legacy `customer_documents` uploads into `policy_documents`.

The migration workflow previously applied layer 1 and layer 3 but skipped layer 2. Therefore the production database could have 281 `policy_documents` rows but only the nine labels created by earlier upload events. Layer 3 cannot repair this by itself: it only creates/updates `policy_documents`; the queue label trigger is defined in layer 2. The earlier claim that the backlog migration alone was sufficient was incorrect.

### Corrective action

PR #523 was merged as `70e09081d6bef2a8cc45d6bc7156d5e409bdbdcf`. PR #524 was then merged as `44f9fb9644d941a999c33059a1ec93ff70ee2f4e` to apply and record all three layers, including `20260821153000`. Its first production rerun failed because that migration also contained unrelated OCR permission inserts referencing the absent remote table `public.access_permissions_v2`. PR #525 removed that unrelated block; it merged as `894d5be010e18c2a3e9d8ed4e638e96a5ab8a4a6`. **APPLIED / VERIFIED:** Supabase workflow `32513044974` completed the queue backfill, and the idempotent verification run `32513396428` reported `policy_copy_documents=286`, `queue_labels=286`, `pending_jobs=286`, `ready_jobs=0`, `exhausted_jobs=0`. The database queue is no longer limited to nine. Refresh the deployed page; if it still shows nine, the remaining issue is stale deployment/session caching or a different production project, not missing queue labels.

### Easier and safer operating model

Do not make the web page responsible for queue creation and do not rely on page visits to process a large backlog. Use one idempotent Supabase SQL/RPC operation that:

- links eligible legacy copies;
- inserts missing queue labels with `on conflict do nothing`;
- resets only explicitly requeued/exhausted jobs;
- returns counts for `policy_documents`, queue labels, pending, processing, ready and exhausted.

Run that operation once through the protected migration workflow, then use a protected cron/worker with a batch size such as 5–10. The reviewer page should only read the queue and show a diagnostic banner when `policy_documents > queue_labels`, with a “sync backlog” action restricted to authorized operators. Keep the three-attempt safety limit, but never claim a job until Google/OIDC preflight succeeds. This is simpler than trying to infer Storage contents during page rendering.

### Required next verification

1. Publish the follow-up that removes the unrelated `access_permissions_v2` dependency, rerun the corrected workflow from `main`, and inspect the live SQL result: count policy-copy `policy_documents` and count `policy_ocr_training_labels`.
2. Confirm the counts differ only for intentionally unlinked/ambiguous records.
3. Confirm the worker secret, Google Document AI variables, and Vercel OIDC subject token are configured.
4. Run one controlled job and verify `processing_status` changes to `ready` with a proposal or to an explicit parser/OCR failure; it must not silently remain `exhausted`.
5. Only then ask a reviewer to use the queue. A synthetic regression or Vercel `READY` deployment is not proof of live OCR.

### Automated comparison continuation — 2026-08-22

**HISTORICAL IMPLEMENTATION, SUPERSEDED BY THE SINGLE-OPERATOR DECISION BELOW:** successful queue jobs copy the linked policy's saved Section 03 reference into the training-label row and calculate a normalized OCR-vs-database comparison. The UI uses the same comparator, shows exact-match/mismatch/missing totals and adds an `Exact match` filter. Policy data and parser source are never changed automatically.

The production cron definition follows the latest `main` decision: hourly with a maximum batch of three and server-only OIDC fallbacks. This requires a Vercel plan that permits hourly cron plus a valid private worker secret and runtime OIDC. Do not deploy until the plan is confirmed and the user explicitly requests deployment. After deployment, verify cron logs and live queue movement from the previously verified `286 pending / 0 ready / 0 exhausted` baseline.

Local verification on the feature branch:

```text
Policy OCR regressions: passed (IFFCO structured 5/5, IFFCO 12/12, Digit 5/5, New India 9/9, additional insurers 6/6, training workflow passed)
Typecheck: passed
Lint: passed with 72 existing warnings and 0 errors
Production build: passed with CI placeholder public Supabase values
```

### 2026-08-22 worker-scheduling finding

**VERIFIED:** after the queue backfill, the live count report showed all 286 jobs as `pending`, with `processing_attempts=0`, `ready=0`, and `exhausted=0`. This means the worker had not claimed any job; it is not evidence that Google or the parser failed.

The worker route was configured for one daily cron (`0 2 * * *`) and passed only `x-vercel-oidc-token` to the processor. The processor requires a Google subject token before claiming a job. The route now falls back to server-only `VERCEL_OIDC_TOKEN` and `GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN`, and the cron is hourly (`0 * * * *`). Each run still claims at most three jobs because OCR calls can take up to two minutes and automatic attempts remain capped at three.

This worker fix is **IMPLEMENTED but not yet production-deployed**. After the protected deployment, verify one cron/authorized request changes jobs from `pending` to `processing` and then `ready` or an explicit failure. With three jobs per hour, 286 copies are intentionally processed over multiple hours; do not expect all rows to become ready immediately.

### Phase 1 decision for draft PR #530 — 2026-08-22

**LATEST DECISION; SUPERSEDES THE CRON NOTES ABOVE:** OCR training execution is operator-controlled. No upload, edit, reviewer-page visit or Vercel cron should send a policy copy to Google. An authorized training reviewer/owner chooses one row and clicks **Run with Google Cloud**. The selected-run action independently enforces the reviewer/owner capability, preflights Google configuration/OIDC, claims exactly the selected label with an optimistic row-state guard, and processes only its linked private policy copy. Re-run is also explicit. The first production version incorrectly retained a retired cron/worker-secret prerequisite; production digest `3201635344` verified that this missing secret caused the generic application-error screen before Google was called. The follow-up implementation removes only that obsolete prerequisite, preserves operator authorization and Google/OIDC preflight, and returns operational results inline. Deployment and live Google execution remain pending.

Section 02 vehicle extraction has deliberately not been added. The exact current form-to-payload-to-database mapping is in `docs/POLICY_OCR_SECTION_02_FIELD_MAP.md`. It establishes policy snapshot precedence, class-aware CC/GVW/seating handling, identity masking and the current server requirement for chassis/engine in both registration modes.

### Canonical NEW vehicle identity — 2026-08-22

**IMPLEMENTED IN PR #530 / PRODUCTION APPLICATION PENDING:** `NEW-<normalized chassis>` is the chosen internal identity for registration-pending vehicles. The forward migration `20260821194052_canonical_new_vehicle_prefix.sql` supersedes the later conflicting `PENDING-` trigger, checks missing and duplicate chassis values plus target collisions, updates the onboarding RPC, repairs temporary vehicle rows and asserts zero legacy `PENDING-` vehicle prefixes. Vehicle/fleet displays, ownership-conflict masking and MIS export recognize both prefixes during transition. The policy snapshot remains `REGISTRATION PENDING`; `vehicle_no_normalized` remains null.

### Single-operator OCR training confirmation — 2026-08-22

**LATEST DECISION / IMPLEMENTED LOCALLY / NOT APPLIED OR DEPLOYED:** the OCR training queue no longer uses separate reviewer and owner identities. The operator still inspects the Google OCR versus saved Section 03 comparison, but one **Confirm comparison & approve training** click now performs the database-reference confirmation and sanitized-candidate approval atomically. The same authenticated profile is recorded in the existing review/approval audit columns for schema compatibility. The self-approval UI block, different-owner message and separate approval form are removed. Expected confirmation errors return inline instead of causing a route-level application-error page.

Forward migration: `20260822000100_single_operator_policy_ocr_training.sql`. It drops `policy_ocr_training_labels_separate_approval_check`, removes the self-approval exception from candidate approval and adds the service-role-only atomic RPC `approve_policy_ocr_database_comparison(uuid, uuid, jsonb, jsonb)`. Apply this migration before deploying the matching application commit; otherwise the new button cannot complete.

### Combined Section 02 + Section 03 OCR training — 2026-08-22

**IMPLEMENTED LOCALLY / NOT MERGED / NOT APPLIED / NOT DEPLOYED:** one operator-selected Google Cloud run now extracts the approved visible Section 02 vehicle fields alongside Section 03. The training queue loads policy-time `policy_party_snapshots` first, falls back to the linked `vehicles` row where required, and renders two grouped field-by-field comparisons with one confirmation button. The confirmation creates `policy_ocr_training_candidate_v2` with nested `section_02` and `section_03` ground truth. Real policy, registration, chassis and engine identifiers are replaced with deterministic synthetic values in the candidate.

Migration `20260822093000_policy_ocr_section_02_training.sql` adds service-role-only `section_02_reference` storage and replaces the atomic approval validators for the combined contract. `.github/workflows/apply-supabase-migrations.yml` applies and verifies it explicitly. The Policy Onboarding OCR review modal can also copy selected Section 02 values into the unsaved form; insured name and phone remain excluded. No training action overwrites a saved policy, vehicle or snapshot.

**MIGRATION RERUN FIX:** after PR #535 merged, Supabase run `32527822191` stopped while rerunning `20260821153000_premium_ocr_training_workflow.sql` because that historical script re-added the retired different-operator constraint against already-approved single-operator rows. The rerunnable migration must continue dropping the legacy constraint but must never re-add it. The newer single-operator migration remains authoritative.

The rerunnable queue migration now downgrades only legacy `approved` rows that have no approval actor. It no longer resets already-approved candidates to `reviewed` when the protected migration workflow is rerun.

### Six approved-policy parser training — 2026-08-22

**IMPLEMENTED LOCALLY / NOT MERGED OR DEPLOYED:** six approved Section 02 + Section 03 comparisons were converted into a privacy-safe structured-layout regression corpus. The production PDFs were inspected only from a temporary local directory; no PDF, raw OCR text or real identifier is in the branch.

The parser now recognizes HDFC ERGO and Royal Sundaram directly, runs Google Layout Parser once for every manually selected PDF, and uses structured table alignment to extract vehicle and reconciled premium fields for the approved United India, HDFC ERGO, New India, National and Royal Sundaram shapes. The six sanitized cases pass with 24–25 comparable fields each; the complete OCR regression suite, TypeScript check and focused lint pass.

This is parser training through reviewed code and regression evidence, not an automatically self-modifying model. The six live queue rows must be manually rerun after this branch is merged and explicitly deployed; their existing approvals alone do not reprocess them with the new parser.

### IT Super User-only OCR Training navigation — 2026-08-22

**IMPLEMENTED / NOT YET MERGED OR DEPLOYED:** `/policies/ocr-training` is now listed under the Development menu, and that section remains visible only to `it_super_user` with approve-level `manage_system` access. The route and training Server Actions also reject every non-`it_super_user` role, so hiding the menu is not the only protection. The OCR workflow and database behavior are unchanged.


## 2026-08-25 phased mobile merge and main-only Expo preview plan

**USER-APPROVED OPERATING DECISION:** the shared Expo `preview` channel must now be sourced only from the exact current `main` commit. Isolated feature/recovery/PR branches must no longer publish directly to `preview`.

**LEARNING:** Expo `preview` is a moving channel, not a stack of branch updates. Publishing #588, #593, #595, #603, #607, #612, or any other branch directly to the same channel can replace the cumulative snapshot and make earlier work appear reverted even when Git history is intact.

### Phased merge plan

1. **Phase 0 — deployment guard.** Merge the main-only Expo preview workflow/documentation PR first. It must reject non-`main` refs and verify checked-out HEAD equals `origin/main` before `eas update --channel preview`.
2. **Phase 1 — refresh cumulative recovery.** Refresh PR #612 (`recovery/mobile-today-cumulative`) against the then-current `main`, resolve overlaps with later merges, and rerun required mobile/web CI. Do not merge #588/#593/#595/#603/#607 separately.
3. **Phase 2 — merge cumulative recovery.** Merge #612 only when refreshed, green and mergeable; verify the exact resulting `main` commit.
4. **Phase 3 — authoritative OTA.** Publish the exact verified `main` commit to Expo `preview`. OTA only for JS/assets changes; no APK. Confirm Expo publish success/channel mapping before claiming the installed preview is restored.
5. **Phase 4 — close superseded PRs.** Close #588, #593, #595, #603 and #607 as superseded by #612 after Phase 3 verification.
6. **Phase 5 — independent remaining work.** Handle unrelated PRs separately, refreshed against current `main` with their own CI. Web-only merges need no mobile OTA; mobile-affecting merges follow the same main-only preview rule.

At this handoff update, `main` had advanced beyond the original #612 base, so #612 must be refreshed before any merge. No direct production-data, Supabase schema/RLS/auth, Expo runtime/version/build-profile, or APK change is part of this plan.


## IT Super User financial deletion controls — 2026-08-28

**IMPLEMENTED, NOT MERGED / NOT DEPLOYED:** PR #750 (`feat/it-super-user-financial-delete-control`) adds a separate, dependency-aware financial deletion path for IT Super User cleanup.

- Reconciliation History exposes an IT Super User-only cycle delete control. It previews line/event cascades and blocks deletion whenever an Accounts invoice directly references the cycle or an Accounts invoice line uses one of its reconciliation lines.
- Accounts > Billing exposes an IT Super User-only invoice delete control. Only unchanged Draft invoices are deletable; receipt allocations, TDS entries, receivable ledger entries, and all non-Draft statuses block deletion.
- Deletion is rechecked server-side immediately before the destructive operation and successful deletes write an `audit_logs` entry with `deletion_source = it_super_user_financial_data_control`.
- Existing database foreign keys and cascade rules are unchanged. Reconciliation lines/events and draft invoice lines/events are the only intended child cascades. Posted accounting history is never silently removed.
- Receipt, TDS, partner-payment, partner-payable and posted-invoice cleanup remains outside this first phase because those flows require reversal-aware accounting semantics rather than generic deletion.


## INSUREIT Partner Zerodha-style refinement handoff — 2026-08-31

**CURRENT INSTALLED/PREVIEW BASELINE**

- Partner app: `INSUREIT Partner`
- Android package: `com.insureit.partner`
- Runtime/app version: `0.1.0`
- Current installed native baseline: Android versionCode 3, originally built from merge commit `71cc1d03b43d8526e02d06a6f7b59798ef458470`.
- No new APK/AAB has been approved after that icon build.
- Current preview OTA source immediately before this documentation slice: `d64a69b10e082e189dee86b85c13764266c5161c`.
- Current successful preview update group immediately before this documentation slice: `c2e71b42-703f-464e-b205-6c9d7d503811`.

### Critical OTA/native compatibility learning

A native date-picker dependency was introduced after the versionCode 3 APK without a matching new native build. Later OTAs bundled code importing that module and the installed Android app auto-closed. Republishing another post-build OTA did not recover the app because it still contained the incompatible native code.

Recovery and permanent rule:
- rollback-to-embedded recovered the installed app and the user verified it opened correctly;
- `@react-native-community/datetimepicker` was removed from Partner runtime `0.1.0` source/dependencies;
- date-picker functionality is deferred until a future explicitly approved APK build;
- Partner CI blocks that module from runtime `0.1.0` OTA source;
- never publish a Partner OTA that introduces/imports a native module not embedded in the installed runtime;
- no native build may be created without explicit user approval for that exact build.

### UI/UX benchmark decision

User approved **Zerodha Kite as the primary UX interaction benchmark** for INSUREIT Partner.

Use Zerodha principles:
- serious business-app density;
- clean flat lists;
- predictable action placement;
- bottom-reachable/contextual actions;
- bottom sheets instead of unnecessary full pages/modals;
- progressive disclosure;
- compact top/watchlist-style selectors;
- semantic color;
- minimal instructional copy;
- preserved navigation/search/filter context;
- restrained motion.

MyJio/Airtel remain secondary references for selective dashboard polish/content treatment only.

### Refinement foundation already merged

Shared OTA-safe primitives exist for:
- bottom sheet;
- compact top tabs;
- bottom action bar;
- filter sheet;
- overflow/context menu;
- flat operational list row;
- divider;
- semantic status indicator;
- compact stat block;
- lightweight entrance animation.

### Home refinement history/current rules

Home is now a working-console layout rather than a card-heavy dashboard.

Current composition:
1. greeting / role / freshness;
2. My Business;
3. Quick Actions;
4. Your Impact;
5. INSUREIT Stories.

Home change approved 2026-08-31:
- the My Work section is removed from the dashboard;
- Your Impact is restored above INSUREIT Stories;
- INSUREIT Stories is the final Home section;
- the Stories `See all` control is removed;
- story icons share the available row width evenly.

Quick Actions use stronger filled icons with differentiated semantic surfaces:
- Policy Intake;
- Renewals;
- Claims;
- Customers.

Motion:
- subtle staggered Home section entrance;
- subtle Quick Action scale/lift on press;
- React Native Animated only;
- no looping/promotional motion.

Typography:
- Home section labels are smaller ALL CAPS, lighter weight, refined tracking;
- Gross Premium uses lighter weight;
- decimal/fraction digits are visually smaller where present;
- Active Motor IDV Protected is intentionally not heavily bold.

Money-format rule:
- default Partner rule is full Indian financial formatting: `₹32,600`, `₹8,42,000`, `₹1,25,00,000`;
- do not abbreviate normal Partner money as K/L/Cr;
- **Home-only visual exception:** Active Motor IDV Protected uses compact Indian notation such as `₹32.6K`, `₹20L`, `₹2.4Cr`.

Home duplication decision:
- the standalone Business Pulse / “A few things need you” block remains removed from Home;
- My Work is also removed from Home by explicit user direction;
- dedicated operational destinations remain available through Quick Actions, bottom navigation and secondary routes;
- the dedicated Pulse route can remain for deeper insight.

### Compactness rule

User preference is explicit:
- remove unnecessary instructional/marketing copy;
- arrange options horizontally where sensible;
- minimize wasted padding;
- preserve at least 48px interactive targets;
- reduce visual footprint and surrounding whitespace, not tappable area;
- retain only essential error, warning, offline, recovery, confirmation and destructive-action guidance.

### Next authorized refinement work

Start **R3 list UX refinement** on a separate branch for:
- Customers;
- Policies;
- Claims;
- Renewals;
- Policy Intake history.

R3 goals:
- one consistent list language;
- less card chrome;
- compact top filters/tabs;
- clean flat rows;
- stronger scan hierarchy;
- contextual status/actions;
- preserve current server-authorized scope;
- preserve existing cache/offline/refresh behavior;
- no backend/schema/RLS/auth change unless separately justified and approved;
- no native dependency;
- no APK/AAB.

After R3, continue the agreed sequence:
- R4 detail screens;
- R5 transactional journeys;
- R6 Business/Payout/Network;
- R7 Account/Profile/Settings/Support;
- R8 universal search/cross-navigation/preserved context.



### R3 list refinement completed — 2026-08-31

**VERIFIED / DEPLOYED TO PARTNER PREVIEW**

PR #928 merged as `db84cd97b03b7e5317e1414751c179c8808511d6`.

Final R3 behavior:
- **Customers:** one-line summary strip; flat customer rows; name/status first; customer/location/intermediary metadata reduced to scan lines; compact Call/WhatsApp actions retained.
- **Policies:** full premium remains full Indian formatted and gets its own readable summary line; counts sit below in the shared summary strip; All/In force/Expiring/Expired/Upcoming use shared top tabs; each row prioritizes policy number/status, customer/insurer, risk/category, premium and expiry.
- **Claims:** summary strip; All/Active/Completed top tabs; flat rows prioritize claim/status, customer/insurer, vehicle/policy, amount and date.
- **Renewals:** dark hero removed in favor of a compact white 30-day summary; full Indian premium remains readable; Upcoming/Overdue use top tabs; 0–7d/8–15d/16–30d secondary windows remain; rows keep the customer shortcut.
- **Policy Intake history:** dark pipeline hero removed; compact Active/Need you/In progress/Completed strip; top tabs; flatter submission rows retain lightweight progress state and attention warning only when required.

Shared components:
- `components/ui/partner-list-summary-strip.tsx`
- refined `components/ui/partner-top-tabs.tsx`

Preserved:
- existing Partner backend/RPC behavior;
- authorization/scope;
- Customers/Policies/Claims/Renewals pagination where already present;
- saved search/filter state where already present;
- debounce/search;
- cache/offline banners;
- pull-to-refresh;
- existing navigation/detail routes;
- full Indian money-format rule, except the previously documented Home-only Active Motor IDV compact exception.

Verification:
- final R3 PR head: `a50de86f138230330cdcf6a95ed0e451bac488c1`
- Partner Verify #93 / run `33421460050`: SUCCESS
- Web Verify #2471 / run `33421460104`: SUCCESS
- OTA trigger PR #929 source: `91c5caabc668d64838a8d11b80763eb539290573`
- Partner preview OTA run `33421816823`: SUCCESS
- runtime: `0.1.0`
- update group: `07f4cb1f-15bd-40a5-aed6-f93f540936ba`
- Android update: `01a058f4-451c-7d98-96df-163050dcb02c`
- no APK/AAB and no native dependency/config change.

Next planned slice: **R4 detail screens** — Customer Detail, Policy Detail, Claim Detail and Policy Intake Detail. Use installed-device review of R3 first if any density/hierarchy adjustment is needed before R4.


## INSUREIT Partner Home simplification OTA — 2026-08-31

**VERIFIED / DEPLOYED TO PARTNER PREVIEW**

- Feature PR #932 merged as `ebdefc672602181ee5270622afdcaddc8e34cad3`.
- Partner Verify #95 / run `33423691651`: SUCCESS.
- Web Verify #2475 / run `33423691560`: SUCCESS.
- OTA trigger PR #933 merged as `a45be762890f5612778420c2f76a9661baafd02d`.
- Partner preview OTA run `33424089808`: SUCCESS.
- Runtime: `0.1.0`.
- Update group: `7fc15d46-84a9-4664-a073-4c60288f6e05`.
- Android update: `01a0590b-87f2-7bbd-9352-8c4491f5829b`.
- iOS update: `01a0590b-87f2-7944-abd7-cb7c8faf44d8`.

Deployed Home composition:
1. greeting / role / freshness;
2. My Business;
3. Quick Actions;
4. Your Impact;
5. INSUREIT Stories.

The My Work section is removed. INSUREIT Stories is the final Home section, has no See all action, and evenly distributes its visible story icons across the available width. Individual story icons remain tappable. No APK/AAB, native dependency/config, backend, schema, RLS or auth change was introduced.


## Partner UX refinement R4 / R5 — 2026-09-01

### R4 detail screens — VERIFIED / MERGED

PR #940 merged as `57c9764874e489a5e3304b93480538ec27e0725f`.

Delivered:
- Customer Detail: duplicate phone/email rows removed from Relationship while contact actions remain; long Policies/Vehicles/Claims sections default to two items with accessible Show all / Show less.
- Policy Detail: generic shortcut row removed; premium breakup and commercial attribution use progressive disclosure; gross premium remains visible with lighter weight.
- Claim Detail: always-on explanatory guidance removed; Partner attention appears only when applicable; customer navigation stays contextual; latest five journey events show by default with full-history expansion.
- Policy Intake Detail: extracted policy and vehicle OCR details are progressively disclosed under one Extracted details section while workflow status, attention response, replacement upload and final-policy navigation remain intact.

Final R4 head:
- `b072feb627694f0c7bfae58c0567cd8d475c5d9a`
- Partner Verify #103 / run `33469840016`: SUCCESS
- Web Verify #2488 / run `33469840019`: SUCCESS

R4 OTA publication evidence:
- OTA trigger PR #941 merged as `ef32a563d5b85d57d16f4e8da5fcd21b99d88b3c`.
- A second explicit marker push was committed directly to current main as `8f2f0c949a35769c3f610c3713da008c9ebd8b41`.
- Marker: `partner-r4-detail-screens-retrigger-2026-09-01`.
- Push-triggered OTA run status is **UNVERIFIED from the currently available GitHub connector**, because its commit-workflow helper only returns pull-request-triggered runs. Do not label the R4 OTA DEPLOYED until direct push-run / EAS evidence is obtained.
- No APK/AAB, native dependency/config, backend, schema, RLS or auth change.

### R5 Policy Intake transactional journey — VERIFIED / MERGED

PR #943 merged as `b6f35d5d048f06625e6ede8152c8f83f89834e7d`.

Delivered:
- synchronous duplicate-submit guard on New Policy Intake;
- compact Ready to submit review summary for lead source, customer mobile and selected policy copy;
- existing persisted draft, validation, upload progress, retry and selected-file error recovery preserved;
- synchronous duplicate-action guard on replacement uploads in Policy Intake Detail;
- existing Operations review/attention workflow remains authoritative; no direct booking or invented persistent workflow state.

Final R5 head:
- `35d0e09dbba3f94a4052321a3f0462fb3b54e17c`
- Partner Verify #105 / run `33470314551`: SUCCESS
- Web Verify #2491 / run `33470314526`: SUCCESS

R5 OTA publication:
- current-main marker push commit: `35fad7d32a8b9aabce209f750467050f6e5987d6`
- marker: `partner-r5-policy-intake-journey-2026-09-01`
- push-triggered OTA result remains **UNVERIFIED from the current connector** until direct Actions/EAS run evidence is available.
- Runtime remains `0.1.0`; no APK/AAB or native dependency/config change.

### Next refinement slice

Proceed with **R6 Business / Payout / Network** using the same compact, progressive, role-authorized Partner UX language. Preserve all server-side commercial authorization boundaries and do not expose internal accounting/reconciliation data.


## Partner UX refinement R4–R8 closeout — 2026-09-01

This section supersedes the earlier R4/R5 OTA entries that were marked TRIGGERED / UNVERIFIED. Direct GitHub Actions push-run evidence is now available and confirms the actual deployment state.

### R4 — Detail screens — VERIFIED / DEPLOYED

- PR #940 merged as `57c9764874e489a5e3304b93480538ec27e0725f`.
- Final feature head: `b072feb627694f0c7bfae58c0567cd8d475c5d9a`.
- Partner Verify #103 / run `33469840016`: SUCCESS.
- Web Verify #2488 / run `33469840019`: SUCCESS.
- OTA marker commit: `8f2f0c949a35769c3f610c3713da008c9ebd8b41`.
- Publish Partner preview OTA #24 / run `33470126679`: SUCCESS.
- No APK/AAB or native dependency/config change.

### R5 — Policy Intake transactional journey — VERIFIED / DEPLOYED

- PR #943 merged as `b6f35d5d048f06625e6ede8152c8f83f89834e7d`.
- Final feature head: `35d0e09dbba3f94a4052321a3f0462fb3b54e17c`.
- Partner Verify #105 / run `33470314551`: SUCCESS.
- Web Verify #2491 / run `33470314526`: SUCCESS.
- OTA marker commit: `35fad7d32a8b9aabce209f750467050f6e5987d6`.
- Publish Partner preview OTA #25 / run `33470533523`: SUCCESS.
- No APK/AAB or native dependency/config change.

### R6 — Business / Payout / Network — VERIFIED / DEPLOYED

- PR #946 merged as `83b0fb441695d6a5aa7fe41109902e723204d776`.
- Final feature head: `dc279ff3787660e31f9bc8c5584cd9facec5055e`.
- Partner Verify #106 / run `33470725076`: SUCCESS.
- Web Verify #2494 / run `33470725068`: SUCCESS.
- Delivered:
  - compact Payout summary using shared list-summary language;
  - recent payout records moved behind progressive disclosure;
  - server-driven restricted payout visibility preserved exactly;
  - Network moved to shared Partner loading/error/summary patterns;
  - tiny legacy Network text replaced by shared readable typography;
  - hierarchy, Partner metrics, owner data and POSP/MISP children preserved.
- OTA marker commit: `f77545cad058ee65448114f98527f0e3db18228a`.
- Publish Partner preview OTA #26 / run `33470938811`: SUCCESS.
- No payout calculation/RPC, hierarchy, backend/schema/RLS/auth, APK/AAB or native dependency/config change.

### R7 — Account / Profile / Settings / Support — VERIFIED / DEPLOYED

- PR #947 merged as `df54fec4d8fe9b9bdef71a562192195a29cb6610`.
- Final feature head: `352e66b2b8ce47b292f11ff7f9ea9c919d872bbc`.
- Partner Verify #107 / run `33471069531`: SUCCESS.
- Web Verify #2495 / run `33471069539`: SUCCESS.
- Delivered:
  - Profile moved to shared readable typography and section hierarchy;
  - new OTA-safe `Settings & app info` route with Profile/Support shortcuts;
  - Settings shows app version/runtime/update behavior only and does not create backend preferences or scope-changing controls;
  - Support prioritizes Need your attention above in-progress Policy Intakes.
- OTA marker commit: `d869008a2514e036d2b4f85673cdd2ed5e606969`.
- Publish Partner preview OTA #27 / run `33471283749`: SUCCESS.
- No backend/schema/RLS/auth, APK/AAB or native dependency/config change.

### R8 — Universal search / cross-navigation / preserved context — VERIFIED / DEPLOYED

- PR #949 merged as `cf800ffce3fa4bcb1cf4dfc7faf7c26b571d18e7`.
- Final feature head: `cf880102e880ebc5dce6ed4a63b072c6c3ecd35c`.
- Partner Verify #108 / run `33471596329`: SUCCESS.
- Web Verify #2498 / run `33471596333`: SUCCESS.
- Delivered:
  - dedicated universal Search route under More > Work;
  - Customer, Policy and Claim search composed only from existing Partner-scoped RPC search functions;
  - no new backend search endpoint or expanded data surface;
  - six compact results per section with direct detail navigation;
  - debounced search, stale-response protection and partial-failure tolerance;
  - universal query preserved when navigating to a detail and back;
  - existing Customers/Policies/Claims saved list search/filter state remains untouched.
- OTA marker commit: `3a11b4754de7c919b17fbf2cdcd4139efae6d2bf`.
- Publish Partner preview OTA #28 / run `33471796783`: SUCCESS.
- No backend/schema/RLS/auth, APK/AAB or native dependency/config change.

### Refinement sequence status

R3 through R8 are now complete. There is no planned R9 in this OTA-safe refinement sequence.

**NEXT SAFE STEP:** installed-device UAT and release-readiness review across the refined Partner app, followed by any OTA-safe defects discovered during UAT. Keep all work that genuinely requires a new APK/AAB/native dependency or native configuration for the explicitly approved final native-build stage.


## Partner Google Play release-readiness continuation — 2026-09-01

The OTA-safe R3–R8 refinement track is complete. Continue from:
`docs/INSUREIT_PARTNER_PLAY_RELEASE_READINESS_2026_09_01.md`.

Current device-UAT baseline:
- main OTA marker/source commit: `c48e5803aec3f455100cefcdc146cd4cc32d3692`;
- Partner preview OTA #29 / run `33472570374`: SUCCESS;
- runtime: `0.1.0`;
- Expo update group: `f5ab58ca-176c-4c22-82d7-ce24432ae6fd`;
- Android update: `01a05b62-8253-7f5d-a5c2-18e105f44a19`.

Play privacy readiness:
- PR #954 merged as `0a09d2d9cc2d7923244009fd4edb9f591f045d23`;
- Partner Verify #109 / `33472394033`: SUCCESS;
- Web Verify #2504 / `33472394139`: SUCCESS;
- Partner Settings now links to the live public privacy policy;
- `https://portal.insureit.in/privacy-policy` returned HTTP 200 through Vercel verification.

Production UAT identity check:
- one active intermediary portal account exists;
- it is a Partner identity;
- its family is standalone with zero active POSP and zero active MISP children;
- use it only for authorized internal UAT; do not expose a real production user's credentials to Google Play reviewers;
- child-family UAT and a dedicated reusable Play reviewer/demo identity remain separate explicit setup items.

Google Play technical readiness:
- Expo SDK 54 targets Android API 36, satisfying the Google Play target requirement effective 31 August 2026;
- final Play artifact must be an AAB;
- EAS uses remote app versioning with autoIncrement, so do not treat `app.json` versionCode 1 as the final Play version code;
- store-listing assets still need preparation: 512x512 PNG store icon, feature graphic, at least two final-UI phone screenshots, listing copy and Play Console declarations.

**NEXT:** execute installed-device UAT against the current preview OTA and record PASS/FAIL evidence in the release-readiness document. Fix only OTA-safe defects now. No Partner APK/AAB/native build without explicit authorization for that exact build.


## Policy existing-vehicle / replacement flow — 2026-09-01

**IMPLEMENTED, NOT APPLIED/DEPLOYED:** branch `feat/policy-existing-vehicle-replacement-flow` adds:
- canonical "Use Existing Vehicle" hydration from vehicle ID;
- server-side re-verification of the selected vehicle/customer;
- active, expired and overlap policy-history warnings across managed + external policy records;
- explicit Edit Existing Policy / Change New Policy Details paths;
- privileged, audited managed-policy replacement that preserves the old record and creates a separate new policy;
- migration `20260901154500_policy_existing_vehicle_replacement.sql` with atomic `replace_active_motor_policy_v1` and `policy_replacement_audit`;
- static regression guard `policy-existing-vehicle-replacement-regression.mjs`.

No migration has been applied and no production deployment has been triggered. The active-policy replacement path must remain unavailable until the migration is applied through the normal approved workflow.


## INSUREIT Partner Brand Experience direction locked — 2026-09-02

The user has completed reference review across **Zerodha Kite, RenewBuy and Naukri** and locked the next Partner visual direction.

### Locked benchmark mix

- **Kite:** information discipline, compact operational rows, predictable navigation, restrained chrome, progressive disclosure.
- **RenewBuy:** branded business personality, running ticker/announcement rail, product-family modules, custom iconography, promotional/informative banners, more varied dashboard rhythm.
- **Naukri:** premium consumer-app polish, stronger screen hierarchy, contextual banners, illustrated empty states, grouped settings/navigation, lifecycle/status presentation, richer profile/notification treatment.

Final product principle:

> **INSUREIT Partner = Kite-level clarity + RenewBuy-style business personality + Naukri-level consumer polish and lifecycle UX.**

Do not copy these products' artwork or exact layouts. INSUREIT must retain its own brand identity and keep operational screens cleaner than the references.

### New phase name

**INSUREIT Partner Brand Experience Phase**

Planned workstreams:
1. dashboard information architecture;
2. custom INSUREIT icon system;
3. live ticker / insight rail;
4. branded banner framework;
5. empty-state illustration system;
6. Profile / More / Settings redesign;
7. notification redesign;
8. product-family visual language;
9. smart insight cards;
10. final motion / interaction polish.

### Dashboard target composition

Current target structure:
1. Header / Partner identity
2. Live ticker / insight rail
3. Business Snapshot
4. Branded Quick Actions
5. Priority / Opportunity layer
6. Business by Product
7. Smart Insights
8. One branded INSUREIT update/banner
9. Your Impact
10. Stories / Learning / Campaign

Operational Policies/Claims/Customers/Renewals lists should remain primarily Kite-like and restrained; brand expression should be strongest in Home, More/Profile, Settings, Notifications, Empty States, Support and lifecycle surfaces.

### Asset-production brief

The detailed production brief is now canonical at:

`docs/INSUREIT_PARTNER_BRAND_EXPERIENCE_ASSET_BRIEF_2026_09_02.md`

It defines:
- 32-icon custom INSUREIT Partner icon family;
- 8 dashboard quick-action assets;
- 5+ product-family tiles;
- ticker micro-icon pack;
- reusable branded banner system;
- 8–12 initial branded banners;
- 12 empty-state illustrations;
- notification/alert visual pack;
- profile/settings/support assets;
- Policy Intake transactional illustrations;
- analytics micro-graphics;
- campaign artwork;
- optional later motion/Lottie assets;
- naming/export rules and generation order.

Documentation commit that introduced the asset brief:
- `92d5ea6bdc7ef3b91d805fc07ec51096819f1341`

### Continuity requirement from user

The user explicitly requested that the process be continuously written into repo documentation so a new chat/agent can resume with full context.

For every material Partner Brand Experience step, record:
- date;
- branch / PR;
- exact feature head;
- merge commit;
- files/components/assets changed;
- CI evidence;
- Partner OTA trigger and exact run;
- real-device validation state;
- whether any native APK/AAB/build occurred;
- next planned step;
- any pending asset-generation/approval requirement.

Do not claim generated/integrated/deployed/device-validated status without direct evidence.

### Native-build rule remains unchanged

The Brand Experience phase is **OTA-first**. No Partner APK/AAB/native dependency/native configuration change is authorized unless the user explicitly approves that exact native build. The previously approved Partner logo/icon remains the target for the next native build; do not replace its basic logo design without a new explicit decision.

### Immediate next step

Begin **Asset Batch 1** before large dashboard restructuring:
1. custom 32-icon INSUREIT Partner master pack;
2. 8 Quick Action visuals;
3. 5 Product Family visuals;
4. ticker micro-icon pack;
5. banner visual template system.

After Batch 1 is approved, integrate it into a controlled OTA-safe dashboard Brand Experience slice and validate on the installed Partner app before expanding to empty states/profile/notifications.


## Partner Web Portal goal locked — 2026-09-03

**USER-APPROVED GOAL:** build a full Partner-facing web portal inside the existing web application on `portal.insureit.in`.

Controlling plan:
`docs/PARTNER_WEB_PORTAL_IMPLEMENTATION_PLAN_2026_09_03.md`

Locked product decisions:
- keep the same public domain and login surface;
- authenticated intermediary/Partner identities should route to the Partner Web experience, while Operations users continue to the existing Operations portal;
- use `/partner` as the canonical Partner Web route family, preserving `/intermediary-portal` as a compatibility redirect during migration;
- expose the important Partner App workflows/data on web, without requiring complete mobile feature parity;
- Partner Web design/layout must follow the existing Operations portal visual system exactly in shell language, spacing, navigation geometry, header treatment, cards and responsive behavior;
- use a Partner-only navigation surface; never expose Operations menus/actions merely through frontend hiding;
- reuse existing Partner identity, commercial-scope and `partner_app_*` RPC contracts rather than creating a second Partner authorization/business model;
- normal Partner Web business reads must not expand the existing static intermediary page's service-role/admin-read pattern;
- retain the useful onboarding/training/exam/agreement/IIB capability from the current static `/intermediary-portal` as an Account/Registration area inside Partner Web;
- core first-release modules are Home, My Business, Customers, Policies, Renewals, Claims, Policy Intake, Payout, Network, Search, Activity, Account/Registration/Training, Profile and Support;
- mobile engagement modules such as Impact, Journey, Learn, Stories and Recognition are secondary and should be added only if they provide useful web value.

No implementation beyond documentation was performed in this decision-lock step.

# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

Policy Onboarding OCR hardening remains an active workstream. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

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
  -> reviewer confirmation -> separate owner approval -> sanitized candidate
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

### 2026-08-22 worker-scheduling finding

**VERIFIED:** after the queue backfill, the live count report showed all 286 jobs as `pending`, with `processing_attempts=0`, `ready=0`, and `exhausted=0`. This means the worker had not claimed any job; it is not evidence that Google or the parser failed.

The worker route was configured for one daily cron (`0 2 * * *`) and passed only `x-vercel-oidc-token` to the processor. The processor requires a Google subject token before claiming a job. The route now falls back to server-only `VERCEL_OIDC_TOKEN` and `GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN`, and the cron is hourly (`0 * * * *`). Each run still claims at most three jobs because OCR calls can take up to two minutes and automatic attempts remain capped at three.

This worker fix is **IMPLEMENTED but not yet production-deployed**. After the protected deployment, verify one cron/authorized request changes jobs from `pending` to `processing` and then `ready` or an explicit failure. With three jobs per hour, 286 copies are intentionally processed over multiple hours; do not expect all rows to become ready immediately.

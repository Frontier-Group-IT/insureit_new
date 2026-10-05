# INSUREIT Partner Home Refinement Handoff — 2026-09-13

This note is the fast operational continuation record for the current Partner Home work. Read it together with `docs/PARTNER_APP_HANDOFF_2026_09_13.md` and `apps/partner-app/AGENTS.md`.

## 2026-10-05 — Exact-reference Home cards and bright-blue Quick Action icons

- Branch: `ui/partner-home-reference-exact-v2-2026-10-05`.
- User supplied the current Home screenshot plus a second reference and requested the Home cards to match the second reference, including the Quick Action icon family.
- `apps/partner-app/app/(tabs)/index.tsx` now uses a bright-blue reference-style vector treatment for the This Month chart, Policies Sold, Commission Earned, Policy Intake, Renewals, Claims, Customers and Pending Tasks artwork. The four Quick Actions use one coordinated blue glyph + semantic badge + soft-cyan glow treatment rather than the darker mixed image assets visible in the prior device screenshot.
- Pending Tasks now uses the pale-blue clipboard/check decorative treatment from the reference direction while retaining the live active-claim count and Claims route.
- Card geometry, dividers and light-blue surfaces were tuned without changing the accepted hero/search/Stories/bottom-navigation composition, live business semantics, routes, authorization or backend data.
- This change supersedes the old Home-specific Policy Intake `imageScale={1.22}` exception for the current 0.2.0 Home screen because the four Quick Actions are now rendered through the same vector icon path rather than differently padded PNG assets. Historical 0.1.0 compatibility notes below remain audit history only.
- Detailed note: `docs/PARTNER_HOME_REFERENCE_EXACT_V2_2026_10_05.md`.
- Evidence state: **IMPLEMENTED on branch; PR/CI/merge/production OTA/device verification pending. NO APK/AAB CREATED.**

## 2026-10-03 — Quick Actions reference icon alignment

- Branch: `ui/partner-home-quick-action-reference-icons-2026-10-03`.
- User supplied a reference showing one coordinated bright-blue icon family for the Home Quick Actions: Policy Intake, Renewals, Claims and Customers.
- Current Home source already used `PartnerAssets.navigation.policyIntake`, `PartnerAssets.navigation.claims` and `PartnerAssets.navigation.customers`; only Renewals still pointed at the older `PartnerAssets.actions.renewals` artwork.
- `PartnerAssets.actions.renewals` now aliases `assets/partner/navigation/renewals.png`, so the four Home Quick Actions render from the same coordinated navigation icon family without changing card dimensions, labels, routes, animation, business data, authorization, native dependencies or runtime configuration.
- This is an OTA-safe JS/asset-registry refinement for the current production runtime `0.2.0`; no APK/AAB/native build is authorized or created by this change.
- Evidence state: **IMPLEMENTED on branch; PR/CI pending; NOT MERGED; NOT DEPLOYED; NOT DEVICE-VERIFIED.**

## Installed build / release boundary

> Historical 0.1.0 compatibility information below is retained for audit/continuity. As recorded in `apps/partner-app/AGENTS.md`, the current Partner delivery target since 2026-10-01 is production runtime/version `0.2.0 (18)` and new OTA-safe Partner changes must target that production runtime unless the user explicitly requests the legacy path.

- User is testing the Android internal-distribution **preview** APK.
- App/runtime: **0.1.0**.
- Android version code: **3**.
- Native build commit: `71cc1d0`.
- Approved 0.1.0 compatibility source: `74039199991888777911deb30cf248e8f36cf8a8`.
- EAS channel: `preview`.
- Partner EAS project: `8ade82c1-4c96-4f09-b90b-802270fb406d`.
- Do not create a new Partner APK/AAB without explicit permission.
- Do not publish current `main` directly to runtime 0.1.0 by changing only the version/runtime label.

## Important milestones completed

- PR #1706: structural Home hero/banner composition introduced.
- PR #1715: corrected oversized/cropped first hero attempt.
- PR #1730: tuned hero artwork crop/scale, controls, greeting and search overlap.
- PR #1746: added device-aware top safe-area/status strip without disturbing the accepted hero composition.
- PR #1773: merged as `1e63da0887711329c73847bf6c63f46cbc236651` and Partner 0.1.0 preview OTA **DEPLOYED**. Added stronger hero control/greeting contrast, compact Pending Tasks, removed Recent Activity from Home, and added a JS-only Business Report date range compatible with the installed 0.1.0 APK.
- PR #1774: merged as `f4a1086458ff39f144405e60402269da19caf653` and Partner 0.1.0 preview OTA **DEPLOYED**. Removed Your Impact from Home while retaining `/impact`, switched Policy Intake to the dedicated image asset, and set hero artwork-image opacity to 70% without reducing foreground opacity.
- PR #1777: merged as `d3df6b77a6eb8c607d72ff7984a13e3e0b7c842a` and Partner 0.1.0 preview OTA **DEPLOYED**. Policy Intake uses `imageScale={1.22}` only, because `assets/generated-dashboard/policy-add.png` has more internal transparent padding than the other Quick Action images. This makes the visible icon match Renewals / Claims / Customers while leaving the shared `quickImageAsset` size and all other icons/cards unchanged.

Latest OTA workflow for PR #1777: run `34769107401`, conclusion **success**. Installed-device visual verification of the final Policy Intake icon size is still pending.

## Current accepted Home state

Preserve these unless the user explicitly requests another change:

- device-aware top safe-area/status strip;
- accepted hero height/crop/focal framing;
- hero artwork-image opacity at **70%** only;
- full-opacity INSUREIT Partner branding, clock/activity control, profile avatar, greeting treatment and search card;
- stronger clock/profile visibility and localized greeting contrast;
- compact Pending Tasks;
- Recent Activity removed from Home, but `/activity` and top clock shortcut retained;
- Your Impact removed from Home, but `/impact` retained;
- Business Report pure-JS date-range filter for runtime 0.1.0;
- image-based Quick Actions in the historical 0.1.0 compatibility line;
- Policy Intake asset `assets/generated-dashboard/policy-add.png` with local `imageScale={1.22}` in that historical line;
- current 0.2.0 Home may use the coordinated vector reference treatment recorded in the 2026-10-05 section above.

## Policy Intake icon rule

For the historical image-based 0.1.0 compatibility source, do **not** solve Policy Intake sizing by globally increasing `quickImageAsset`. The generated Policy Intake PNG contains more transparent padding than the surrounding Figma Quick Action images. The approved historical solution is a per-item visual scale:

- Policy Intake: `imageScale={1.22}`
- other Quick Action images: default `imageScale={1}`

For the current 0.2.0 Home source after the 2026-10-05 exact-reference refinement, all four Quick Actions use the same vector path and this per-PNG scaling exception no longer applies to that screen.

## Files controlling the 0.1.0 OTA refinement

- `scripts/partner/patch-0-1-home-hero-reference.mjs`
- `scripts/partner/patch-0-1-home-refinements.mjs`
- `scripts/partner/patch-0-1-business-date-filter.mjs`
- `scripts/partner/compat/partner-business-date-filter.tsx`
- `.github/workflows/publish-partner-0-1-home-hero-reference-once.yml`

The workflow must continue to build the OTA from the approved compatibility source, apply narrow patches, typecheck, verify the linked EAS project, then publish to `preview`.

## Guardrails

Preserve:

- greeting identity source; never hardcode screenshot names/initials;
- business summary data semantics;
- Quick Action routes;
- Pending Task routes/counts;
- bottom navigation;
- Activity and Impact dedicated routes;
- runtime/channel/source compatibility rules.

Do not add a native module to the current app merely for Home icon matching; the 2026-10-05 refinement is JS/vector-only.

## Release evidence discipline

Always record these separately:

- **IMPLEMENTED**: code exists on branch/commit.
- **MERGED**: PR merged to `main`.
- **DEPLOYED**: Expo OTA publish succeeded to the correct runtime/channel.
- **VERIFIED**: user/device screenshot or behavior confirms the update actually runs correctly.

The 2026-10-05 exact-reference refinement is currently **IMPLEMENTED ONLY**; PR/CI/merge/production OTA and device verification remain pending.

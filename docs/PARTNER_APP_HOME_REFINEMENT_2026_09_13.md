# INSUREIT Partner Home Refinement Handoff — 2026-09-13

This note is the fast operational continuation record for the current Partner Home work. Read it together with `docs/PARTNER_APP_HANDOFF_2026_09_13.md` and `apps/partner-app/AGENTS.md`.

## Installed build / release boundary

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
- image-based Quick Actions;
- Policy Intake asset `assets/generated-dashboard/policy-add.png` with local `imageScale={1.22}`;
- shared Quick Action image style remains unchanged for Renewals / Claims / Customers.

## Policy Intake icon rule

Do **not** solve Policy Intake sizing by globally increasing `quickImageAsset`. The generated Policy Intake PNG contains more transparent padding than the surrounding Figma Quick Action images. The approved solution is a per-item visual scale:

- Policy Intake: `imageScale={1.22}`
- other Quick Action images: default `imageScale={1}`

The Quick Action card dimensions, label, route and tap behavior must remain unchanged.

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

Do not add a native module to the current 0.1.0 OTA unless it is proven to exist in the installed APK.

## Release evidence discipline

Always record these separately:

- **IMPLEMENTED**: code exists on branch/commit.
- **MERGED**: PR merged to `main`.
- **DEPLOYED**: Expo OTA publish succeeded to the correct runtime/channel.
- **VERIFIED**: user/device screenshot or behavior confirms the update actually runs correctly.

PR #1777 is currently **MERGED + DEPLOYED, NOT YET DEVICE-VERIFIED**. Ask the user to fully close and reopen the Partner app (often twice) and visually confirm the Policy Intake icon before marking this milestone VERIFIED.

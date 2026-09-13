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

## Important milestones already completed

- PR #1706: structural Home hero/banner composition introduced.
- PR #1715: corrected oversized/cropped first hero attempt.
- PR #1730: tuned hero artwork crop/scale, controls, greeting and search overlap.
- PR #1746: added device-aware top safe-area/status strip without disturbing the accepted hero composition.
- PR #1773: merged and published the next Home/Business refinement set: stronger hero control/greeting contrast, compact Pending Tasks, Recent Activity removed from Home, initial Policy Intake replacement, and a JS-only Business Report date-range implementation compatible with runtime 0.1.0. OTA publication succeeded; installed-device verification remains a separate evidence state.

## Current user-approved refinement — PR #1774

Branch: `refine/partner-home-impact-icon-opacity`

State at creation of this note:

- **IMPLEMENTED ON BRANCH**
- **NOT MERGED**
- **NOT PUBLISHED**
- **NOT DEVICE-VERIFIED**

Requested changes:

1. Remove **Your Impact** from the Home page only.
   - Keep `/impact` and underlying functionality intact.
2. Make **Policy Intake** visually consistent with the other Quick Actions.
   - Do not use the generic Feather `file-plus` glyph on Home.
   - Use the dedicated image asset `assets/generated-dashboard/policy-add.png` through the same image-based `QuickAction` rendering path used by Renewals / Claims / Customers.
3. Set the hero **artwork image opacity to 70%**.
   - Preserve hero height, crop/focal framing, status strip, brand placement, clock/profile controls, greeting contrast treatment and overlapping search geometry.
   - The 70% applies to the artwork image, not the whole hero container or foreground controls/text.

## Files controlling the 0.1.0 OTA refinement

- `scripts/partner/patch-0-1-home-hero-reference.mjs`
- `scripts/partner/patch-0-1-home-refinements.mjs`
- `.github/workflows/publish-partner-0-1-home-hero-reference-once.yml`

The workflow must continue to build the OTA from the approved compatibility source, apply narrow patches, typecheck, verify the linked EAS project, then publish to `preview`.

## Guardrails for the current Home

Preserve these working parts unless the user explicitly requests otherwise:

- top safe-area/status strip;
- accepted hero crop and scale;
- INSUREIT Partner lockup placement;
- clock/activity route and profile route;
- greeting identity source (no hardcoded screenshot name/initials);
- overlapping search geometry and search behavior;
- business summary card/data semantics;
- compact Pending Tasks routes/counts;
- Quick Action routes;
- bottom navigation;
- Activity route even though Recent Activity is removed from Home;
- Impact route even though Your Impact is removed from Home.

## Release evidence discipline

Always record these separately:

- **IMPLEMENTED**: code exists on branch/commit.
- **MERGED**: PR merged to `main`.
- **DEPLOYED**: Expo OTA publish succeeded to the correct runtime/channel.
- **VERIFIED**: user/device screenshot or behavior confirms the update actually runs correctly.

Never call an OTA publish device-verified until the user cold-launches the installed app and confirms the result.
# INSUREIT Partner — Agent Instructions

Read `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md`, `../../docs/PARTNER_APP_HOME_REFINEMENT_2026_09_13.md` and `../../docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner work.

## Current installed-build rules

- **Standing delivery rule (user-confirmed 2026-09-29): Any Partner App change given to the user must be delivered to the latest installed Partner APK through runtime/OTA. The current latest installed APK is `0.1.0 (5)`, so all Partner App changes must target runtime `0.1.0`. Do not publish Partner changes to runtime `0.2.0` or another runtime unless the user explicitly authorizes moving to a newer installed build.**
- The user's currently installed Partner APK is `preview`, runtime/app version `0.1.0`, Android version code `5` (confirmed 2026-09-19). The successful native build is EAS build `a97a3ee6-b871-4825-b135-2a93f5a7eabb`; it was produced from the approved 0.1.0 compatibility source line.
- For that installed `0.1.0 (5)` APK, use the approved compatibility source `74039199991888777911deb30cf248e8f36cf8a8` plus narrow OTA-safe patches.
- **Never publish current `main` to runtime `0.1.0` by only changing the version/runtime label.** That previously caused fallback to the embedded old dashboard.
- Normal JS/TS/UI changes are OTA-first. **Never create a new Partner APK/AAB/native EAS build without explicit user permission for that exact build.**
- Do not add a native dependency to a `0.1.0` OTA unless it already exists in the installed binary. Prefer JS-only alternatives.
- Current OTA target for the installed APK is channel `preview`, runtime `0.1.0`, Partner EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`.

## UI preservation rules

- Preserve the currently accepted Home hero crop/focal framing, safe-area strip, branding placement and overlapping search unless the user explicitly asks to change them.
- Current hero artwork image opacity is **70%**; do not apply 70% opacity to foreground branding, greeting, clock/profile controls or the whole hero container.
- Home refinements should be localized and must not alter business/accounting semantics or Partner authorization.
- Removing Recent Activity from Home does **not** remove the Activity route or top activity/clock shortcut.
- Removing Your Impact from Home does **not** remove the `/impact` route or its underlying functionality.
- Policy Intake on Home uses `assets/generated-dashboard/policy-add.png` through the same image-based QuickAction path as the other actions. That PNG has more internal transparent padding, so **only Policy Intake uses `imageScale={1.22}`** to match the visible size of Renewals / Claims / Customers. Do not globally enlarge `quickImageAsset` or the other Quick Action icons.
- Do not hardcode screenshot names/initials; identity comes from resolved Partner session data.

## Release evidence

Use separate states: IMPLEMENTED, MERGED, DEPLOYED, VERIFIED. OTA publish success is not installed-device verification. After Partner OTA publication, require a cold launch (often twice) and device verification.

- **2026-10-01 — Partner Profile exact reference refinement:** branch `refine/partner-profile-reference-exact-2026-10-01`; Profile keeps the already-accepted Account header, deep-blue identity hero, live employee/intermediary registration values and server-authorized scope labels, while matching the supplied reference palette more closely: Role/active icon accents use green and the Commercial Access card uses the reference light-green authorization treatment with green shield/eyebrow. No schema/RLS/native/runtime/business-permission change. **IMPLEMENTED; PR/CI/merge/runtime 0.1.0 OTA pending. NO APK/AAB CREATED.**

- **2026-09-30 — Partner My Network Commercial reference redesign:** PR #2626 merged as `ec5ce11f61ada96e8d5db8b980e7ad63d1da0179`; Commercial relationships now matches the supplied blue reference with a custom blue header, three icon KPI cards, partner name/code search, grouped/ungrouped filter, collapsible group headers, rounded partner cards, and colored Policies/Customers/Renewals/Claims metric icons. Existing live network RPC/data, partner-family grouping, monthly premium, child POSP/MISP expansion, owner data, and authorization remain unchanged. Release branch `release/partner-network-0-1-ota` carries the merged screen into the approved cumulative runtime `0.1.0` compatibility OTA path. **MERGED; runtime 0.1.0 OTA publish pending. NO APK/AAB CREATED.**

- **2026-09-30 — Partner Profile & registration reference redesign:** Profile now follows the supplied reference with a custom Account header, deep-blue identity hero, role pill and icon-led Registration rows. This baseline is now superseded visually by the 2026-10-01 exact-reference palette refinement above; preserve the live identity/scope data and server authorization behavior.

- **2026-09-30 — Partner Activity reference redesign:** branch `ui/partner-activity-reference-redesign`; Activity now follows the supplied blue-header/card reference, uses insurer logos when resolvable with existing safe fallbacks, keeps live activity/attention data and routes, renames the list heading to `Recent activity · Today`, and removes the left timeline dots/vertical connector completely. **IMPLEMENTED; PR/CI/merge/runtime 0.1.0 OTA pending. NO APK/AAB CREATED.**

- **2026-09-30 — Partner Customer Detail reference redesign:** branch `ui/partner-customer-detail-reference`; Customer Detail now follows the approved blue-header/card reference, keeps live customer/policy/vehicle/claim values, shows Call + WhatsApp + Email, uses insurer logos for Policies/Claims and manufacturer logos for Vehicles with safe fallbacks. **IMPLEMENTED; PR/CI/merge/runtime 0.1.0 OTA pending. NO APK/AAB CREATED.**

Native app-icon milestone: user explicitly authorized one new Android preview APK using the shield-only purple Partner icon. Build only through `.github/workflows/build-partner-0-1-shield-icon-apk-once.yml`, which embeds the approved 0.1.0 compatibility source plus current accepted patches. This authorization is limited to this icon build; future native builds still require explicit approval.

Latest Home icon-size milestone: **PR #1777 merged as `d3df6b77a6eb8c607d72ff7984a13e3e0b7c842a`; Partner 0.1.0 preview OTA DEPLOYED successfully; installed-device visual verification remains pending.**

Update `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md` or the current Partner refinement handoff after any material Partner runtime, compatibility-source, native-build, OTA, or user-visible milestone.

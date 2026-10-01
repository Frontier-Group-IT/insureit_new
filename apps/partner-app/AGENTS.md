# INSUREIT Partner — Agent Instructions

Read `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md`, `../../docs/PARTNER_APP_HOME_REFINEMENT_2026_09_13.md` and `../../docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner work.

## Current installed-build rules

- **Standing delivery rule (user-confirmed 2026-10-01): The current Partner App delivery target is the new production Android build `0.2.0 (18)`. Any Partner App implementation intended for the user must be published to runtime/version `0.2.0` on the production deployment/channel through OTA when the change is OTA-safe. Do not continue publishing new Partner changes to the old `0.1.0` preview runtime unless the user explicitly asks for that legacy build.**
- The user confirmed the new production Android Play Store AAB build as version/runtime `0.2.0`, Android version code `18`, production profile/environment/deployment. The shown successful build was created from commit `1030518` and completed on 2026-09-30.
- Normal JS/TS/UI changes are OTA-first against production runtime `0.2.0`. **Never create another Partner APK/AAB/native EAS build without explicit user permission for that exact build.**
- Do not change native dependencies, permissions, package identifiers, runtime version, SDK/native config or Expo plugins and then claim OTA is sufficient. If a requested change requires native changes, stop and obtain explicit authorization for a new native build.
- Current Partner EAS project remains `8ade82c1-4c96-4f09-b90b-802270fb406d`. Treat publish success and installed-device verification as separate evidence states.
- Historical `0.1.0 (5)` compatibility tooling and notes remain repository history only. They must not be used as the default release target for new work after this 2026-10-01 production cutover.

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

- **2026-10-01 — Partner production runtime cutover:** user confirmed the new Android Play Store production build `0.2.0 (18)` as the current Partner App delivery target. New OTA-safe Partner implementations must publish to production runtime/version `0.2.0`; the old `0.1.0` preview compatibility path is no longer the default. No new native build is authorized by this rule. **TARGET UPDATED; future OTA delivery pending per implementation.**

- **2026-10-01 — Partner Profile exact reference refinement:** branch `refine/partner-profile-reference-exact-2026-10-01`; Profile keeps the already-accepted Account header, deep-blue identity hero, live employee/intermediary registration values and server-authorized scope labels, while matching the supplied reference palette more closely: Role/active icon accents use green and the Commercial Access card uses the reference light-green authorization treatment with green shield/eyebrow. No schema/RLS/native/runtime/business-permission change. **IMPLEMENTED; PR #2658 CI passed; merge/production runtime 0.2.0 OTA pending. NO APK/AAB CREATED.**

- **2026-09-30 — Partner My Network Commercial reference redesign:** PR #2626 merged as `ec5ce11f61ada96e8d5db8b980e7ad63d1da0179`; Commercial relationships now matches the supplied blue reference with a custom blue header, three icon KPI cards, partner name/code search, grouped/ungrouped filter, collapsible group headers, rounded partner cards, and colored Policies/Customers/Renewals/Claims metric icons. Existing live network RPC/data, partner-family grouping, monthly premium, child POSP/MISP expansion, owner data, and authorization remain unchanged. Release branch `release/partner-network-0-1-ota` carries the merged screen into the approved cumulative runtime `0.1.0` compatibility OTA path. **MERGED; historical 0.1.0 OTA path not the default after 2026-10-01 production cutover. NO APK/AAB CREATED.**

- **2026-09-30 — Partner Profile & registration reference redesign:** Profile now follows the supplied reference with a custom Account header, deep-blue identity hero, role pill and icon-led Registration rows. This baseline is now superseded visually by the 2026-10-01 exact-reference palette refinement above; preserve the live identity/scope data and server authorization behavior.

- **2026-09-30 — Partner Activity reference redesign:** branch `ui/partner-activity-reference-redesign`; Activity now follows the supplied blue-header/card reference, uses insurer logos when resolvable with existing safe fallbacks, keeps live activity/attention data and routes, renames the list heading to `Recent activity · Today`, and removes the left timeline dots/vertical connector completely. **IMPLEMENTED; PR/CI/merge/publish state remains as recorded by its branch. NO APK/AAB CREATED.**

- **2026-09-30 — Partner Customer Detail reference redesign:** branch `ui/partner-customer-detail-reference`; Customer Detail now follows the approved blue-header/card reference, keeps live customer/policy/vehicle/claim values, shows Call + WhatsApp + Email, uses insurer logos for Policies/Claims and manufacturer logos for Vehicles with safe fallbacks. **IMPLEMENTED; PR/CI/merge/publish state remains as recorded by its branch. NO APK/AAB CREATED.**

Native app-icon milestone: user previously authorized one specific Android preview APK using the shield-only purple Partner icon. That historical authorization does not authorize any further native builds; future APK/AAB builds still require explicit approval.

Historical Home icon-size milestone: **PR #1777 merged as `d3df6b77a6eb8c607d72ff7984a13e3e0b7c842a`; Partner 0.1.0 preview OTA DEPLOYED successfully.** This is historical evidence and not the current delivery target.

Update `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md` or the current Partner refinement handoff after any material Partner runtime, channel, native-build, OTA, or user-visible milestone.

# INSUREIT Partner — Agent Instructions

Read `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md`, `../../docs/PARTNER_APP_HOME_REFINEMENT_2026_09_13.md` and `../../docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner work.

## Current installed-build rules

- The user's installed Partner APK is `preview`, runtime/app version `0.1.0`, Android version code `3`, native build commit `71cc1d0`.
- For that APK, use the approved compatibility source `74039199991888777911deb30cf248e8f36cf8a8` plus narrow OTA-safe patches.
- **Never publish current `main` to runtime `0.1.0` by only changing the version/runtime label.** That previously caused fallback to the embedded old dashboard.
- Normal JS/TS/UI changes are OTA-first. **Never create a new Partner APK/AAB/native EAS build without explicit user permission for that exact build.**
- Do not add a native dependency to a `0.1.0` OTA unless it already exists in the installed binary. Prefer JS-only alternatives.
- Current OTA target for the installed APK is channel `preview`, runtime `0.1.0`, Partner EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`.

## UI preservation rules

- Preserve the currently accepted Home hero crop/focal framing, safe-area strip, branding placement and overlapping search unless the user explicitly asks to change them.
- Current requested hero change is limited to **70% artwork-image opacity**; do not apply 70% opacity to foreground branding, greeting, clock/profile controls or the whole hero container.
- Home refinements should be localized and must not alter business/accounting semantics or Partner authorization.
- Removing Recent Activity from Home does **not** remove the Activity route or top activity/clock shortcut.
- Removing Your Impact from Home does **not** remove the `/impact` route or its underlying functionality.
- Policy Intake on Home should use an image-based QuickAction asset so it visually follows Renewals / Claims / Customers; do not fall back to the generic `file-plus` glyph for this refinement.
- Do not hardcode screenshot names/initials; identity comes from resolved Partner session data.

## Release evidence

Use separate states: IMPLEMENTED, MERGED, DEPLOYED, VERIFIED. OTA publish success is not installed-device verification. After Partner OTA publication, require a cold launch (often twice) and device verification.

Update `../../docs/PARTNER_APP_HANDOFF_2026_09_13.md` or the current Partner refinement handoff after any material Partner runtime, compatibility-source, native-build, OTA, or user-visible milestone.

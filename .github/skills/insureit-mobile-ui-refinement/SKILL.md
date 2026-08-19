---
name: insureit-mobile-ui-refinement
description: 'Refine INSUREIT mobile customer screens from supplied reference screenshots while preserving live React Native logic, branding, routing, data integrations, responsive behavior, and Expo OTA safety. Use for mobile UI polish, screenshot matching, custom dashboard or workflow assets, shared navigation changes, and visual verification of apps/mobile-app.'
argument-hint: '[target screen and reference screenshot]'
user-invocable: true
disable-model-invocation: false
---

# INSUREIT Mobile UI Refinement

## Purpose

Match a supplied reference screenshot as closely as safely possible while keeping the existing INSUREIT mobile product functional, dynamic, branded, responsive, and maintainable.

This is a UI-refinement workflow. It is not permission to rebuild business logic, replace live data, or create a new APK without explicit approval.

## 1. Inspect Before Editing

1. Read `AGENTS.md`.
2. Read the relevant mobile handoffs, at minimum:
   - `docs/INSUREIT_PROJECT_CONTEXT.md`
   - `docs/CURRENT_CHAT_HANDOFF.md`
   - `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`
3. For broader mobile UI work, also read:
   - `docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md`
   - `docs/mobile-web-continuation-handoff.md`
   - `docs/mobile-app-production-review.md`
   - `docs/mobile-app-polish-roadmap.md`
4. Trace the route to the actual rendered component. Do not assume a similarly named legacy file is live.
5. Inspect the target screen, nearby call sites, shared UI/theme/navigation components, and the actual asset tree.
6. State one local hypothesis about the controlling layout/behavior and one cheap validation check before the first edit.

Typical mobile surfaces:

```text
apps/mobile-app/app/customer/
apps/mobile-app/components/
apps/mobile-app/assets/brand/
apps/mobile-app/lib/
docs/
```

## 2. Audit Reference Visuals and Assets

Classify every visible visual before implementing it.

### Existing brand assets

Preserve without regeneration, redrawing, recoloring, or replacement:

- INSUREIT logo and shield
- wordmark
- tagline
- brand name and casing
- established navy/blue theme tokens

### Custom illustration assets

Use PNG/WebP artwork for visuals that are expensive or undesirable to reproduce in code:

- fleet and vehicle compositions
- shield/checklist/car illustrations
- city and road scenes
- stylized document artwork

For every custom asset, record:

- exact filename and repository path
- intended screen location
- approximate dimensions
- transparent or opaque background
- intended resize mode
- whether it contains dynamic text

Never bake customer names, vehicle numbers, policy numbers, dates, counts, badges, percentages, CTAs, or navigation state into an image.

### Vector/code UI

Use the existing MaterialCommunityIcons/vector system and React Native for:

- arrows, chevrons, bells, clocks, calendars
- trucks, checks, info, upload controls
- badges, avatars, coverage rings, progress indicators
- cards, borders, shadows, backgrounds, pills
- bottom navigation

Avoid creating PNGs for ordinary controls or dynamic UI state.

## 3. Preserve Working Behavior

Do not change unless explicitly requested and verified necessary:

- Supabase loading and customer/group context
- vehicle and policy selection
- external/self-tracked/broker-managed claim branching
- claim validation and submission
- KYC, renewal, coverage, and policy calculations
- document and bulk uploads
- support actions
- navigation and route parameters
- loading, retry, empty, and error states
- pull-to-refresh
- `UniversalBottomTabs`

Never replace live values with reference screenshot values or mock data.

## 4. Screenshot Refinement Order

Compare and fix major differences first:

1. page background
2. header size and shape
3. content margins
4. section order
5. hero artwork
6. vertical spacing
7. card dimensions
8. card colors
9. typography hierarchy
10. icon sizing
11. CTA dimensions
12. bottom navigation
13. decorative artwork scaling

For a full-width hero, avoid an unnecessary inset-card appearance. For a large footer scene, intentional overscaling is acceptable when it preserves the important artwork and matches the reference without breaking touch targets or text.

## 5. Shared Customer Navigation

If the reference uses a dark navy customer bottom bar, treat it as a shared design decision.

Update `UniversalBottomTabs` rather than creating a page-specific competing navigation implementation. Preserve all existing routes and accessibility. The active tab must have a clear dynamic highlight, while inactive tabs remain visually subordinate.

## 6. Implementation Rules

- Prefer existing local components, theme tokens, and patterns.
- Keep edits scoped to the target screen, intended assets, and genuinely necessary shared components.
- Keep text inside stable containers on small screens; use `numberOfLines`, flex constraints, and responsive dimensions where appropriate.
- Keep date/time controls aligned when the reference shows them in one row.
- Keep mandatory markers tied to actual validation requirements.
- Use `resizeMode="contain"` for supplied illustration assets unless the reference clearly requires a controlled crop.
- Do not change `app.json`, Expo SDK, native packages, permissions, identifiers, plugins, or runtime version for JavaScript/layout/assets-only work.
- Do not create, build, install, or download a new APK unless the user explicitly authorizes it.
- Publish ordinary mobile layout/assets changes only to the existing Expo `preview` channel and runtime.

## 7. Verification

Run at minimum from the repository root:

```powershell
npm --workspace apps/mobile-app run typecheck
Set-Location apps/mobile-app
npx eslint <changed-tsx-files> --quiet
Set-Location ..\..
git diff --check
npm --workspace apps/mobile-app run build:web
```

Also verify:

- custom assets are imported and rendered by the target route
- no image imports are broken
- small-screen layout remains usable
- dynamic values and navigation destinations remain intact
- group/portfolio and no-customer/KYC states remain intact
- shared bottom tabs preserve active-state behavior

## 8. Expo OTA Verification

Before publishing, inspect the mobile diff and confirm `.env` is loaded without printing its values. Publish to the existing `preview` branch/channel with runtime `0.2.0`:

```powershell
$env:CI='1'
$env:EAS_SKIP_AUTO_FINGERPRINT='1'
npx eas-cli update --branch preview --message "<clear message>" --non-interactive --json
npx eas-cli update:list --branch preview --limit 1 --json --non-interactive
```

Do not claim an OTA is reflected on-device from publication alone. Require:

1. published update evidence with Android and iOS IDs/group
2. connected device visibility through `adb devices` when Android verification is required
3. two cold launches of the installed app
4. no fatal/runtime errors
5. a fresh screenshot or equivalent visual evidence showing the intended page and custom assets

If the installed APK cannot receive the update because its embedded channel/runtime/configuration is stale, report the blocker. Do not silently create a replacement APK. Request explicit permission before any native build/install.

## 9. Common Failure Modes

Avoid:

- claiming implementation when the target route is not the edited file
- reporting assets as used when they are merely present but not imported/rendered
- making shared navigation page-specific
- hardcoding screenshot data
- regenerating the INSUREIT brand identity
- rewriting business logic during visual work
- treating a successful build or Expo publication as visual/device verification
- publishing dirty source without clearly reporting it
- creating a preview APK without explicit user approval

## Final Principle

Reference-inspired UI + existing INSUREIT identity + existing live logic + minimum custom artwork + shared reusable components + safe Expo/React Native implementation + evidence-based verification.

## 2026-09-25 — More header aligned with Home and Profile heading added

- Branch: `refine/partner-more-home-header-profile`.
- More now uses the same accepted Home-style hero branding constants: 30x35 logo mark, 14px `insureit` / `Partner` text, 33x33 activity/clock control, and a 35x35 white initials profile avatar using the resolved logged-in identity.
- Added a `Profile` heading inside the More hero using the same compact 14px heading scale.
- Existing More banner artwork, profile summary card, WORK / INSIGHTS / GROW & LEARN / ACCOUNT sections, navigation routes, sign-out behavior, permissions and business logic remain unchanged.
- The same changes are mirrored in `scripts/partner/compat/partner-more-reference-0-1.tsx`; the approved Partner 0.1.0 OTA workflow now verifies these header markers before publishing to the installed `0.1.0 (5)` app.
- **IMPLEMENTED only. NOT MERGED, NOT OTA-PUBLISHED, NO APK/AAB BUILD.**

---

## 2026-09-25 — Claims heading moved directly above search

- Branch: `refine/partner-claims-heading-above-search`.
- Removed the Claims hero subheading `Support. Settle. Keep Your Business Moving.` completely.
- Kept only the `Claims` heading and moved it to the lower-left of the hero using a bottom-based position so it sits directly above the overlapping search field.
- Claims banner artwork, Home-matched logo/activity/profile controls, search/filter controls, KPI cards, claim cards, data, permissions, pagination and navigation remain unchanged.
- The same change is mirrored in `scripts/partner/compat/partner-claims-reference-0-1.tsx`, and the Partner 0.1.0 OTA workflow now fails if the removed subheading or old subtitle styling reappears.
- **IMPLEMENTED only. NOT MERGED, NOT OTA-PUBLISHED, NO APK/AAB BUILD.**

---

## 2026-09-25 — Claims header aligned with Partner Home

- Branch: `refine/partner-claims-home-header-match`.
- User requested the Claims header logo, activity/notification control, profile avatar, and header font sizing to match the Partner Home screen exactly while preserving the Claims-specific banner artwork and the rest of the Claims experience.
- Claims now uses the same Home header visual constants for branding: 30x35 logo mark, 14px `insureit` / `Partner` text, 33x33 clock button with Home contrast treatment, 35x35 white profile avatar, and matching top-row spacing.
- Claims title typography is reduced to the Home header scale (14px) and the supporting subtitle is compacted to remain subordinate without changing its wording.
- Existing claim summary/list RPCs, search/filter/sort behavior, KPI cards, claim cards, pagination, claim-detail navigation, permissions, schema, and business logic remain unchanged.
- The same header treatment is mirrored in `scripts/partner/compat/partner-claims-reference-0-1.tsx`, and the approved Partner 0.1.0 OTA workflow now validates the Home-matched Claims header before publish.
- **IMPLEMENTED only. NOT MERGED, NOT OTA-PUBLISHED, NO APK/AAB BUILD.**

---

## 2026-09-19 — Claims reference-layout redesign for installed Partner 0.1.0 (5)

- Branch: `ui/partner-claims-reference-redesign`.
- User requested the Partner Claims list to match the supplied premium blue reference layout and explicitly required the existing logo to remain unchanged.
- UI implementation keeps the existing official `assets/partner-login-logo.png` asset untouched and uses it as-is in the Claims hero.
- Claims now uses: deep-blue hero, Claims title/subtitle, activity + profile controls, overlapping search/filter bar, four live claim KPI cards, All/Active/Completed lifecycle tabs, sort sheet, dense rounded claim cards, existing claim-detail navigation, and a manual Load More affordance.
- Monthly-trend percentages from the reference are not fabricated because the current Partner claim summary RPC does not provide comparison-period data; the KPI cards identify the current authorized scope instead.
- Existing `partner_app_claim_summary` and `partner_app_list_claims` contracts, authorization scope, search, pagination and claim detail routes are preserved. No schema/RLS/backend change.
- Runtime 0.1.0 compatibility copy is stored at `scripts/partner/compat/partner-claims-reference-0-1.tsx`; the approved compatibility OTA workflow is prepared to install it into the `74039199991888777911deb30cf248e8f36cf8a8` source before publishing preview runtime 0.1.0.
- **IMPLEMENTED only. NOT MERGED, NOT OTA-PUBLISHED, NO APK/AAB BUILD.**

---

# INSUREIT Partner App — Operational Handoff (2026-09-13)

> **Purpose:** durable handoff for any new AI agent continuing INSUREIT Partner work.
> **Scope:** Partner mobile app only (`apps/partner-app`) plus its Partner-specific Expo/EAS/compatibility OTA tooling.
> **Important:** this file records the current operational reality of the installed Partner build and the safe way to continue refinement work.

---

## 1. Read this before touching Partner app code

Also read:

- `AGENTS.md`
- `apps/partner-app/AGENTS.md`
- `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`
- `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`

Do not assume current `main` can be directly published to the currently installed Partner binary.

---

## 2. Installed Partner build that the user is actually testing

The user confirmed the currently installed Android Partner build from Expo build details.

- Build type: Android internal distribution
- EAS profile: `preview`
- Deployment/channel: `preview`
- App version / runtime: `0.1.0`
- Android version code: `3`
- Native build commit: `71cc1d0`
- EAS project ID: `8ade82c1-4c96-4f09-b90b-802270fb406d`
- Runtime policy: `appVersion`

This is the real device baseline that matters for OTA compatibility.

### Critical lesson

A matching runtime string is **not sufficient proof of binary compatibility**.

A previous attempt published much newer Partner source while forcing runtime `0.1.0`. Expo accepted the update, but the installed APK fell back/emergency-launched the embedded old bundle. The user then saw the very old dashboard from the native build baseline.

**Never repeat this.** Do not take current `main`, rewrite its version/runtime to `0.1.0`, and publish it to the old APK.

---

## 3. Approved compatibility source for the current 0.1.0 APK

For the current installed Partner APK, the working compatibility publication flow uses this source baseline:

- `COMPAT_SHA = 74039199991888777911deb30cf248e8f36cf8a8`

The repository workflow checks out:

1. current `main` for tooling/patch scripts;
2. the exact compatibility source at `COMPAT_SHA` for the app bundle;
3. applies narrow JS/TS patches to that compatibility checkout;
4. typechecks that compatibility app;
5. publishes to runtime `0.1.0`, channel `preview`.

Current compatibility workflow:

- `.github/workflows/publish-partner-0-1-home-hero-reference-once.yml`

Current patch tooling evolved around:

- `scripts/partner/patch-0-1-home-hero-reference.mjs`
- later refinement scripts added by PR #1773

Do not silently change `COMPAT_SHA` unless a new source is directly verified on the installed APK.

---

## 4. Native build authorization rule

The user has explicitly required OTA-first delivery.

**Do not create a new Partner APK/AAB/native Expo build without explicit permission for that exact build.**

Normal JS/TS/UI/business-logic changes must use OTA when safe.

If a requested change needs a native module that does not exist in the `0.1.0 (3)` APK, do not add the dependency and publish an OTA as if it will work. Either implement a JS-only alternative or stop and explain why a native rebuild is genuinely required.

Example already discovered:

- newer Business Report date UI uses `@react-native-community/datetimepicker`;
- the actual `0.1.0` compatibility package does not contain that native dependency;
- therefore the 0.1.0-safe refinement must use a pure React Native date/range control rather than that native picker.

---

## 5. Hero/header refinement history and current accepted visual state

The user iteratively refined the Partner Home hero/header against a supplied mockup.

Important milestones:

### PR #1706

- Introduced the structural hero/banner approach instead of a generic page header.
- Full-width hero artwork, branding, controls, greeting and overlapping search became one composition.

### PR #1715

- Corrected the first oversized/cropped hero attempt.
- Reduced hero/control/search proportions and improved artwork focal framing.

### PR #1730

- Further tuned artwork crop/scale, brand/control sizing, greeting spacing and search overlap.
- User later confirmed the overall banner image looked good.

### PR #1746

- Added a device-aware safe-area/status strip above the hero.
- Kept the approved hero crop and composition intact.
- User screenshot confirmed the status-bar strip concept was working and the hero artwork itself was acceptable.

Latest merged hero/status-strip commit from PR #1746:

- merge commit `5b65a47027dfa47811ce94a25b8819165cfeee97`

### Current hero rule

Preserve:

- current hero height/crop/focal framing;
- current branding placement;
- current search overlap;
- safe-area strip above the hero.

Do not restart the hero from scratch.

Current remaining hero issue is **readability**, not composition:

- activity/notification control needs stronger contrast;
- profile avatar needs clearer separation from bright artwork;
- greeting/welcome text needs localized contrast support.

Preferred fix: localized translucent backing/border/shadow, **not** dimming the entire hero image.

---

## 6. Home dashboard current refinement request

User-approved refinements now in progress:

1. Improve contrast/readability of the top activity/notification control.
2. Improve contrast/readability of the profile avatar.
3. Improve greeting text readability with a localized backing/scrim.
4. Make **Pending Tasks** significantly more compact to save vertical space while preserving all task routes/counts.
5. Replace the inappropriate Policy Intake quick-action artwork with a professional policy/document intake icon/glyph.
6. Remove **Recent Activity** from the Home page only.
   - Keep the dedicated Activity route.
   - Keep the top activity/clock shortcut.
7. Fix Business Report date filtering.

Do not disturb business totals, Quick Action routing, bottom navigation, hero crop, or other working sections while implementing these refinements.

---

## 7. Business Report date filter — verified implementation constraint

The compatibility source already has:

- `getPartnerBusinessRange(fromDate, toDate)`
- Supabase RPC: `partner_app_business_range`

The newer `main` UI includes a custom range summary card, but that newer UI depends on a native date picker unavailable in the installed 0.1.0 APK.

For the current compatibility OTA, the desired behavior is:

- select From date;
- select To date;
- apply range;
- chosen range must drive the main Business Report values, not just render a disconnected secondary card;
- update premium, policies, customers, claims and comparison/trend where supported by the RPC;
- no new native dependency.

Regression checks should include:

- same-day range;
- cross-month range;
- valid maximum range;
- From > To prevented;
- future dates prevented;
- Apply disabled until valid;
- refresh/error states do not silently revert to the default month without explanation.

---

## 8. Current active PR

### PR #1773 — `Refine Partner 0.1 home and fix Business Report date filter`

Branch:

- `fix/partner-0-1-home-refinements`

State at handoff creation:

- **OPEN / IMPLEMENTED, NOT MERGED, NOT PUBLISHED**
- CI started; verification must be checked again before merge.

Scope implemented in this PR:

- stronger profile/activity contrast over hero artwork;
- greeting localized contrast backing;
- compact Pending Tasks;
- Policy Intake quick-action visual replacement;
- remove Recent Activity from Home;
- keep Activity route/top shortcut;
- 0.1.0-safe Business Report date range implementation without a new native dependency;
- compatibility OTA workflow remains pinned to `74039199991888777911deb30cf248e8f36cf8a8`.

Never state this PR is deployed until it is merged, the OTA workflow succeeds, and the installed app is visually verified.

---

## 2026-09-19 — Development screenshot policy

- User explicitly requested screenshot blocking to be disabled while the Partner app remains in development.
- `PartnerSensitivePrivacyProvider` now positively releases any existing screen-capture restriction on all routes instead of enabling protection on customer/claim/policy-intake detail screens.
- Biometric/session/native-security structure remains intact so screenshot protection can be re-enabled later as a controlled production-hardening change.
- This is a JS/TS behavior change only; no native rebuild is required for source states where `expo-screen-capture` is already present in the binary. The currently installed 0.1.0 compatibility APK must still follow its separate compatibility/OTA rules.

## 2026-09-19 — Policies reference-layout redesign (reversible)

- Branch: `ui/partner-policies-reference-layout`.
- Scope is UI-only in `apps/partner-app/app/(tabs)/policies.tsx`.
- Replaces the existing Policies presentation with the supplied reference hierarchy: deep-blue hero header, compact search/filter row, four policy KPI cards, full-width Policy Intake CTA, compact lifecycle tabs, dense rounded policy cards and manual Load More affordance.
- Existing `partner_app_policy_summary` / `partner_app_list_policies` data sources, Partner scope, policy detail navigation, lifecycle values, search and pagination remain unchanged.
- Reference-only labels map existing lifecycle values as `in_force -> Active`, `expiring -> Expiring Soon`, `expired -> Lapsed`; `upcoming` remains available rather than inventing a non-existent Cancelled backend state.
- No schema, Supabase, permission, accounting or native dependency changes. Revert is one feature commit/PR revert.
- **IMPLEMENTED; PR/CI/merge/OTA/device verification pending.**

## 9. OTA publication discipline

For the current installed app:

- channel: `preview`
- runtime: `0.1.0`
- compatibility source: `74039199991888777911deb30cf248e8f36cf8a8`

Before publishing:

1. confirm PR checks are green;
2. confirm the compatibility checkout is exactly `COMPAT_SHA`;
3. confirm `app.json` reports version/runtime `0.1.0` and runtime policy `appVersion`;
4. typecheck the compatibility app after patches are applied;
5. confirm correct Partner EAS project ID;
6. publish to `preview`;
7. record update group/platform update IDs if available;
8. ask user to force-close and cold-launch twice;
9. require installed-device screenshot/behavior verification before calling it VERIFIED.

**An Expo publish success is DEPLOYED, not device-VERIFIED.**

---

## 10. Failure modes already learned

### A. Wrong source with correct runtime

**Failed assumption:** runtime `0.1.0` alone guarantees compatibility.

**Observed result:** app fell back to the old embedded dashboard.

**Correct rule:** publish from a source known to run against that native binary/fingerprint; for the current APK use the approved compatibility baseline and narrow patches.

### B. Solving hero mismatch by only changing dimensions

**Failed approach:** repeatedly changing hero height/search height without changing the composition/focal framing.

**Correct rule:** preserve the current successful hero composition; future changes should be localized refinements.

### C. Adding native UI dependencies to an old binary

**Risk:** OTA JS can reference a native package that is not in the installed APK.

**Correct rule:** inspect the compatibility package before adopting any native library. Use JS-only alternatives until the user explicitly authorizes a native build.

---

## 11. Data and navigation boundaries that must remain intact

Home currently relies on Partner server-authorized context and existing RPC-backed data.

Do not:

- bypass Partner scope/authorization;
- replace server-authorized counts with hardcoded values;
- hardcode the user's name to match screenshots;
- remove Activity route just because the Home Recent Activity card is removed;
- change business/accounting semantics as part of visual polish;
- make database/RLS/schema changes as part of these UI refinements unless separately scoped and approved.

Greeting/avatar use resolved identity data; screenshots may show company/partner identity such as `Frontier Trucks Pvt Ltd / FT`. Treat that as data behavior, not a styling bug, unless the user separately requests employee-level identity display.

---

## 12. How a new agent should resume

1. Read this file and `apps/partner-app/AGENTS.md`.
2. Read PR #1773 and inspect the latest CI state.
3. Do not create a new APK.
4. Do not publish current `main` directly to runtime `0.1.0`.
5. If PR #1773 is green, review the diff for narrow scope and regressions.
6. Merge only when safe/authorized by the user.
7. Let the compatibility OTA workflow publish only the approved 0.1.0 bundle.
8. Verify on the user's installed device with screenshots and actual Business Report date filtering.
9. Update this handoff after any material Partner runtime, OTA, native-build, compatibility-source, or user-visible milestone.

---

## 13. Evidence language

Use precise state labels:

- **IMPLEMENTED** — committed in branch/code.
- **MERGED** — merged into `main`.
- **DEPLOYED** — Expo/EAS OTA publish succeeded for the exact update.
- **VERIFIED** — user/device/runtime behavior directly observed after deployment.
- **BLOCKED** — named dependency prevents progress.
- **UNVERIFIED** — expected but not directly observed.

Never collapse merge, publish and device verification into one status.

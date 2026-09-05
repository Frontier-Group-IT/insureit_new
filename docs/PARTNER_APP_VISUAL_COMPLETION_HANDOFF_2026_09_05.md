# INSUREIT Partner — Visual Completion Handoff

> **Created:** 2026-09-05 (IST)  
> **Scope:** `apps/partner-app` visual-system completion before the next native Partner build  
> **Status:** USER-APPROVED OTA REFINEMENT CONTINUATION / IN PROGRESS

Read this with `AGENTS.md` and `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner refinement.

## Durable correction to earlier phase status

The user's installed-screen audit showed that technical completion of Phases 0–5 did **not** equal app-wide visual completion. Shared primitives existed, but formatting and custom Partner artwork were not consistently propagated across all screens.

**Do not advance to native Phase 6 merely because the older phase table says Phases 0–5 are complete.** Complete the OTA-safe visual migration, publish/verify it in the installed Partner preview, then re-evaluate the native batch.

## Asset rule

- Feature identity, meaningful status, empty/error states, banners, profile and support surfaces should prefer approved Partner artwork.
- Back, close, chevron, overflow, filter, calendar, edit, small contact shortcuts and other lightweight utility controls remain vector icons.
- Do not replace every glyph with 3D art.
- Do not assign a generated banner/avatar a semantic meaning it does not clearly represent.
- The current banner batch is mainly generic business-growth artwork; do **not** relabel it as Claims Assistance, Renewal Opportunities, Academy, pending intake or insurer announcements.

## Slice 1 — shared feature identity

**MERGED:** PR #1333  
**Merge:** `53b52a5abb6383be33d5146c19b7afcb9b803dc6`  
**Partner Verify:** #186 / `33979348613` success  
**Web Verify:** #3014 / `33979348649` success

Delivered:

- shared feature-artwork support in `PartnerTopBar`, `PartnerScreen` and `PartnerListScreen`;
- centralized `partner-screen-artwork.ts` mapping for major Partner routes;
- registration of prepared Learn, Support Verified, Apps Grid and Settings artwork;
- branded Offline/Error/Unauthorized defaults in `PartnerStateView`;
- complete feature-art coverage in More;
- `verify:visual` CI regression.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 2 — core operational list/state artwork

**MERGED:** PR #1334  
**Merge:** `28ac62daf0092fe7f8a320b9669f4d0209e0f29f`  
**Partner Verify:** #187 / `33979804980` success  
**Web Verify:** #3015 / `33979804906` success

Delivered:

- Customers: branded no-customer state; initials intentionally retained for real customer identity.
- Policies: branded empty state plus Motor/Health/Life-family/Commercial row artwork.
- Claims: Partner claim artwork for active/empty states and Verified artwork for completed claims.
- Renewals: branded empty state plus Renewal/Warning artwork by queue state.
- Policy Intake history: Upload/Processing, Pending Review, Needs Attention, Completed and Rejected artwork mapped to existing states.
- `verify:visual` expanded to protect the core screen mappings.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 3 — Search, Support, Settings and Activity

**MERGED:** PR #1336  
**Merge:** `bb16602adae63f43b6b9e5595d42abea909ffa84`  
**Final head:** `006634debd49aa88c8381dbe0ca1d054ac086ee4`  
**Partner Verify:** #192 / `33980782882` success  
**Web Verify:** #3021 / `33980782864` success

Important CI lesson:

- final-head Partner CI first failed because `asset && styles.linkArtwork` in Settings produced a React Native TypeScript style-union error;
- fixed by using `asset ? styles.linkArtwork : undefined`;
- exact final head then passed Partner and Web verification before merge.

Delivered:

- Search: branded Search/no-results states and Customer/Policy/Claim result artwork.
- Support: verified Support artwork for Operations Desk fallback; real relationship-contact initials retained.
- Settings: Partner Profile, Support and Settings/update artwork for feature rows while privacy/chevron utilities stay vector-based.
- Activity: event-specific Policy/Claim/Policy Intake/Learn artwork replaced generic colored timeline dots; empty timeline uses Announcement artwork.
- Activity tiny 7–8.5px timeline text was raised to the shared readable mobile scale.
- `verify:visual` protects Search, Support, Settings and Activity semantics and typography.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 4 — Impact and Journey body normalization

**IN PROGRESS:** branch `partner/visual-system-completion-slice4`  
**Base:** Slice 3 merge `bb16602adae63f43b6b9e5595d42abea909ffa84`.

Implemented:

- **Impact:** generic car/people/document/shield feature glyphs replaced with approved Motor, Customers, Policies and Claims Partner artwork.
- **Impact:** claim outcome card now uses Verified artwork and journey link uses Journey artwork.
- **Impact:** legacy 7.5–8.5px labels were replaced with the shared theme typography scale; copy was shortened without changing data meaning.
- **Journey:** timeline dots replaced with Journey artwork; empty state continues using Journey artwork.
- **Journey:** legacy 7.5–8.5px labels/timeline text were raised to the shared readable mobile scale.
- `verify:visual` now blocks regressions in Impact/Journey artwork and tiny typography.

No API, data calculation, scope, routes, backend, schema/RLS, runtime or native configuration changed.

## Remaining visual-completion work

Priority order after Slice 4:

1. **Business body** — replace locally generic renewal/claim/network/payout feature imagery where a correct Partner asset exists and normalize dense local styling without changing commercial calculations or authorization.
2. **Profile body** — keep identity initials unless an avatar is definitely semantically correct; normalize remaining spacing/details only.
3. **Your Week / Recognition / Learn** — finish body typography and feature-art consistency.
4. **Policy Intake new/detail** — apply correct Upload/Review/Attention/Completed/Failed artwork to upload/retry/detail states.
5. **Customer / Policy / Claim detail pages** — check body spacing, section/card hierarchy and meaningful feature/status artwork.
6. **Banner review** — current approved banner set is generic business-growth artwork only; use it only on genuinely business/growth surfaces and never mislabel it.
7. Final installed-app screen-by-screen QA, then one consolidated Partner preview OTA publication when explicitly intended.

## Acceptance gate before native Phase 6

Visual completion is not done until:

- every major Partner route follows the same header/spacing/card/section system;
- feature artwork is intentional and consistent;
- vector icons remain only for utilities or when no correct custom asset exists;
- relevant empty/error/offline states are branded;
- banner use is semantically correct and does not displace operational work;
- exact-head Partner CI and relevant web regression are green;
- merged OTA-safe source is published through the Partner preview OTA path when explicitly intended;
- installed Partner preview is cold-launched and changed screens are visually checked;
- no new Partner APK/AAB is created without explicit approval for that exact native build.

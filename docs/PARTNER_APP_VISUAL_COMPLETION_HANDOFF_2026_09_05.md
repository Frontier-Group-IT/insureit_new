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
- Do not assign generated banner/avatar artwork a semantic meaning it does not clearly represent.
- The current banner batch is mainly generic business-growth artwork; do **not** relabel it as Claims Assistance, Renewal Opportunities, Academy, pending intake or insurer announcements.

## Completed visual slices

### Slice 1 — shared feature identity

**MERGED:** PR #1333  
**Merge:** `53b52a5abb6383be33d5146c19b7afcb9b803dc6`  
**Partner Verify:** #186 / `33979348613` success  
**Web Verify:** #3014 / `33979348649` success

Shared feature artwork was added to common screen shells, feature-art mapping was centralized, common failure states became branded, More feature-art coverage was completed and `verify:visual` was introduced.

### Slice 2 — core operational list/state artwork

**MERGED:** PR #1334  
**Merge:** `28ac62daf0092fe7f8a320b9669f4d0209e0f29f`  
**Partner Verify:** #187 / `33979804980` success  
**Web Verify:** #3015 / `33979804906` success

Customers, Policies, Claims, Renewals and Policy Intake history received appropriate branded list/empty/status artwork without changing data behavior.

### Slice 3 — Search, Support, Settings and Activity

**MERGED:** PR #1336  
**Merge:** `bb16602adae63f43b6b9e5595d42abea909ffa84`  
**Final head:** `006634debd49aa88c8381dbe0ca1d054ac086ee4`  
**Partner Verify:** #192 / `33980782882` success  
**Web Verify:** #3021 / `33980782864` success

Delivered branded Search/Support/Settings surfaces plus event-specific Activity artwork and readable Activity timeline typography.

**CI lesson:** `asset && styles.linkArtwork` in React Native Settings created a TypeScript style union containing `0`; use `asset ? styles.linkArtwork : undefined` instead. Final exact head passed both gates before merge.

### Slice 4 — Impact and Journey

**MERGED:** PR #1338  
**Merge:** `62ea263c7bcd958efbc7748da366feb93cf5277b`  
**Final head:** `9cce862884f462bade399608f7136c497219592a`  
**Partner Verify:** #193 / `33981084342` success  
**Web Verify:** #3023 / `33981084184` success

Impact now uses Motor/Customers/Policies/Claims artwork, Verified claim-outcome artwork and Journey artwork. Journey timeline dots were replaced with Journey artwork. Both screens had legacy tiny typography removed.

### Slice 5 — Your Week, Recognition, Learn and Profile audit

**MERGED:** PR #1342  
**Merge:** `e03f392ea47d5e642951ebe9ee880c5db6cd232d`  
**Final head:** `2563489876a6b7f3c3c7da8a054d506dc9d527ae`  
**Partner Verify:** #194 / `33981465353` success  
**Web Verify:** #3028 / `33981465350` success

Delivered:

- Your Week: retained correct Renewal artwork and replaced remaining 7.5–9px local labels with shared typography.
- Recognition: milestone cards use Learn, Renewal and Journey artwork instead of generic feature glyphs; tiny text removed.
- Learn: no-card and learning-feedback states use Learn artwork, correct-answer feedback uses Verified artwork, and tiny option/stats/explanation/footnote typography was normalized. Quiz loading/submission/scoring semantics were not changed.
- Profile audit: no body code change was justified. Real signed-in-user initials are intentionally retained because arbitrary avatar artwork could misrepresent identity; registration rows already use shared typography and the common header supplies branded Profile identity.
- `verify:visual` protects these engagement decisions.

### Business body pass

**MERGED:** PR #1344  
**Merge:** `4a017d294b6f726a9f5f3c29897217e2fd131128`  
**Partner Verify:** #195 / `33981793956` success  
**Web Verify:** #3030 / `33981794112` success

Delivered:

- Today → Renewals uses `PartnerAssets.actions.renewals` instead of a generic refresh glyph.
- Today → Active Claims uses `PartnerAssets.navigation.claims` instead of a generic shield glyph.
- My Network uses `PartnerAssets.actions.businessPerformance` instead of a locally drawn network symbol/tree.
- Touched action/network/card radii use the shared Partner radius.
- Restricted payout lock intentionally remains a vector security/authorization symbol.
- `verify:visual` protects the artwork and explicitly preserves the existing payout authorization gate and `getPartnerPayoutSummary()` service path.

**Explicitly unchanged:** business calculations, trend/mix calculations, payout amounts/status semantics, payout authorization, Partner scope, network sorting, routes, API/RPC/service calls, backend/schema/RLS, runtime/native configuration.

## Preview OTA checkpoint — 2026-09-05

The user explicitly requested a device-review OTA before the next refinement stage.

- Trigger commit on `main`: `1f215486f8f337f389dd75eb13fc6b5fbc984743`
- Workflow: `Publish Partner preview OTA`
- Workflow run: #45 / `33983382784`
- Channel: `preview`
- Result: **success**
- Exact-current-main guard: passed
- Partner EAS/update identity guard: passed
- Expo project access: passed
- OTA publish step: passed
- No APK/AAB or native build was created.

Important boundary: this checkpoint OTA contains the merged visual work through the Business pass. The Policy Intake new/detail branch described below was intentionally **not** included in that OTA.

## Policy Intake new/detail pass

**IN PROGRESS:** branch `partner/visual-system-completion-intake-details`

Implemented:

- **New Policy Intake:** policy-file selection uses Upload artwork before selection and Verified artwork after selection; Ready to submit uses Verified artwork.
- Existing radio controls, chevrons and send button icons remain vectors because they are interaction utilities rather than feature identity.
- **Policy Intake detail:** status artwork is centralized in `statusArtwork(row)` and maps:
  - processing → Document Upload
  - ready/in review → Pending Review
  - needs attention / manual review → Policy Attention
  - completed → Verified
  - rejected → Rejected
- Missing/unavailable intake uses prepared Policy Upload artwork.
- Operations-attention card uses Policy Attention artwork instead of the generic alert feature glyph.
- Replacement upload progress uses Document Upload artwork.
- Disclosure chevrons and Open final policy / Upload replacement button glyphs remain utility/action vectors.
- `verify:visual` protects all Intake artwork mappings and explicitly checks that draft restore/save, initial submit service, and replacement-submit service paths remain intact.

**Explicitly unchanged:** DocumentPicker types/size rules, draft save/restore timing, customer-mobile validation, lead-source behavior, upload progress calculation, submit locking, submit/replacement API calls, routing, OCR/status semantics, backend/schema/RLS, runtime/native configuration.

## Remaining visual-completion work

After the Policy Intake pass:

1. **Customer / Policy / Claim detail pages** — audit body spacing, section/card hierarchy and meaningful status/product artwork while preserving identity initials and all business/data behavior.
2. **Banner review** — current approved banner set is generic business-growth artwork only. Use only where genuinely business/growth oriented; do not force banners into operational screens.
3. **Final source audit** — verify all major Partner routes against the visual system and remaining generic feature-level glyphs.
4. **Final consolidated Partner preview OTA** after all remaining OTA-safe visual work is merged and intended for device review.
5. **Installed-app screen-by-screen QA** including two cold launches, then decide whether OTA visual refinement is accepted and native Phase 6 may be reconsidered.

## Acceptance gate before native Phase 6

Visual completion is not done until:

- every major Partner route follows the same header/spacing/card/section system;
- feature artwork is intentional and consistent;
- vector icons remain only for utilities/security semantics or when no correct custom asset exists;
- relevant empty/error/offline states are branded;
- banner use is semantically correct and does not displace operational work;
- exact-head Partner CI and relevant web regression are green;
- merged OTA-safe source is published through the Partner preview OTA path when explicitly intended;
- installed Partner preview is cold-launched and changed screens are visually checked;
- no new Partner APK/AAB is created without explicit approval for that exact native build.

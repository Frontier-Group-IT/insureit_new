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
- Current exposed banners are generic business-growth artwork; do **not** relabel them as Claims Assistance, Renewal Opportunities, Academy, pending intake or insurer announcements.

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

**CI lesson:** `asset && styles.linkArtwork` in React Native Settings created a TypeScript style union containing `0`; use `asset ? styles.linkArtwork : undefined` instead.

### Slice 4 — Impact and Journey
**MERGED:** PR #1338  
**Merge:** `62ea263c7bcd958efbc7748da366feb93cf5277b`  
**Partner Verify:** #193 / `33981084342` success  
**Web Verify:** #3023 / `33981084184` success

Impact uses Motor/Customers/Policies/Claims artwork, Verified claim-outcome artwork and Journey artwork. Journey timeline dots were replaced with Journey artwork. Legacy tiny typography was removed from both screens.

### Slice 5 — Your Week, Recognition, Learn and Profile audit
**MERGED:** PR #1342  
**Merge:** `e03f392ea47d5e642951ebe9ee880c5db6cd232d`  
**Partner Verify:** #194 / `33981465353` success  
**Web Verify:** #3028 / `33981465350` success

Your Week, Recognition and Learn were normalized. Profile deliberately retains the signed-in user's initials because arbitrary generated avatar artwork could misrepresent identity.

### Business body pass
**MERGED:** PR #1344  
**Merge:** `4a017d294b6f726a9f5f3c29897217e2fd131128`  
**Partner Verify:** #195 / `33981793956` success  
**Web Verify:** #3030 / `33981794112` success

Renewals, Claims and My Network use approved Partner artwork. Restricted payout lock remains a vector security symbol. Business calculations, payout values/statuses, payout authorization, Partner scope, network sorting and service calls were unchanged and regression-protected.

## Preview OTA checkpoint — 2026-09-05

The user explicitly requested a device-review OTA before continuing the next refinement stage.

- Trigger commit on `main`: `1f215486f8f337f389dd75eb13fc6b5fbc984743`
- Workflow: `Publish Partner preview OTA`
- Run: #45 / `33983382784`
- Channel: `preview`
- Result: **success**
- Exact-current-main, Partner EAS identity and Expo access guards passed.
- No APK/AAB or native build was created.

**Boundary:** this checkpoint OTA contains merged visual work through the Business pass. Policy Intake and detail-page work below occurred after this checkpoint and are not part of that device snapshot.

### Policy Intake new/detail pass
**MERGED:** PR #1347  
**Merge:** `168481565fa833f696c703ab059afaf146518574`  
**Final head:** `fd6fd8832e12975ecaa3a6831c7e944f7d5c4a5b`  
**Partner Verify:** #196 / `33983916606` success  
**Web Verify:** #3036 / `33983916596` success

Delivered:

- New Policy Intake file selection uses Document Upload artwork before selection and Verified artwork after selection / ready-to-submit.
- Policy Intake detail centralizes semantic status artwork:
  - processing → Document Upload
  - ready/in review → Pending Review
  - needs attention / manual review → Policy Attention
  - completed → Verified
  - rejected → Rejected
- unavailable intake uses Policy Upload artwork;
- Operations-attention and replacement-upload progress use the appropriate status artwork;
- radio controls, chevrons and button action glyphs remain vectors;
- `verify:visual` explicitly protects draft restore/save, initial submit and replacement-submit service paths.

**Explicitly unchanged:** DocumentPicker rules, draft timing, mobile validation, lead-source behavior, upload progress, submit locks, submit/replacement APIs, routing, OCR/status semantics, backend/schema/RLS, runtime/native configuration.

## Customer / Policy / Claim detail-page pass

**IN PROGRESS:** branch `partner/visual-system-completion-detail-pages`  
**Exact base:** Policy Intake merge `168481565fa833f696c703ab059afaf146518574`.

Implemented:

- **Policy detail:** hero uses product artwork by category: Motor → `motorInsurance`, Health → `healthInsurance`, Life → `familyInsurance`, Non-Motor → `commercialInsurance`. Customer entity uses Customers artwork; linked vehicle uses Motor artwork; non-motor insured risk uses Commercial artwork. Disclosure chevrons remain vectors.
- Important registry correction: there is **no** `PartnerAssets.products.lifeInsurance`; Life intentionally uses the existing `familyInsurance` asset, matching the established registry.
- **Claim detail:** hero uses Claims artwork for normal active claims, Claim Attention only for pending/attention states, and Verified for completed/settled/closed states. Customer link uses Customers artwork. Journey rail uses Claims artwork for creation and Journey artwork for subsequent status/stage events rather than generic dots. Empty journey uses Journey artwork.
- **Customer detail:** real customer initials remain the hero identity. Policy rows use category product artwork, vehicle rows use Motor artwork, claim rows use Claims / Claim Attention / Verified based on actual status. Expand chevrons remain utility vectors.
- `verify:visual` now protects all three detail surfaces, blocks the old generic person/car/document/shield feature glyphs where they acted as entity identity, and explicitly preserves `getPartnerPolicyDetail(id)`, `getPartnerCustomerDetail(id)` and `getPartnerClaimDetail(id)` service paths.

No customer/policy/claim calculations, scope, status semantics, routes, data services, backend/schema/RLS, runtime or native configuration changed.

## Remaining OTA-safe visual-completion work

After the detail-page pass:

1. **Banner review** — only use exposed business-growth banners on genuinely business/growth surfaces; do not force banners into operational/detail screens.
2. **Final source audit** — inspect every major Partner route for remaining generic feature-level glyphs, tiny local typography, inconsistent section/card hierarchy and unbranded relevant empty/error states.
3. **Final consolidated Partner preview OTA** after all remaining OTA-safe visual changes are merged and intended for device review.
4. **Installed-app screen-by-screen QA** including two cold launches and comparison against the user's screenshot/audit baseline.
5. Only after visual acceptance may native Phase 6 be reconsidered.

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

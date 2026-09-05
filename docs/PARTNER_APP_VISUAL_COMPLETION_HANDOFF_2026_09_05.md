# INSUREIT Partner — Visual Completion Handoff

> **Created:** 2026-09-05 (IST)  
> **Scope:** `apps/partner-app` visual-system completion before the next native Partner build  
> **Status:** OTA-SAFE VISUAL SOURCE COMPLETION MERGED + FINAL PREVIEW OTA PUBLISHED / INSTALLED-APP ACCEPTANCE PENDING

Read this with `AGENTS.md` and `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner refinement.

## Durable correction to earlier phase status

The user's installed-screen audit showed that technical completion of Phases 0–5 did **not** equal app-wide visual completion. Shared primitives existed, but formatting and custom Partner artwork were not consistently propagated across all screens.

**Do not advance to native Phase 6 merely because the older phase table says Phases 0–5 are complete.** The OTA-safe visual migration is now merged and published to Partner preview, but installed-app visual acceptance is still required before native Phase 6 can be reconsidered.

## Asset and visual rules

- Feature identity, meaningful status, empty/error states, banners, profile and support surfaces should prefer approved Partner artwork.
- Back, close, chevron, overflow, filter, calendar, edit, CTA arrows, small contact shortcuts and security/authorization locks remain vector icons.
- Do not replace every glyph with 3D art.
- Real people/customers/partners should use actual identity or initials unless an approved factual avatar exists. Do not assign arbitrary generated avatars.
- Current exposed banners are generic business-growth artwork. They must **not** be relabeled as Claims Assistance, Renewal Opportunities, Academy, pending intake, insurer announcements or any other unsupported semantic.
- Operational/detail screens should not receive generic growth banners merely to increase artwork usage.

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
**Partner Verify:** #187 success  
**Web Verify:** #3015 success

Customers, Policies, Claims, Renewals and Policy Intake history received appropriate branded list/empty/status artwork without changing data behavior.

### Slice 3 — Search, Support, Settings and Activity
**MERGED:** PR #1336  
**Merge:** `bb16602adae63f43b6b9e5595d42abea909ffa84`  
**Final head:** `006634debd49aa88c8381dbe0ca1d054ac086ee4`  
**Partner Verify:** #192 / `33980782882` success  
**Web Verify:** #3021 / `33980782864` success

Search, Support and Settings received semantic Partner artwork. Activity uses event-specific artwork and shared readable typography.

**CI lesson:** in React Native conditional styles, use `asset ? styles.foo : undefined`, not `asset && styles.foo`, because the latter can introduce `0` into the style union.

### Slice 4 — Impact and Journey
**MERGED:** PR #1338  
**Merge:** `62ea263c7bcd958efbc7748da366feb93cf5277b`  
**Partner Verify:** #193 / `33981084342` success  
**Web Verify:** #3023 / `33981084184` success

Impact uses Motor/Customers/Policies/Claims artwork, Verified claim-outcome artwork and Journey artwork. Journey timeline dots were replaced with Journey artwork. Legacy tiny typography was removed.

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

## Intermediate preview OTA checkpoint — 2026-09-05

The user explicitly requested a device-review OTA before continuing the next refinement stage.

- Trigger commit on `main`: `1f215486f8f337f389dd75eb13fc6b5fbc984743`
- Workflow: `Publish Partner preview OTA`
- Run: #45 / `33983382784`
- Channel: `preview`
- Result: **success**
- Exact-current-main, Partner EAS identity and Expo access guards passed.
- No APK/AAB or native build was created.

**Boundary:** this checkpoint OTA contained merged visual work through the Business pass only.

### Policy Intake new/detail pass
**MERGED:** PR #1347  
**Merge:** `168481565fa833f696c703ab059afaf146518574`  
**Final head:** `fd6fd8832e12975ecaa3a6831c7e944f7d5c4a5b`  
**Partner Verify:** #196 / `33983916606` success  
**Web Verify:** #3036 / `33983916596` success

New Policy Intake uses Document Upload / Verified artwork for file and ready states. Policy Intake detail centralizes Processing / Review / Attention / Completed / Rejected artwork. Draft save/restore, submit/replacement APIs, upload rules, OCR/status semantics and routing are unchanged and regression-protected.

### Customer / Policy / Claim detail-page pass
**MERGED:** PR #1348  
**Merge:** `14356cd1177d55cef9424d1b59ca3dcedcb7f4f0`  
**Final head:** `be3c9ff86a649a8a686464f0b402794497a5c2fc`  
**Partner Verify:** #197 / `33984339164` success  
**Web Verify:** #3037 / `33984338949` success

Delivered:

- **Policy detail:** semantic product artwork by category: Motor → `motorInsurance`, Health → `healthInsurance`, Life → `familyInsurance`, Non-Motor → `commercialInsurance`; Customer entity uses Customers artwork; linked vehicle uses Motor artwork; non-motor insured risk uses Commercial artwork.
- Registry fact: there is **no** `PartnerAssets.products.lifeInsurance`; Life intentionally uses the existing `familyInsurance` asset.
- **Claim detail:** active claims use Claims artwork, actual pending/attention states use Claim Attention, completed/settled/closed use Verified; Customer link uses Customers artwork; journey rail uses Claims for creation and Journey for later events instead of dot-only markers.
- **Customer detail:** real customer initials remain the hero identity; Policy rows use product artwork, Vehicle rows use Motor artwork, Claim rows use Claims / Claim Attention / Verified based on actual status.
- Chevrons and expand controls remain utility vectors.
- Existing scoped detail services `getPartnerPolicyDetail(id)`, `getPartnerCustomerDetail(id)` and `getPartnerClaimDetail(id)` are regression-protected.

### Final source audit / Pulse completion
**MERGED:** PR #1349  
**Merge:** `5d96093f4bb51d694ec4002c6a10f1e7286755d3`  
**Final head:** `4d5ea6dcd13ecf4f86312e84f6d3d3dc640f9685`  
**Partner Verify:** #198 / `33984765766` success  
**Web Verify:** #3038 / `33984765773` success

Final audit decisions:

- **Banners:** generic growth banners are not forced into Policies, Claims, Renewals, Customers, Policy Intake, Search, Support or detail pages. `verify:visual` blocks `PartnerAssets.banners.*` on those operational/detail surfaces.
- **Network:** real Partner families retain initials; group/layer/POSP/MISP structural symbols remain lightweight vectors because no exact prepared semantic asset exists. The screen already uses shared typography and centralized Business/Network header artwork.
- **Stories:** Stories intentionally remains an immersive dark story viewer with its own progress/header/story-type icon language and is not forced into the ordinary white PartnerScreen/card treatment.
- **Pulse:** the last concrete source outlier was completed:
  - loading/error → shared branded `PartnerStateView`;
  - Business momentum → `PartnerAssets.actions.businessPerformance`;
  - Renewal readiness → `PartnerAssets.actions.renewals`;
  - Customer service → `PartnerAssets.navigation.claims`;
  - Operations actions → `PartnerAssets.navigation.policyIntake`;
  - legacy 8–9.5px labels moved to shared typography;
  - standard radius/touch tokens used;
  - CTA arrow remains a utility vector;
  - existing `getPartnerHome()` behavior is regression-protected.

## Final consolidated Partner preview OTA — 2026-09-05

This is the OTA intended for installed-app acceptance of the completed OTA-safe visual source pass.

- Final visual-source merge: `5d96093f4bb51d694ec4002c6a10f1e7286755d3`
- OTA trigger commit on `main`: `1a0e6921c4082390b435a36e93207a748fa61888`
- Workflow: `Publish Partner preview OTA`
- Run: #46 / `33984956718`
- Channel: `preview`
- Result: **success**
- Exact-current-main guard: passed
- Partner EAS/update linkage guard: passed
- Expo project access: passed
- Actual `Publish Partner preview OTA` step: passed
- OTA summary: passed
- No APK/AAB or native build was created.

This final OTA includes the later Policy Intake, Customer/Policy/Claim detail, and Pulse/final-audit work that was not present in OTA checkpoint #45.

## Current acceptance state

**Source/CI/OTA status:** complete for the planned OTA-safe visual refinement.  
**Installed-app visual acceptance:** pending user/device review.

Required device acceptance step:

1. Cold-launch the installed Partner preview twice so the new OTA is definitely active.
2. Review the major changed surfaces, especially Home/More, Business, Pulse, Policies/Claims/Customers/Renewals, Policy Intake, Search/Support/Settings/Activity, Impact/Journey/Recognition/Learn/Your Week, and Customer/Policy/Claim details.
3. Compare against the user's screenshot/audit baseline and report any visible regressions or remaining inconsistencies.

## Acceptance gate before native Phase 6

Native Phase 6 remains blocked until installed-app visual review is accepted. Specifically:

- every major Partner route must visually match the intended shared system or an explicitly documented intentional mode such as Stories;
- feature artwork must look intentional and consistent on the real device;
- generic growth banners must not appear as false operational semantics;
- no navigation/session/claim-flow/vehicle-selector regression may appear during device testing;
- the final preview OTA above must be visibly active;
- no new Partner APK/AAB may be created without explicit user approval for that exact native build.

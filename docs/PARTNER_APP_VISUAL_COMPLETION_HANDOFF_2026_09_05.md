# INSUREIT Partner — Visual Completion Handoff

> **Created:** 2026-09-05 (IST)  
> **Scope:** `apps/partner-app` visual-system completion before the next native Partner build  
> **Status:** USER-APPROVED OTA REFINEMENT CONTINUATION / FINAL SOURCE AUDIT IN PROGRESS

Read this with `AGENTS.md` and `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before Partner refinement.

## Durable correction to earlier phase status

The user's installed-screen audit showed that technical completion of Phases 0–5 did **not** equal app-wide visual completion. Shared primitives existed, but formatting and custom Partner artwork were not consistently propagated across all screens.

**Do not advance to native Phase 6 merely because the older phase table says Phases 0–5 are complete.** Complete the OTA-safe visual migration, publish/verify the final merged source in the installed Partner preview, then re-evaluate the native batch.

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

## Preview OTA checkpoint — 2026-09-05

The user explicitly requested a device-review OTA before continuing the next refinement stage.

- Trigger commit on `main`: `1f215486f8f337f389dd75eb13fc6b5fbc984743`
- Workflow: `Publish Partner preview OTA`
- Run: #45 / `33983382784`
- Channel: `preview`
- Result: **success**
- Exact-current-main, Partner EAS identity and Expo access guards passed.
- No APK/AAB or native build was created.

**Boundary:** this checkpoint OTA contains merged visual work through the Business pass. Later Policy Intake/detail/final-audit work is not part of that device snapshot.

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

## Final source audit

**IN PROGRESS:** branch `partner/visual-system-final-audit`  
**Exact base:** detail-page merge `14356cd1177d55cef9424d1b59ca3dcedcb7f4f0`.

### Audit decisions already resolved

- **Banners:** no generic growth banner is being forced into Policies, Claims, Renewals, Customers, Policy Intake, Search, Support or detail pages. `verify:visual` now prevents `PartnerAssets.banners.*` from appearing on those operational/detail surfaces. A future banner can be added only when its artwork has exact semantic meaning for the target surface.
- **Network:** real Partner families retain initials; group/layer/POSP/MISP structural symbols remain lightweight vectors because there is no exact prepared semantic asset for those entity types. The Network screen already uses shared typography and the centralized Business/Network header artwork. Do not replace structural symbols with arbitrary 3D art.
- **Stories:** Stories remains an intentionally immersive dark story viewer with its own progress/header/story-type icon language. Its distinct presentation is intentional and should not be forced into the ordinary white PartnerScreen/card layout.

### Pulse — final concrete outlier found and fixed

Before this audit, `app/pulse.tsx` still used generic feature glyphs and multiple 8–9.5px local labels. It is now migrated:

- loading/error → shared `PartnerStateView` branded states;
- Business momentum → `PartnerAssets.actions.businessPerformance`;
- Renewal readiness → `PartnerAssets.actions.renewals`;
- Customer service → `PartnerAssets.navigation.claims`;
- Operations actions → `PartnerAssets.navigation.policyIntake`;
- feature rows render Partner artwork instead of `trending-up`, refresh, shield and document glyphs;
- hero/row/next-action labels use shared typography and standard radius/touch tokens;
- CTA forward arrow remains a utility vector;
- `getPartnerHome()` data/service behavior is explicitly regression-protected.

`verify:visual` now also prevents the old Pulse feature glyphs/tiny typography from returning and enforces the no-fake-operational-banner rule.

## Remaining before OTA visual acceptance

1. Final-audit PR must pass exact-head Partner and relevant Web CI and be merged.
2. Publish one **final consolidated Partner preview OTA** from exact current `main` after the audit merge.
3. Record the final OTA trigger SHA, run number/id and result in this handoff.
4. On the installed Partner preview, cold-launch twice and visually check the changed screens against the user's screenshot/audit baseline.
5. Only after that installed-app review can the OTA visual refinement be considered accepted and native Phase 6 be reconsidered.

## Acceptance gate before native Phase 6

Visual completion is not accepted until:

- every major Partner route follows the intended shared header/spacing/card/section system or has an explicitly documented intentional mode such as Stories;
- feature artwork is intentional and consistent;
- vector icons remain only for utilities/security/structural semantics or where no correct custom asset exists;
- relevant empty/error/offline states are branded;
- generic growth banners are not misused as operational semantics;
- exact-head Partner CI and relevant web regression are green;
- final merged OTA-safe source is published through the Partner preview OTA path;
- installed Partner preview is cold-launched and changed screens are visually checked;
- no new Partner APK/AAB is created without explicit approval for that exact native build.

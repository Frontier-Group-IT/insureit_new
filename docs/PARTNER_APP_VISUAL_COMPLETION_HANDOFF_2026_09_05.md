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

- **Customers:** `noCustomers` artwork for empty/no-result customer book; initials intentionally retained for real customer identity.
- **Policies:** `noPolicies` empty state; Motor/Health/Life-family/Commercial product artwork in rows instead of generic category glyphs.
- **Claims:** Partner claim artwork for active/empty states; Verified artwork for completed claims.
- **Renewals:** `noRenewals` empty state; Renewal artwork for upcoming rows and Warning artwork for overdue rows.
- **Policy Intake history:** Upload/Processing, Pending Review, Needs Attention, Completed and Rejected artwork mapped to the existing pipeline states; branded empty/filter states.
- `verify:visual` expanded to protect all of the above.

No data fetching, filtering, pagination, routing, processing, claim/policy/customer semantics, backend, schema/RLS, runtime or native configuration changed.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 3 — utility surfaces

**IN PROGRESS:** branch `partner/visual-system-completion-slice3`  
**Base:** Slice 2 merge `28ac62daf0092fe7f8a320b9669f4d0209e0f29f`.

Implemented so far:

- **Search:** initial search state uses Search artwork; no-results uses `noSearchResults`; Customer/Policy/Claim result rows use their Partner artwork; completed claims use Verified artwork.
- **Support:** Operations Desk fallback uses `supportVerified` artwork. Relationship-contact initials remain because they identify a real person. Call/email/chevron remain utility vectors. Support-unavailable errors deliberately use the shared generic branded error state rather than misusing `supportResolved` artwork.
- **Settings:** Profile, Support and Check for Updates feature rows use Partner artwork; Privacy Policy remains a lightweight shield utility/legal icon; chevrons remain utility vectors.
- `verify:visual` expanded to protect Search, Support and Settings artwork semantics, including a guard against using `supportResolved` for Support-unavailable errors.

Still remaining after Slice 3:

- Activity category/status artwork review.
- Profile body visual consistency; use profile/avatar artwork only where semantically valid.
- Your Week / Impact / Journey / Recognition / Learn body-format normalization.
- Business screen body: replace locally generic feature/status imagery and normalize hero/action/network spacing/hierarchy.
- Policy Intake new/detail upload/retry/review states.
- Policy/Claim/Customer detail-page body consistency.
- Final banner placement review; only semantically correct generic growth placements are allowed with current assets.
- Final installed-app screen-by-screen QA and preview OTA publication when explicitly intended.

## Acceptance gate before native Phase 6

Visual completion is not done until:

- every major Partner route follows the same header/spacing/card/section system;
- feature artwork is intentional and consistent;
- vector icons remain only for utilities or when no correct custom asset exists;
- relevant empty/error/offline states are branded;
- banner use is semantically correct and does not displace operational work;
- exact-head Partner CI is green;
- merged OTA-safe source is published through the Partner preview OTA path when explicitly intended;
- installed Partner preview is cold-launched and changed screens are visually checked;
- no new Partner APK/AAB is created without explicit approval for that exact native build.

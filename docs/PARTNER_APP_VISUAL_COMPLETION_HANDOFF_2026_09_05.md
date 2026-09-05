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

Delivered shared feature artwork in the common screen shells, centralized feature-art mapping, branded common failure states, complete More feature-art coverage and the initial `verify:visual` CI contract.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 2 — core operational list/state artwork

**MERGED:** PR #1334  
**Merge:** `28ac62daf0092fe7f8a320b9669f4d0209e0f29f`  
**Partner Verify:** #187 / `33979804980` success  
**Web Verify:** #3015 / `33979804906` success

Delivered branded Customers/Policies/Claims/Renewals/Policy Intake list and empty/status artwork while preserving identity initials and all business/data behavior.

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

Delivered Search, Support and Settings branded feature artwork plus event-specific Activity artwork and readable Activity timeline typography.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 4 — Impact and Journey body normalization

**MERGED:** PR #1338  
**Merge:** `62ea263c7bcd958efbc7748da366feb93cf5277b`  
**Final head:** `9cce862884f462bade399608f7136c497219592a`  
**Partner Verify:** #193 / `33981084342` success  
**Web Verify:** #3023 / `33981084184` success

Delivered:

- Impact feature cards use approved Motor, Customers, Policies and Claims artwork;
- claim outcome uses Verified artwork and journey action uses Journey artwork;
- Impact legacy 7.5–8.5px labels moved to shared readable typography;
- Journey timeline dots replaced with Journey artwork;
- Journey legacy tiny timeline/summary text moved to shared readable typography;
- `verify:visual` protects these choices.

**Release state:** merged only; no Partner OTA, APK or AAB.

## Slice 5 — Your Week, Recognition, Learn and Profile audit

**IN PROGRESS:** branch `partner/visual-system-completion-slice5`  
**Base:** Slice 4 merge `62ea263c7bcd958efbc7748da366feb93cf5277b`.

Implemented:

- **Your Week:** retained the correct Renewal artwork for upcoming renewal work and replaced the remaining 7.5–9px local labels with shared `meta`, `caption`, `bodyStrong` and `sectionTitle` typography. No weekly calculations/routes changed.
- **Recognition:** milestone cards now use approved Learn, Renewal and Journey artwork instead of generic feature Ionicons; tiny item/date/next-milestone typography moved to the shared readable scale; Achievement artwork remains the hero and empty-state identity.
- **Learn:** no-card state now uses Learn/Policy Checklist artwork; correct answers use Verified artwork and explanation/learning feedback uses Learn artwork; remaining 7.2–9px labels/footnote/options/stats text moved to shared readable typography. Quiz load, answer submission, scoring and answer semantics are unchanged.
- **Profile audit:** no code change is currently justified. The real signed-in person's initials are intentionally retained because arbitrary generated avatar variants could misrepresent identity. Registration rows already use shared typography, and the centralized screen header supplies Profile artwork.
- `verify:visual` now protects Your Week, Recognition and Learn artwork and prevents tiny typography from returning.

No API, data calculation, auth/scope, quiz logic, backend, schema/RLS, runtime or native configuration changed.

## Remaining visual-completion work

Priority order after Slice 5:

1. **Business body** — isolate this pass because it contains commercial/network/payout UI. Replace generic renewal/claim/network feature imagery where a correct Partner asset exists and normalize local styling without altering calculations or authorization.
2. **Policy Intake new/detail** — map Upload/Review/Attention/Completed/Failed artwork into upload/retry/detail states without changing processing behavior.
3. **Customer / Policy / Claim detail pages** — audit body spacing, section/card hierarchy and meaningful status/product artwork.
4. **Banner review** — current approved banner set is generic business-growth artwork only; use it only on genuinely business/growth surfaces and never mislabel it.
5. Final source audit + one consolidated installed-app screen-by-screen QA and Partner preview OTA publication when explicitly intended.

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

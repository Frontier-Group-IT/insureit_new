# INSUREIT Partner — Visual Completion Handoff

> **Created:** 2026-09-05 (IST)  
> **Scope:** `apps/partner-app` visual-system completion before the next native Partner build  
> **Status:** USER-APPROVED OTA REFINEMENT CONTINUATION / IN PROGRESS

Read this with `AGENTS.md` and `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md` before continuing Partner app refinement.

## Why this continuation exists

The user reviewed the current installed Partner screens and reported that formatting is still inconsistent and that the prepared custom icons/banners are absent from many screens.

A source + screenshot audit confirmed the gap:

- Phases 0–5 delivered the technical foundation, data hardening, resilience and representative visual acceptance.
- The shared design-system primitives exist, but many screens still own local formatting below the common shell.
- Custom Partner artwork is heavily visible on Home and More but much less visible on Business, Policies, Claims, Search, Support and several utility/detail pages.
- The prepared banner family is present in the repository but only a small subset is registered; the banner batch is primarily generic business-growth artwork and must not be mislabeled as claims/renewal/academy artwork without a semantic match.
- Error/offline/unauthorized screens could still fall back to generic vector icons even though branded state artwork exists.

**Durable decision:** Do not treat the Partner OTA refinement as visually complete, and do not advance to the next native-build phase merely because the earlier phase table says Phases 0–5 are complete. The plan's existing requirement for one shared design system must be completed across the full app first.

## User-approved current objective

Complete the remaining OTA-safe Partner visual refinement without changing business logic, Partner scope, backend contracts, schema/RLS, runtime/native configuration or package identity.

Priority order:

1. normalize the shared screen/header visual language;
2. finish intentional custom feature-icon deployment;
3. use existing banners only where their generic business-growth meaning is semantically correct;
4. wire custom empty/offline/error/status artwork into relevant screens;
5. normalize page spacing, cards, section hierarchy, rows and utility screens;
6. perform a final screen-by-screen installed-app visual acceptance pass;
7. only then re-evaluate the batched native Phase 6 build.

## Asset usage rule

Preserve the existing asset-library rule from `apps/partner-app/assets/partner/README.md`:

- Feature identity, meaningful status, empty/error state, banner, profile and support surfaces should prefer Partner artwork.
- Lightweight interface controls such as back, close, chevron, overflow, filter, calendar and edit remain vector icons.
- Do not replace every glyph with a 3D image.
- Do not assign a generated banner/avatar a semantic meaning it does not clearly represent.

## Slice 1 — shared feature identity and branded failure states

**MERGED:** PR #1333  
**Merge commit:** `53b52a5abb6383be33d5146c19b7afcb9b803dc6`  
**Base:** `998514d0074fd72527507b9b3c62bfd4678a6994`  
**Verification:** Partner Verify #186 / run `33979348613` success; Web Verify #3014 / run `33979348649` success.

Changes:

- `PartnerTopBar` supports feature artwork and centrally resolves appropriate Partner artwork from screen title/eyebrow when no explicit override is supplied.
- `PartnerScreen` and `PartnerListScreen` preserve explicit artwork overrides while sharing the same top-bar behavior.
- `lib/partner-screen-artwork.ts` centralizes feature-to-artwork mapping for Home, Business, Policies, Claims, Customers, Renewals, Policy Intake, Search, More, Activity, Your Week, Impact, Journey, Learn, Stories, Recognition, Profile, Support, Settings and payout-related screens.
- `PartnerAssets` exposes existing prepared Policy Checklist/Learn, Support Verified, Apps Grid and Settings artwork that had not been registered.
- `PartnerStateView` defaults Offline, Error and Unauthorized states to branded Partner artwork while still allowing screen-specific overrides.
- More now uses Partner artwork for 60-Second Learn, INSUREIT Stories and Settings instead of generic feature-level Ionicons.
- `verify:visual` was added and enforced by Partner CI.

**Release state:** merged source only. No Partner OTA was published by this slice and no APK/AAB was created.

## Slice 2 — core operational screen bodies

**IN PROGRESS:** branch `partner/visual-system-completion-slice2`  
**Base:** Slice 1 merge commit `53b52a5abb6383be33d5146c19b7afcb9b803dc6`.

Implemented so far:

- **Customers:** no-result/empty customer book now uses `PartnerAssets.emptyStates.noCustomers`; customer initials remain intentionally because they communicate record identity better than repeating a generic feature image on every row.
- **Policies:** empty policy book uses `noPolicies`; policy rows now use Motor, Health, Life/family and Commercial product artwork according to the existing policy-category logic instead of generic car/medkit/heart/business glyphs.
- **Claims:** empty claim book uses Partner claim artwork; active claim rows use claim artwork and completed rows use Verified artwork instead of the generic shield glyph.
- **Renewals:** empty renewal queues use `noRenewals`; upcoming rows use Renewal artwork and overdue rows use Warning artwork. The small customer shortcut remains a vector utility control.
- **Policy Intake history:** row artwork now reflects Uploaded/Processing, Pending Review, Needs Attention, Completed and Rejected states using the existing Partner status assets. Empty intake history uses Policy Upload artwork; an empty filtered result uses No Search Results artwork.
- `verify:visual` now protects these core-screen artwork mappings from later regression.

No data fetch, filter, pagination, route, Policy Intake processing, claim workflow, policy semantics, customer identity, backend, schema/RLS, runtime or native configuration was changed.

Still remaining inside/after the core-screen pass:

- **Business:** replace locally generic feature/status imagery and normalize its hero/action/network visual hierarchy; use a generic growth banner only if it remains semantically correct and does not displace operational content.
- **Policy Intake new/detail states:** inspect the upload/retry/review detail surfaces beyond submission history and apply the correct existing state artwork where semantically valid.
- Representative policy/claim/customer detail pages still need body-format and feature-art consistency review after list surfaces are stable.

## Utility / engagement work remaining

- Search: use `noSearchResults` for the no-result state.
- Support: use Support artwork for the Operations desk/relationship-contact fallback presentation.
- Profile: use prepared profile/avatar artwork only where it represents the intended person/account state; do not relabel arbitrary avatar variants.
- Settings: use Settings/update artwork for feature-level sections while retaining vector icons for small utilities.
- Activity: use category/status artwork consistently for meaningful event types.
- Your Week / Impact / Journey / Recognition / Learn: normalize headers, section spacing and feature artwork without making operational work less prominent.

## Banner program

The current repository banner batch is mostly generic business-growth art. It can be used on genuinely growth/business-oriented surfaces such as Business/Impact/Home secondary content, but it must **not** be presented as Claims Assistance, Renewal Opportunities, Academy, pending intake or insurer announcement artwork unless a matching semantic asset is later approved.

## Acceptance gate before native Phase 6

Do not mark visual completion done until all of the following are true:

- every major Partner route has been checked against the same spacing/header/card/section system;
- feature-level custom artwork is intentional and consistently used;
- generic vector icons remain only for utility controls or places where no correct custom asset exists;
- relevant empty/error/offline states use branded artwork;
- any banner use is semantically correct and does not displace urgent operational content;
- Partner CI is green for the exact feature head;
- merged source is published through the established Partner preview OTA path only when explicitly intended;
- installed Partner preview is cold-launched and the changed screens are visually checked;
- no new Partner APK/AAB is created without explicit user approval for that exact native build.

## Next continuation action

Complete Slice 2 verification, then continue with **Business + utility/detail visual completion** before any native Phase 6 work.

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
- Error/offline/unauthorized screens can still fall back to generic vector icons even though branded state artwork exists.

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

**IMPLEMENTED on branch:** `partner/visual-system-completion-slice1`  
**Base:** current `main` at branch creation `998514d0074fd72527507b9b3c62bfd4678a6994`.

Changes in this slice:

- `PartnerTopBar` now supports feature artwork and centrally resolves appropriate Partner artwork from screen title/eyebrow when a screen does not provide an explicit override.
- `PartnerScreen` and `PartnerListScreen` preserve explicit artwork overrides while sharing the same top-bar behavior.
- New `lib/partner-screen-artwork.ts` centralizes feature-to-artwork mapping for Home, Business, Policies, Claims, Customers, Renewals, Policy Intake, Search, More, Activity, Your Week, Impact, Journey, Learn, Stories, Recognition, Profile, Support, Settings and payout-related screens.
- `PartnerAssets` now exposes existing prepared artwork that had been left unregistered but is required by the current UI: Policy Checklist/Learn, Support Verified, Apps Grid and Settings.
- `PartnerStateView` now defaults common Offline, Error and Unauthorized states to existing branded Partner artwork while still allowing screen-specific artwork overrides.
- More now uses custom Partner artwork for 60-Second Learn, INSUREIT Stories and Settings instead of generic feature-level Ionicons.
- New `verify:visual` regression protects the centralized artwork resolver, branded failure states and complete More feature-art coverage.
- Partner CI now runs the visual-system regression before pre-APK/UAT checks.

No native dependency, app config, runtime, Expo project, backend, schema, RLS, API or business workflow change is included.

## Remaining visual-completion work after Slice 1

The shared header identity fix does not complete the screen bodies. Remaining work must continue in focused OTA slices:

### Core operational screens

- Business: replace locally generic feature/status icons with the approved Partner assets; normalize hero/action cards to the shared spacing/radius hierarchy; use generic growth banner only if placement remains action-first.
- Policies: apply policy/product/status artwork to summary/empty/detail surfaces while keeping list density compact.
- Claims: apply claim/status/attention artwork to summary/empty/detail surfaces without altering service-mode or workflow logic.
- Customers: apply customer artwork to list/empty/detail surfaces without replacing useful initials where identity is clearer.
- Renewals: apply renewal/status artwork to queue and empty states while preserving current filters/actions.
- Policy Intake: wire upload/review/rejected/completion artwork to the existing submission states.

### Utility / engagement screens

- Search: use `noSearchResults` for the no-result state.
- Support: use Support artwork for the Operations desk/relationship-contact empty/fallback presentation.
- Profile: use prepared profile/avatar artwork only where it represents the intended person/account state; do not relabel arbitrary avatar variants.
- Settings: use Settings/update artwork for feature-level sections while retaining vector icons for small utilities.
- Activity: use category/status artwork consistently for meaningful event types.
- Your Week / Impact / Journey / Recognition / Learn: normalize headers, section spacing and feature artwork without making operational work less prominent.

### Banner program

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

Continue with **Slice 2: core operational screen bodies — Business, Policies, Claims, Customers, Renewals and Policy Intake**, preserving all existing data/auth/workflow behavior.

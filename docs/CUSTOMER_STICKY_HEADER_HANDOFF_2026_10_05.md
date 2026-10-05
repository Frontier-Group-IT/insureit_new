# Customer App fixed page headers — 2026-10-05

Status: IMPLEMENTED in branch `fix/customer-sticky-page-headers-2026-10-05`, pending PR verification and merge.

## Scope

Customer App page-level header content is now separated from the vertical body scroll in the customer-aware UI wrapper. The top INSUREIT brand/navigation bar remains fixed, page header controls remain fixed below it, the page body scrolls independently, and the bottom navigation remains fixed.

## Covered behavior

- Standard Customer App screens that use the shared `Screen` title header keep that title header fixed.
- Vehicle list keeps the page heading/action and search panel fixed while vehicle cards scroll.
- Policy list keeps the heading/action/search and status/category filters fixed while policy cards scroll.
- Claims list keeps the page heading, search and claim filters fixed while claim cards scroll.
- Profile keeps the page heading fixed while profile content scrolls.
- Portfolio/group routes that reuse these screens map to the same fixed-header behavior.
- The Customer Home screen already uses its own fixed brand header and is left unchanged.

## Implementation

Primary file: `apps/mobile-app/components/customer-aware-ui.tsx`.

The customer-only wrapper now renders a fixed customer shell rather than placing all page content inside the base `Screen` scroll view. Non-customer roles continue using the existing base `Screen` unchanged.

No database, RLS, native dependency, runtime version, APK or AAB changes are required.

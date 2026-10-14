# Customer Policies reference redesign — 2026-10-14

## Status
Implemented on branch `ui/customer-policies-reference-redesign-20261014`. **No PR, merge, deployment, SQL migration or APK/AAB.** CI and live responsive visual validation pending.

## Scope
- Redesigned `apps/web-portal/app/customer/(protected)/policies/page.tsx` for supplied My Policies reference: light blue illustrated commercial-vehicle insurance hero, title/subtitle and three reference feature highlights.
- Original illustrated reference is not available as a standalone source asset, so added an original, repository-hosted SVG illustration: `apps/web-portal/public/customer-policies-reference-hero.svg`. This is a close thematic rendition, not a pixel-identical copy of the screenshot artwork.
- Added three status-linked cards displaying customer-scoped Total, Active and Expired counts, calculated from the existing policies loader.
- Retained existing search, account context, statuses, source filtering, insurer logos, truthful premium placeholder `—`, and policy detail routes. Added a dedicated View details action to each desktop row; removed the conflicting full-row link overlay.
- Added query-param pagination at 10 results per page for desktop and mobile, retaining filters and account scope. Page range clamps to available pages; status/source changes reset to page 1.
- Updated customer sidebar labels and a functional Support panel without deleting existing destinations, changed Policy breadcrumb title, and displayed the authenticated user name beside the existing profile control.
- Original account security load uses `resolveCustomerWebScope` and `loadCustomerWebPolicies(account.id)`, unchanged. No backend/data changes. Notifications do not show a fabricated count.

## Review checklist before PR
1. Run repository web-portal TypeScript, lint, production build and regression checks.
2. Inspect mobile/tablet/desktop, including narrow widths and collapsed sidebar; confirm screenshot-close design and hero readability.
3. Verify summary cards filter correctly and filter/search/source/page query parameters preserve authenticated account.
4. Verify 11+ policies paginate on both responsive views; verify empty results and invalid page.
5. Verify internal/external policy details navigation and insurer assets with the customer account constraints.
6. Confirm shared navigation/header refinements are acceptable on other Customer Portal pages.
7. No deployment without approval.

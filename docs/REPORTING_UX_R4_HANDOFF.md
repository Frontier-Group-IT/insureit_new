# Reporting UX R4 Handoff

Date: 2026-08-13
Status: IMPLEMENTED on feature branch; verification pending.

## Scope

Reporting UX Phase R4 improves report registers and mobile usability without changing report calculations, Supabase RPCs, hierarchy/customer scope, export authorization, Finance billing semantics, Management Pack snapshot/Close Month rules, or database behavior.

Implemented:
- Shared register primitives in `apps/web-portal/components/reports/report-register.tsx` for future/new report register rendering: responsive desktop/mobile views, record cards, labeled fields, explicit Open actions, and pagination.
- Reports-only responsive enhancer in `apps/web-portal/components/reports/report-register-enhancer.tsx`.
- The enhancer runs only inside the shared Reports page shell and reacts to report route/query changes.
- It reads each rendered table's existing column headers and annotates body cells with those labels.
- A table is converted to the mobile card treatment only when its rendered width exceeds its container; narrow tables stay normal tables.
- Mobile wide-table rows render as labeled record cards, two columns on normal phones and one column on very narrow screens.
- Existing icon-only row action buttons now display the explicit text `Open` while retaining their existing destination and icon.
- Existing report pagination controls receive consistent desktop/mobile density and stack safely on phones.
- The behavior applies across existing R2/R3 report pages through the common shell instead of duplicating mobile register JSX in every report page.
- No polling or global-site DOM observer is used. The enhancer is scoped to `.report-page-shell` and runs after report route/query changes.

## Performance boundary

This implementation deliberately avoids duplicating each report dataset into a second client-rendered mobile tree. The existing server-rendered table remains the source of truth; the scoped enhancer adds labels/classes only after render. Report loaders and database reads are unchanged.

## Release state

R4 must pass the compulsory GitHub web-portal verification gate before merge. Ordinary R4 commits must not update `.deploy/production-trigger.json`. Production deployment requires a separate explicit user request.

## Next phase

R5 remains Management Pack workflow refinement, including Close Month confirmation and clearer Live/Frozen state handling. R5 must not be bundled into R4 without a separate request.

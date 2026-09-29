# Accounts Dashboard Reconciliation Handoff — 2026-09-29

## Current working model

The Accounts Dashboard remains the simple operating surface for Pay-In / Pay-Out reconciliation against projected policy commercials. The existing Business MIS table is the source layout for both dashboard display and the download/upload reconciliation template; its columns, order, and structure must remain unchanged unless the user explicitly approves a later redesign.

## Existing implementation

- PR #2529 added a compact reconciliation overview above the unchanged Business MIS table.
- The overview derives projected/posted Pay-In and projected/paid Payout from the same Business MIS values already backed by the existing accounts transaction tables.
- Successful reconciliation workbook import refreshes the dashboard automatically.
- No new accounting tables were introduced.

## Current UX change

PR #2533 (`ui/accounts-custom-date-popover`) improves period filtering without changing accounting logic or the Business MIS table:

- `Last month` and `MTD` remain instant period presets.
- `Custom` opens a compact anchored date-range popover in the dashboard header.
- The popover contains From / To date controls, validation, Cancel and Apply.
- Outside click and Escape close the popover.
- When Custom is active, the selected date range is shown directly in the Custom control.
- The old separate From / To fields are removed from the lower row; that row now contains only Insurer, Branch and the business-filter apply action.

## Explicit boundaries

Do not change the Business MIS main-table columns/order/layout, export/upload template contract, reconciliation import logic, accounting tables/RPC, schema, RLS, or mobile/native runtime as part of this UX change.

## Evidence state

PR #2533 is IMPLEMENTED and awaiting canonical `Verify web portal` CI / merge. Deployment is not implied by merge.
# Accounts reconciliation workflow — Step 1

Date: 2026-09-16

State: **IMPLEMENTED, NOT MERGED, NOT DEPLOYED**

## Purpose

Start the Accounts team's new professional operating workflow without changing any accounting data model or existing reconciliation controls.

## Implemented

The Accounts Dashboard now presents a compact four-stage operating flow beneath the KPI cards:

1. **Expected pay-in** — uses the dashboard's filtered projected net pay-in and policy count.
2. **Insurer reconciliation** — links to the existing `/reconciliation` workspace.
3. **Brokerage billing** — links to the existing `/accounts/billing` workbench.
4. **Receipts & UTR** — links to the existing `/accounts/receivables` workspace.

The existing date / insurer / branch-placeholder filters and KPI calculations remain unchanged.

## Safety boundary

- No Supabase schema changes.
- No migration.
- No accounting formula changes.
- No reconciliation write-flow changes.
- No sidebar changes; Accounts continues to expose only Accounts Dashboard and Other Recon.

## Planned next step

Add the controlled reconciliation export/import experience: a purpose-built template for Accounts entry, validation/preview before commit, and the detailed Business MIS export that reproduces the team's required final spreadsheet format.

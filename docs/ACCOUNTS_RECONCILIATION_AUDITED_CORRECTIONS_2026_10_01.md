# Accounts reconciliation audited corrections

Date: 2026-10-01

Status: **IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / SCHEMA NOT APPLIED / PRODUCTION NOT VERIFIED**

Branch: `feature/accounts-reconciliation-audited-corrections`

## Approved business rule

For the current Accounts Dashboard policy-wise reconciliation workflow, the Pay-In **Bill Amount is the received/receipt amount**. The drawer does not present Bill Amount and Amount Received as two separate operational values.

## User-facing status rule

Pay-In and Payout history entries use reconciliation-entry statuses rather than exposing internal invoice lifecycle states:

- `Posted`
- `Edited`
- `Reversed`

Internal invoice states such as Raised / Partially Received / Received remain accounting implementation details and are not shown as the history-entry status in this drawer.

## Correction access

Any authenticated user who already passes the existing Accounts posting access boundary (`view_accounts` plus commercial access) may use correction actions. No extra super-user-only restriction is introduced.

## Audited edit

Eligible users may edit an active Pay-In or Payout entry. A correction reason is mandatory.

Pay-In edit fields:

- Bill Number
- Bill Date
- Bill / Received Amount

Payout edit fields:

- Paid Amount
- Paid Date
- UTR / Reference

The change is applied to the existing normalized financial record and the before/after values, reason, actor and timestamp are stored in `accounts_reconciliation_corrections`.

## Reverse

There is no physical delete action.

Pay-In reversal marks the invoice Cancelled, removes it from active Pay-In totals, preserves its original invoice/line data, writes the appropriate receivable reversal for any remaining outstanding amount, and writes invoice/audit events.

Payout reversal preserves the Partner payment/allocation rows but zeros the active payment/allocation value, restores the payable outstanding amount/status, writes a payable event and stores the original values in the correction audit record. This makes reversed entries stop contributing to current reconciliation totals while retaining their history.

## UI behavior

Each active history row exposes:

- `Edit`
- `Reverse`

Reversed rows remain visible as `Reversed` with `Audit retained`; they cannot be edited/reversed again. Edited rows show `Edited`. The correction reason is available as the status tooltip.

## Schema/application boundary

The existing service-role-only Accounts reconciliation schema workflow was extended to verify and apply the correction audit table and correction RPC. Browser roles remain denied direct execution; application server actions continue to perform Accounts capability/scope checks before calling the service-role RPC.

## Files changed

- `apps/web-portal/app/accounts/accounts-policy-reconciliation-drawer.tsx`
- `apps/web-portal/app/accounts/accounts-reconciliation-detail-actions.ts`
- `apps/web-portal/app/accounts/accounts-reconciliation-post-actions.ts`
- `supabase/migrations/20260929134500_accounts_policy_reconciliation_entry.sql`
- `.github/workflows/apply-accounts-policy-reconciliation-entry.yml`

## Verification still required before merge

1. Run canonical web portal PR verification (regressions, typecheck, lint, production build).
2. Review SQL against current production schema before any application.
3. Confirm schema workflow applies the correction extension safely and verifies service-role-only execution.
4. Test Pay-In edit, Pay-In reverse, Payout edit and Payout reverse on controlled records.
5. Confirm dashboard totals exclude reversed entries and use edited values.
6. Confirm no hard-delete path exists.
7. Confirm production deployment only after schema verification.

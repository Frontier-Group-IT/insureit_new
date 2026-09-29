# Accounts Reconciliation Phase 3 — Transaction Templates

Date: 2026-09-29
Status: IMPLEMENTED on PR branch; canonical CI / merge / schema application / deployment must be tracked separately.

## Purpose

Phase 3 adds a compact operational Excel workflow for Accounts users to append new policy-wise Pay-In and Payout transactions without editing the complete Business MIS workbook.

The existing Business MIS remains the reporting surface and keeps its exact visible column structure/order and its existing full workbook download/upload flow.

## User-approved accounting principles preserved

- Reconciliation remains policy-wise.
- `Bill Amount` remains the received Pay-In amount in the current INSUREIT Accounts model.
- Pay-In and Payout may have multiple installments under one policy.
- New installments append history and never overwrite an earlier installment.
- Policy summary values remain cumulative.
- Zero projection + zero actual is Not applicable, not Reconciled.
- Pooled insurer bank-receipt allocation is not part of this phase.

## Transaction template downloads

New route:

`/accounts/reconciliation-transaction-template`

The compact Accounts control exposes separate Pay-In and Payout workbooks filtered by the current Accounts date/insurer scope and by working queue:

- All applicable
- Pending
- Partial
- Variance

### Pay-In template fields

System Policy ID is hidden. Visible context includes Policy Number, Registration No., Insured Name, Insurance Company, Projected Pay-In, Already Received, and Current Difference. Users enter New Bill Number, New Bill Amount, New Bill Date, TDS and optional Remarks.

### Payout template fields

System Policy ID and System Payout ID are hidden. Visible context includes Policy Number, Insured Name, Intermediary Type/Code, Projected Payout, Already Paid and Remaining. Users enter New Paid Amount, New Paid Date, New UTR / Reference and optional Remarks.

The workbook contains the marker `INSUREIT_ACCOUNTS_TRANSACTION_TEMPLATE_V1` in a hidden metadata sheet.

## Upload validation

`reconciliation-transaction-upload-actions.ts` reads only the dedicated transaction-template marker and exact headers. It then re-resolves all hidden policy IDs through the current Accounts/commercial access scope. Workbook context values are never treated as authoritative accounting state.

Validation rules include:

- max 8 MB `.xlsx`;
- max 500 transaction rows;
- exact template structure;
- policy/system-ID scope check;
- current Policy Number identity check;
- current Payout ID check for Payout rows;
- required reference/amount/date fields;
- positive amounts;
- TDS between zero and Pay-In amount;
- duplicate rows inside the workbook;
- Payout cannot exceed current projected remaining;
- Pay-In above projected remaining is shown as a warning because it creates a variance rather than silently capping the real transaction.

The confirmation path reruns validation before posting.

## Atomic batch posting

Migration:

`supabase/migrations/20260929153000_accounts_reconciliation_transaction_batch.sql`

RPC:

`post_accounts_policy_reconciliation_batch(p_actor uuid, p_entries jsonb)`

The batch RPC:

- accepts 1–500 entries;
- orders policies deterministically before locking to reduce opposite-lock-order concurrency risk;
- calls the existing Phase 2 `post_accounts_policy_reconciliation_entry` for each transaction;
- therefore reuses the existing duplicate/reference/balance/policy-lock rules;
- executes inside one PostgreSQL transaction so any failed entry rolls back the entire workbook;
- is SECURITY DEFINER but explicitly revokes PUBLIC, anon and authenticated EXECUTE;
- grants EXECUTE only to `service_role`.

The browser never calls this RPC directly. The server action requires `view_accounts`, commercial access and a second live scope validation before using the server-only admin client.

## Release safety

Dedicated schema workflow:

`.github/workflows/apply-accounts-reconciliation-transaction-batch.yml`

Production deploy gate recognizes `20260929153000_accounts_reconciliation_transaction_batch.sql` and waits for the schema workflow before Vercel deployment.

A committed migration is not proof that it is applied. Do not mark Phase 3 APPLIED or DEPLOYED until the exact production schema workflow and application deployment are directly verified.

## UI

`ReconciliationTransactionTools` is rendered beside the existing full-Business-MIS reconciliation upload control.

- download control: compact Pay-In/Payout queue template menu;
- green spreadsheet control: transaction-template upload;
- existing blue upload control: unchanged full Business MIS reconciliation workbook path;
- preview shows Ready / Warning / Error counts and row-level validation;
- successful import refreshes the Accounts dashboard snapshot.

## Files

- `apps/web-portal/app/accounts/reconciliation-transaction-template/route.ts`
- `apps/web-portal/app/accounts/reconciliation-transaction-upload-actions.ts`
- `apps/web-portal/app/accounts/reconciliation-transaction-tools.tsx`
- `apps/web-portal/app/accounts/reconciliation-tools.tsx`
- `supabase/migrations/20260929153000_accounts_reconciliation_transaction_batch.sql`
- `.github/workflows/apply-accounts-reconciliation-transaction-batch.yml`
- `.github/workflows/deploy-production.yml`

## Next phase

Phase 4 remains work-queue/search refinement: compact status queues plus policy/registration/customer/reference and transaction-date search. Do not expand Phase 4 into pooled bank reconciliation unless the product direction is explicitly changed.

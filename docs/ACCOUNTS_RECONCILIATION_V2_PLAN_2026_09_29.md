# Accounts Reconciliation V2 Plan — 2026-09-29

> This is the dated decision record for the Accounts redesign. The canonical living source of truth is `docs/ACCOUNTS_DASHBOARD_RECONCILIATION_HANDOFF.md`. Future Accounts changes must update that living handoff in the same PR.

## Goal

Turn the Accounts Dashboard into the single operational workspace for **policy-wise** Pay-In and Payout reconciliation without forcing Accounts users to repeatedly download and re-upload the complete Business MIS workbook.

The existing Business MIS table remains one row per policy and keeps its current structure. The redesign adds one-to-many transaction history underneath each policy so repeated installments can be posted without overwriting prior entries.

## User-confirmed semantics and scope

- **Bill Amount remains the received Pay-In amount used by the current Accounts calculation.** Do not split it into a separate billed-vs-received model in this redesign.
- Reconciliation is performed **individually per policy**.
- One insurer receipt allocated across many policies is not the target workflow.
- Partially allocated pooled bank receipts and unallocated-cash handling are not current priorities.
- The visible Business MIS column structure must remain unchanged unless separately approved.

## Core limitation in the current workflow

The current full-MIS upload behaves like each policy has one editable Pay-In slot and one editable Payout slot. Once a Pay-In/Payout has been posted, the live-row validation treats a later different value as an attempted edit instead of a new installment.

Example:

- Projected Pay-In: ₹1,000
- Entry 1: ₹400 → remaining ₹600
- Entry 2: ₹450 → remaining ₹150
- Entry 3: ₹150 → remaining ₹0

All three entries must remain as separate history records. The Business MIS summary row should show cumulative Bill Amount ₹1,000 and Difference ₹0.

## Target working model

### Business MIS summary layer

Keep one policy row with the current reconciliation columns:

**Pay-In**
- Total Pay-in
- Bill Number
- Bill Amount
- Bill Date
- Difference
- TDS

**Payout**
- Gross Payout
- Retention
- Paid Amount
- Paid Date
- UTR Details

`Bill Amount` and `Paid Amount` become cumulative policy-level summaries of valid underlying entries. Latest dates and compact/aggregated references can be shown without deleting older history.

### Transaction history layer

A policy may have unlimited:
- Pay-In entries (Bill Number, Bill Amount, Bill Date, TDS/remarks where applicable);
- Payout entries (Paid Amount, Paid Date, UTR/reference, remarks).

Prior installments are never overwritten.

## Existing architecture that can be reused

The current summary code already supports cumulative underlying rows in important places:

- Pay-In Business MIS uses `accounts_invoice_lines` + `accounts_invoices`, sums invoice-line amounts, aggregates references and uses the latest bill date.
- Payout Business MIS uses `partner_payables` + `partner_payment_allocations` + `partner_payments`, sums allocated amounts and aggregates dates/references.
- The existing controlled RPC `post_accounts_excel_reconciliation` creates the accounting records used by the current workflow.

Production inspection on 2026-09-29 confirmed that the RPC creates a new Accounts invoice + line for each Pay-In group and uses existing partner payment allocation functions for Payout. The current one-installment blocker is therefore primarily the existing full-MIS validation/UX, not the summary aggregation itself.

V2 should reuse these primitives where safe instead of creating a parallel ledger simply to support installments.

## Required UX

### 1. Compact summary dashboard

Keep the current KPI and reconciliation overview. Counts must remain trustworthy and zero-projection/zero-actual policies must not inflate reconciled totals.

### 2. Policy reconciliation drawer

A Business MIS row opens a compact drawer showing:

**Policy context**
- policy number
- insured/customer
- insurer
- registration number

**Pay-In**
- projected Pay-In
- cumulative Bill Amount
- Difference
- status/progress
- chronological Pay-In history
- `+ Add Pay-In`

**Payout**
- Gross/Projected Payout
- cumulative Paid Amount
- remaining
- status/progress
- chronological payout history
- `+ Add Payout`

Detail should load lazily only when a policy is opened.

### 3. Direct portal entry

Accounts should be able to add a new Pay-In/Payout from the policy drawer without using Excel.

Each save appends a new transaction and refreshes the policy summary.

### 4. Transaction-oriented Excel

Keep the full Business MIS export for reporting, but stop using it as the only practical posting workflow.

Add compact Pay-In and Payout transaction templates where every uploaded row means **append one new transaction**. The same policy may appear multiple times.

Allow targeted downloads such as:
- Pay-In Pending
- Pay-In Partial
- Payout Pending
- Payout Partial
- Variance
- selected insurer/date/search result/policies
- blank transaction template

## Reconciliation calculation

For each applicable side:

- projection > 0, actual = 0 → Pending
- 0 < actual < projection → Partial
- actual = projection (₹0.01 tolerance) → Reconciled
- actual > projection → Variance
- projection = 0 and actual = 0 → Not applicable
- projection = 0 and actual > 0 → Variance

Status is derived from current projection versus cumulative posted entries so projection changes do not destroy history.

## Important future blockers retained in scope

- duplicate upload / duplicate direct posting protection;
- correction/audit trail instead of silent overwrite;
- policy/business date versus transaction date;
- projection changes after transactions exist;
- overpayment/over-payout variance;
- TDS consistency with current Accounts calculation;
- concurrent Accounts users;
- server-side aggregation and lazy history loading for performance.

Direct portal duplicate/concurrency protection is now implemented for Phase 2. Import-batch idempotency, correction/reversal and broader audit controls remain Phase 3/5 work. Intentional payout above the remaining payable is not enabled: the existing payable ledger still blocks it, so any future over-payout variance feature must be an explicit accounting-model change.

## Explicitly not driving this redesign

- pooled insurer receipts across multiple policies;
- partial allocation of one pooled bank receipt;
- unallocated bank cash workflow;
- bank-statement reconciliation;
- changing the current Bill Amount meaning;
- redesigning the Business MIS columns.

## Delivery phases

### Phase 0 — semantics and architecture verification

Document working principles, verify existing tables/RPCs and identify the one-slot limitation.

**Completed for the current design.**

### Phase 1 — multi-entry foundation + read-only history

Resolve the selected Business MIS row safely on the server, add a permission-scoped reconciliation detail loader and a read-only policy drawer using existing accounting history.

**Implemented and carried into PR #2559.** The drawer opens from the existing Policy Number cell; no visible Business MIS column was added.

### Phase 2 — direct portal posting

Add `+ Add Pay-In` and `+ Add Payout`, reusing controlled posting primitives where repeated installments are safe and duplicate/reference checks are explicit.

**Implemented on PR #2559, not merged/deployed.** The drawer now supports append-only Pay-In/Payout entry with before-save balance preview, scoped server re-resolution, direct-post duplicate/reference checks, policy-row write serialization and immediate history/dashboard refresh. Migration `20260929134500_accounts_policy_reconciliation_entry.sql` plus its schema workflow/deployment gate are committed; production schema is **not applied** until the approved merge/release path runs.

### Phase 3 — transaction Excel flow

Add transaction templates and targeted pending/partial downloads. Keep full MIS export as reporting output.

### Phase 4 — work queues and search

Add compact status queues, policy/registration/customer/reference search and transaction-date filters.

### Phase 5 — controls and audit hardening

Add stronger import idempotency checks, corrections/reversals, import history, concurrency tests and projection-change regressions.

## Safety boundary

Do not change the visible Business MIS structure, Bill Amount semantics, production accounting data or permission boundaries without explicit approval. No mobile/APK/AAB/native-runtime work is part of this redesign.

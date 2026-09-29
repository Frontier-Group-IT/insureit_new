# Accounts Reconciliation V2 Plan — 2026-09-29

## Goal
Turn the Accounts Dashboard into the single operational workspace for policy-level Pay-In and Payout reconciliation without forcing Accounts users to repeatedly download and re-upload the complete Business MIS workbook.

The existing Business MIS table remains the reporting/summary surface. Transaction entry becomes a separate one-to-many ledger workflow so a policy can receive or pay multiple installments over time.

## Core limitation in the current workflow
The current template behaves like each policy has one editable Pay-In slot and one editable Payout slot. That breaks as soon as a policy is settled in installments.

Example:
- Projected Pay-In: ₹1,000
- First receipt: ₹400
- Remaining: ₹600
- Second receipt: ₹450
- Remaining: ₹150

The second receipt must be stored as a new reconciliation transaction, not as an overwrite of the first ₹400 transaction.

## Target accounting model
### Projection layer
Keep the policy projection as one policy-level aggregate:
- projected Pay-In
- projected Payout
- expected TDS/net collectible where applicable

### Transaction layer
Use one-to-many accounting transactions underneath each policy:
- Pay-In invoice/bill entries
- Pay-In cash/receipt entries
- Pay-In TDS entries
- Payout payment entries
- adjustments/reversals where explicitly permitted

A policy can therefore have any number of receipts/payments. The dashboard derives totals and remaining balances from the transaction ledger.

The repo already has accounting primitives such as `accounts_invoices`, `accounts_invoice_lines`, `accounts_receipts`, `accounts_receipt_allocations`, `accounts_tds_entries`, `partner_payables`, and `partner_payment_allocations`. V2 should reuse these where semantically correct instead of inventing parallel accounting storage.

## Required UX
### 1. Accounts Dashboard stays summary-first
Top area should show:
- Projected Pay-In
- Billed Pay-In
- Received Pay-In
- TDS recorded
- Pay-In outstanding
- Projected Payout
- Paid Payout
- Payout outstanding
- reconciliation progress and exception counts

### 2. Business MIS remains the main summary table
Do not turn the existing Business MIS row into a transaction row. It remains one row per policy and shows aggregate values such as:
- total projected Pay-In
- total billed
- total received
- total TDS
- Pay-In balance
- total projected Payout
- total paid
- Payout balance
- latest transaction/reference where useful

A row should expose a compact action to open the policy reconciliation detail.

### 3. Policy reconciliation drawer/detail
Clicking a policy opens a compact side drawer/detail panel with two timelines:

**Pay-In**
- projection
- invoices/bills
- receipts
- TDS
- running outstanding balance

**Payout**
- projection
- payments
- running outstanding balance

Each transaction shows amount, date, reference/bill/UTR, source/import batch, creator and timestamp. Existing posted transactions are not silently overwritten.

### 4. Direct Add Transaction
Accounts users should be able to add a transaction directly from the dashboard without Excel:
- search policy number / registration / insured name / control identifier
- choose Pay-In or Payout
- choose transaction subtype
- enter amount
- date
- bill/reference/UTR
- optional notes/document
- preview remaining balance
- save

### 5. Replace full-MIS upload as the primary entry workflow
Keep Excel for bulk work, but make it transaction-oriented.

Provide compact downloads:
- blank Pay-In transaction template
- blank Payout transaction template
- pending Pay-In only
- pending Payout only
- selected insurer
- selected date range
- selected policies/rows

Each spreadsheet row represents a **new transaction**, not the mutable final state of the policy.

Suggested bulk columns include:
- policy identifier
- policy number
- insured/customer
- insurer / intermediary
- transaction type
- amount
- date
- bill/reference/UTR
- TDS if relevant
- notes

The same policy may appear on multiple rows in the same upload.

## Reconciliation calculation
Pay-In and Payout should be calculated independently.

### Pay-In
At minimum surface separately:
- Projected Pay-In
- Billed
- Received
- TDS
- Outstanding

Do not use `Bill Amount` as a synonym for cash received. Billing and receipt are different accounting events.

### Payout
- Projected Payout
- Paid Payout
- Outstanding Payout

### Status rules
Statuses should be derived, not manually typed:
- Not applicable
- Pending
- Partial
- Reconciled
- Variance / overpaid / unexpected transaction

## Filters and work queues
Accounts users need operational filters beyond period + insurer:
- Pay-In / Payout
- Pending / Partial / Reconciled / Variance
- insurer
- intermediary / partner
- RM
- branch
- policy number
- registration number
- customer / insured name
- bill number
- UTR/reference
- transaction date
- business date / policy issuance date
- outstanding amount buckets
- ageing buckets

Useful quick queues:
- Pay-In pending
- Payout pending
- Partial settlements
- Variances
- Missing bill/reference
- Missing TDS
- Overdue receivables
- Recently reconciled

## Important hidden blockers to solve now
### Multiple receipts/payments
Never overwrite prior settlement events. Every new installment is a new immutable transaction/allocation.

### One receipt covering many policies
An insurer may send one bank receipt for multiple policies. Store the receipt once and allocate it across policies.

### One policy settled by many receipts
Support unlimited allocations against the same policy.

### Partial allocations
A bank receipt may remain partially unallocated. Track unallocated balance separately.

### Duplicate upload/idempotency
Uploading the same Excel twice must not double-post transactions. Use import batch IDs plus deterministic transaction/reference checks.

### Corrections and reversals
Posted accounting records should not simply be edited in place. Use controlled reversal/correction entries with audit history.

### TDS
TDS must be a distinct accounting component. A ₹1,000 billed amount with ₹900 cash + ₹100 TDS should be able to reconcile correctly without pretending ₹900 is the full receipt.

### Billing versus collection
Invoice/bill creation and actual money receipt must be separate. Dashboard labels must not confuse `Billed`, `Received`, and `Reconciled`.

### Overpayment / unexpected payment
If actual exceeds projection, show the excess separately and require review rather than silently cap it.

### Cross-period receipts
A September policy may be paid in October. Filters must distinguish policy/business date from transaction/receipt date.

### Cancellation / endorsement / projection changes
If projected Pay-In/Payout changes after transactions already exist, retain the transaction history and recalculate the outstanding/variance against the revised projection with audit context.

### Concurrency
Two Accounts users may upload/add transactions at the same time. Posting must be atomic and protect against duplicate allocations/races.

### Auditability
Every transaction/import needs:
- created by
- created at
- source (manual / Excel / system)
- import batch
- original reference
- reversal linkage where applicable

### Performance
Do not derive a large dashboard by loading every transaction row into the browser. Aggregate server-side and load detail only when a policy drawer is opened.

### Permissions and period close
Respect existing Accounts permissions and eventually prevent mutation of closed accounting periods except through an authorized adjustment workflow.

## Proposed delivery phases
### Phase 0 — semantics and data audit
Before schema/UI changes, map the current production meaning of Bill Amount, receipts, TDS, payouts and existing old Accounts tables. Confirm which existing tables/RPCs can be reused safely.

### Phase 1 — multi-transaction foundation
Implement one-to-many Pay-In/Payout transaction retrieval and derived outstanding balances. Preserve current Business MIS/export compatibility.

### Phase 2 — policy reconciliation detail
Add the policy detail drawer with transaction timelines, running balances and direct Add Transaction.

### Phase 3 — transaction-based Excel import
Introduce small transaction templates and pending-only exports. Keep the current full Business MIS export for reporting, but stop making it the primary posting mechanism.

### Phase 4 — work queues and comprehensive filters
Add Pending/Partial/Variance queues, search, ageing, references, partner/RM/branch filters and operational counts.

### Phase 5 — controls and audit hardening
Add idempotency, duplicate detection, reversals/corrections, import batch history, period-close handling and stronger audit visibility.

## Safety boundary
Do not redesign the existing Business MIS table structure until separately approved. V2 should add transaction-level accounting behind it and richer reconciliation UX around it while keeping the current summary/export contract stable during migration.

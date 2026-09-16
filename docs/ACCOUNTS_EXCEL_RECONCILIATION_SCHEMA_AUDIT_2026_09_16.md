# Accounts Excel Reconciliation — Existing Schema Reuse Audit

Date: 2026-09-16

Status: **READ-ONLY PRODUCTION AUDIT / NO DATABASE CHANGES MADE**

Canonical architecture: `docs/ACCOUNTS_RECONCILIATION_WORKFLOW_STEP1_2026_09_16.md`

Canonical write mapping after active-code audit: `docs/ACCOUNTS_EXCEL_RECONCILIATION_CANONICAL_WRITE_MAPPING_2026_09_16.md`

## Purpose

This audit verifies how much of the approved Excel-first Accounts reconciliation architecture already exists in the INSUREIT production database. The goal is to reuse the existing financial model and avoid creating duplicate pay-in, payout, receipt, TDS, billing, allocation or audit structures.

## Executive finding

The existing system already contains most of the required accounting architecture.

The new Excel-first workflow should be implemented primarily as a **new controlled import interface over existing tables and stored functions**, not as a parallel financial schema.

In particular, production already contains normalized structures for:

- authoritative projected Pay-In;
- authoritative projected Partner Pay-Out and retention;
- policy billing facts;
- insurer invoices and policy invoice lines;
- insurer receipts;
- receipt allocations;
- TDS entries;
- insurer receivable ledger entries including reversal type;
- Partner payables;
- Partner payments;
- Partner payment allocations;
- Partner payable events;
- accounting-period controls;
- commercial audit history.

The database also already supports the core business requirement that one policy/payable can receive multiple financial transactions over time.

The active-code audit is now complete. Its final write-path decision and the one verified insurer-side granularity gap are recorded in `docs/ACCOUNTS_EXCEL_RECONCILIATION_CANONICAL_WRITE_MAPPING_2026_09_16.md`.

## Existing schema mapping

| New workflow requirement | Existing production structure | Audit decision |
|---|---|---|
| Policy identity | `policies.id`, `policies.policy_no` | **REUSE** |
| Net premium | `policy_premium_details.net_premium` | **REUSE** |
| Projected Pay-In | `policy_payin_details` | **REUSE** |
| Projected Pay-Out / retention | `policy_intermediary_payouts` | **REUSE** |
| Policy-level bill fields | `policy_payin_bills` | **LEGACY/REPORTING COMPATIBILITY; do not make a second canonical import ledger** |
| Normalized insurer invoice | `accounts_invoices` | **REUSE AS CANONICAL BILL HEADER** |
| Policy rows within invoice | `accounts_invoice_lines` | **REUSE AS CANONICAL POLICY BILL LINE** |
| Insurer receipt / UTR transaction | `accounts_receipts` | **REUSE** |
| Receipt-to-invoice allocation | `accounts_receipt_allocations` | **REUSE; line-level policy attribution needs a small extension for consolidated invoices** |
| TDS transaction | `accounts_tds_entries` | **REUSE; line-level attribution only if policy-level TDS is required** |
| Insurer receivable ledger | `accounts_receivable_entries` | **REUSE** |
| Invoice audit/state history | `accounts_invoice_events` | **REUSE** |
| Partner payable | `partner_payables` | **REUSE** |
| Partner payment / UTR transaction | `partner_payments` | **REUSE** |
| Partner payment allocation | `partner_payment_allocations` | **REUSE** |
| Partner payable audit/state history | `partner_payable_events` | **REUSE** |
| Reversal concept | `accounts_receivable_entries.entry_type = 'Reversal'` exists | **REUSE concept; workflow still to be designed** |
| Accounting period lock | `accounting_periods` + guards/events | **REUSE when period close is enabled** |
| Commercial value audit | `commercial_control_events` | **REUSE** |
| General audit facility | `audit_logs` | **VERIFY coverage before relying on it** |
| New Accounts Excel import batch metadata | no dedicated Accounts import batch table identified in this audit | **DO NOT ADD YET; first determine whether an in-memory preview + atomic posting is sufficient** |

## Authoritative commercial tables

### `policy_payin_details`

This table is one row per policy and already owns the projected insurer-side commercial calculation, including:

- projected OD percentage and amount;
- projected TP percentage and amount;
- insurer scheme amount;
- `total_projected_payin`;
- TDS percentage and projected TDS amount;
- `payin_after_tds`;
- commercial review status/note/actor/timestamp;
- commercial basis;
- projected commission percentage/amount.

Decision: **Accounts Excel must never overwrite these values.** They continue to be controlled by Policy Onboarding and `/policies/commercial-review`.

### `policy_intermediary_payouts`

This table already owns the projected Partner/intermediary liability, including:

- intermediary identity;
- OD payout percentage/amount;
- TP payout percentage/amount;
- `gross_payout`;
- `retention_amount`;
- commercial status/review metadata;
- payout basis;
- partner payout planning fields.

Decision: **Accounts Excel must not edit payout percentages, projected payout or retention.** The operational payout transaction should be written through the existing payable/payment model.

Important existing semantic: Accounts dashboard projected payout should continue to use `gross_payout` as established by the payout/retention accounting correction; `partner_payout_amount` is not a replacement for the canonical realized/projected payout KPI.

## Existing policy bill table

### `policy_payin_bills`

Production already has a policy-linked bill table with:

- `policy_id`;
- Bill Number;
- Billed Amount;
- Bill Date;
- Received Amount;
- Received Date;
- Receipt Reference;
- Received By;
- Status;
- short payout/difference-style amount;
- remarks.

`policy_id` is **not unique**, so the schema permits multiple rows against the same policy.

This table is very close to the Accounts team's requested spreadsheet format, but the active production data and policy-onboarding code clarify its current role.

Production currently contains 833 rows:

- 575 `Unbilled` rows with no bill number, billed amount, received amount or receipt reference;
- 258 `Billing details incomplete` rows with billed amount populated but no bill number, received amount or receipt reference;
- zero current rows with actual received amount or receipt reference.

The policy-onboarding function creates this row together with the policy/commercial records, and existing finance/readiness reports use it to classify policy billing status. It is therefore currently a policy-finance/reporting compatibility structure rather than the authoritative bank-receipt ledger.

Decision after active-code audit: **do not make `policy_payin_bills` a second independently-written canonical source for confirmed Excel transactions.** The normalized Accounts invoice/receipt model is the canonical transaction layer. Keep `policy_payin_bills` for legacy/reporting compatibility unless a later explicit one-way projection is designed and tested.

## Existing normalized Pay-In / receivable model

### `accounts_invoices`

Already represents insurer billing documents and includes:

- insurer;
- invoice number/date/due date;
- accounting period;
- brokerage subtotal/tax/gross invoice amount;
- outstanding amount;
- status lifecycle: Draft → Raised → Partially Received → Received / Adjusted / Cancelled;
- create/raise/cancel actors and timestamps.

The database enforces a case-insensitive unique nonblank invoice number.

### `accounts_invoice_lines`

Already links invoice rows to policy IDs and policy numbers and stores recognized brokerage/adjustment/line amount.

The active billing code confirms that one invoice can contain many policy lines. Its current workbench builds those lines from legacy reconciliation rows, but `reconciliation_line_id` is nullable. Therefore the new Excel importer can create policy lines directly from validated System Policy IDs without manufacturing legacy reconciliation cycles or lines.

Decision: **reuse `accounts_invoices` + `accounts_invoice_lines` as the canonical bill layer for the new workflow.**

### `accounts_receipts`

Already represents a bank receipt transaction with:

- insurer;
- receipt date;
- bank reference / UTR;
- bank amount;
- notes;
- actor/timestamp.

There is an existing unique index on `(insurer_id, upper(bank_reference))`, which already provides strong duplicate protection for repeated insurer UTR/reference uploads.

### `accounts_receipt_allocations`

Already allocates one receipt to one or more invoices. The unique `(receipt_id, invoice_id)` constraint prevents duplicate allocation of the same receipt to the same invoice.

This structure naturally supports:

- one invoice receiving multiple receipts at different times;
- one receipt being allocated across multiple invoices.

The active-code audit also confirms its one limitation for the new policy-row Excel workflow: it currently targets invoice headers, not invoice lines. Therefore an exact receipt split among policies inside one consolidated invoice cannot yet be persisted. The smallest safe extension should add line/policy attribution to the existing allocation model rather than creating a parallel Pay-In transaction table.

### `post_accounts_receipt(...)`

Production already has a security-definer stored function that:

- requires a positive bank amount and bank reference;
- requires at least one allocation;
- locks invoice rows;
- only allows Raised / Partially Received invoices;
- rejects allocations above outstanding balance;
- requires allocations to equal the bank amount;
- creates the receipt;
- creates allocation rows;
- posts a Receipt entry into the receivable ledger;
- decreases invoice outstanding amount;
- moves invoice status to Partially Received or Received;
- writes invoice events.

Decision: **the new Excel importer should strongly prefer this existing posting function/behavior for confirmed Pay-In receipts instead of reproducing its accounting logic in application code.** Any line-attribution extension must preserve these controls atomically.

### `accounts_tds_entries` and `post_accounts_tds(...)`

Production already has separate TDS transaction storage and a posting function that:

- validates invoice eligibility and balance;
- writes the TDS entry;
- writes the receivable ledger credit;
- reduces outstanding;
- updates invoice status;
- records invoice event history.

Current TDS storage targets the invoice, not an invoice line. If the definitive workbook uses policy-row TDS inside a consolidated invoice, the same minimal line-attribution issue must be addressed explicitly. If TDS is bill-level, the existing structure is sufficient.

Decision: **reuse this existing TDS path rather than creating TDS columns on a new Excel transaction table.**

### `accounts_receivable_entries`

The existing receivable ledger supports entry types:

- Invoice;
- Receipt;
- TDS;
- Adjustment;
- Credit Note;
- Debit Note;
- Reversal.

This already provides the conceptual foundation for future non-destructive correction/reversal behavior.

## Existing normalized Pay-Out model

### `partner_payables`

Already represents the policy/intermediary payable liability and links directly to `policy_intermediary_payouts` through unique `policy_payout_id`.

It contains:

- policy;
- intermediary identity;
- agreed amount;
- outstanding amount;
- status;
- eligibility/hold reason;
- approval/close actors and timestamps.

Because `policy_payout_id` is unique, one commercial payout source becomes one payable; payment installments belong beneath the payable rather than creating duplicate commercial payout rows.

### `create_partner_payable(...)`

Existing stored function creates a payable from the commercial payout only when:

- commercial terms are entered/reviewed;
- source payout is still Pending;
- gross payout is positive;
- an eligibility reason is provided.

It copies `gross_payout` into agreed/outstanding amount and records a payable event.

Decision: **reuse this function or its existing lifecycle rather than letting Excel create or alter the projected payout itself.**

### `partner_payments`

Already represents actual Partner payment transactions with:

- intermediary identity;
- payment date;
- payment reference / UTR;
- payment amount;
- notes;
- actor/timestamp.

The database has a unique index on `(upper(intermediary_code), upper(payment_reference))`, which provides strong duplicate protection for repeated payout references.

### `partner_payment_allocations`

Already allocates payments to payables. This supports multiple payment installments against the same payable while retaining exact policy attribution because each payable is tied to one policy payout source.

### `post_partner_payment(...)`

Production already has a security-definer posting function that:

- requires partner identity, payment reference and positive amount;
- requires allocations;
- locks target payables;
- permits only approved/payment-in-progress payables;
- rejects overpayment;
- requires allocations to equal payment amount;
- creates the payment transaction;
- creates allocations;
- reduces outstanding;
- moves status to Payment Initiated or Paid;
- writes payable events.

The active Accounts Partner Payables server action already uses this RPC and `gross_payout`-backed payable lifecycle.

Decision: **the Excel importer should reuse this function for confirmed Pay-Out transactions instead of implementing parallel payout accounting logic. No new Pay-Out transaction or policy-attribution structure is required.**

## Partial payment requirement — already supported

The user's core rule is already supported by the normalized schema.

Example:

- one policy/payable has ₹1,000 expected;
- first transaction ₹400;
- second transaction ₹560.

For Pay-In, separate `accounts_receipts` can allocate ₹400 and ₹560 against the same invoice over time.

For Pay-Out, separate `partner_payments` can allocate ₹400 and ₹560 against the same `partner_payables` row over time.

Therefore **no new generic Pay-In transaction table and no new generic Pay-Out transaction table should be created for this requirement.**

For Pay-In only, exact policy attribution within a multi-policy consolidated invoice is the verified small gap described above.

## Duplicate protection already present

Existing database constraints provide useful idempotency:

- insurer receipt: unique insurer + bank reference;
- partner payment: unique intermediary + payment reference;
- receipt allocation: unique receipt + invoice;
- partner payment allocation: unique payment + payable;
- partner payable: unique commercial payout source;
- invoice number: globally case-insensitive unique when nonblank.

The importer should validate likely duplicates before confirmation, but database constraints remain the final authority.

Repeated Bill Number rows in one workbook are valid when they are policy lines belonging to the same insurer bill; they must be grouped under one invoice header rather than treated as duplicate invoice creation attempts.

## Legacy reconciliation tables

Production also contains:

- `reconciliation_cycles`;
- `reconciliation_lines`;
- `reconciliation_events`.

These structures support the older insurer statement reconciliation flow, including template import/excel-paste source methods and review/close/reopen lifecycle.

The active `/accounts/billing` workbench currently creates invoice drafts only from accepted/resolved legacy reconciliation lines. That dependency belongs to the old UI/workflow, not to the normalized database model: `accounts_invoice_lines.reconciliation_line_id` is nullable.

Decision: **leave these available for Other Recon. The new Accounts workflow must not create fake reconciliation rows or navigate into/require these legacy workspaces merely to create an invoice.**

Do not delete these tables and do not migrate their historical records solely to serve the new UI.

## Accounting-period controls

The schema already includes `accounting_periods`, `accounting_period_events` and guard functions/triggers for closed accounting dates/documents.

Decision: preserve these controls. When the new importer begins writing financial transactions, it must respect existing accounting-period guards rather than bypassing them.

## Canonical write-path decision after active-code audit

The previously unresolved choice is now settled:

- group validated Excel Pay-In rows by live insurer + Bill Number when they are lines of the same insurer bill;
- use one `accounts_invoices` header per real bill;
- use `accounts_invoice_lines` for policy-specific Bill Amount;
- leave `reconciliation_line_id` null for the new Excel workflow;
- use `accounts_receipts` and existing posting behavior for actual bank receipts/UTRs;
- use `accounts_tds_entries` and existing posting behavior for TDS;
- derive invoice outstanding/status from the normalized model;
- keep `policy_payin_bills` as legacy/reporting compatibility unless a deliberate one-way projection is later implemented;
- do not create or require legacy reconciliation cycles/lines;
- use `partner_payables` + `partner_payments` + allocations for Pay-Out.

The detailed decision record is `docs/ACCOUNTS_EXCEL_RECONCILIATION_CANONICAL_WRITE_MAPPING_2026_09_16.md`.

### Verified gap

Receipt allocations currently target invoice headers, not invoice lines/policies. If one consolidated insurer invoice contains many policies and Accounts must preserve the exact receipt amount attributable to each policy, the existing schema cannot store that split.

This is a legitimate candidate for a **small extension to the existing allocation model**, not a reason to create a new Pay-In ledger.

TDS has the same potential granularity issue only if TDS will be entered per policy row rather than at bill level.

## Import batch persistence

No dedicated Accounts reconciliation import batch/row tables were identified in this audit.

That does not automatically mean they should be created.

For the first confirmed-import design, prefer:

- parse workbook server-side;
- validate against live data;
- allow preview corrections in temporary application state;
- on Confirm Import, call/reuse existing posting behavior atomically/idempotently;
- rely on existing transaction IDs, UTR uniqueness and event/ledger records as financial proof.

Only add import-batch persistence if a concrete requirement appears, such as resumable uploads, original-file retention, per-row upload provenance, or batch-level rollback/audit that cannot be represented safely through existing records.

## No database changes from this audit

This audit was read-only.

No table, column, index, constraint, function, trigger, policy or production data was created, modified or deleted.

## Next implementation direction

1. Finalize the exact `Pay-In` and `Pay-Out` workbook columns and field granularity.
2. Confirm whether TDS is a bill-level or policy-row-level operational input.
3. Design the smallest safe invoice-line receipt-attribution extension for consolidated invoices.
4. Put any required DDL in a separate implementation migration/PR; do not apply production DDL merely because the migration exists.
5. Remove legacy page redirects from the new Accounts dashboard workflow; keep legacy workspaces in Other Recon.
6. Redesign the downloadable workbook into `Pay-In` and `Pay-Out` sheets using existing authoritative commercial values.
7. Keep upload preview non-writing until Confirm Import.
8. Reuse existing receipt/TDS/payable/payment posting logic and preserve ledger/event/accounting-period controls.
9. Add regression coverage for multi-policy bills, partial receipts, duplicate UTRs, partial Partner payouts, over-allocation, closed periods and retries/idempotency.
10. Do not introduce new generic financial transaction tables.
# Accounts Excel Reconciliation — Existing Schema Reuse Audit

Date: 2026-09-16

Status: **READ-ONLY PRODUCTION AUDIT / NO DATABASE CHANGES MADE**

Canonical architecture: `docs/ACCOUNTS_RECONCILIATION_WORKFLOW_STEP1_2026_09_16.md`

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

## Existing schema mapping

| New workflow requirement | Existing production structure | Audit decision |
|---|---|---|
| Policy identity | `policies.id`, `policies.policy_no` | **REUSE** |
| Net premium | `policy_premium_details.net_premium` | **REUSE** |
| Projected Pay-In | `policy_payin_details` | **REUSE** |
| Projected Pay-Out / retention | `policy_intermediary_payouts` | **REUSE** |
| Policy-level bill fields | `policy_payin_bills` | **REUSE where semantics fit; do not duplicate** |
| Normalized insurer invoice | `accounts_invoices` | **REUSE** |
| Policy rows within invoice | `accounts_invoice_lines` | **REUSE** |
| Insurer receipt / UTR transaction | `accounts_receipts` | **REUSE** |
| Receipt-to-invoice allocation | `accounts_receipt_allocations` | **REUSE** |
| TDS transaction | `accounts_tds_entries` | **REUSE** |
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

This is very close to the Accounts team's requested spreadsheet format and should not be duplicated.

However, this table combines bill and receipt information on the same row. The newer normalized Accounts model separately represents invoices, receipts and allocations. Therefore the implementation must decide which existing layer is canonical for the new import rather than writing the same fact into two unrelated sources without an explicit synchronization rule.

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

This is suitable for representing a bill containing one or more policy rows.

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

Decision: **the new Excel importer should strongly prefer this existing posting function for confirmed Pay-In receipts instead of reproducing its accounting logic in application code.**

### `accounts_tds_entries` and `post_accounts_tds(...)`

Production already has separate TDS transaction storage and a posting function that:

- validates invoice eligibility and balance;
- writes the TDS entry;
- writes the receivable ledger credit;
- reduces outstanding;
- updates invoice status;
- records invoice event history.

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

Already allocates payments to payables. This supports multiple payment installments against the same payable.

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

Decision: **the Excel importer should reuse this function for confirmed Pay-Out transactions instead of implementing parallel payout accounting logic.**

## Partial payment requirement — already supported

The user's core rule is already supported by the normalized schema.

Example:

- one policy/payable has ₹1,000 expected;
- first transaction ₹400;
- second transaction ₹560.

For Pay-In, separate `accounts_receipts` can allocate ₹400 and ₹560 against the same invoice over time.

For Pay-Out, separate `partner_payments` can allocate ₹400 and ₹560 against the same `partner_payables` row over time.

Therefore **no new generic Pay-In transaction table and no new generic Pay-Out transaction table should be created for this requirement.**

## Duplicate protection already present

Existing database constraints provide useful idempotency:

- insurer receipt: unique insurer + bank reference;
- partner payment: unique intermediary + payment reference;
- receipt allocation: unique receipt + invoice;
- partner payment allocation: unique payment + payable;
- partner payable: unique commercial payout source;
- invoice number: globally case-insensitive unique when nonblank.

The importer should validate likely duplicates before confirmation, but database constraints remain the final authority.

## Legacy reconciliation tables

Production also contains:

- `reconciliation_cycles`;
- `reconciliation_lines`;
- `reconciliation_events`.

These structures support the older insurer statement reconciliation flow, including template import/excel-paste source methods and review/close/reopen lifecycle.

Decision: **leave these available for Other Recon. The new Accounts workflow should not navigate into or require these legacy workspaces.**

Do not delete these tables and do not migrate their historical records solely to serve the new UI.

## Accounting-period controls

The schema already includes `accounting_periods`, `accounting_period_events` and guard functions/triggers for closed accounting dates/documents.

Decision: preserve these controls. When the new importer begins writing financial transactions, it must respect existing accounting-period guards rather than bypassing them.

## Main unresolved semantic question

Most required structures already exist. The main remaining design choice is not whether to add transaction tables, but **how the Excel policy-level Bill fields map into the two existing billing layers**:

1. legacy `policy_payin_bills`; and
2. normalized `accounts_invoices` + `accounts_invoice_lines`.

The normalized model is stronger for receipts, TDS, outstanding balance and audit. But the user's spreadsheet is policy-row oriented, while an insurer invoice may contain multiple policies.

Before any schema change, implementation should inspect the active old billing page/RPC behavior and then choose one canonical write path.

Preferred direction, subject to code audit:

- group Excel rows by insurer + Bill Number when they represent the same insurer bill;
- create/reuse one `accounts_invoices` header;
- create policy-specific `accounts_invoice_lines`;
- create actual bank receipts by UTR using `post_accounts_receipt`;
- post TDS using `post_accounts_tds`;
- derive outstanding/status from the normalized model;
- use `policy_payin_bills` only if existing production code requires it as a compatibility projection, with an explicit synchronization rule rather than independent duplicate writes.

One potential gap remains: receipt allocations currently target invoice headers, not individual invoice lines/policies. If one consolidated insurer invoice contains many policies and Accounts needs to report exactly which installment amount belongs to which policy, that attribution is not directly represented by `accounts_receipt_allocations`. **Do not add a field/table yet.** First confirm whether Accounts actually allocates receipts policy-by-policy or only needs bill-level receipt reconciliation plus policy-line bill reporting.

## Import batch persistence

No dedicated Accounts reconciliation import batch/row tables were identified in this audit.

That does not automatically mean they should be created.

For the first confirmed-import design, prefer:

- parse workbook server-side;
- validate against live data;
- allow preview corrections in temporary application state;
- on Confirm Import, call existing posting functions atomically/idempotently;
- rely on existing transaction IDs, UTR uniqueness and event/ledger records as financial proof.

Only add import-batch persistence if a concrete requirement appears, such as resumable uploads, original-file retention, per-row upload provenance, or batch-level rollback/audit that cannot be represented safely through existing records.

## No database changes from this audit

This audit was read-only.

No table, column, index, constraint, function, trigger, policy or production data was created, modified or deleted.

## Next implementation direction

1. Inspect active billing/receivable/partner-payable application code and any remaining RPCs to settle the canonical bill mapping.
2. Remove legacy page redirects from the new Accounts dashboard workflow; keep legacy workspaces in Other Recon.
3. Redesign the downloadable workbook into `Pay-In` and `Pay-Out` sheets using existing authoritative commercial values.
4. Keep upload preview read-only to the database until Confirm Import.
5. Reuse `post_accounts_receipt`, `post_accounts_tds`, `create_partner_payable`, approval lifecycle and `post_partner_payment` for confirmed writes wherever their existing business rules match.
6. Do not introduce new financial transaction tables unless a verified gap remains after the code audit.

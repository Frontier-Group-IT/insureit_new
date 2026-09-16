# Accounts Excel Reconciliation — Canonical Write Mapping

Date: 2026-09-16

Status: **CODE + PRODUCTION SCHEMA AUDIT COMPLETE / DESIGN DECISION RECORDED / NO DATABASE CHANGES MADE**

Canonical architecture: `docs/ACCOUNTS_RECONCILIATION_WORKFLOW_STEP1_2026_09_16.md`

Supporting schema audit: `docs/ACCOUNTS_EXCEL_RECONCILIATION_SCHEMA_AUDIT_2026_09_16.md`

## Purpose

This document closes the main unresolved question from the first Accounts schema audit: how the new Excel-first Accounts workflow should map policy-level bill, receipt, TDS and payout rows into the financial structures that already exist.

The decision below is based on:

- the live production schema;
- the current Accounts billing actions;
- the current Accounts Partner Payables actions;
- existing posting RPCs/functions;
- current production data shape in `policy_payin_bills`;
- the approved rule that the new Accounts workflow must remain independent of the legacy reconciliation workspaces kept under **Other Recon**.

No database table, column, function, trigger, policy or production record was changed during this audit.

## Executive decision

The new Accounts Excel reconciliation workflow should use the **normalized Accounts financial model as the canonical transaction layer**.

For new confirmed imports:

- bill header / insurer document -> `accounts_invoices`;
- policy-level bill amount -> `accounts_invoice_lines`;
- actual insurer bank receipt / UTR -> `accounts_receipts`;
- receipt allocation -> `accounts_receipt_allocations`;
- TDS -> `accounts_tds_entries`;
- receivable ledger -> `accounts_receivable_entries`;
- payout liability -> `partner_payables`;
- actual Partner payment / UTR -> `partner_payments`;
- Partner payment allocation -> `partner_payment_allocations`;
- lifecycle audit -> existing invoice/payable event tables.

`policy_payin_bills` must **not become a second independently-written source of truth for the same confirmed Excel transaction**.

It remains a legacy/policy-finance compatibility structure until a deliberate projection/synchronization strategy is designed.

The new Excel workflow also must **not require `reconciliation_cycles` or `reconciliation_lines`**. Those tables belong to the legacy statement reconciliation flow retained under Other Recon.

## Why `accounts_invoices` is the canonical bill layer

The active legacy billing workbench already demonstrates the intended normalized relationship:

1. one `accounts_invoices` header belongs to one insurer;
2. one invoice can contain multiple `accounts_invoice_lines`;
3. each line can carry a `policy_id` and `policy_no`;
4. invoice header values own invoice number/date/status/outstanding lifecycle;
5. invoice lines own the policy-specific amount.

The current billing action builds invoice lines from legacy `reconciliation_lines`, but `accounts_invoice_lines.reconciliation_line_id` is nullable. Therefore the new Excel importer does **not** need to manufacture a legacy reconciliation line before it can create a policy-linked invoice line.

The new importer should create its policy-specific lines directly from validated System Policy IDs.

## Why `policy_payin_bills` is not the new canonical transaction layer

`policy_payin_bills` is useful and remains important for existing reporting compatibility, but its current semantics are materially different from the normalized Accounts transaction model.

Production inspection shows that all 833 current rows are still operationally pre-reconciliation:

- 575 rows are `Unbilled` with no bill number, billed amount, receipt or UTR;
- 258 rows are `Billing details incomplete`, with a billed amount but no bill number and no receipt;
- no current rows contain an actual received amount or receipt reference.

The policy onboarding function creates a `policy_payin_bills` row at policy creation time. It is therefore currently acting primarily as a policy-finance/billing-status snapshot created alongside the commercial record, not as a mature bank-transaction ledger.

Existing finance/readiness reports also read this table to classify policies as:

- Unbilled;
- Billing details incomplete;
- Billed.

Because it combines bill and receipt fields in one policy row while the normalized model separates invoices, receipts, allocations and TDS, writing both layers independently from Excel would create reconciliation drift.

### Decision

For the new workflow:

- normalized Accounts tables are canonical for confirmed financial transactions;
- `policy_payin_bills` remains available to legacy reports and Other Recon;
- do not dual-write it from the importer unless a later explicit compatibility projection is implemented and tested as one-way derived state;
- do not read `policy_payin_bills.received_amount` as the authoritative cash ledger for the new workflow.

## Canonical Pay-In bill mapping

### Excel fields

The Pay-In sheet should include protected/reference fields plus Accounts-entered transaction fields.

Relevant billing fields:

- System Policy ID
- Policy Number
- Insurance Company
- Projected Pay-In
- Bill Number
- Bill Amount
- Bill Date

### Confirmed import mapping

Rows that share the same real insurer bill should be grouped into one invoice header using the validated insurer identity plus Bill Number.

Create/reuse:

### `accounts_invoices`

- `insurer_id` <- live policy insurer
- `invoice_no` <- Bill Number
- `invoice_date` <- Bill Date
- `status` <- raised/posted state according to the final importer transaction boundary
- `brokerage_subtotal` / gross fields <- sum of policy-line Bill Amounts under that invoice, with tax semantics kept consistent with the existing billing model
- `outstanding_amount` <- invoice amount less confirmed receipt/TDS postings
- `created_by` / raised actor <- authenticated Accounts profile

### `accounts_invoice_lines`

One row per policy line in the bill:

- `invoice_id` <- grouped bill header
- `policy_id` <- protected System Policy ID
- `policy_no` <- live policy number snapshot
- `reconciliation_line_id` <- **NULL for the new Excel workflow**
- `invoice_line_amount` <- policy-level Bill Amount
- brokerage/adjustment fields only where their existing semantics match the imported bill fact

This supports one insurer bill containing many policies without duplicating invoice numbers.

## Important rule: do not route the new importer through legacy reconciliation lines

The current `/accounts/billing` workbench only offers invoice creation from finalized `reconciliation_lines` because it was built for the old reconciliation architecture.

That is an application-workflow dependency, not a database requirement.

The new Excel workflow must not:

- create fake reconciliation cycles;
- create fake reconciliation lines;
- mark old reconciliation rows accepted solely to unlock billing;
- redirect users to the billing workbench to finish the import.

Instead, the new server-side confirmed-import service should reuse the normalized financial tables and accounting rules directly.

Legacy billing UI remains available through Other Recon.

## Canonical insurer receipt mapping

Relevant Pay-In fields:

- Amount Received
- Receipt Date
- UTR / Reference

The canonical cash transaction is `accounts_receipts`.

The existing `post_accounts_receipt(...)` function is valuable because it already:

- rejects non-positive receipts;
- requires a bank reference;
- locks target invoices;
- prevents over-allocation;
- requires allocation total to equal bank amount;
- inserts the receipt;
- inserts allocations;
- writes receivable-ledger entries;
- updates invoice outstanding/status;
- writes invoice events.

### Decision

Confirmed Excel imports should use this posting behavior instead of duplicating it in arbitrary application updates.

The existing unique insurer + bank-reference constraint remains the final duplicate guard for UTR/reference reuse.

## Verified Pay-In semantic gap: policy-level receipt attribution inside a consolidated bill

The code/schema audit confirms one real gap.

`accounts_receipt_allocations` currently allocates:

**Receipt -> Invoice**

It does not allocate:

**Receipt -> Invoice Line / Policy**

This is sufficient when Accounts only needs to know that a consolidated insurer invoice received ₹X.

It is **not sufficient** if the Pay-In Excel row says that a specific portion of one receipt belongs to a specific policy inside that consolidated invoice and the system must later report that policy-level receipt history exactly.

Example:

- Bill B-100 contains Policy A ₹600 and Policy B ₹400.
- One bank receipt UTR-X is ₹700.
- Excel says ₹500 belongs to Policy A and ₹200 belongs to Policy B.

The current normalized schema can record:

- invoice B-100 = ₹1,000;
- receipt UTR-X = ₹700;
- allocation UTR-X -> B-100 = ₹700.

It cannot persist the final split ₹500 / ₹200 at invoice-line level.

### Consequence

This is the first verified semantic gap that may justify a **small schema extension**, but not a parallel transaction table.

Before implementing confirmed imports, the design should add the smallest possible policy-line attribution mechanism, preferably by extending allocation semantics around the existing invoice line rather than creating a new generic Pay-In transaction system.

A safe target shape is conceptually:

- receipt transaction remains `accounts_receipts`;
- invoice remains `accounts_invoices`;
- policy bill remains `accounts_invoice_lines`;
- allocation gains an invoice-line/policy target for exact attribution.

The final DDL should be designed in a separate implementation PR with migration, constraints, backfill/no-backfill decision, posting-RPC update and regression coverage. **No DDL was applied as part of this audit.**

## TDS attribution gap

`accounts_tds_entries` currently targets an invoice, not an invoice line/policy.

That is correct when TDS is known only at consolidated invoice level.

If the approved Pay-In workbook requires TDS entered and reported separately per policy row inside a multi-policy bill, exact policy-level TDS attribution is also not represented today.

### Decision

The definitive workbook/import implementation must treat this explicitly:

- if TDS is bill-level, keep the existing invoice-level model;
- if TDS is policy-row-level, make the same minimal line-attribution extension rather than creating another parallel TDS ledger.

The current architecture wording that lists TDS in the Pay-In operational fields does not by itself prove which granularity the Accounts team will provide. The importer must not silently invent a policy split from an invoice-level TDS amount.

## Partial receipts remain supported

The gap above does **not** mean partial payments are unsupported.

The existing normalized model already supports multiple receipts over time against the same invoice:

- Receipt 1 -> invoice
- Receipt 2 -> same invoice
- Receipt 3 -> same invoice

The missing detail is only the exact policy-line split when the invoice contains multiple policies.

Therefore no generic Pay-In transaction table is required.

## Canonical Pay-Out mapping — no equivalent policy-attribution gap

The Pay-Out side is cleaner because the existing model already resolves liability at policy payout level before payment allocation.

### Commercial source

`policy_intermediary_payouts`

Canonical projected amount for Accounts cashflow: **`gross_payout`**.

Do not use `partner_payout_amount` as the Accounts cashflow source. That field can hold planning/configuration values that do not represent payable cashflow.

### Liability

`partner_payables`

One payable is tied to one `policy_payout_id`, so the policy-level liability is explicit.

### Payment

`partner_payments`

Stores payment date, reference/UTR, amount and intermediary.

### Allocation

`partner_payment_allocations`

Allocates a payment directly to a specific payable, and that payable already identifies the policy commercial payout.

Therefore a Partner payment can be split across several policy payables while retaining exact policy attribution.

The existing `post_partner_payment(...)` function already validates the allocation total, partner identity, outstanding balance and status while writing lifecycle events.

### Decision

No new Pay-Out transaction table or policy-attribution structure is needed for the approved Excel workflow.

## Canonical correction model

Confirmed financial transactions should not be silently overwritten by later workbook uploads.

Existing structures already provide the building blocks:

- receivable ledger has a `Reversal` entry type;
- invoice/payable event tables preserve lifecycle history;
- accounting-period guards exist;
- Partner payments/payables are normalized and auditable.

The later correction workflow should be implemented as explicit reversal/void + replacement semantics. It must not make an imported workbook behave like an editable master spreadsheet after confirmation.

## Duplicate/idempotency rules

Use the existing database constraints as final authority and add importer preview checks for operator clarity.

### Pay-In

Strong existing duplicate key:

- insurer + bank reference/UTR on `accounts_receipts`.

Bill duplicate protection:

- case-insensitive unique nonblank invoice number on `accounts_invoices`.

Because the new workflow groups policy rows under a common bill header, repeated Bill Number rows in the workbook are valid when they represent different policy lines of the same bill. They must not be mistaken for duplicate invoice creation attempts.

### Pay-Out

Strong existing duplicate key:

- intermediary + payment reference/UTR on `partner_payments`.

A repeated policy is valid when it represents a later installment with a new payment reference.

## Required transaction boundary for Confirm Import

The preview remains non-writing.

On Confirm Import, the server should validate the workbook again against live data and then apply financial writes using an atomic/idempotent design.

At a minimum:

1. revalidate access scope;
2. revalidate System Policy IDs and visible policy references;
3. reload authoritative projected Pay-In/Payout values;
4. validate insurer/intermediary identity;
5. validate bill grouping consistency;
6. validate duplicate invoice/UTR/payment references;
7. validate amounts and dates;
8. validate outstanding balances;
9. respect closed accounting periods;
10. write normalized financial records;
11. write ledger/events through existing posting behavior;
12. return permanent transaction IDs and per-row confirmation results.

If any blocking row fails before the transaction boundary, no partial financial import should be silently committed.

## Concrete architecture status after this audit

| Requirement | Decision |
|---|---|
| Projected Pay-In | Existing `policy_payin_details`; read-only to Accounts import |
| Policy bill header | Existing `accounts_invoices` |
| Policy bill amount | Existing `accounts_invoice_lines` |
| Actual insurer receipt | Existing `accounts_receipts` |
| Partial insurer receipts | Existing receipt model supports repeated receipts |
| Receipt -> invoice allocation | Existing `accounts_receipt_allocations` |
| Exact receipt -> policy line allocation | **Verified small schema gap for consolidated invoices** |
| TDS at invoice level | Existing `accounts_tds_entries` |
| Exact TDS -> policy line attribution | **Potential small schema gap if policy-level TDS is required** |
| Projected payout | Existing `policy_intermediary_payouts.gross_payout` |
| Partner liability | Existing `partner_payables` |
| Actual Partner payment | Existing `partner_payments` |
| Payment -> policy payable allocation | Existing `partner_payment_allocations`; no gap |
| Financial events | Existing event tables |
| Receivable reversal concept | Existing ledger supports `Reversal` |
| Legacy reconciliation | Keep under Other Recon; do not depend on it |
| `policy_payin_bills` | Legacy/reporting compatibility; not independent canonical import ledger |
| New generic Pay-In table | **Do not create** |
| New generic Pay-Out table | **Do not create** |

## Next implementation phase

The architecture is now sufficiently settled to begin implementation planning for the definitive workbook and confirmed import.

Proceed in this order:

1. Define the exact final `Pay-In` and `Pay-Out` workbook columns and their granularity.
2. Confirm whether TDS is entered at bill level or policy-row level.
3. Design the minimal invoice-line receipt attribution extension required for consolidated bills.
4. Put that schema extension in a migration on a separate implementation branch; do not apply production DDL merely because the migration exists.
5. Extend/reuse receipt posting RPC logic so policy-line allocations remain atomic with invoice outstanding/ledger/event updates.
6. Build definitive two-sheet download.
7. Build validation preview with editable upload-owned fields.
8. Build Confirm Import using the normalized financial model.
9. Add regression tests for multi-policy bills, partial receipts, duplicate UTRs, partial Partner payouts, over-allocation, closed periods and retry/idempotency.
10. Keep legacy workspaces accessible only through Other Recon.

## Audit conclusion

The audit confirms that the Accounts architecture does **not** need a new parallel accounting system.

The normalized insurer receivable and Partner payable structures already provide the majority of the required model and transaction controls.

The only confirmed structural issue for the new Excel workflow is the granularity of insurer-side allocation when one consolidated bill contains multiple policies. That should be solved with a small extension to the existing normalized allocation model, not by creating a second Pay-In ledger.

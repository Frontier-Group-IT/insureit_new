# Accounts Excel-First Reconciliation Architecture

Date: 2026-09-16

Status: **APPROVED ARCHITECTURE DIRECTION / IMPLEMENTATION PARTIALLY LIVE / DATABASE REUSE AUDIT REQUIRED BEFORE NEW DDL**

Canonical reference for future Accounts reconciliation work.

> This file supersedes the earlier Step 1–2 interpretation that the new Accounts workflow should redirect users into the legacy reconciliation, billing, receivable or settlement pages. Those legacy workspaces remain available only under **Accounts → Other Recon**. The new Accounts workflow is Excel-first and must not depend on those old pages for normal operation.

## 1. Purpose

The Accounts team ultimately needs a professional, controlled system that can generate its final Business MIS in the familiar spreadsheet format while allowing day-to-day pay-in and pay-out reconciliation to be completed through a single controlled Excel workflow.

The application must not become a large editable spreadsheet UI. Instead:

- INSUREIT remains the source of truth for policies, commercial terms, projected pay-in, projected payout and retention.
- Accounts performs operational reconciliation through a controlled workbook.
- The workbook is uploaded, validated, previewed and confirmed before any financial transaction is written.
- The final Business MIS export can reproduce the Accounts team's required reporting format.
- Existing legacy reconciliation features remain intact under **Other Recon**, but are not part of this new workflow.

## 2. Architectural boundary: New Recon vs Other Recon

### New Accounts reconciliation

Normal Accounts processing must use only the new Excel-first workflow:

1. Choose the Accounts dashboard filters.
2. Download the controlled reconciliation workbook.
3. Fill pay-in and/or pay-out transaction details.
4. Upload the workbook.
5. Validate the workbook.
6. Allow correction of upload-owned fields inside the validation preview if necessary.
7. Block error rows.
8. Confirm Import.
9. Store new financial transaction entries.
10. Recalculate reconciliation summaries/statuses from the authoritative commercial values plus imported transactions.
11. Export registers / Business MIS when required.

The new workflow must **not redirect** Accounts users to:

- legacy insurer reconciliation pages;
- legacy brokerage billing pages;
- legacy receivable/settlement pages;
- legacy manual reconciliation workbenches.

### Other Recon

The existing reconciliation system is not being deleted.

Legacy and exception workflows remain available under:

**Accounts → Other Recon**

This keeps historical functionality available without contaminating the new streamlined process.

## 3. Mandatory database-reuse rule

The old Accounts/reconciliation system was designed with many of the same accounting concepts already in mind. Therefore:

> **Do not create new tables or duplicate financial columns merely because the new UI/workflow is different.**

Before any new migration or DDL is proposed, future agents must inspect the current database schema, migrations and active code paths and map every new requirement to existing structures.

Audit at minimum:

- `policies`
- `policy_premium_details`
- `policy_payin_details`
- `policy_payin_bills`
- `policy_intermediary_payouts`
- existing billing/reconciliation/receivable/settlement tables
- any existing payment/allocation/ledger/audit tables
- active RPCs used by Policy Onboarding and `/policies/commercial-review`
- current legacy reconciliation pages under Other Recon
- current Accounts dashboard Excel preview code

For every required field or transaction concept, classify it as:

- **EXISTING / REUSE** — current schema semantics already match.
- **EXISTING / EXTEND** — current table is correct but a small field/constraint/index may be missing.
- **MISSING / ADD** — no current authoritative structure can represent the requirement safely.
- **LEGACY-ONLY / LEAVE UNTOUCHED** — old feature remains for Other Recon but should not be reused by the new workflow.

No database migration should be created until this mapping is completed.

## 4. Authoritative commercial values

Accounts must not be able to edit projected commercial terms through the reconciliation workbook.

The following values are system-owned and authoritative:

- Projected Pay-In
- projected OD/TP pay-in components where applicable
- insurer scheme values where applicable
- projected TDS logic where applicable
- Projected / Gross Partner Payout
- payout OD %
- payout TP %
- intermediary commercial basis
- projected retention

These values are created or edited only through the existing commercial workflow:

1. Policy Onboarding; and
2. `/policies/commercial-review`

The Excel reconciliation workflow may display these values for reference and validation, but must not overwrite them.

## 5. Workbook design

Use **one workbook** with separate operational sheets:

- `Pay-In`
- `Pay-Out`

A separate `Instructions` sheet may be included for guidance and format rules.

The workbook should be generated from the currently selected Accounts filters so the visible policy set remains relevant to the operator.

## 6. Hidden/protected system identity

Each downloadable policy row must include a protected internal identifier in addition to the visible Policy Number.

Recommended reference fields:

- `System Policy ID` — hidden/protected, authoritative matching key
- `Policy Number` — visible human reference

Policy Number alone must not be trusted as the database identity because formatting, duplication across insurers and accidental user edits can create ambiguity.

The upload service must resolve records using the protected system identity and validate the visible references against live data.

## 7. Pay-In sheet

### System-controlled/reference fields

Recommended fields:

- System Policy ID — hidden/protected
- Policy Number
- Insurance Company
- Projected Pay-In

Projected Pay-In must always be refreshed/revalidated from the live commercial source during upload validation. A workbook-edited projected value must never become authoritative.

### Accounts-entered transaction fields

Required model includes:

- Bill Number
- Bill Amount
- Bill Date
- TDS
- Amount Received
- Receipt Date
- UTR / Reference

### System-calculated fields

Do not require Accounts to type calculated reconciliation outcomes.

The system should derive values such as:

- Bill Difference
- cumulative Amount Received against the policy
- remaining / Outstanding Pay-In
- reconciliation status

The exact sign convention for Difference must remain consistent throughout the UI/export once finalized. The current intended accounting concept is the difference between authoritative expected/projected pay-in and the relevant billed/received amount.

## 8. Pay-Out sheet

The existing commercial data and the Business MIS structure indicate that payout commercial terms must remain system-owned while Accounts records execution/payment transactions.

### System-controlled/reference fields

Recommended fields:

- System Policy ID — hidden/protected
- Policy Number
- Intermediary / Partner reference
- Payout OD %
- Payout TP %
- Projected Gross Payout

Where the current schema exposes a more authoritative payout amount or naming convention, the database audit must use that existing semantic rather than creating a duplicate value.

### Accounts-entered transaction fields

Recommended execution fields:

- Paid Amount
- Paid Date
- UTR / Reference

If the existing database already has a canonical payout execution/TDS/settlement structure, reuse its fields instead of introducing parallel columns.

### System-calculated fields

The system should derive:

- cumulative Paid Amount against the policy
- Outstanding Payout
- payout reconciliation status

Accounts must not edit payout percentage, projected payout or retention through Excel.

## 9. Partial payments / one policy to many transactions

This is a core approved business rule.

A policy may receive pay-in or payout in multiple installments.

Example:

- Projected Pay-In = ₹1,000
- First insurer payment = ₹400
- Later insurer payment = ₹560

The system must keep **one policy** and store **two Pay-In transaction entries** against it.

Do not duplicate the policy row/entity merely because there are multiple financial transactions.

The same rule applies to payout.

Therefore the target data model must support:

- one policy → many Pay-In transactions
- one policy → many Pay-Out transactions

If the existing database already supports these one-to-many transaction relationships, reuse them. If not, the audit must identify the smallest safe extension.

## 10. Import is append-only for normal Accounts users

Excel upload must **not update or overwrite an existing confirmed financial transaction**.

A repeated policy in a later workbook is valid because it may represent another installment.

A repeated transaction is not valid.

The import process should therefore append new transaction entries while checking for probable duplicates.

Recommended duplicate checks include combinations such as:

- System Policy ID
- amount
- transaction/payment date
- UTR/reference
- bill number where applicable

The exact uniqueness/idempotency rule must be based on the existing database model after audit and must not prevent legitimate installment payments.

## 11. Transaction identifiers

Each confirmed imported transaction should have a permanent system identity independent of the policy identity.

Conceptually:

- one Policy ID
- many Pay-In Transaction IDs
- many Pay-Out Transaction IDs

If existing tables already provide suitable UUIDs/transaction IDs, reuse them.

Do not create a parallel human-readable sequence unless it materially improves Accounts operations and does not duplicate an existing identifier.

## 12. Upload validation workflow

Approved workflow:

**Upload → Validation Preview → Error rows blocked → Confirm Import**

Validation must happen before database writes.

At minimum validate:

- workbook type and size
- required sheet names
- required headers
- protected System Policy ID
- policy accessibility / Accounts scope
- visible Policy Number against live policy data
- insurer/intermediary reference where applicable
- live projected values against workbook references
- amount type/range
- date format
- Bill Amount dependencies
- Bill Number / Bill Date dependencies
- Amount Received / Receipt Date / UTR dependencies
- payout Paid Amount / Paid Date / UTR dependencies
- probable duplicate transactions
- rows already confirmed/imported if an existing transaction identifier is somehow supplied

Rows with blocking errors cannot be imported.

## 13. Editing during validation

Accounts may correct **upload-owned transaction fields** in the validation preview before confirming import.

This is the only normal editing surface for the new reconciliation workflow.

Editable during preview may include:

- Bill Number
- Bill Amount
- Bill Date
- TDS
- Amount Received
- Receipt Date
- UTR / Reference
- Pay-Out Paid Amount
- Pay-Out Paid Date
- Pay-Out UTR / Reference

System-owned values remain locked:

- System Policy ID
- Policy Number identity
- Insurer
- Intermediary identity
- Projected Pay-In
- payout percentages
- Projected Gross Payout
- retention / commercial values

After Confirm Import, Accounts must not silently modify the confirmed transaction through the normal workflow.

## 14. Corrections after import

A future controlled correction mechanism should preserve accounting history rather than rewriting it.

Preferred architecture:

- void/reverse the incorrect transaction with reason, actor and timestamp;
- create the replacement transaction;
- retain the original record in audit history.

Do not implement destructive silent edits to confirmed financial history.

The database audit must first determine whether the legacy system already has reversal/status/audit capabilities that can be reused.

## 15. Reconciliation status model

The exact UI labels may evolve, but statuses should be derived from authoritative projected values plus imported transaction totals rather than manually typed.

Pay-In concepts may include:

- Not Billed
- Billed
- Partially Received
- Received
- Difference / Attention Required
- Reconciled

Pay-Out concepts may include:

- Pending
- Partially Paid
- Paid
- Difference / Attention Required
- Reconciled

Do not add redundant persisted status columns if these statuses can already be safely derived or if the old schema already owns the canonical state.

## 16. Dashboard design direction

The Accounts Dashboard should summarize financial position rather than render the complete Business MIS grid.

The current filters remain the operating context:

- Last month / MTD / Custom date
- Insurance Company
- Branch placeholder until insurer-branch master data is designed

Existing top-level KPI concepts include:

- Policies
- Net Premium
- Projected Net Pay-In
- Projected Net Payout
- Projected Retention

As transaction imports become live, additional operational summaries can be derived, for example:

Pay-In:

- Projected
- Billed
- Received
- Outstanding
- Difference / Attention

Pay-Out:

- Projected
- Paid
- Outstanding

Retention:

- Projected
- Realised, only when the accounting definition is formally established from authoritative transaction data

The dashboard should remain compact and professional and should not become a 30+ column spreadsheet.

## 17. Final Business MIS export

The final detailed export should preserve the Accounts team's familiar reporting structure.

The source workbook reviewed for this architecture includes the final reconciliation fields:

- Bill Number
- Bill Amount
- Bill Date
- Difference
- Paid Amount
- Paid Date
- UTR Details

The final Business MIS should combine policy/commercial master values with imported transaction/reconciliation data and may include the wider policy/premium/pay-in/payout/retention columns already used by the Accounts team.

The MIS is an **output/reporting format**, not the canonical database model.

## 18. Important distinction: Bill vs Receipt

Bill Amount and Amount Received are separate accounting facts.

Example:

- Bill / expected amount = ₹1,000
- first receipt = ₹400
- later receipt = ₹560

Do not force Bill Amount and Amount Received into a single field or overwrite the original bill fact with installment receipts.

The same principle applies to payout liability vs payout execution.

## 19. Current live implementation from PR #1933

The current production implementation already provides:

- Accounts workflow section on the dashboard
- controlled `.xlsx` template download
- upload preview
- header/file validation
- live projected pay-in revalidation
- Ready / Warning / Error row-level preview
- no financial database write from the preview

However, the current live workflow still contains links from the new Accounts workflow into the old reconciliation/billing/receivable pages.

Those redirects are now **superseded by this architecture decision** and must be removed in the next implementation phase. The legacy destinations remain available through **Other Recon** only.

## 20. Next required work order

Future implementation must proceed in this order:

### Phase A — schema/code audit first

Inspect the current database and active code before changing schema.

Deliver a mapping:

| Requirement | Existing structure | Decision |
|---|---|---|
| Projected Pay-In | To be verified | Reuse / extend / add |
| Projected Payout | To be verified | Reuse / extend / add |
| Pay-In bill | To be verified | Reuse / extend / add |
| Pay-In installments/receipts | To be verified | Reuse / extend / add |
| Pay-Out installments/payments | To be verified | Reuse / extend / add |
| UTR/reference | To be verified | Reuse / extend / add |
| TDS | To be verified | Reuse / extend / add |
| Reversal/void | To be verified | Reuse / extend / add |
| Audit history | To be verified | Reuse / extend / add |

### Phase B — remove legacy redirects from new workflow

- New workflow becomes Excel-only.
- Old pages stay under Other Recon.

### Phase C — definitive two-sheet workbook

- Pay-In sheet
- Pay-Out sheet
- protected system identity
- authoritative reference values
- upload-owned transaction fields only

### Phase D — validation + preview editing

- allow safe correction of upload-owned fields
- block errors
- detect likely duplicate transactions

### Phase E — confirmed import

- append-only new financial transactions
- atomic import semantics
- idempotency/duplicate protection
- audit actor/timestamps
- no silent overwrite

### Phase F — reconciliation register/dashboard summaries

- derive policy and transaction-level status
- show installments cleanly under one policy

### Phase G — Business MIS export

- reproduce the Accounts team's required final reporting format from system data

## 21. Safety requirements

- No secrets or credentials in workbook, logs or repository docs.
- Do not expose internal database identifiers unnecessarily; the protected system ID may be hidden in the workbook and validated server-side.
- Upload parsing and financial writes must be server-authoritative.
- Never trust workbook-provided projected commercial amounts.
- Do not let Accounts alter Policy Onboarding/Commercial Review commercial values through reconciliation.
- Do not duplicate existing database structures without completing the reuse audit.
- A database migration committed to Git is not proof that it was applied.
- A successful import preview is not proof that financial records were written.
- A merged feature is not proof that production is deployed.

## 22. Approved decisions captured in this architecture

The user has explicitly approved:

1. One workbook with separate Pay-In and Pay-Out sheets.
2. Hidden/protected system ID plus visible Policy Number.
3. Pay-In accounting fields: Expected Pay-In, Actual Pay-In/Bill Amount, Bill Number, Bill Date, Amount Received, Receipt Date, UTR/reference, TDS and Difference.
4. Pay-Out execution fields must be designed from the existing Business MIS and current commercial schema; Accounts must not edit projected payout/commercial terms.
5. Projected Pay-In and payout values remain owned by Policy Onboarding and `/policies/commercial-review`.
6. Upload flow: Upload → Validation Preview → Error rows blocked → Confirm Import.
7. Repeated policy rows are allowed for separate installments; existing confirmed transactions are not updated by later Excel uploads.
8. The same one-policy/many-transactions rule applies to both Pay-In and Pay-Out.
9. Accounts may edit upload-owned fields during validation preview, but does not receive general post-import editing rights.
10. Existing legacy reconciliation options remain under Other Recon and are excluded from the new normal workflow.
11. The database must be audited and existing structures reused before any new financial schema is created.

## 23. Continuity instruction for future agents

When asked to continue the new Accounts workflow:

1. Read this file first.
2. Inspect current `main` because implementation may have advanced.
3. Audit existing schema/code before proposing DDL.
4. Keep the new Excel-first workflow separate from legacy Other Recon navigation.
5. Treat Policy Onboarding and Commercial Review as the only normal sources for projected commercial values.
6. Preserve one-policy/many-transaction behavior for both Pay-In and Pay-Out.
7. Do not enable destructive updates of confirmed imported transactions.
8. Update this document when a verified architecture/schema decision materially changes.

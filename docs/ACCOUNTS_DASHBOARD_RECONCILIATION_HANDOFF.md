# Accounts Dashboard & Reconciliation — Living Working Principles

> **Mandatory living context for future AI agents and developers working on `/accounts`.**
>
> Read this file before changing the Accounts Dashboard, Business MIS reconciliation, Pay-In posting, Payout posting, Accounts Excel import/export, or reconciliation status logic. Update this file in the same PR whenever the working principle, data model, UX, calculation, or rollout status changes.

Last updated: 2026-09-29
Status: active redesign / staged implementation

## 1. Product goal

The Accounts Dashboard should become the single practical workspace for policy-wise Pay-In and Payout reconciliation while preserving the existing Business MIS structure that the Accounts team already understands.

The redesign is not intended to build a general bank-reconciliation or pooled insurer-receipt system. The working unit in INSUREIT is the **individual policy**.

The target experience is:

- one summary row per policy in Business MIS;
- unlimited Pay-In reconciliation entries under that policy;
- unlimited Payout reconciliation entries under that policy;
- cumulative policy-level totals shown in the existing Business MIS columns;
- direct portal entry for small day-to-day work;
- compact transaction-oriented Excel import for bulk work;
- no need to download and edit the entire MIS simply to post the next installment;
- full transaction history and auditability;
- reconciliation status derived from current projection versus cumulative posted entries.

## 2. User-confirmed accounting semantics — do not reinterpret without approval

### Bill Amount

For the current INSUREIT Accounts workflow, **Bill Amount is treated as the received Pay-In amount for the policy**. Preserve this meaning for the redesign.

Do not independently rename or split the current Business MIS into separate `Billed` and `Received` concepts unless the user explicitly approves a future accounting-model change.

Current policy-level Pay-In summary remains based on:

- `Total Pay-in` = projected Pay-In;
- `Bill Number` = Pay-In reference/bill number;
- `Bill Amount` = received/posting amount used by the current Accounts calculation;
- `Bill Date` = transaction/bill date;
- `Difference` = projected Pay-In minus cumulative Bill Amount;
- `TDS` = current TDS value/calculation used by the existing system.

### Policy-wise reconciliation

Pay-In and Payout details are entered and reconciled **individually for each policy**.

Current scope explicitly does **not** prioritize:

- one insurer bank receipt being allocated across many policies;
- partially allocated pooled bank receipts;
- unallocated-cash work queues;
- a general bank-statement reconciliation engine.

Existing database tables may support those accounting concepts, but they are not the product model driving this redesign.

## 3. Existing Business MIS contract must remain stable

The main Business MIS table is the familiar reporting surface and must remain **one row per policy**.

Current visible columns stay in the existing structure and order unless separately approved. In particular, the reconciliation-related columns remain:

### Pay-In
- Total Pay-in
- Bill Number
- Bill Amount
- Bill Date
- Difference
- TDS

### Payout
- Gross Payout
- Retention
- Paid Amount
- Paid Date
- UTR Details

The redesign happens underneath and around this table, not by converting the Business MIS into a transaction table.

## 4. Fundamental redesign principle: summary row + one-to-many history

A policy can have more than one Pay-In receipt/installment and more than one Payout payment/installment.

The current one-slot workflow is insufficient because the next entry becomes impossible to post cleanly after the first amount is already present.

### Canonical example

Projected Pay-In = **₹1,000**

1. First Pay-In entry = ₹400 → remaining ₹600
2. Second Pay-In entry = ₹450 → remaining ₹150
3. Third Pay-In entry = ₹150 → remaining ₹0

The first ₹400 must never be overwritten by the later ₹450.

The Business MIS policy row should finally show the cumulative state:

- Total Pay-in = ₹1,000
- Bill Amount = ₹1,000
- Difference = ₹0

The underlying history still preserves all three entries with their own bill/reference numbers, dates, users, timestamps and source.

The same working principle applies to Payout:

Projected/Gross Payout = **₹1,000**

- payment 1 = ₹300
- payment 2 = ₹450
- payment 3 = ₹250
- cumulative Paid Amount = ₹1,000
- remaining = ₹0

## 5. Summary display rules when multiple transactions exist

The Business MIS row remains compact.

Recommended aggregation rules:

### Pay-In
- `Bill Amount`: sum of all valid policy Pay-In entries.
- `Difference`: `Total Pay-in - cumulative Bill Amount`.
- `Bill Date`: latest valid Pay-In transaction date.
- `Bill Number`: preserve the existing aggregate/reference behavior; where UX is later refined, show the latest reference plus a compact count such as `B003 +2` rather than losing older references.
- `TDS`: cumulative/current value according to existing approved TDS semantics.

### Payout
- `Paid Amount`: sum of all valid policy payout payment entries.
- `Paid Date`: latest valid payout payment date.
- `UTR Details`: preserve all references in history; summary may show latest reference plus a count when compacting is approved.

No summary field should destroy the historical transaction records beneath it.

## 6. Reconciliation status rules

Pay-In and Payout are calculated independently and then combined for the policy-level status.

For an applicable side:

- projection > 0 and cumulative actual = 0 → `Pending`
- projection > 0 and cumulative actual between 0 and projection → `Partial`
- projection > 0 and cumulative actual equals projection (₹0.01 tolerance) → `Reconciled`
- cumulative actual exceeds projection → `Variance`
- projection = 0 and actual = 0 → `Not applicable`
- projection = 0 and actual > 0 → `Variance`

Zero-projection/zero-actual rows must never inflate reconciled counts.

Status must be **derived**, not permanently typed into the row, so a projection change can automatically move a previously reconciled policy back to Partial or Variance without deleting transaction history.

## 7. Target Accounts Dashboard UX

### A. Summary first

Keep the compact KPI and reconciliation overview at the top.

The overview should provide trustworthy counts and cumulative amounts without explanatory filler text.

### B. Policy reconciliation drawer

A Business MIS policy row should expose a compact reconciliation action. Opening it should show a side drawer/panel containing:

#### Policy context
- policy number
- insured/customer
- insurer
- registration number
- relevant business date

#### Pay-In section
- Projected Pay-In
- cumulative Bill Amount
- remaining Difference
- reconciliation percentage/status
- chronological transaction history
- `+ Add Pay-In`

Recommended history columns:
- Bill Date
- Bill Number
- Bill Amount
- TDS where applicable
- remaining after entry when useful
- source
- added by / timestamp

#### Payout section
- Gross/Projected Payout
- cumulative Paid Amount
- remaining
- reconciliation percentage/status
- chronological payment history
- `+ Add Payout`

Recommended history columns:
- Paid Date
- Paid Amount
- UTR/reference
- source
- added by / timestamp

The drawer loads details only when opened so the dashboard does not pull every transaction into the browser.

Current Phase 1 implementation opens the drawer from the existing **Policy Number** cell. No extra visible Business MIS column was added.

### C. Direct Add Pay-In

Accounts should be able to post a new policy-wise Pay-In entry directly from the drawer.

Initial fields should follow the current structure:
- Bill Number
- Bill Amount
- Bill Date
- TDS where currently supported/required
- optional remarks

Before save, show the projected amount, already received cumulative Bill Amount, new amount and expected remaining Difference.

Saving creates a **new transaction**, never overwrites the previous installment.

### D. Direct Add Payout

Initial fields:
- Paid Amount
- Paid Date
- UTR Details / payment reference
- optional remarks

Again, saving creates a new payment transaction and recalculates cumulative Paid Amount and remaining payout.

## 8. Excel redesign

The current full Business MIS workbook remains useful as a report, but it must stop being the primary mechanism for every new reconciliation entry.

The redesigned bulk flow should use **transaction-oriented templates**.

### Pay-In transaction template

Recommended columns:
- System Policy ID (hidden/protected where appropriate)
- Policy Number
- Registration No.
- Insured Name
- Insurance Company
- Projected Pay-In
- Already Received / Current Bill Amount
- Current Difference
- New Bill Number
- New Bill Amount
- New Bill Date
- TDS
- Remarks

Each uploaded row means: **add this new Pay-In transaction**.

The same policy can appear more than once if multiple new installments are being posted.

### Payout transaction template

Recommended columns:
- System Policy ID / System Payout ID
- Policy Number
- Insured Name
- Intermediary identifiers required by the existing payout posting RPC
- Gross/Projected Payout
- Already Paid
- Remaining
- New Paid Amount
- New Paid Date
- New UTR/reference
- Remarks

Each row means: **add this new Payout payment**.

### Downloads should be targeted

Accounts should be able to download only the working set they need, for example:
- Pay-In Pending
- Pay-In Partial
- Payout Pending
- Payout Partial
- Variance
- selected insurer
- selected date period
- search result / selected policies
- blank transaction template

This eliminates the current need to download the whole MIS merely to post one or a few new entries.

## 9. Filters and work queues

Current date and insurer filters remain, but operational reconciliation should progressively support:

- Pay-In / Payout
- Pending / Partial / Reconciled / Variance / Not applicable
- insurer
- policy number
- registration number
- customer / insured name
- Bill Number
- UTR/reference
- policy/business date
- transaction date

Useful quick work queues:
- Pay-In Pending
- Pay-In Partial
- Payout Pending
- Payout Partial
- Variance
- Recently reconciled

Do not add complex filter menus simply because fields exist. Keep the page compact and task-oriented.

## 10. Current implementation architecture and reuse strategy

The existing summary layer already aggregates multiple underlying accounting rows in important places.

### Pay-In summary today

`apps/web-portal/lib/accounts-business-mis.ts` reads policy-linked `accounts_invoice_lines` and their `accounts_invoices`.

It already:
- sums `accounts_invoice_lines.invoice_line_amount` into Business MIS `Bill Amount`;
- aggregates invoice/bill references;
- uses the latest bill date;
- derives Difference from Total Pay-In minus Bill Amount.

Therefore the summary architecture is already compatible with multiple Pay-In entries per policy. The main blocker is the current upload UX/validation, which treats an already-posted policy row as non-editable for a second installment.

### Payout summary today

The Business MIS reads `partner_payables` → `partner_payment_allocations` → `partner_payments` and already sums allocated payment amounts and aggregates payment dates/references.

That is also structurally compatible with multiple payout installments.

### Current posting RPC

`post_accounts_excel_reconciliation` is the existing controlled accounting posting path. It creates Accounts invoices/lines and related receipt/TDS records for Pay-In, and partner payable/payment allocations for Payout.

The redesign should reuse the existing controlled posting primitives where safe rather than creating a second parallel accounting ledger.

Production inspection on 2026-09-29 confirmed that the RPC intentionally does not reject duplicate Bill Numbers as its primary duplicate key, creates a new Accounts invoice + invoice line for each Pay-In group, and posts payout allocations through the existing partner payable/payment functions. The read path must therefore remain append-oriented, while UI/import duplicate protection needs to be handled deliberately before direct posting is enabled.

### Phase 1 row resolution

The browser does not receive or trust a new hidden policy ID just to open the history drawer. The current implementation sends the visible Business MIS identity fields (policy number plus registration/insured/insurer context) to a server action. The server resolves candidate policies, reapplies `view_accounts` and commercial-access rules, then verifies the candidate through the canonical Accounts scope before returning reconciliation detail.

If more than one scoped record still matches the same visible row identity, the action fails safely instead of guessing which policy to open.

### Phase 2 direct-posting path

Direct portal posting is intentionally separate from the Excel-import RPC so portal transactions do not carry misleading `Accounts Excel reconciliation` provenance.

Migration `20260929134500_accounts_policy_reconciliation_entry.sql` introduces service-role-only `post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb)`.

For direct Pay-In it:
- locks the policy row before duplicate checking/writing so two direct users cannot append the same policy transaction concurrently;
- requires insurer, Bill Number, Bill Date and positive Bill Amount;
- blocks only an exact same-policy duplicate using normalized Bill Number + Bill Date + Bill Amount;
- continues to allow the same Bill Number in legitimate different policy/date/amount contexts;
- appends a new Accounts invoice/line and receivable/event history instead of replacing prior installments;
- preserves optional remarks and optional Actual TDS through the existing TDS posting primitive.

For direct Payout it:
- requires exactly one policy payout record and fails safely instead of guessing when multiple payout records exist;
- requires entered/reviewed commercial data and intermediary code;
- blocks an already-used normalized UTR/reference for the intermediary;
- reuses the existing payable approval/payment primitives;
- preserves optional remarks and appends payment/allocation history.

The server actions re-resolve the visible Business MIS row through canonical Accounts scope immediately before posting. A browser-supplied policy ID is not treated as authority.

## 11. Known current blocker in the existing Excel workflow

`reconciliation-upload-actions.ts` compares the uploaded row against live Business MIS values.

If a policy already has Pay-In values, a different uploaded Pay-In is rejected as an edit to a posted Pay-In. The same pattern exists for posted Payout.

This is why installment 2 cannot currently be entered cleanly through the same policy row.

The V2 transaction template must not use that mutable-state comparison model. It should validate each row as a **new transaction to append**.

## 12. Important future blockers we must design for

### Duplicate posting / idempotency

Uploading the same transaction file twice must not double-post the same installment.

Duplicate protection should consider appropriate policy/reference/date/amount context plus import batch identity. A likely duplicate should be blocked or sent to review.

Direct portal posting now has same-policy duplicate protection and policy-level write serialization. Phase 3 Excel idempotency still needs import-batch-aware protection.

### Corrections

Posted history should not silently disappear. If an entry is wrong, correction must retain:
- original value
- corrected/reversed value
- reason
- user
- timestamp

A full reversal-ledger model can be phased later, but audit history is mandatory.

### Cross-period transactions

A policy issued in one month may receive Pay-In or Payout in a later month. The system must distinguish:
- policy/business date;
- transaction/payment date.

Future reporting should support both views without hiding older policies that receive money today.

### Projection changes

Endorsement/cancellation/commercial corrections can change projected Pay-In or Payout after transactions exist. Keep the transactions; recalculate status against the latest approved projection.

### Overpayment / over-payout

The status model supports Variance when cumulative actual exceeds projection, but the existing controlled partner-payable ledger currently prevents a payout payment above the remaining payable outstanding amount. Phase 2 deliberately preserves that accounting invariant rather than bypassing it. If INSUREIT later needs intentional over-payout posting, change the accounting model explicitly and auditably; do not weaken the existing payable guard incidentally.

### TDS

Keep TDS aligned with the current Accounts calculation. Do not redesign its accounting meaning incidentally as part of installment support.

### Concurrent users

Two Accounts users can post at nearly the same time. Phase 2 direct writes serialize on the policy row before duplicate checking/writing. Excel/import concurrency remains a separate Phase 3 hardening concern.

### Performance

Dashboard queries should return policy summaries. Transaction history should be lazy-loaded when a policy is opened.

### Auditability

Every new transaction should ultimately expose:
- policy ID
- transaction type
- amount
- date
- reference
- TDS where relevant
- source (`Portal`, `Excel`, `System`)
- import batch where relevant
- created by
- created at
- correction/reversal relationship when applicable

## 13. Explicitly out of current scope

Unless the user later changes direction, do not make these prerequisites for Accounts V2:

- pooled insurer bank receipts split across many policies;
- partially allocated bank receipts;
- unallocated bank cash;
- bank-statement matching;
- redesigning the Business MIS column structure;
- replacing the existing Bill Amount meaning with a new billed-vs-received accounting definition.

## 14. Delivery phases

### Phase 0 — document and verify semantics

- Maintain this living handoff.
- Verify current summary and posting primitives.
- Preserve Bill Amount = received Pay-In meaning.
- Identify exactly where the one-slot limitation exists.

### Phase 1 — multi-entry foundation + read-only policy history

- resolve the selected Business MIS policy safely on the server without changing visible columns;
- add a permission-scoped policy reconciliation detail loader;
- load Pay-In history from existing invoice/line records;
- load Payout history from existing payable/payment allocation records;
- calculate cumulative totals and remaining amounts using current semantics;
- add a read-only reconciliation drawer from Business MIS.

### Phase 2 — direct portal posting

- add `+ Add Pay-In` using existing controlled Accounts posting primitives;
- add `+ Add Payout` using existing controlled payout posting primitives;
- preview remaining balance before save;
- refresh summary + history immediately after save;
- prevent duplicate/reference mistakes.

### Phase 3 — transaction-oriented Excel

- add Pay-In transaction template;
- add Payout transaction template;
- allow repeated policies across transaction rows;
- add pending/partial/selected-policy downloads;
- keep full Business MIS export as reporting output.

### Phase 4 — work queues and search

- status filters;
- policy/registration/customer/reference search;
- transaction-date filtering;
- compact Pending/Partial/Variance queues.

### Phase 5 — audit hardening

- correction/reversal UX;
- import batch history;
- duplicate/idempotency hardening;
- concurrency tests;
- projection-change regression coverage;
- period-close controls only if/when required.

## 15. Safety boundaries

- Do not change the visible Business MIS structure unless explicitly approved.
- Do not reinterpret Bill Amount semantics without explicit approval.
- Do not introduce bank-allocation complexity into the core workflow.
- Do not overwrite prior installments.
- Do not silently change production accounting records while building UI.
- Schema changes, if eventually required, must be migration-controlled and verified separately.
- Keep existing permissions/commercial-access boundaries.
- No mobile/APK/AAB/native-runtime work is part of this Accounts redesign.

## 16. Implementation ledger

Update this section with every Accounts V2 change.

### 2026-09-29 — working principles frozen

- User confirmed Bill Amount remains the received Pay-In amount in the current Accounts calculation.
- User confirmed reconciliation remains policy-wise.
- Pooled multi-policy insurer receipt allocation and partially allocated bank receipts were removed from current scope.
- Existing Business MIS structure remains unchanged.
- Target model is one policy summary row with unlimited underlying Pay-In/Payout entries.
- Existing summary aggregation and posting primitives are to be reused where safe.
- Phase 1 begins with permission-scoped read-only policy reconciliation history before direct write workflows are enabled.

### 2026-09-29 — Phase 1 history loader started

- Added `apps/web-portal/app/accounts/accounts-reconciliation-detail-actions.ts`.
- The loader requires `view_accounts`, preserves commercial-access checks and reuses the canonical policy scope before loading any detail.
- Pay-In history is loaded from policy-linked `accounts_invoice_lines` + `accounts_invoices`; cancelled invoices are excluded.
- Payout history is loaded from `partner_payables` + `partner_payment_allocations` + `partner_payments`.
- The loader returns projected values, cumulative actual values and remaining differences using the same Business MIS semantics.
- Production RPC inspection confirmed the existing controlled posting path can append new invoice/line and payment/allocation records.

### 2026-09-29 — Phase 1 read-only reconciliation drawer wired

- Added `apps/web-portal/app/accounts/accounts-policy-reconciliation-drawer.tsx`.
- The existing Policy Number cell is the compact entry point to history; no Business MIS column was added, removed or reordered.
- The drawer lazy-loads Pay-In and Payout history only after a policy is opened.
- It shows policy context, projected amounts, cumulative received/paid amounts, remaining balances, derived status, TDS context and chronological transaction history.
- The Accounts overview wording says `Received Pay-In` rather than `Posted Pay-In`, matching the user-confirmed Bill Amount semantics.
- The selected row is resolved server-side from visible row identity and then revalidated against Accounts scope; ambiguous matches fail safely instead of exposing or trusting a client-supplied policy ID.
- Phase 1 verification passed on the earlier PR #2541 head in Verify web portal run #4926; that PR remained unmerged and is superseded by the current Phase 2 branch.

### 2026-09-29 — Phase 2 direct policy-wise posting implemented

- PR #2559 carries Phase 1 onto current `main` and adds direct `+ Add Pay-In` / `+ Add Payout` inside the existing reconciliation drawer.
- Pay-In fields are Bill Number, Bill Date, Bill Amount, Actual TDS and optional Remarks; Payout fields are Paid Amount, Paid Date, UTR/reference and optional Remarks.
- Both forms preview the projected amount, current cumulative actual, cumulative amount after the new entry and remaining/status before save.
- Successful posts reload the drawer history and refresh the dashboard reconciliation summary without changing visible Business MIS columns or the existing full MIS/template structure.
- `accounts-reconciliation-post-actions.ts` re-resolves the visible policy through scoped Accounts access immediately before posting.
- Migration `20260929134500_accounts_policy_reconciliation_entry.sql` adds a service-role-only atomic portal-posting RPC with policy-row serialization, exact same-policy Pay-In duplicate protection, UTR/reference protection and correct portal provenance.
- Payout posting reuses the existing payable/payment primitives and currently preserves their no-overpayment rule; intentional over-payout variance remains a future accounting-model decision.
- `.github/workflows/apply-accounts-policy-reconciliation-entry.yml` applies/verifies the migration only after merge to `main`; `deploy-production.yml` now waits for that schema workflow before allowing Vercel deployment for this migration.
- **IMPLEMENTED on PR #2559; production migration NOT APPLIED; merge/deployment NOT performed. Latest exact-head Verify web portal result must be recorded before merge.**

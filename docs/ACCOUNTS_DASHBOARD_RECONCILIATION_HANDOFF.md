# Accounts Dashboard & Reconciliation — Living Working Principles

> **Mandatory living context for future AI agents and developers working on `/accounts`.**
>
> Read this file before changing the Accounts Dashboard, Business MIS reconciliation, Pay-In posting, Payout posting, Accounts Excel import/export, reconciliation status logic, or Accounts work queues. Update this file in the same PR whenever the working principle, data model, UX, calculation, rollout status, or release state changes.

Last updated: 2026-09-29
Status: Phases 0–4 production-deployed; Phase 5 implementation in progress

## 1. Product goal

The Accounts Dashboard is being redesigned into the single practical workspace for **policy-wise Pay-In and Payout reconciliation** while preserving the Business MIS structure already used by the Accounts team.

The working unit is the **individual policy**. The redesign is not a general bank-reconciliation engine.

Target operating model:

- one Business MIS summary row per policy;
- unlimited Pay-In installments beneath that policy;
- unlimited Payout installments beneath that policy;
- cumulative policy-level values shown in the existing Business MIS columns;
- direct portal entry for day-to-day posting;
- transaction-oriented Excel for bulk posting;
- targeted Pending/Partial/Variance work queues;
- lazy-loaded transaction history and auditability;
- reconciliation status derived from current projection versus cumulative posted entries;
- no need to download and edit the whole MIS just to post installment 2, 3, or later.

## 2. User-confirmed accounting semantics — do not reinterpret without approval

### Bill Amount

For the current INSUREIT Accounts workflow:

**Bill Amount = received Pay-In amount for the policy.**

Preserve this meaning. Do not split the current Business MIS into separate Billed and Received concepts unless explicitly approved later.

Current Pay-In summary semantics:

- `Total Pay-in` = projected Pay-In;
- `Bill Number` = Pay-In reference/bill number;
- `Bill Amount` = received Pay-In amount used in the Accounts calculation;
- `Bill Date` = transaction/bill date;
- `Difference` = projected Pay-In minus cumulative Bill Amount;
- `TDS` = current approved TDS value/calculation.

### Policy-wise reconciliation

Pay-In and Payout are entered and reconciled **individually for each policy**.

The following are explicitly not priorities for this redesign:

- one insurer receipt allocated across many policies;
- partially allocated pooled bank receipts;
- unallocated-cash queues;
- bank-statement matching;
- a general pooled cash-allocation engine.

## 3. Business MIS is a stable summary contract

The main Business MIS remains **one row per policy** and retains its existing visible column structure/order unless separately approved.

Reconciliation columns remain:

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

The redesign happens underneath and around this table. Do not turn Business MIS into a transaction table.

## 4. Fundamental data principle: summary row + one-to-many history

A policy may have many Pay-In entries and many Payout entries.

Canonical Pay-In example:

Projected Pay-In = **₹1,000**

1. ₹400 received → remaining ₹600
2. ₹450 received → remaining ₹150
3. ₹150 received → remaining ₹0

The earlier ₹400 and ₹450 must never be overwritten. The Business MIS row eventually shows cumulative Bill Amount ₹1,000 and Difference ₹0 while history preserves all three entries.

The same rule applies to Payout. If Gross Payout is ₹1,000 and payments are ₹300 + ₹450 + ₹250, Business MIS shows cumulative Paid Amount ₹1,000 while history retains all three payments.

## 5. Current summary aggregation

The existing read model is already compatible with multiple transactions.

### Pay-In

`apps/web-portal/lib/accounts-business-mis.ts` aggregates policy-linked `accounts_invoice_lines` and `accounts_invoices`.

It already:

- sums invoice-line amounts into Business MIS Bill Amount;
- aggregates bill references;
- uses the latest bill date;
- calculates Difference from projected Pay-In minus cumulative Bill Amount.

### Payout

Business MIS aggregates `partner_payables` → `partner_payment_allocations` → `partner_payments`.

It already sums allocated payment amounts and aggregates dates/references.

Therefore prior installments should remain append-only in the underlying ledger and Business MIS should remain the cumulative summary.

## 6. Reconciliation status rules

Pay-In and Payout are evaluated independently and then combined at policy level.

For each applicable side:

- projection > 0 and actual = 0 → `Pending`
- projection > 0 and 0 < actual < projection → `Partial`
- projection > 0 and actual equals projection within ₹0.01 → `Reconciled`
- actual > projection + ₹0.01 → `Variance`
- projection <= ₹0.01 and actual <= ₹0.01 → `Not applicable`
- projection <= ₹0.01 and actual > ₹0.01 → `Variance`

Policy-level rules:

- any side Variance → `Variance`;
- no applicable side → `Not applicable`;
- all applicable sides Reconciled → `Reconciled`;
- all applicable sides Pending → `Pending`;
- otherwise → `Partial`.

Zero-projection/zero-actual rows must never inflate reconciled counts.

Status is **derived**, not permanently stored, so commercial/projection changes automatically reclassify a policy without deleting transaction history.

## 7. Direct policy reconciliation drawer

The existing policy reconciliation drawer is the canonical detail/action surface.

It resolves a selected visible Business MIS row server-side using policy number plus registration/customer/insurer context, reapplies `view_accounts` and commercial-access checks, then verifies the candidate through canonical Accounts scope. The browser-supplied visible identity is not treated as an authoritative policy ID.

If more than one scoped policy remains ambiguous, the action fails safely rather than guessing.

Drawer contents:

### Policy context
- policy number
- insured/customer
- insurer
- registration number

### Pay-In
- projected Pay-In
- cumulative Bill Amount / received Pay-In
- remaining Difference
- status
- chronological transaction history
- `+ Add Pay-In`

### Payout
- projected/Gross Payout
- cumulative Paid Amount
- remaining
- status
- chronological payment history
- `+ Add Payout`

History is lazy-loaded only when the drawer opens.

## 8. Direct posting rules

Migration `20260929134500_accounts_policy_reconciliation_entry.sql` provides service-role-only `post_accounts_policy_reconciliation_entry(...)`.

### Direct Pay-In

Fields:
- Bill Number
- Bill Date
- Bill Amount
- Actual TDS
- optional Remarks

Rules:

- append a new invoice/line entry; never overwrite an earlier installment;
- serialize direct writes on the policy row;
- require positive Bill Amount and valid required references/date;
- block an exact same-policy duplicate using normalized Bill Number + Bill Date + Bill Amount;
- allow the same Bill Number in legitimate different policy/date/amount contexts;
- preserve remarks and TDS through existing posting primitives.

### Direct Payout

Fields:
- Paid Amount
- Paid Date
- UTR/reference
- optional Remarks

Rules:

- append payment/allocation history;
- require exactly one eligible policy payout record;
- block already-used normalized UTR/reference for the intermediary;
- preserve the existing payable-ledger rule that Paid Amount cannot exceed current outstanding payable;
- do not weaken payable controls simply to create a Variance state.

The direct RPC is executable by `service_role` only; `anon` and `authenticated` direct EXECUTE are revoked.

## 9. Transaction-oriented Excel

The full Business MIS export/upload remains available for its existing reporting/reconciliation compatibility, but bulk installment posting now has a separate transaction workflow.

Phase 3 introduced targeted Pay-In/Payout transaction templates and atomic batch posting.

### Pay-In transaction workflow

A row represents **one new Pay-In transaction**, not a replacement state.

Context includes policy identity, projected/current values, and new Bill Number/Amount/Date/TDS/Remarks.

### Payout transaction workflow

A row represents **one new Payout transaction**, not a replacement state.

Context includes policy/payout identity, projected/current values, and new Paid Amount/Date/UTR/Remarks.

### Batch safety

Migration `20260929153000_accounts_reconciliation_transaction_batch.sql` provides service-role-only `post_accounts_policy_reconciliation_batch(...)`.

The batch path:

- revalidates hidden IDs against current scoped Accounts data;
- treats workbook context values as informational, not authoritative;
- reuses Phase 2 posting protections;
- is atomic: a failed row prevents partial posting of the batch;
- supports repeated policies as separate new transactions;
- caps a batch at 500 transaction rows;
- warns on Pay-In above projected remaining as a variance condition;
- blocks Payout above remaining because the payable ledger does not allow it.

The batch RPC is executable by `service_role` only; `anon` and `authenticated` direct EXECUTE are revoked.

## 10. Reconciliation work queue

Phase 4 added a compact operational work queue above the existing dashboard.

Queues:

- All
- Pending
- Partial
- Variance
- Reconciled
- N/A

Search covers:

- Policy Number
- Registration Number
- Customer/insured name
- Bill Number
- Bill Date
- UTR/reference
- Paid Date

The queue follows the same status rules as the reconciliation overview and stays synchronized with the dashboard's current date/insurer scope.

## 11. Phase 5 — actionable work queue

Phase 5 makes the work queue an action surface rather than a read-only list.

Planned/current behavior:

- Policy Number in the work queue opens the same canonical policy reconciliation drawer already used from Business MIS.
- Accounts can move directly from `Pending`, `Partial`, or `Variance` → policy → history → Add Pay-In/Add Payout without locating the row again in Business MIS.
- No additional accounting write path is introduced. The queue reuses the existing scoped drawer and Phase 2 posting actions.
- After a successful post initiated from the queue, the page refreshes to guarantee the KPI, reconciliation overview, queue counts, and Business MIS all show the same newly committed state.
- No Business MIS column/order/template change.
- No database migration is required for this Phase 5 queue action.

Future refinement may replace the full-page refresh with a shared client refresh coordinator, but correctness takes priority over avoiding a reload.

## 12. Known future hardening needs

### Corrections / reversals

Posted history must not silently disappear. Future correction UX must preserve:

- original transaction;
- corrected/reversal record;
- reason;
- actor;
- timestamp;
- relationship between original and corrective entry.

### Import-batch history and idempotency

The transaction batch already reuses duplicate protections, but a durable import-batch history/receipt should eventually show who uploaded which workbook, when, how many rows succeeded, and a stable batch identity for operational audit.

### Cross-period transactions

A policy issued in one month can receive Pay-In/Payout later. Reporting must continue distinguishing policy/business date from transaction/payment date.

### Projection changes

Endorsement/cancellation/commercial correction may change projected Pay-In/Payout after transactions exist. Preserve transactions and recalculate status against the latest approved projection.

### Concurrent users

Direct writes serialize on policy rows. Batch posting is atomic. Keep adding regression coverage for simultaneous portal/batch operations rather than weakening these controls.

### Performance

Dashboard should load policy summaries. Detailed transaction history remains lazy-loaded.

### Auditability

Every transaction should ultimately expose:

- policy ID
- type
- amount
- date
- reference
- TDS where relevant
- source (`Portal`, `Excel`, `System`)
- import batch where relevant
- created by
- created at
- correction/reversal relationship where applicable.

## 13. Explicitly out of current scope

Do not make these prerequisites unless direction changes:

- pooled insurer receipts split across policies;
- partially allocated bank receipts;
- unallocated bank cash;
- bank-statement matching;
- redesigning Business MIS columns;
- replacing Bill Amount's received-Pay-In meaning;
- APK/AAB/mobile/native work.

## 14. Delivery status

### Phase 0 — semantics and architecture
**COMPLETE**

- Bill Amount meaning frozen as received Pay-In.
- Policy-wise reconciliation confirmed.
- Business MIS stability boundary confirmed.
- Existing append-capable accounting primitives inspected.

### Phase 1 — multi-entry history + drawer
**COMPLETE / MERGED / DEPLOYED**

- scoped row resolution;
- lazy Pay-In/Payout history;
- cumulative totals/remaining;
- read-only drawer.

### Phase 2 — direct portal posting
**COMPLETE / MERGED / DATABASE APPLIED / DEPLOYED**

- PR #2559 merged as `7f9eb7b3efd6a806175dc71a77679e830901de12`;
- direct Add Pay-In/Add Payout;
- append-only history;
- duplicate/reference controls;
- policy-level write serialization;
- migration `20260929134500_accounts_policy_reconciliation_entry` present in production migration history;
- direct RPC production privileges verified on 2026-09-29: `service_role=true`, `anon=false`, `authenticated=false`.

### Phase 2 security hardening
**COMPLETE / MERGED / DATABASE APPLIED / DEPLOYED**

- PR #2562 hardened direct RPC privileges;
- production privileges re-verified after rollout.

### Phase 3 — transaction-oriented Excel
**COMPLETE / MERGED / DATABASE APPLIED / DEPLOYED**

- PR #2565 merged as `ddc5f565c397aa2d001518143ff77889a19f7ba8`;
- targeted Pay-In/Payout templates;
- preview/validation;
- atomic append-only batch import;
- migration `20260929153000_accounts_reconciliation_transaction_batch` present in production migration history;
- production batch RPC privileges verified on 2026-09-29: `service_role=true`, `anon=false`, `authenticated=false`.

### Phase 4 — operational queue/search
**COMPLETE / MERGED / DEPLOYED**

- PR #2572 merged as `09e3a71ef68325f243c335e92d88796bba2d6fd6`;
- All/Pending/Partial/Variance/Reconciled/N/A queues;
- policy/RC/customer/reference/date search;
- filter synchronization;
- no schema change.

### Production deployment verification
**CONFIRMED 2026-09-29**

- production schema-parity false-positive was fixed by PR #2576;
- latest verified Vercel production deployment is READY on main commit `a9650a07d5ece2bf5541397412faeaa05eaf7b31`;
- GitHub comparison confirms Phase 4 merge commit `09e3a71...` is an ancestor of that production commit, therefore Phases 1–4 application code are included in the deployed release;
- Supabase production migration history contains both Accounts V2 migrations (`20260929134500`, `20260929153000`);
- production RPC privilege checks confirm both direct and batch posting RPCs are service-role-only.

### Phase 5 — actionable work queue
**IN PROGRESS**

- branch: `feature/accounts-phase5-actionable-work-queue`;
- work-queue Policy Number opens the canonical reconciliation drawer;
- reuses existing direct posting controls; no new schema/write primitive;
- full page refresh after queue-initiated posting keeps every Accounts surface consistent;
- canonical Verify web portal must pass before merge.

## 15. Safety boundaries

- Do not change the visible Business MIS structure without explicit approval.
- Do not reinterpret Bill Amount semantics without explicit approval.
- Do not introduce bank-allocation complexity into the core workflow.
- Never overwrite prior installments.
- Do not silently mutate production accounting data while building UI.
- Schema changes must remain migration-controlled and separately verified.
- Preserve existing permissions/commercial-access boundaries.
- Use service-role-only server paths for privileged accounting RPCs.
- No APK/AAB/mobile/native-runtime work belongs to this Accounts redesign.

## 16. Continuity rule

Every future Accounts PR must update this file with:

1. what behavior changed;
2. whether Business MIS structure changed (normally `no`);
3. whether schema/migration changed;
4. exact migration/RPC security impact if any;
5. PR and canonical CI status;
6. merge state;
7. database application state;
8. production deployment evidence when actually verified;
9. the next unfinished Accounts phase or blocker.

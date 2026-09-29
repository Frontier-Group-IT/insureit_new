# Accounts Reconciliation Phase 6 — Stale Workbook / Replay Guard

Date: 2026-09-29

## Purpose

This phase hardens the existing Phase 3 transaction-oriented Excel workflow against stale workbooks, replay of a workbook that has already been imported, and projection changes that happen after a template is downloaded.

It does not change the Business MIS visible columns/order/template and does not introduce pooled receipts, bank allocation, or a new accounting write primitive.

## Existing safety retained

The existing transaction import remains append-only and atomic through `post_accounts_policy_reconciliation_batch(...)`, which reuses the Phase 2 policy-wise posting RPC. Existing duplicate-reference, payout-balance and policy-level locking rules remain the final database-side safety boundary.

## New optimistic-concurrency rule

A downloaded transaction template already contains a snapshot of the current policy reconciliation state.

For Pay-In the protected snapshot fields are:

- Projected Pay-In
- Already Received
- Current Difference

For Payout the protected snapshot fields are:

- Projected Payout
- Already Paid
- Remaining

At preview and again immediately before import, the server compares those downloaded values with the current canonical Accounts Business MIS values using the existing ₹0.01 tolerance.

If any protected value changed, the row becomes an Error and the workbook cannot be posted. Accounts must download a fresh transaction template.

## Why this matters

This prevents three important future failure modes without changing the accounting schema:

1. **Workbook replay:** after a successful import, cumulative received/paid values change. Uploading the same workbook again is rejected as stale before the batch RPC can append anything.
2. **Concurrent Accounts work:** if another user posts a Pay-In/Payout after a template was downloaded, the old workbook cannot silently post against outdated balances.
3. **Projection change:** if endorsement/cancellation/commercial correction changes projected Pay-In/Payout after download, the old workbook cannot post against the earlier projection.

## Repeated policies in one workbook

Repeated policy rows remain supported. They share the same downloaded starting snapshot and are posted atomically as separate append-only transactions. If the whole batch succeeds, a later replay sees the changed live cumulative value and is rejected.

## Variance rows

The transaction template stores `Current Difference` / `Remaining` as a non-negative working balance using `max(projection - actual, 0)`. The stale-state comparison follows that exact template convention so an existing over-received/variance row does not become falsely stale merely because its raw mathematical difference is negative.

## Safety boundary

- no database migration;
- no RLS/permission change;
- no new privileged RPC;
- no Business MIS restructure;
- no Bill Amount semantic change (`Bill Amount = received Pay-In` remains authoritative);
- no APK/AAB/mobile/native work.

## Next hardening step

After this state-snapshot guard is verified and deployed, the remaining audit-hardening backlog is:

- durable import-batch receipt/history;
- correction/reversal UX that preserves original transactions;
- richer created-by/source audit display;
- explicit regression coverage for simultaneous direct and bulk posting;
- period-close controls only if later required.

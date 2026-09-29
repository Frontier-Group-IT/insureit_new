# Accounts Reconciliation Phase 4 — Work Queues and Search

Date: 2026-09-29

## Scope

Phase 4 adds a compact operational reconciliation work queue to the existing Accounts Dashboard. It does not change the Business MIS report, its column order, its download template, its upload template, database schema, RLS, or any mobile/native runtime.

## Work queues

The queue classifies the currently scoped Business MIS policy rows into mutually exclusive operational states:

- **Pending** — every applicable Pay-In/Payout side has a positive projection and no actual posting yet.
- **Partial** — an applicable side has a partial posting, or the policy has a mix of reconciled and pending applicable sides.
- **Variance** — an actual amount exceeds its projection, including an actual posting where the projection is zero/not applicable.
- **Reconciled** — every applicable side is reconciled within the existing ₹0.01 tolerance.
- **N/A** — neither side has an applicable projection and neither side has an unexpected actual posting.

The rules intentionally mirror the Accounts reconciliation overview semantics introduced earlier. The Pay-In comparison remains Business MIS Total Pay-in vs Bill Amount, and the Payout comparison remains Gross Payout vs Paid Amount.

## Search

The work queue provides one compact search field covering:

- Policy Number
- Registration Number
- Customer / insured name
- Bill Number
- Bill Date
- UTR / payment reference
- Paid Date

Search is normalization-based so punctuation, whitespace and case do not prevent matches.

## Live filter synchronization

The existing Accounts dashboard updates filters and refreshed reconciliation data client-side and writes the active state to the URL with `history.replaceState`. The Phase 4 queue listens for those URL-state updates, reloads the canonical scoped Accounts snapshot through the existing server action, and replaces only its local working-set rows.

This keeps the queue aligned after:

- Last month / MTD changes
- Custom date-range changes
- Insurer filter changes
- Successful full-MIS reconciliation import
- Successful direct policy reconciliation posting

If a queue refresh fails, the last known queue snapshot is preserved; the existing dashboard remains the source of the visible refresh error.

## Safety boundary

- No new accounting write path is introduced.
- No prior installment can be changed by the queue.
- No new migration is required.
- The Business MIS structure remains unchanged.
- Phase 3 transaction-template and direct policy posting controls remain authoritative for writes.
- No APK/AAB/mobile/native work is part of this phase.

## Continuation

A later phase can add action-oriented drill-down (for example opening the existing policy reconciliation history/posting drawer directly from a work-queue row) after the compact queue UX is validated in production.

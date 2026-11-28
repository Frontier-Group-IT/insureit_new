# INSUREIT — Uncertain Policy Booking Evidence Report

## Purpose
Already-issued insurer policies are imported for **record keeping**. An automatic-booking response of `conversion_outcome_unknown` is **not** evidence that the database transaction failed. Repeated retries can create duplicate policy/customer/vehicle records. This report is read-only and supports an operator's reconciliation decision; it never claims or books an intake.

Run `infra/sql/audit_uncertain_policy_booking_readonly.sql` using a trusted read-capable database session. It scans all original uncertain attempts, their current PDF and queue, source policy/chassis identities, draft revision, policy register, vehicle register, document provenance, audit history, and existing Go Digit / United India recovery ledgers. Output includes a specific **hold** disposition, not a retry authorization.

## Observed on 28 November 2026

| Intake | Original attempt | Later attempt | Current evidence | Disposition |
|---|---|---|---|---|
| `PIR-261127-7A8864` | uncertain | Go Digit recovery **uncertain again** | Verified 18/18, revision 2 draft, no matching policy number or source document | `second_uncertain_no_more_booking` |
| `PIR-261127-C33977` | uncertain | United India recovery `canonical_booking_review` | Verified 18/18, revision 2 draft, no matching policy number | `canonical_review_no_automatic_retry` |
| `PIR-261125-E99B5C` | uncertain | None | Verified queue 18/18; legacy OCR pending and zero saved fields, **no draft** | `source_draft_missing_reconcile_without_booking` |
| `PIR-261127-1C79A4` (not among screenshot's 13) | uncertain | N/A | **Already-linked finalized policy and policy document**, even though original ledger is uncertain | `already_linked_never_retry` |

## Required next operations

1. `7A8864`: no third automatic booking attempt. Investigate the transaction/audit logs around **both** original and recovery execution timestamps. Preserve PDF and original/recovery ledger entries. An absence of policy row on today's query is **not** proof of non-commit.
2. `C33977`: inspect the existing canonical review failure from the **second** attempt; do not create another attempt. A failed source-to-customer, vehicle, or canonical relationship must be explained before any new booking is considered.
3. `E99B5C`: reconstruct a draft from the **same current original PDF** in extraction/draft-only mode with no booking. Verify policy number, chassis, customer identity and payable. Keep original uncertain booking attempt immutable; a draft-only parse does not authorize booking.
4. Keep all duplicate, ownership and idempotency guards; do not change original state based on an operator-clicked Retry button. The nine excluded Tata AIG recoveries remain excluded.

## Reuse
The report is insurer-neutral and detects later recovery attempts. It is useful for any future `conversion_outcome_unknown` record to distinguish already-booked evidence, second uncertain attempts, canonical review, and missing sources. Its companion CI test rejects SQL write operations and unsafe classification ordering.

**No database schema migration, RLS or n8n changes are required for the report.** The script executes read-only. This release does not automatically clear exception labels or book any of the three records.

## Future Go Digit JCB draft identity correction
The verified `go_digit_jcb_new_unregistered_native_pdf` source can print a valid insured name yet formerly leave the editable onboarding draft's `insuredName` empty. This layout is now admitted to the existing exact `page:null` + `Native PDF policy schedule` insured-name evidence contract. It fills an **editable draft only** and returns `needsManualReview=true` when no customer master is linked. Conflicting masters stay blocked; no new customer is auto-created, no prior uncertain attempt is requeued, and no booking or policy record is inserted.

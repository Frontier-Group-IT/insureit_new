# Quote & Book workflow: staged integration plan (2026-10-25)

## Current phase — operations demonstration
Development route: /development/quote-book. IT Super User and Super Admin only.
Four clearly fictional insurer examples, with response statuses, filters, compare table/cards, coverage and premium-detail panel, sample quote selection and in-memory proposal preview. No insurer requests, customer approval, records, payment, or policy issued.

## Stage 1 — Quote request / persisted draft
- Establish quote_request and quote_request_vehicle_snapshot/customer_snapshot models with versioned snapshots; approval before schema changes.
- Reuse authorized account, vehicle, policy and insurer masters, never trust browser-supplied customer IDs.
- Capture mandatory input, chosen coverage, addons, user, branch, timestamps, source, status and idempotency key.
- Draft statuses: draft, ready_to_quote, pending_insurers, partially_quoted, quoted, expired, withdrawn.
- Multiple matching customers for one chassis: explicit choice and scope authorization; no implicit first-match binding.

## Stage 2 — Insurer adapter + manual quotes
- Define adapter contract: insurer quote ID, request ID, premium components, taxes as supplied, IDV, deductible, plan wording, applicable addons, validity, inspection/underwriting status, quote PDF and error/retry codes.
- Explicit source API / manual / uploaded; never represent sample premiums as actual insurer prices.
- Protect credentials on server, suppress payload PII from logs, secure storage.
- Responses: received, pending, referral, failed, expired. Retry and idempotency; manual quote requires audit trail and review.
- Quote arithmetic and applicable tax derived from real insurer response and validated, not hardcoded demo assumptions.

## Stage 3 — Compare / select
- Compare only eligible live offers; quote status and age visible.
- Horizontal table/card modes, carrier logos from insurer master, filtering, sorting, quote response timestamps, validity.
- Capture selected quote and reason; track maker/checker approval for manual adjustments and exception underwriting.
- Immutable offer snapshot and selected quote audit event.

## Stage 4 — Proposal
- Carry selected quote, vehicle/customer versions, addons, IDV and underwriting declarations forward without retyping.
- Validate identity/consent, required KYC, nominee, financier, claim history and insurer-specific questionnaire.
- Upload documents with authorized signed storage; proposal draft, submit, referral, accepted/rejected statuses.
- Freeze relevant data on proposal submission and require explicit requote if changed.

## Stage 5 — Payment and issuance
- Only accepted/valid proposals can create payment intent using approved gateway integration.
- Record payment initiation, success/failure/reconciliation and webhook idempotency; never infer success from client redirect.
- Insurer bind/issue integration, policy number, cover note, policy PDF and dates; verify authoritative insurer response.
- Handoff to existing policy register/accounting, audit and customer notifications; no duplicate policy from retries.

## Stage 6 — Post-issuance operations
- Pending issuance queue, exception handling, refunds/cancellations, endorsement requests, failed issuance after payment.
- Follow-ups and operator SLAs; role/branch-level data authorization.
- Reporting: turnaround, quote conversion, insurer errors, premiums and finance subject to existing commercial permissions.

## Release safeguards
- Keep Demo and Live as separate modes and response types.
- Never create real payments/policies while in demo mode.
- Add unit/regression tests for permission isolation, mixed insurer response statuses, tax reconciliation, expiration, failed retries, manual quote approval and proposal data integrity.
- Review production database migrations, RLS and authorization before applying.
- Deploy behind role capability/feature flag, run staged read-only smoke test, then controlled write tests with approval.
- No mobile native builds without explicit request.

# Quote & Book — demo payment, booking, communication and register specification (2026-10-25)

## Mandatory isolation
DEMO ONLY. No Razorpay, WhatsApp Cloud API, payment provider, insurer service, booking endpoint, actual collection request, policy register write or customer message. All references carry `DEMO-`. State is limited to browser sessionStorage and may be lost. No real client payments or policies exist.

## Research sources and engineering implications
- Razorpay Payment Links can have reference, expiry, reminders and payment states, including partial, paid, cancelled and expired. See https://razorpay.com/docs/payments/payment-links/reminders/ and https://github.com/razorpay/markdown-docs/blob/master/payments/payment-links/apis.md
- Payment-link webhook states include paid, partially paid, expired and cancelled: https://tfs.np.razorpay.in/docs/webhooks/payment-links
- WhatsApp Business templates are subject to approval and customer opt-in / permitted message windows: https://docs.360dialog.com/docs/resources/templates and https://docs.360dialog.com/partner/messaging-and-calling/utility-messages-on-whatsapp/managing-opt-ins-opt-outs-and-preferences

## Demo behavior included
- A non-payable DEMO reference instead of a real URL. WhatsApp message preview with explicit 'Do not transfer money'; clipboard copy only, no actual sending.
- Simulate link prepared/shared, pending/partial/paid/failed/expired/cancelled.
- Pending/paid/booked dashboard cards and searchable/filterable case register.
- Booking workbench transitions for pending insurer/referral/failed/booked after a simulated fully paid state.
- History entries for each simulated operation; fixture reset.

## Production-ready future data contract (NOT implemented)
payment_request: id, quote_selection_id, customer_id, amount_minor, currency, provider, provider_link_id, payment_url, expires_at, status, amount_paid_minor, idempotency_key, created_by, approval_context, created_at, updated_at.
payment_attempt: id, payment_request_id, provider_payment_id, provider_event_id, amount_minor, status, received_at, reconciled_at.
outbound_message: id, template_id, recipient, consent_reference, provider_message_id, delivery_status, attempted_at, delivered_at, last_error.
policy_booking: id, selected_quote_snapshot, insurer_reference, proposal_reference, payment_request_id, booking_status, underwriting_referral, policy_number, issued_at, document_storage_ref, verified_by.
quote_case_event: actor, case_id, event_type, before/after, correlation_id, timestamp. Protect all PII with branch/capability/RLS.

## Workflow / business safeguards
1. Selected insurer quote must be valid and insurer-confirmed; offer expiration requires requote.
2. Customer consent and destination confirmation before real WhatsApp notification; approved utility templates for outbound communication as required.
3. Actual payment link creation must be server-only with provider credentials, customer-specific idempotency and expiry; never use arbitrary user-entered URL.
4. Payment status must be taken from authenticated provider webhook + server reconciliation; never allow a human 'Mark paid' action to issue a real policy.
5. Partial payment cannot trigger insurer booking unless required full balance has been paid and reconciled.
6. Booking state should distinguish waiting insurer, referral, booking failure, issued, cancellation and refund exception. Avoid automatic policy creation on web redirect.
7. Separate pending-payment, paid-pending-booking, issued, failed, expired and cancelled register views with role-scope.
8. Before activation, add regression coverage for duplicate webhooks, retries, payment disputes, stale quotes, tampered links, multi-customer mapping and access controls.
9. No database migrations or production services should be activated without separate approval.

## Next demo milestones
- Introduce optional demo communication history and consent simulator.
- Add mock pay-by-link landing page with tamper-proof local fixtures (not externally accessible).
- Add policy PDF-watermarked demo document, booking exception resolution and simulated reconciliation queue.
- Add explicit QA script and browser flow for proposal → payment pending → simulated paid → booking → issued → reports.

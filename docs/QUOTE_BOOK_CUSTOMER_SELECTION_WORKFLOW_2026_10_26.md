# Quote & Book: customer quotation selection and booking preview
Date: 2026-10-26

## Workflow
1. Compare fictional insurer quotes in the existing four-carrier comparison UI. Each card adds/removes itself from a selection (1–4).
2. Prepare quotations: select View per insurer, download individual insurer PDF, or download combined PDF covering all selected offers. The generated documents contain premiums, add-ons, inspection, IDV and customer/vehicle snapshot and display strong fictional/illustrative notices.
3. Customer communication: copy message content, download PDFs for review, manually mark communication as shared. **No WhatsApp, email or other customer message is actually transmitted.**
4. Customer decision: record awaiting / revision requested / declined / accepted, choose the actual insurer agreed by customer from the selected quotes, capture notes. Booking is only accessible after an insurer has been accepted.
5. Booking: review chosen insurer and relevant customer/vehicle details, create a fictional booking request, proceed to preview payment.
6. Payment: create an internal fictional reference; preview provider fixture confirms status on refresh and generates non-real policy reference; no payments are collected.
7. Issuance / policy register: view the case and download a clearly invalid preview record. This is not a real issued insurance policy.

## Integration boundaries
- This is a frontend-only, role-gated development feature. No database migrations or writes, insurer API, payment gateway, approved messaging API, customer delivery, booking submission, or policy issuance.
- Example premium/tax values are arithmetic demonstration values only and do not constitute real insurer quotations.
- PDF uses existing pdf-lib dependency, with standard ASCII-safe fonts and a prominent not-issued disclaimer.
- Case / quotation status is stored in sessionStorage. Its context fingerprint binds it to the selection, insured vehicle and customer without storing raw customer/vehicle identifiers in the new key. This is not permanent server storage or a security boundary.
- The booking-preview draft also uses a context fingerprint to avoid carrying a status from another customer case with the same insurer.

## Manual QA acceptance checklist
- [ ] Compare: all four cards display, 1–4 selected, add/remove works, coverage choices recalculate premiums.
- [ ] Open each insurer details panel; add/remove quotation from its footer.
- [ ] Prepare: each PDF downloads with exactly one insurer per file; combined PDF has one page per selected insurer.
- [ ] View preview displays customer, vehicle, insurer, breakdown and disclaimers.
- [ ] Share: copy does not send message; mark shared updates history.
- [ ] Decision: no accepted insurer disables booking; accepted insurer enables booking; revision and decline clear previous selection.
- [ ] Booking: accepted insurer matches selection; Continue requires booking request.
- [ ] Payment: request / refresh / Continue routes to issuance only after preview payment is confirmed.
- [ ] Reload in same tab: matching case restores; unrelated vehicle/customer does not inherit payment or acceptance status.
- [ ] No real payment links, customer communication, or live policies created; existing RC/chassis form and route authorization intact.

## Deferred until explicit authorization
- Persistent quote cases, reusable customer records, real communication and delivery receipts, signed payment URLs, insurer quoting/bind APIs, legally valid insurer documents, automated customer acceptance.

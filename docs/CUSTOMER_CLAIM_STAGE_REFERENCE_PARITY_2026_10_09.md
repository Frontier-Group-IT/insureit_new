# Nine-stage Customer Claim reference parity — 2026-10-09

Reference images: eleven user-provided screenshots of Customer and Operations claims, including Stage 1, Stage 2, Stage 3, Work Approval, Repair & RI, Billing, Delivery Order, Vehicle Delivery and Payment Encashment.

## Core correction
Do not render the same seven-section Document Verification workspace after every stage.
- Stage 1 Spot Intimation: compact five-field incident details plus the seven category document cards.
- Stage 2 Spot Status: four fields (Spot Survey Done Date, Surveyor Name, Email, Number), no seven-card workspace.
- Stage 3 Claim Intimation: 5-column details plus its own Vehicle Docs / Driver Docs / Permit & Tax / KYC & Other / Forms category strip. These customer document groups require mapping and access review before customer mutations.
- Stage 4 Work Approval: date, cashless choice, optional surveyor name/phone/email, no document workspace.
- Stage 5 Repair & RI: three dates, no document workspace.
- Stage 6 Billing: date and amount, no document workspace.
- Stage 7 Delivery Order: assessment Yes/No, date and amount, no document workspace.
- Stage 8 Vehicle Delivery: received Yes/Not Yet and date, no document workspace.
- Stage 9 Payment Encashment: two Yes/No controls, documents submitted date, payment received date and amount, no document workspace.

Existing customer-specific workflows and stage access restrictions must be retained. Operations approvals and verification are not customer actions.

## Status
Code implemented on separate branch, not merged/deployed. Automated CI and authenticated screenshot checks pending. Document group selector is a visual reference only until real customer document categories are mapped; do not claim full functional parity or advertise its inert tabs as working.
No schema, RLS, Partner/Operations, APK or OTA changes.

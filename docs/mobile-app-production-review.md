# InsureIT Mobile App Production Review

Date: 2026-06-17

Reviewed scope:
- Source document: `C:\Users\HP\Downloads\Customer App (2).docx`
- Mobile app: `apps/mobile-app`
- Supporting schema/docs: `supabase/migrations`, `docs/business-flow.md`, `docs/database-schema.md`

This review focuses on the customer-facing mobile app and its claim journey. The repo also contains staff/OPS mobile screens, but the primary lens here is whether the customer app follows the supplied business document and whether it is ready for production.

## 1. Executive Summary

The current mobile app is a strong first-stage prototype. It has the right broad foundation: login, customer dashboard, vehicle/policy visibility, accident reporting, document upload, claim list, claim detail, timeline, and support. It also uses private Supabase storage and RLS-backed records, which is a good production direction.

It is not production-ready yet. The largest gaps are not visual polish alone; they are workflow fidelity, data completeness, claim-stage modeling, OPS-to-customer communication, and QA readiness.

The written document describes a detailed commercial motor claim lifecycle:

1. Initial accident/doc intake.
2. OPS receives the case.
3. OPS arranges surveyor and notifies customer.
4. OPS sends intimation mail to insurer and captures insurer response.
5. Customer waits for work approval or query.
6. RI/re-inspection process.
7. DO process with final repair bill and assessment report.
8. Customer accepts DO amount and uploads payment receipt.
9. Payment advice is uploaded and journey is completed.
10. Dashboard metrics split by claim stage and financial amount.

The app currently implements only part of this journey:

- Accident reported.
- Vehicle photo uploaded.
- Generic claim documents uploaded.
- Generic status timeline displayed.
- Generic status history displayed.

The current app does not yet implement several required customer-facing moments:

- RC copy, insurance copy, load challan/GR copy as the first required intake set.
- Driver name and driver number.
- Surveyor details shown to customer.
- "Intimation done please wait for details" customer state.
- Work approval/query loop.
- Required-paper list generated after survey.
- Re-inspection/RI state.
- Final repair bill visibility.
- DO amount and assessment report visibility.
- Customer DO acceptance.
- Payment receipt upload.
- Payment advice breakdown: bill amount, DO amount, depreciation, GST TDS, TDS, received amount.
- "Journey complete" end-state experience.
- Dashboard counts by exact operational buckets.

Recommendation: treat the current app as Phase 1 foundation, then add a workflow engine, document-request model, financial settlement model, notification layer, and a redesigned claim-detail experience before production release.

## 2. Current Working Principle Of The Mobile App

### 2.1 Authentication And Routing

The app uses Supabase Auth. After login, it loads a `profiles` row, validates role, and routes customers to `/customer/home`. Role routing is defined in `apps/mobile-app/lib/auth.ts`.

Customer access depends on:

- A valid Supabase session.
- An active `profiles` row.
- A `customer` role.
- A linked `customers` row via `profile_id`.

If the customer record is missing, some screens use `getCustomerForUser`, while accident/document upload can call `ensureCustomerForUser` to create a fallback customer record.

Production note: automatic customer creation is convenient for demos, but risky for production because it can create incomplete customer master data without OPS validation.

### 2.2 Customer Dashboard

The dashboard at `apps/mobile-app/app/customer/home.tsx` loads:

- Customer profile.
- Vehicles.
- Policies.
- Claims.
- Claim documents.

It then displays:

- Accident report call-to-action.
- Active claim card.
- Action-required card when documents are pending or rejected.
- Quick action grid.
- Summary cards for vehicles, active policies, and total claims.
- Policy expiry reminder.
- Support card.

The dashboard currently operates as a general overview. It does not yet provide the document's required operational claim counters, such as survey pending, intimation pending, approval pending, under repair, RI pending, DO pending, payment pending, settled plus bill amount, and total claims occurred.

### 2.3 Accident Reporting

The accident report screen at `apps/mobile-app/app/customer/report-accident.tsx` lets the customer:

- Select a vehicle.
- Automatically link the latest policy for that vehicle.
- Capture current date/time.
- Capture or manually enter location.
- Enter accident description.
- Capture or choose one vehicle photo.
- Submit a new claim.

On submit, it inserts a row in `claims` with `current_status: 'Accident Reported'`, uploads the vehicle photo to Supabase Storage, creates a `claim_documents` metadata row, and redirects to document upload.

This is a solid start, but it does not match Step 1 of the document fully. Step 1 asks for number of docs/details, RC copy, insurance copy, load challan/GR copy, driver name, driver number, and location capture if feasible. The current screen captures location and photo, but does not capture driver details or the document set required by the written flow.

### 2.4 Document Upload

The upload screen at `apps/mobile-app/app/customer/upload-documents.tsx` supports camera, gallery, and file picker uploads for a fixed list:

- Accident photos.
- Registration certificate.
- Driving licence.
- Policy copy.
- Repair estimate.

It stores metadata in `claim_documents` with pending verification status. It also lets the customer open previously uploaded files via signed URL.

This screen is important, but it needs to become dynamic. The document says required papers change after survey, during query, after approval, at final bill/DO, and during payment receipt. A fixed five-document list cannot represent that operational journey.

### 2.5 Claim Tracking

The claim detail screen at `apps/mobile-app/app/customer/claim-detail.tsx` shows:

- Claim number.
- Vehicle number.
- Current status badge.
- Accident date/location.
- A hardcoded journey timeline.
- Uploaded documents.
- Status history.
- Upload documents and support buttons.

The app has a basic status model in `apps/mobile-app/lib/types.ts`:

- Draft.
- Accident Reported.
- Documents Pending.
- Documents Submitted.
- Claim Intimated.
- Surveyor Appointed.
- Vehicle Inspected.
- Estimate Submitted.
- Approval Pending.
- Repair Started.
- Repair Completed.
- Final Bill Submitted.
- Settlement Under Process.
- Settled.
- Rejected.
- Closed.

This status list partially maps to the written flow, but it compresses important business events. For example, "Settlement Under Process" hides DO amount, DO acceptance, payment receipt, payment advice, deductions, and received amount.

## 3. Document-To-App Gap Analysis

### Step 1: Initial Customer Intake

Document requirement:
- Fill number of docs and details.
- RC copy.
- Insurance copy.
- Load challan/GR copy.
- Driver name.
- Driver number.
- Location address/location capture.

Current app:
- Vehicle selection.
- Policy display.
- Accident date/time.
- Location capture/manual location.
- Accident description.
- One vehicle photo.
- Later upload of registration certificate, policy copy, driving licence, accident photos, repair estimate.

Gaps:
- No "number of docs" field or explicit required document count.
- No load challan/GR copy requirement.
- No driver name.
- No driver phone number.
- Driving licence is captured, but driver identity is not tied to it.
- RC and policy copy are not enforced at claim creation.
- Accident report can continue with only a vehicle photo.

Production recommendation:
- Add a structured FNOL/intake form.
- Required fields: driver name, driver phone, accident location, accident description, vehicle, policy, accident date/time.
- Required initial documents: RC copy, insurance/policy copy, load challan/GR copy, accident photos, driver licence.
- Add document requirement status per claim, not a static upload checklist.

### Step 2: OPS Receives Case And Assigns Surveyor

Document requirement:
- Case received by broker OPS.
- OPS arranges surveyor name/number.
- Customer gets notification/message with surveyor details.

Current app:
- Claim status can represent `Surveyor Appointed`.
- `claims` table has `surveyor_id`.
- Customer claim detail does not fetch or show surveyor details.
- No notification/message UI is present in customer app.

Gaps:
- No customer-visible surveyor card.
- No surveyor phone/email display.
- No "OPS received your claim" acknowledgement state.
- No notification inbox or push/SMS integration.

Production recommendation:
- Add customer-visible claim coordination section: OPS owner, surveyor name, surveyor phone, surveyor email, inspection appointment.
- Add notifications table usage in mobile app.
- Add push notifications/SMS/WhatsApp integration later, but at minimum show in-app notifications.

### Step 3: Post-Survey Required Papers And Mail To Insurer

Document requirement:
- After survey, new stage appears on customer app and OPS dashboard.
- Required papers are listed.
- Customer or OPS uploads papers.
- OPS performs QC.
- OPS sends final mail to insurer with fixed sender and manually entered receiver.
- Insurer responds with surveyor name, number, claim number.

Current app:
- Generic upload screen with fixed document list.
- Staff document screen can verify/reject documents.
- No post-survey dynamic document request list.
- No mail-sent event.
- No insurer receiver email capture.
- No insurer claim number field distinct from internal claim number.

Gaps:
- Missing claim document request model.
- Missing QC workflow visibility for customer.
- Missing insurer mail/intimation tracking.
- Missing insurer claim number.
- Missing separation between internal claim number and insurance company claim number.

Production recommendation:
- Add `claim_document_requests` with required document type, stage, requested_by, due_date, status, and customer visibility.
- Add `claim_communications` or `claim_intimations` to track outgoing insurer/surveyor emails.
- Add insurer claim reference fields: insurer_claim_no, insurer_received_at, insurer_response_notes.
- Customer should see: "Documents requested", "Under QC", "Sent to insurer", "Insurer claim number received".

### Step 4: Intimation Done

Document requirement:
- OPS enters claim number, surveyor name, surveyor number, surveyor email.
- Customer portal shows "INTIMATION DONE PLEASE WAIT FOR DETAILS".
- When details are received, OPS enters them and customer receives notification.

Current app:
- Timeline has "Intimation Sent" mapped to `Claim Intimated`.
- Claim detail does not show the required waiting copy.
- Claim record lacks insurer claim details as first-class fields.

Gaps:
- Customer-facing status copy is not tailored.
- No insurer claim information card.
- No customer notification when OPS enters details.

Production recommendation:
- Add customer status messages per stage.
- For `Claim Intimated`, show: "Intimation done. Please wait for insurer/surveyor details."
- Show insurer claim number and surveyor contact when available.

### Step 5: Work Approval Or Query

Document requirement:
- OPS uploads other required docs and sends mail.
- Customer app shows "WAIT FOR WORK APPROVAL OR QUERY".
- If approval comes, OPS clicks approval received.
- If pendency/query comes, upload docs opens on customer app.

Current app:
- Status model has `Estimate Submitted` and `Approval Pending`.
- Generic upload documents is always accessible.
- No query/pendency object.
- No approval received event.

Gaps:
- No explicit "query raised" workflow.
- No dynamic action required based on insurer query.
- No approval detail or approval document.
- No customer-facing "wait for work approval or query" state.

Production recommendation:
- Add `claim_queries` or use document requests with query category.
- Add approval object: approval_received_at, approval_reference, approval_notes, approval_document_id.
- Customer home should show action only when specific query/doc request exists.

### Step 6: RI/Re-Inspection Process

Document requirement:
- When vehicle is ready, OPS sends mail to insurer and surveyor for RI.

Current app:
- Status model has `Repair Completed`, but no RI-specific status.
- Timeline does not include RI pending/done.
- Dashboard does not count RI pending.

Gaps:
- No RI pending stage.
- No RI sent/completed event.
- No RI documents/communications.

Production recommendation:
- Add statuses or events: `RI Requested`, `RI Pending`, `RI Completed`.
- Customer should see whether the vehicle is ready for re-inspection and who is expected to act.

### Step 7: DO Process

Document requirement:
- After RI, OPS uploads final repair bill and sends to insurer/surveyor.
- Bill is visible on customer app.
- Insurer sends DO amount with assessment report.
- Assessment report is uploaded to customer app for transparency.

Current app:
- Status model has `Final Bill Submitted`.
- Upload screen has repair estimate, but not final bill or assessment report.
- No bill/DO amount fields.

Gaps:
- No final repair bill document requirement.
- No assessment report document category.
- No DO amount.
- No bill amount.
- No financial transparency section in claim detail.

Production recommendation:
- Add settlement/DO section to claim detail.
- Add required document types: final repair bill, assessment report, DO letter/order.
- Add fields: bill_amount, do_amount, depreciation_amount, approved_amount, assessment_report_document_id.

### Step 8: DO Encashment

Document requirement:
- After customer accepts DO amount, customer uploads payment receipt.
- OPS sends it to insurer.

Current app:
- No DO acceptance button.
- No payment receipt category.
- No customer declaration/consent.

Gaps:
- Missing customer approval/acceptance action.
- Missing receipt upload tied to DO encashment.
- Missing customer-visible terms/confirmation.

Production recommendation:
- Add customer action when DO amount is available: accept amount, reject/raise concern, upload receipt.
- Store acceptance timestamp, accepted_by, accepted_amount, declaration text/version.

### Step 9: Payment Advice And Journey Complete

Document requirement:
- OPS uploads payment advice PDF/JPG.
- Customer sees bill amount, DO amount, depreciation, GST TDS, TDS, received amount.
- Customer sees "JOURNEY COMPLETE".

Current app:
- Status model has `Settlement Under Process` and `Settled`.
- Claims table has `settlement_amount`, `approved_amount`, and `estimated_loss`, but no detailed breakdown.
- Claim detail does not render any financial summary.

Gaps:
- Missing payment advice document category.
- Missing settlement calculation breakdown.
- Missing customer-facing completion screen.

Production recommendation:
- Add payment advice object and document.
- Add settlement breakdown fields.
- On settled claim, show "Journey Complete" with transparent financial math.

### Dashboard Metrics

Document requirement:
- Total claims occurred.
- Claims settled plus bill amount.
- Payment pending plus pending amount.
- DO pending plus bill amount.
- RI pending.
- Under repair.
- Approval pending.
- Survey pending.
- Intimation pending.
- Spot pending.

Current app:
- Dashboard shows vehicles, policies, claims.
- Active claim card shows broad progress.
- No financial or stage-bucket metrics.

Gaps:
- Required dashboard KPIs are absent.
- No aggregation by claim stage.
- No amount totals.

Production recommendation:
- Add stage buckets and amount aggregates.
- Use customer dashboard cards for customer-owned claims only.
- Add drill-down from each metric to filtered claims.

## 4. UI/UX Review

### Strengths

- The app has a coherent visual identity: navy, green, light grey, white cards.
- Dashboard is approachable and gives the customer an obvious "Report Accident" entry point.
- Claim status timeline is understandable for a first prototype.
- Camera/gallery/file options are convenient.
- Bottom navigation makes major areas reachable.
- Empty, loading, and error states exist in most key screens.

### Critical UX Issues

1. The claim journey is too generic for a high-trust claim product.

Customers in an accident claim need certainty: what happened, who owns the next step, what document is missing, what amount is approved, and when money is expected. The current UI mostly shows raw statuses and document rows. It needs stage-specific explanations and next-action clarity.

2. The upload screen should be dynamic, not a fixed checklist.

The document describes different required papers at different stages. A fixed list creates confusion because customers may upload documents that are not needed yet, or fail to see a document requested by OPS.

3. The dashboard summary is not aligned with business operations.

The document asks for claim-stage counters and financial amounts. The current dashboard uses generic counts, so it does not help a customer or OPS user understand where money/process is stuck.

4. The claim detail screen needs to become the single source of truth.

Right now it has summary, timeline, documents, and history. It should be redesigned around:

- Current status and next action.
- Important contacts.
- Required documents.
- Insurer/surveyor updates.
- Repair/RI progress.
- DO/settlement amounts.
- Payment advice.
- Full audit trail.

5. Visual density is high and the app relies too much on repeated cards.

Cards are used for almost every element. For a production claim app, repeated card stacking can make important information feel equal. The UI should use priority zones: current action banner, claim summary, document checklist, timeline, financial section.

6. Some copy is placeholder-like.

Examples:

- Support phone: "Contact your assigned InsureIt representative".
- Email: "Use your registered support contact".

Production users need actual contact names, numbers, email, and escalation path.

7. Buttons and actions need stronger hierarchy.

Claim screens should separate primary customer action from secondary viewing. For example, "Upload missing documents" should be visually dominant only when documents are required. "Open document" repeated for every document should be lower emphasis.

8. Trust and reassurance are underdeveloped.

Insurance claims are stressful. The app should explain what is happening without marketing language:

- "Your claim has been received by OPS."
- "Surveyor details will appear here after assignment."
- "No action is needed from you right now."
- "We will notify you when insurer raises approval/query."

### UI/UX Production Improvements

Recommended redesign:

- Dashboard top: active claim alert with next required action.
- Dashboard metrics: claim stage counters from the document.
- Claim detail top: claim number, vehicle, insurer, status, next step.
- Claim detail middle: "Your action" module, surveyor/OPS contacts, required documents.
- Claim detail lower: timeline, documents, settlement/DO/payment advice.
- Upload documents: dynamic document request cards with status, reason, deadline, accepted formats, and rejection notes.
- Settlement screen: transparent calculation table.

Accessibility improvements:

- Increase semantic labeling for icon-only controls.
- Ensure all touch targets are at least 44x44.
- Avoid very small 9-12px text in bottom tabs and dense badges where critical.
- Add `accessibilityLabel` for timeline/status elements and document actions.
- Confirm color contrast for warning orange text and grey secondary text.

## 5. Production Readiness Review

### Engineering Readiness

Current positives:

- TypeScript types exist for Supabase tables.
- Role routing is centralized.
- The app uses Supabase RLS and private storage.
- Screens handle unauthenticated sessions.
- Uploads use signed URLs for viewing.

Production blockers:

- `npm --workspace apps/mobile-app run typecheck` fails because `tsc` is not recognized.
- `npm --workspace apps/mobile-app run lint` fails because `expo` is not recognized.
- This means local dependencies are not installed or workspace binaries are not available.
- There are no automated mobile tests visible.
- No E2E test path is defined for the claim flow.
- No offline/retry strategy exists for accident reporting and document uploads.
- No crash reporting or analytics instrumentation is visible.
- No environment validation exists for Supabase URL/key in mobile app startup.

### Data And Workflow Readiness

Current positives:

- Schema includes claims, documents, history, tasks, notifications, garages, surveyors.
- Claims can reference surveyor and garage IDs.
- Documents can be verified/rejected.

Production blockers:

- Important claim workflow concepts are not modeled first-class:
  - Driver details.
  - Required document requests.
  - Insurer claim number.
  - Surveyor appointment details.
  - Insurer communications/mail events.
  - Queries/pendencies.
  - Work approval event.
  - RI/re-inspection.
  - DO amount and acceptance.
  - Payment receipt.
  - Payment advice and settlement breakdown.
- Current statuses are too broad for the exact document flow.
- There is no server-side validation that required documents exist before stage movement.
- Claim number generation is client-side timestamp based; production should use server-side sequence/unique reference generation.

### Security And Compliance

Current positives:

- Storage bucket is private.
- RLS policies exist.
- Signed URLs expire.

Production concerns:

- Accident claims contain sensitive personal, vehicle, financial, and identity documents.
- Upload file type and size limits exist at bucket level, but client-side validation should also be explicit.
- No malware scanning or document safety pipeline is visible.
- No consent/terms flow for DO acceptance.
- No audit trail visible to customer.
- No privacy controls for PII retention/deletion are visible.
- Support screen exposes no verified contact, which can create social-engineering risk if customers are contacted outside the app.

### Operations Readiness

Current positives:

- Staff screens exist for claims, documents, tasks, and status updates.
- Staff can verify/reject uploaded documents.

Production gaps:

- OPS mail workflow from the document is absent.
- OPS surveyor assignment notification is not customer-visible.
- No SLA tracking.
- No claim-stage ownership.
- No escalation path.
- No manual receiver email flow.
- No insurer response capture.
- No dealership access from second-stage integration.

## 6. Recommended Production Working Principle

The production app should be built around a claim-state engine, not only around a current status string.

Recommended domain model:

- `claims`: base claim case and current high-level state.
- `claim_participants`: customer, OPS owner, surveyor, garage, insurer contacts.
- `claim_stage_events`: immutable lifecycle events.
- `claim_document_requests`: dynamic required documents per stage.
- `claim_documents`: uploaded files attached to a request or claim.
- `claim_queries`: insurer/OPS/customer pending questions.
- `claim_communications`: email/SMS/WhatsApp/in-app notifications.
- `claim_financials`: estimate, bill, DO, deductions, received amount.
- `claim_acceptances`: customer acceptance of DO amount and declarations.
- `claim_notifications`: customer-visible notification inbox.

Recommended customer flow:

1. Report accident.
2. Complete initial intake documents.
3. See "OPS received" state.
4. Receive surveyor details.
5. Upload post-survey required docs.
6. See "Intimation done, please wait for details".
7. Wait for work approval or respond to query.
8. Track repair and RI.
9. View final bill and assessment report.
10. Accept DO amount.
11. Upload payment receipt.
12. View payment advice and settlement breakdown.
13. See Journey Complete.

## 7. Refinement And Repolish Plan

### Phase 0: Stabilize The Mobile Build

Goal: make the current app verifiable before adding more workflow.

Actions:

- Install workspace dependencies and confirm `expo`, `tsc`, and ESLint binaries resolve.
- Run `npm --workspace apps/mobile-app run typecheck`.
- Run `npm --workspace apps/mobile-app run lint`.
- Fix all TypeScript/lint errors.
- Add a basic smoke test checklist for customer login, dashboard, accident report, upload, claim detail.
- Add environment startup validation for Supabase URL/key.

Acceptance criteria:

- Typecheck passes.
- Lint passes.
- App starts locally.
- Customer can complete the current accident and upload flow without manual database changes.

### Phase 1: Align Step 1 Intake With The Document

Goal: make the accident report flow match the written first-stage requirement.

Actions:

- Add driver name and driver phone fields.
- Add load challan/GR document requirement.
- Require RC copy, policy copy, driver licence, load challan/GR, and accident photos before marking initial intake complete.
- Save initial intake data in structured claim fields or a claim intake table.
- Change post-submit status to a customer-friendly state such as "Submitted to OPS" while keeping internal status consistent.

Acceptance criteria:

- Customer cannot submit incomplete first-stage intake unless OPS/admin override is explicitly allowed.
- Claim detail shows submitted intake data and documents.
- OPS can see the same intake package.

### Phase 2: Dynamic Document Requests

Goal: replace fixed upload sections with claim-stage document requirements.

Actions:

- Add a document request model.
- Create request records for initial intake, post-survey papers, query response, final bill, payment receipt, and payment advice.
- Update upload screen to render required documents from backend records.
- Show request status: required, uploaded, under QC, verified, rejected.
- Display rejection reason and allow replacement upload.

Acceptance criteria:

- Customer sees only relevant required documents for the selected claim/stage.
- Rejected documents clearly show why they failed.
- Staff verification drives customer action-required state.

### Phase 3: Claim Detail Redesign

Goal: make claim detail the customer source of truth.

Actions:

- Replace generic timeline-first layout with priority modules:
  - Current status and next action.
  - OPS/surveyor/garage/insurer contacts.
  - Required documents.
  - Claim milestones.
  - Financial transparency.
  - Documents and history.
- Add stage-specific customer copy from the document:
  - "Intimation done. Please wait for details."
  - "Wait for work approval or query."
  - "Vehicle ready for RI."
  - "DO amount received. Please review and accept."
  - "Journey complete."
- Show insurer claim number separately from internal claim number.

Acceptance criteria:

- A customer can understand the next step in under 5 seconds.
- Every document stage has a clear owner and action.
- Surveyor/OPS contact details are visible when assigned.

### Phase 4: Workflow And Status Model Upgrade

Goal: represent the written claim flow without losing operational detail.

Actions:

- Add or derive stages for:
  - OPS received.
  - Spot/survey pending.
  - Survey completed.
  - Intimation pending.
  - Intimation done.
  - Query pending.
  - Approval pending.
  - Approval received.
  - Under repair.
  - RI pending.
  - RI done.
  - DO pending.
  - DO received.
  - Customer DO accepted.
  - Payment receipt submitted.
  - Payment advice received.
  - Journey complete.
- Add immutable status/event history.
- Enforce valid transitions server-side or in database functions.
- Create customer-friendly labels separate from internal operations statuses.

Acceptance criteria:

- The app can represent every step in the document.
- Invalid stage jumps are blocked.
- Customer sees simple labels while OPS keeps detailed control.

### Phase 5: DO, Settlement, And Payment Advice

Goal: implement the final claim-money transparency required by the document.

Actions:

- Add settlement fields:
  - Bill amount.
  - DO amount.
  - Depreciation.
  - GST TDS.
  - TDS.
  - Received amount.
- Add assessment report and payment advice document types.
- Add customer DO acceptance action.
- Add payment receipt upload after acceptance.
- Add final "Journey Complete" summary.

Acceptance criteria:

- Customer can view final bill, assessment report, DO amount, and payment advice.
- Customer can accept DO amount and upload receipt.
- Settlement math is visible and consistent.

### Phase 6: Dashboard Repolish

Goal: make dashboard match the document and improve customer confidence.

Actions:

- Add stage counters:
  - Total claims occurred.
  - Settled plus bill amount.
  - Payment pending plus pending amount.
  - DO pending plus bill amount.
  - RI pending.
  - Under repair.
  - Approval pending.
  - Survey pending.
  - Intimation pending.
  - Spot pending.
- Add filtered claim drill-down for each counter.
- Keep one high-priority active claim card at top.
- Show "No action required" only when there are truly no open requests.

Acceptance criteria:

- Dashboard metrics match written requirements.
- Customer can tap a metric and see relevant claims.
- Action-required state is driven by workflow records, not broad status guesses.

### Phase 7: Notifications And Communication

Goal: make OPS/customer communication production-grade.

Actions:

- Use notifications table in mobile app.
- Add notification inbox.
- Trigger notification on:
  - Surveyor assigned.
  - Document requested.
  - Document rejected.
  - Intimation done.
  - Query raised.
  - Approval received.
  - RI requested/completed.
  - DO received.
  - Payment advice uploaded.
- Add push notification support after in-app notification works.

Acceptance criteria:

- Customer sees every important state change without calling support.
- Notification history is visible per claim.

### Phase 8: Production Hardening

Goal: prepare app for real users and sensitive claim data.

Actions:

- Add client-side file validation: type, size, readable image/PDF.
- Add upload retry and progress indicators.
- Add offline draft support for accident reports.
- Add crash reporting.
- Add analytics for funnel drop-offs.
- Add audit trail visibility for major customer-facing events.
- Add secure contact verification for support.
- Add release checklist for Android/iOS builds.
- Add E2E tests for full claim journey.

Acceptance criteria:

- Upload failures are recoverable.
- Claim records do not get half-created silently.
- QA can validate production release with repeatable tests.

## 8. Priority Backlog

### P0: Must Fix Before Production

- Make typecheck/lint runnable and passing.
- Add missing Step 1 fields: driver name, driver number, load challan/GR.
- Replace fixed document upload list with dynamic required documents.
- Show customer next action per claim stage.
- Model insurer claim number separately.
- Show surveyor details to customer.
- Add settlement/DO/payment advice data model.
- Add customer DO acceptance and payment receipt upload.
- Add real support contact data.
- Add upload validation, retry, and error recovery.

### P1: Should Fix Before Beta

- Redesign claim detail around current action and transparency.
- Add customer notification inbox.
- Add stage-specific dashboard counters.
- Add query/pendency workflow.
- Add RI workflow.
- Add status transition validation.
- Add crash reporting and analytics.
- Add smoke/E2E tests.

### P2: Post-Beta Enhancements

- Push notifications.
- WhatsApp/SMS notifications.
- Dealership access from second-stage integration.
- Document OCR/auto-classification.
- Settlement calculation automation.
- Customer satisfaction feedback after journey complete.

## 9. Final Assessment

Current maturity: prototype/early MVP.

The mobile app has the right skeleton, but the written claim flow is more operationally detailed than the current implementation. To reach production, the team should not only polish screens; it should upgrade the workflow model so the app can truthfully represent what happens between customer, OPS, surveyor, garage, insurer, and payment.

The most important product principle for this app should be:

> At every claim stage, the customer must know what has happened, who owns the next step, what documents or approvals are pending, and what financial amount is involved.

Once the app is rebuilt around that principle, UI polish becomes much easier because each screen will have a clear job instead of showing generic records.

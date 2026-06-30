# InsureIT Claim Manager Web Dashboard Handoff

This document is for a fresh ChatGPT/Codex session that will continue the InsureIT project from the current local/GitHub repository state. The customer mobile app is considered complete for now. The next major work is the claim-manager web dashboard using the existing unfinished web app in `apps/web-portal`.

## Project overview

InsureIT is an insurance and claim-management product focused on commercial vehicle insurance. The current app has two main surfaces:

- Customer mobile app: `apps/mobile-app`, built with Expo + React Native + Expo Router.
- Web portal: `apps/web-portal`, built with Next.js + React + Tailwind. This is the target for the claim manager dashboard.

Backend is Supabase:

- Auth: Supabase auth.
- Database: public schema with profiles, customers, vehicles, policies, claims, claim documents, claim status history, claim stage details, claim tasks, support tickets, notifications, and customer KYC documents.
- Storage buckets currently used/expected:
  - `claim-documents`
  - `support-ticket-attachments`
  - `customer-documents`

Root scripts:

```bash
npm run dev:web
npm run build:web
npm run lint:web
npm run typecheck:web
npm run dev:mobile
npm run lint:mobile
npm run typecheck:mobile
```

## Current brand and design language

Do not replace the company logo or brand name style. Use the current InsureIT logo/brand assets already in the project.

The current customer app theme is light, premium, modern, and insurance-focused:

- Primary navy: `#071D49`
- Blue: `#174EA6`
- Soft blue backgrounds: `#EAF3FF`, `#F4F8FF`
- Canvas: `#F4F8FC`
- Surface: `#FFFFFF`
- Accent success green: `#10A66F`
- Warning amber/orange: `#C98918`, `#D97912`
- Error/coral: `#E5484D`
- Muted slate: `#5C6878`, `#8793A5`

Mobile style patterns to mirror in web:

- White premium cards with soft border and subtle shadow.
- Rounded corners, usually large radius.
- Light blue page backgrounds with decorative wave/dot/shield motifs when useful.
- Compact but readable dashboard cards.
- Status badges should be soft/subtle, not harsh.
- Loading states should be polished and branded, not plain text.
- Claim journey stages should feel connected, not isolated tabs.

## Customer mobile app current working state

The customer mobile app currently includes these completed or polished areas:

### Auth and first entry

Files:

- `apps/mobile-app/components/auth-experience.tsx`
- `apps/mobile-app/components/first-look.tsx`
- `apps/mobile-app/app/login.tsx`
- `apps/mobile-app/app/signup.tsx`
- `apps/mobile-app/app/forgot-password.tsx`
- `apps/mobile-app/app/reset-password.tsx`

Current behavior:

- Modern login/signup layout inspired by client mockup.
- Uses current company logo/brand style.
- Insurance product tiles for two-wheeler, car, truck, health, life.
- Compact sections so lower content/copyright is visible.
- Copyright text:
  - `© 2026 Sankalp Insurance Brokers Pvt. Ltd. All rights reserved.`
  - `InsureIT v1.0.0 • Your Safety, Our Promise.`
- Forgot password opens reset flow.

### Customer dashboard / home

Files:

- `apps/mobile-app/app/customer/home.tsx`
- `apps/mobile-app/components/customer-dashboard/index.tsx`
- `apps/mobile-app/components/ui.tsx`

Current behavior:

- Customer dashboard is the visual baseline for the app.
- Top logo/header and bottom navigation are stable.
- Dashboard sections are compacted/expanded to fit the mobile viewport without excessive vertical scrolling.
- Bottom nav has improved touch area and stable positioning.
- Modern branded loader is used instead of odd page names during loading.

### Claims and claim detail

Files:

- `apps/mobile-app/app/customer/claims.tsx`
- `apps/mobile-app/app/customer/claim-detail.tsx`
- `apps/mobile-app/app/customer/upload-documents.tsx`
- `apps/mobile-app/lib/claim-workflow.ts`
- `apps/mobile-app/lib/claim-documents.ts`

Current behavior:

- Customer can see claim list, claim detail, current status, next action, uploaded documents, and journey.
- Claim Detail page has a modern connected claim journey chain/rail graphic.
- Incident Location was removed from customer Claim Detail UI.
- Next Action is in its own premium card.
- Uploaded image documents show thumbnails.
- Current stage/status badge is softer and subtle.
- Every visible string in JSX was checked/wrapped in `<Text>` for React Native.
- Upload documents flow uses `Spot Photo` instead of `Accident photos`.
- On claim submission, the button says `Submit Claim`.
- After successful submission, a compact modern success popup appears with claim info and a `View Claim Details` button.

### Vehicles and endorsement flow

File:

- `apps/mobile-app/app/customer/vehicles.tsx`

Current behavior:

- Vehicle list/detail follows the app theme.
- In My Vehicle > Endorsement popup:
  - Options 1–5 require RC copy upload before submit is activated.
  - Option 6, GST no mention, requires GST certificate upload.
  - Other requires relevant document upload.
  - Customer must also enter the exact endorsement request.
  - Submit button only activates after document + details are provided.

### Support

Files:

- `apps/mobile-app/app/customer/support.tsx`
- `apps/mobile-app/app/customer/raise-support-ticket.tsx`
- `apps/mobile-app/app/customer/support-ticket-detail.tsx`
- `apps/mobile-app/app/customer/help-faqs.tsx`

Current behavior:

- Support pages were redesigned based on a supplied support-experience mockup.
- Ticket creation is connected to Supabase.
- Customer can select related claim.
- Tickets are assigned logically for now to the claim manager.
- Ticket detail has conversation/live-support style UI.
- FAQs and contact support are styled in the same customer theme.

### Notifications

Files:

- `apps/mobile-app/app/customer/notifications.tsx`
- `apps/mobile-app/components/notifications-inbox.tsx`
- `apps/mobile-app/components/realtime-notifications.tsx`

Current behavior:

- Notification page redesigned from a dark mockup into the app’s light premium theme.
- Includes summary/category feel and notification list grouped by time.
- Realtime notification bell exists in the shared header.

### Profile

File:

- `apps/mobile-app/app/customer/profile.tsx`

Current behavior:

- Profile page redesigned based on client mockup.
- Uses animated/professional customer avatar asset.
- Shows profile stats, contact information, preferences, quick actions, and signout.
- My Fleet section was removed.
- Documents & KYC is no longer showing claim documents.
- Customer KYC/documents now use `customer_documents`.
- KYC/Documents section is collapsed by default as a premium vault card with expandable down/up arrow.
- When expanded, customer can select document type, upload, open, and delete documents.

## Important database tables and types

The mobile app has up-to-date TypeScript table types in:

- `apps/mobile-app/lib/types.ts`

Key tables:

- `profiles`
- `customers`
- `vehicles`
- `policies`
- `insurance_companies`
- `claims`
- `claim_documents`
- `customer_documents`
- `claim_stage_details`
- `claim_status_history`
- `claim_tasks`
- `support_tickets`
- `support_ticket_messages`
- `support_ticket_attachments`
- `notifications`

Important claim fields:

- `claims.claim_no`
- `claims.insurer_claim_no`
- `claims.customer_id`
- `claims.vehicle_id`
- `claims.policy_id`
- `claims.insurance_company_id`
- `claims.garage_id`
- `claims.surveyor_id`
- `claims.current_status`
- `claims.accident_at`
- `claims.accident_location`
- `claims.accident_description`
- `claims.estimated_loss`
- `claims.approved_amount`
- `claims.settlement_amount`
- `claims.assigned_to`
- `claims.created_by`

Important document fields:

- `claim_documents.claim_id`
- `claim_documents.customer_id`
- `claim_documents.document_type`
- `claim_documents.file_name`
- `claim_documents.storage_bucket`
- `claim_documents.storage_path`
- `claim_documents.mime_type`
- `claim_documents.file_size`
- `claim_documents.verification_status`: `pending | verified | rejected`
- `claim_documents.verified_by`
- `claim_documents.verified_at`
- `claim_documents.rejection_reason`
- `claim_documents.uploaded_by`

Customer KYC document table:

- `customer_documents.customer_id`
- `customer_documents.document_type`
- `customer_documents.file_name`
- `customer_documents.storage_bucket`
- `customer_documents.storage_path`
- `customer_documents.mime_type`
- `customer_documents.file_size`
- `customer_documents.uploaded_by`

Support tables:

- `support_tickets`
- `support_ticket_messages`
- `support_ticket_attachments`

Notification table:

- `notifications.profile_id`
- `notifications.customer_id`
- `notifications.claim_id`
- `notifications.title`
- `notifications.message`
- `notifications.status`

## Migrations recently added/applied

These migrations are relevant to current work:

- `supabase/migrations/202606230001_customer_support_tickets.sql`
- `supabase/migrations/202606240001_customer_profile_documents.sql`

The `202606240001_customer_profile_documents.sql` migration creates:

- `public.customer_documents`
- RLS policies for customer read/upload/delete
- private storage bucket `customer-documents`
- storage policies for customer read/upload/delete under customer-id folders

The migration has been applied to the linked Supabase project and marked as applied in migration history.

## Claim status workflow

Claim status enum/type includes:

- `Draft`
- `Accident Reported`
- `Initial Documents Pending`
- `Initial Documents Verification Pending`
- `Initial Documents Submitted`
- `Initial Documents Verified`
- `Documents Pending`
- `Documents Submitted`
- `Claim Intimated`
- `Surveyor Appointed`
- `Vehicle Inspected`
- `Final Documents Awaited`
- `Final Documents Verification Pending`
- `Final Documents Submitted`
- `Final Documents Verified`
- `Claim Intimation`
- `Final Surveyor Details`
- `Survey Status`
- `Survey Done`
- `Work Approval Status`
- `Work Approval Received`
- `Under Repair`
- `Repair Done`
- `RA Intimation`
- `RA Intimation Done`
- `DO Status`
- `Payment Stage`
- `Claim Completion In Progress`
- `Claim Complete`
- `Estimate Submitted`
- `Approval Pending`
- `Repair Started`
- `Repair Completed`
- `DO Submitted`
- `Final Bill Submitted`
- `Settlement Under Process`
- `Settled`
- `Rejected`
- `Closed`

Mobile customer queue definitions exist in:

- `apps/mobile-app/lib/claim-workflow.ts`

Web portal also has an older workflow helper in:

- `apps/web-portal/lib/claim-workflow.ts`

Important: the web helper may be slightly behind mobile. For claim manager dashboard work, reconcile it with the mobile helper and database types before building major UI.

## Required claim documents

Mobile source of truth:

- `apps/mobile-app/lib/claim-documents.ts`

Initial claim documents:

- `Spot Photo`
- `Registration certificate`
- `Driving licence`
- `Policy copy`
- `GR Copy / Load Challan`

Final claim documents include:

- `Repair estimate`
- `Claim form`
- `Driver KYC`
- `Tax paid receipt`
- `Permit copy A`
- `Permit copy B`
- `Permit authorization letter`
- `Vehicle fitness certificate`
- `Pollution certificate`
- `Insured CKYC documents`
- `FIR / Police report`
- `Affidavit if no FIR`
- `MLC report`
- `Driver fitness report`
- `Fastag summary report`
- `ETP clarification`
- `Final tax invoice`
- `Workshop KYC documents`
- `Towing NOC and bill`
- `Discharge / Satisfaction voucher`
- `Previous year policy for NCB`
- `New vehicle purchase invoice`
- `Highway report`
- `GPS tracking details`
- `Insurer additional documents`

Use this same document logic in the claim manager web dashboard.

## Existing web portal state

Target app:

- `apps/web-portal`

Stack:

- Next.js 15
- React 19
- Tailwind CSS
- Supabase JS

Existing useful files:

- `apps/web-portal/app/layout.tsx`
- `apps/web-portal/app/page.tsx`
- `apps/web-portal/app/dashboard/page.tsx`
- `apps/web-portal/app/claims/page.tsx`
- `apps/web-portal/app/claims/[id]/page.tsx`
- `apps/web-portal/app/actions.ts`
- `apps/web-portal/components/shell.tsx`
- `apps/web-portal/components/ui.tsx`
- `apps/web-portal/lib/auth.ts`
- `apps/web-portal/lib/auth-server.ts`
- `apps/web-portal/lib/supabase.ts`
- `apps/web-portal/lib/roles.ts`
- `apps/web-portal/lib/claim-workflow.ts`

Existing web claim pages already do some basic work:

- Claim queue/list page:
  - `apps/web-portal/app/claims/page.tsx`
  - Lists claims with customer, vehicle, status, assignee, updated age, estimated loss, settlement.
  - Has filters for queue, status, search.

- Claim detail workspace:
  - `apps/web-portal/app/claims/[id]/page.tsx`
  - Loads claim details, documents, history, tasks, stage details.
  - Creates signed URLs for claim documents.
  - Allows document verify/reject through server actions.
  - Allows workflow advancement through server actions.
  - Current UI is functional but unfinished/basic compared with the mobile app theme.

Roles:

- Web portal role access lives in `apps/web-portal/lib/roles.ts`.
- Claim workflow update roles: `manager`, `claim_processor`.
- Claim view roles include `manager`, `claim_processor`, `field_executive`, `admin`, `super_admin`.

## Main goal for next ChatGPT session

Build a full, production-grade Claim Manager web dashboard in `apps/web-portal`, matching the customer mobile app design language but optimized for desktop.

The claim manager web app should be the operational control center for claims.

## Suggested claim manager web dashboard scope

### 1. Manager dashboard landing page

Recommended route:

- `apps/web-portal/app/dashboard/page.tsx`

Should include:

- Premium top hero/header with manager identity and claim desk status.
- KPI cards:
  - Total open claims
  - New claims / accident reported
  - Documents pending verification
  - Customer action awaited
  - Survey pending
  - Work approval pending
  - Payment pending
  - Closed claims
- Queue cards linked to filtered claims:
  - Active claims
  - Documents pending verification
  - Customer action awaited
  - Manager action required
  - Closed cases
- Recent priority claims table/list.
- SLA/age indicators using `stageAgeLabel`.
- Support tickets needing manager response.
- Notifications or alerts.

### 2. Claim queue/list page

Recommended route:

- `apps/web-portal/app/claims/page.tsx`

Upgrade current page to:

- Modern desktop table with sticky header or card-list hybrid.
- Search by claim no, vehicle, customer, policy, assignee.
- Filters:
  - claim status
  - queue
  - age/SLA
  - assignee
  - insurer
  - document status
- Bulk-friendly but safe actions.
- Premium status badges and “next action” chips.

### 3. Claim detail manager workspace

Recommended route:

- `apps/web-portal/app/claims/[id]/page.tsx`

This should become the main manager screen. Suggested layout:

- Top claim summary:
  - claim no
  - customer
  - vehicle no
  - insurer
  - current status
  - stage age
  - assigned manager
- Connected claim journey timeline/chain across the full width.
- Main content grid:
  - Left: claim details, accident summary, policy/vehicle/customer cards.
  - Center: document checklist with previews, signed URL open, verify, reject/reupload reason.
  - Right: next action card with workflow forms.
- Stage details:
  - Surveyor details
  - final surveyor details
  - RA/DO/payment details
  - claim closure financial details
- Status history timeline.
- Support ticket panel / customer conversations if related.

### 4. Document verification

Must support:

- Preview/open uploaded docs via signed URLs.
- Verify document.
- Reject document with required reason.
- Automatically update claim status when all required documents are verified, consistent with mobile logic.
- Clear UI for:
  - pending
  - verified
  - replacement needed

### 5. Workflow advancement

Use/extend existing server actions in:

- `apps/web-portal/app/actions.ts`

Workflow should support:

- Appoint surveyor after initial docs verified.
- Mark vehicle inspected.
- Request final documents.
- Verify final documents.
- Record insurer intimation/final surveyor details.
- Track survey status.
- Track work approval.
- Track repair.
- Record RA intimation.
- Record DO status.
- Record payment stage.
- Close/settle claim.

Every workflow action should:

- update `claims.current_status`
- insert into `claim_status_history`
- insert relevant details into `claim_stage_details`
- create notifications for customer when relevant
- avoid breaking customer mobile display

### 6. Support ticket integration

Customer support tickets exist in mobile and Supabase. Web manager should include:

- Support ticket list/queue.
- Ticket detail/conversation.
- Ability for manager to reply.
- Update ticket status: open, in progress, resolved, closed.
- Related claim link.

### 7. Notification integration

Notifications should be created for customer-facing updates:

- Document rejected/reupload requested.
- Documents verified.
- Surveyor appointed.
- Final documents requested.
- Work approval received.
- Payment/settlement updates.
- Claim closed.
- Support ticket reply.

## Design guidance for desktop mockups

When user provides desktop screen mockup images, use them as the visual target, but preserve:

- existing InsureIT logo/brand identity
- current color palette
- Supabase-backed logic
- role-based access
- mobile customer compatibility

Desktop web should feel like the mobile theme translated into a professional claims operations cockpit:

- light canvas
- large rounded cards
- navy/blue primary accents
- subtle gradients
- soft shadows
- compact data-dense tables
- clear primary actions
- no raw/default browser UI

## Assets

Assets already exist in mobile:

- `apps/mobile-app/assets/auth/`
- `apps/mobile-app/assets/profile/`

Use these as references for visual style. Do not blindly import mobile-only image paths into web unless copied/available in `apps/web-portal/public` or an equivalent web-safe asset location.

## Validation expectations

Before handing back web changes, run:

```bash
npm run typecheck:web
npm run lint:web
npm run build:web
```

For mobile-safe backend changes, also run:

```bash
npm run typecheck:mobile
npm run lint:mobile
```

Known current mobile lint warnings before web work:

- Unicode BOM warnings in a few mobile files.
- One unused `policies` value warning in `apps/mobile-app/app/customer/home.tsx`.

These are existing warnings and not necessarily blockers.

## Git/GitHub handoff notes

The local working tree currently contains many uncommitted customer mobile changes plus new files/assets/migrations. Before moving development fully into another ChatGPT/GitHub workflow, push the current local state to GitHub so the next session sees the completed customer app.

Recommended commit message:

```text
Complete customer mobile app polish and support/profile flows
```

Do not commit local backup/log/generated runtime files unless intentionally needed:

- `_patch-backups/`
- `.expo/`
- `expo-*.log`
- `expo-*.err.log`
- `.publish-git-temp-*`

Do commit relevant source/assets/migrations:

- `apps/mobile-app/**`
- `apps/web-portal/**` if changed
- `supabase/migrations/202606230001_customer_support_tickets.sql`
- `supabase/migrations/202606240001_customer_profile_documents.sql`
- `docs/claim-manager-web-handoff.md`

## Immediate prompt suggestion for the next ChatGPT session

Use this prompt:

```text
We are continuing the InsureIT project. The customer mobile app is complete for now. Use the repository and the handoff file at docs/claim-manager-web-handoff.md as context.

Next goal: build the claim manager web dashboard in apps/web-portal using the current Supabase schema and mobile app workflow logic. Keep the InsureIT logo/brand identity unchanged. Match the light premium theme from the mobile customer app, but optimize for desktop.

First inspect the current web portal and database-related code. Then create a plan for the manager dashboard, claim queue, claim detail workspace, document verification, support ticket integration, and workflow actions. I will provide desktop mockup images for the visual target.
```


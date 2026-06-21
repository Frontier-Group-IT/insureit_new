# InsureIT Mobile App Polish Roadmap

Date: 2026-06-17

Goal: rebuild the mobile app experience into a production-ready, role-specific, modern insurance claim platform with clean UX, vibrant visual design, strong workflow clarity, and clear separation between customer, operations, agent, management, and IT staff experiences.

## 1. Product Direction

The app should not feel like one generic admin app with different menu items. Each role needs a different experience because each user enters the app with a different mindset.

Core principle:

> Every user should open the app and immediately understand what needs attention, what they are responsible for, and what has changed since their last visit.

Design principle:

> Clean, modern, trustworthy, vibrant, and operationally sharp. The app should feel premium enough for customers, but efficient enough for claim teams who use it all day.

The current app is functional but visually generic. It relies heavily on repeated cards, muted colors, basic status labels, and simple lists. The next version should use stronger information hierarchy, role-specific dashboards, better motion, meaningful graphics, branded iconography, and stage-aware screens.

## 2. Role-Specific App Experiences

### Customer Experience

Purpose:

- Report accidents.
- Upload requested documents.
- Track claim journey.
- See surveyor/OPS/agent contacts.
- Accept DO amount.
- Upload payment receipt.
- View payment advice and settlement transparency.

Recommended layout:

- Warm, reassuring customer dashboard.
- Large active claim status module.
- Clear "Action Required" panel.
- Claim journey timeline with friendly stage language.
- Document checklist with upload progress.
- Contact cards for Agent, Claim Handler, Surveyor, and Support.
- Settlement transparency section.

Visual direction:

- More polished and human than internal staff screens.
- Use vibrant but trustworthy colors: deep navy, emerald, sky blue, amber, coral/red for urgent actions.
- Use clean illustrations or animated state graphics for accident reported, surveyor assigned, approval pending, payment complete.
- Avoid cluttered admin-like tables.

Key screens:

- Customer Home.
- Report Accident / FNOL.
- Claim Detail.
- Required Documents.
- DO Review and Acceptance.
- Payment Receipt Upload.
- Journey Complete.
- Support / Contacts.

### Operational Staff Experience

Includes:

- Claim Processor.
- Field Executive.
- Manager where they act operationally.

Purpose:

- Handle claim files.
- Verify documents.
- Request missing documents.
- Assign/update surveyor and garage.
- Track insurer intimation.
- Move claim stages.
- Record approval, RI, DO, payment advice.

Recommended layout:

- Dense but clean operations dashboard.
- Work queues instead of generic cards.
- Tabs for: New Claims, Documents Pending QC, Survey Pending, Approval Pending, RI Pending, DO Pending, Payment Pending, Completed.
- Claim detail should have an operations command center layout:
  - Case summary.
  - Current stage.
  - Required actions.
  - Document QC.
  - Communication log.
  - Timeline.
  - Financial/settlement section.

Visual direction:

- More utilitarian than customer app.
- Compact rows, strong filters, status chips, stage aging indicators.
- Use color as signal, not decoration.
- Motion should be subtle: queue transitions, success confirmations, upload progress, status movement.

Key screens:

- OPS Dashboard.
- Claim Queue.
- Claim Command Center.
- Document QC.
- Status Update.
- Surveyor/Garage Assignment.
- Insurer Communication.
- DO/Payment Advice Entry.
- Task Board.

### Agent Experience

Purpose:

- Support assigned customers.
- Track customer claim status.
- Help collect documents.
- Communicate with customer.
- Monitor customer portfolio.

Recommended layout:

- Relationship dashboard, not OPS command center.
- Assigned customers.
- Claims needing customer follow-up.
- Documents pending from customer.
- Escalations.
- Recent customer communication.

Visual direction:

- Balanced between customer-friendly and operational.
- Use customer cards, claim cards, and follow-up reminders.
- Agent should see "who to call today" and "what to ask for".

Key screens:

- Agent Home.
- Assigned Customers.
- Customer Detail.
- Customer Claims.
- Follow-Up Tasks.
- Communication Notes.

### Management Experience

Includes:

- Sales Manager.
- ASM.
- Zonal Head.
- Sales Head.
- Director.

Purpose:

- View claim stages.
- Monitor downline portfolio.
- Track bottlenecks and financial exposure.
- Escalate stuck claims.

Recommended layout:

- Executive dashboard.
- Stage-wise claim metrics.
- Aging buckets.
- Pending amount summaries.
- Downline performance.
- Drill-down views, mostly read-only.

Visual direction:

- Clean analytics and reporting.
- Use charts, progress rings, stage funnels, and ranked lists.
- Less operational editing, more oversight.

Key screens:

- Management Dashboard.
- Stage Funnel.
- Pending Amount Summary.
- Downline Claims.
- Escalation List.
- Claim Read-Only Detail.

### IT Staff Experience

Purpose:

- Manage users.
- Assign roles.
- Assign reporting managers.
- Activate/deactivate profiles.
- View organization tree.
- Support access issues.

Recommended layout:

- Separate IT/admin visual language.
- System console feel, but still modern.
- User directory, role filters, hierarchy tree, audit log.

Visual direction:

- Cooler, technical palette: navy, graphite, cyan, green.
- Less claim branding, more system controls.
- Clear warnings for permission-impacting changes.

Key screens:

- IT Dashboard.
- Users.
- User Detail/Edit.
- Organization Tree.
- Role/Access Review.
- Audit Log.

## 3. Visual Design And Theme Roadmap

### Brand Foundation

Create a real design system before rebuilding screens.

Deliverables:

- App logo refinement.
- App icon.
- Splash screen.
- Role-aware color system.
- Typography scale.
- Icon system.
- Button, input, card, sheet, modal, tab, badge, timeline, upload, and chart components.
- Motion guidelines.

Recommended design direction:

- Brand base: deep navy for trust, emerald for success, bright blue for progress, amber for waiting, coral/red for urgent or rejected.
- Background: soft neutral grey or very light blue-grey.
- Surfaces: clean white with restrained borders and shadows.
- Avoid overusing rounded cards everywhere.
- Use full-width role dashboards with clear content zones.
- Use branded icons and high-quality vector illustrations.

### Graphics

Use industry-standard visuals:

- Professional vector illustrations for empty states and milestones.
- Lottie animations for success, upload, claim submitted, payment complete.
- Material/React Native vector icons for functional controls.
- Custom InsureIT logo and app icon.
- Stage-specific icons:
  - Accident reported.
  - Documents required.
  - Surveyor assigned.
  - Insurer intimation.
  - Approval pending.
  - Repair.
  - RI.
  - DO.
  - Payment.
  - Journey complete.

Rules:

- Graphics should explain state, not decorate randomly.
- Animations should be short and purposeful.
- Keep staff dashboards efficient; do not overload operational screens with decorative graphics.

### Motion

Recommended animations:

- Smooth dashboard entry transitions.
- Claim stage progress animation.
- Upload progress animation.
- Success state after document upload.
- Status transition confirmation.
- Pull-to-refresh microinteraction.
- Bottom sheet transitions for filters and actions.

Avoid:

- Long animations before operational work.
- Heavy animation on dense staff screens.
- Motion that hides loading or delays user action.

## 4. UX Architecture Roadmap

### Navigation Redesign

Current problem:

- Many roles share similar routes and screens.
- The visual hierarchy does not clearly separate customer, staff, agent, management, and IT usage.

Recommended approach:

- Create role-specific home shells:
  - `/customer/*`
  - `/ops/*`
  - `/agent/*`
  - `/management/*`
  - `/it/*`
- Keep shared claim components, but vary layout and permissions by role.
- Bottom tabs should be role-specific.
- Claim detail should support role-specific modes:
  - Customer view.
  - OPS editable view.
  - Agent assist view.
  - Management read-only view.

### Information Architecture

Customer:

- Home.
- Claims.
- Documents.
- Support.
- Profile.

OPS:

- Queues.
- Claims.
- Documents.
- Tasks.
- Communications.
- Profile.

Agent:

- Home.
- Customers.
- Follow-ups.
- Claims.
- Profile.

Management:

- Dashboard.
- Reports.
- Downline.
- Claims.
- Escalations.

IT:

- Dashboard.
- Users.
- Organization.
- Roles.
- Audit.

## 5. Claim Workflow Roadmap

### Stage 1: Correct The Intake

Add:

- Driver name.
- Driver phone.
- RC copy.
- Insurance/policy copy.
- Load challan/GR copy.
- Driving licence.
- Accident photos.
- Location capture/manual location.

Output:

- A complete first notice/intake package.

### Stage 2: OPS Claim Ownership

Add:

- Claim owner assignment.
- OPS received status.
- Agent/customer contact owner.
- Claim Processor owner.
- Field Executive optional assignment.

Output:

- Every claim has a responsible internal owner.

### Stage 3: Dynamic Document Requests

Add:

- Stage-based required documents.
- Rejection reason.
- Reupload flow.
- OPS upload on behalf of customer.
- Customer upload visibility.

Output:

- Upload screen becomes relevant to the claim's current stage.

### Stage 4: Surveyor And Intimation

Add:

- Surveyor name, phone, email.
- Survey appointment.
- Insurer intimation status.
- Insurer claim number.
- Customer message: "Intimation done. Please wait for details."

Output:

- Customer can see who is handling inspection and insurer reference.

### Stage 5: Query And Approval

Add:

- Work approval pending.
- Query/pendency raised.
- Query document request.
- Approval received event.

Output:

- Customer knows whether to wait or upload missing papers.

### Stage 6: Repair, RI, DO, Payment

Add:

- Repair started/completed.
- RI requested/completed.
- Final repair bill.
- Assessment report.
- DO amount.
- Customer DO acceptance.
- Payment receipt upload.
- Payment advice.
- Settlement breakdown.

Output:

- The final financial journey becomes transparent and complete.

## 6. Technical Roadmap

### Foundation

- Install dependencies and fix local `typecheck`/`lint`.
- Add app-wide environment validation.
- Define role-based route guards.
- Define permission helpers:
  - canViewClaim.
  - canUpdateClaimStage.
  - canVerifyDocument.
  - canRequestDocument.
  - canCommunicateWithCustomer.
  - canUpdateSettlement.
- Add server/database validation for critical status transitions.

### Data Model

Add or refine:

- `claim_assignments`.
- `claim_document_requests`.
- `claim_stage_events`.
- `claim_communications`.
- `claim_queries`.
- `claim_financials`.
- `claim_acceptances`.
- `claim_notifications`.

### App Structure

Create shared modules:

- `components/design-system`.
- `components/claim`.
- `components/dashboard`.
- `components/upload`.
- `components/charts`.
- `lib/permissions`.
- `lib/workflow`.
- `lib/claim-status-copy`.

### Testing

Add:

- Typecheck and lint in CI.
- Unit tests for permissions and workflow transitions.
- E2E smoke paths:
  - Customer reports accident.
  - Customer uploads documents.
  - OPS verifies documents.
  - OPS assigns surveyor.
  - OPS raises query.
  - Customer responds.
  - OPS records DO.
  - Customer accepts DO.
  - OPS uploads payment advice.
  - Claim completes.

## 7. Phased Delivery Plan

### Phase 1: Design System And Navigation

Outcome:

- New visual identity.
- New logo/app icon/splash direction.
- Role-specific app shells.
- Modern components and theme.

Build:

- Color tokens.
- Typography.
- Layout grid.
- Buttons, inputs, badges, cards, timelines.
- Role-specific bottom tabs.
- Animated loading and empty states.

### Phase 2: Customer App Redesign

Outcome:

- Customer app feels premium, clear, and claim-specific.

Build:

- New customer dashboard.
- Redesigned report accident flow.
- Dynamic document upload UI.
- Redesigned claim detail.
- Support/contact cards.
- Journey complete screen.

### Phase 3: OPS App Redesign

Outcome:

- Claim Processor and Field Executive can actually run claims.

Build:

- OPS dashboard queues.
- Claim command center.
- Document QC.
- Surveyor assignment.
- Insurer intimation tracking.
- Status movement.
- DO/payment entry.

### Phase 4: Agent App

Outcome:

- Agents can manage customer relationship and follow-ups.

Build:

- Assigned customer dashboard.
- Customer claim snapshots.
- Follow-up task list.
- Customer communication notes.
- Document follow-up reminders.

### Phase 5: Management App

Outcome:

- Managers and hierarchy users get read-focused oversight.

Build:

- Stage metrics.
- Pending amount reports.
- Downline filters.
- Escalation list.
- Read-only claim detail.

### Phase 6: IT App

Outcome:

- IT has a separate clean system-management experience.

Build:

- IT dashboard.
- User management.
- Organization tree.
- Role/access audit.
- Deactivation/reactivation flow.

### Phase 7: Production Hardening

Outcome:

- App is ready for beta/production testing.

Build:

- CI checks.
- E2E test flows.
- Upload retry and progress.
- Crash reporting.
- Analytics.
- Push/in-app notifications.
- Accessibility pass.
- Android build pipeline.

## 8. Priority Order

Recommended order:

1. Stabilize build tools.
2. Define new design system.
3. Implement role-specific navigation shells.
4. Redesign customer dashboard and claim detail.
5. Add dynamic document requests.
6. Build OPS claim command center.
7. Add Agent and Management experiences.
8. Separate IT system-management layout.
9. Add animations, graphics, logo, and polish pass.
10. Add production QA, analytics, notifications, and release pipeline.

## 9. Success Criteria

The app is production-polished when:

- Each role has a distinct home experience.
- Customer knows their next claim action immediately.
- OPS can process claims without leaving the app.
- Agent can track and support assigned customers.
- Management can view stage and financial bottlenecks.
- IT can manage users without touching claim workflows.
- UI feels modern, clean, vibrant, and branded.
- Claim flow matches the written process end-to-end.
- Lint, typecheck, and core E2E tests pass.
- Uploads, status transitions, and settlement updates are reliable and auditable.


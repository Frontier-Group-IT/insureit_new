# Claim Role Responsibility Model

Date: 2026-06-17

This document captures the role and hierarchy understanding that should guide the next claim-flow refinement. It is based on the current repo model plus the production claim-flow review.

## Current Departmental Hierarchy

The business hierarchy currently modeled in the repo is:

```text
Director
  -> Sales Head
    -> Zonal Head
      -> ASM
        -> Sales Manager
          -> Agent
            -> Customer
              -> Vehicles / Policies / Claims
```

Supporting roles outside the sales hierarchy:

- IT Super User
- Super Admin
- Admin
- Manager
- Claim Processor
- Field Executive
- Customer

Users are connected through `profiles.reporting_manager_id`.

Customers are assigned to agents through `customers.assigned_agent_id`.

Access to business data flows from customer access: if a user can access a customer, they can access that customer's vehicles, policies, claims, documents, claim history, and claim tasks.

## Current Repo Access Behavior

Current broad-access roles:

- Super Admin
- Admin
- IT Super User
- Director
- Manager
- Claim Processor
- Field Executive

Current hierarchy/downline access roles:

- Sales Head
- Zonal Head
- ASM
- Sales Manager
- Agent

Current customer access:

- Customer can access only their own linked customer record and related vehicles, policies, claims, documents, and claim history.

Important note: the current database policies are access policies, not a complete production responsibility model. They allow many users to read or sometimes update records if they can access the customer. For production, UI permissions and server-side transition rules should be stricter than plain RLS visibility.

## Intended Production Responsibility Model

### Customer

Primary responsibility:

- Report accident.
- Upload requested documents.
- View claim progress.
- View surveyor/OPS contact details.
- Respond to document queries.
- Accept DO amount.
- Upload payment receipt.
- View payment advice and journey completion.

Access level:

- Own records only.
- Can create own claim intake.
- Can upload documents requested for own claims.
- Can perform customer-specific actions such as DO acceptance.
- Cannot update claim status directly.
- Cannot assign surveyor, garage, OPS owner, or insurer contacts.
- Cannot verify documents.

### Agent

Primary responsibility:

- Customer relationship owner.
- Communicates with assigned customer.
- Helps customer understand required documents and claim progress.
- May assist with claim intake and document coordination.

Access level:

- View assigned customers and their vehicles, policies, claims, documents, and claim stages.
- Should be allowed to add customer-facing notes or communication logs.
- Should not approve claim stages unless explicitly designated as OPS.
- Should not verify documents unless given a document-QC permission.
- Should not assign surveyor or mark insurer/DO/payment milestones.

Production interpretation:

- The Agent is the natural customer communication role unless your operating model says Claim Processor/Field Executive communicates directly.

### Sales Manager / ASM / Zonal Head / Sales Head

Primary responsibility:

- Supervise downline agents and customer portfolios.
- View claim progress for customers under their hierarchy.
- Monitor bottlenecks and escalations.

Access level:

- View-only access to customer claims under their downline.
- View documents and stage history where business policy allows.
- Can see metrics and reports for their downline.
- Should not directly modify claim statuses, verify documents, assign surveyors, send insurer intimation, approve DO, or close claims unless separately granted an operational role.

Production interpretation:

- These are supervisory/view roles for claim stages.
- They should not be operational claim handlers by default.

### Director

Primary responsibility:

- Executive oversight.
- View business-wide claim volume, stage aging, pending amount, settlement performance, and escalations.

Access level:

- Broad view access.
- Should generally be read-only for claim workflow.
- Should not handle day-to-day claim actions.

Production interpretation:

- Director can view claim stages and reports across the business, excluding IT/admin-only user-management data.

### Claim Processor

Primary responsibility:

- Main claim handler / OPS claim owner.
- Owns insurer intimation and claim-stage movement.
- Coordinates document QC.
- Updates claim milestones.
- Captures insurer claim number, surveyor details, approval, RI, DO, payment advice, and settlement breakdown.

Access level:

- Create/update claim operational data.
- Request documents from customer.
- Verify/reject documents.
- Assign or record surveyor details.
- Send/record insurer communications.
- Move claim through valid workflow stages.
- Upload OPS-side documents.
- Record DO and payment advice details.

Production interpretation:

- This is the core operational role responsible for handling the claim.

### Field Executive

Primary responsibility:

- On-ground support.
- Collect documents physically.
- Coordinate survey/garage/vehicle readiness.
- Upload field documents and updates.

Access level:

- View assigned or accessible claims.
- Upload documents on behalf of customer/OPS.
- Add field notes.
- Mark field tasks complete.
- Should not finalize insurer communication, DO acceptance, settlement amount, or close claim unless specifically authorized.

Production interpretation:

- Field Executive supports the Claim Processor but should not own final claim decisions.

### Manager

Primary responsibility:

- OPS manager / claim operations supervisor.
- Monitors claim processors and field executives.
- Handles escalations and approvals.

Access level:

- Broad claim visibility.
- Can reassign claim ownership.
- Can override/approve certain operational transitions.
- Can review reports and bottlenecks.
- Can update claim statuses when supervising.

Production interpretation:

- Manager is not the default day-to-day communicator, but can supervise and intervene.

### Admin / Super Admin

Primary responsibility:

- Platform and business administration.
- Emergency correction capability.

Access level:

- Broad access.
- Can manage master data and correct records.
- Should not be the default role for ordinary claim handling.

Production interpretation:

- Administrative power should exist, but business workflows should still route normal claim actions to Claim Processor/Manager.

### IT Super User

Primary responsibility:

- User management and organization setup.
- Role assignment, reporting manager assignment, activation/deactivation.
- Technical support for access issues.

Access level:

- Manage profiles/users.
- View organization tree.
- Should not handle claim business workflow by default.
- Should not update claim stages, verify documents, or communicate claim decisions unless separately granted an operational role.

Production interpretation:

- IT Super User is technical administration, not claim operations.

## Who Communicates With Customer?

Recommended default:

- Agent is the customer relationship communicator.
- Claim Processor is the official claim-process communicator for operational claim updates.
- Field Executive communicates for on-ground/document collection tasks.
- Manager communicates only for escalation.

Customer-facing messages should show a clear owner:

- "Your Agent" for relationship/help.
- "Claim Handler" for claim status and document requirements.
- "Field Executive" for physical collection/survey/garage coordination.
- "Manager" for escalation.

## Who Handles The Claim?

Recommended default claim owner:

- Claim Processor.

Supporting users:

- Field Executive for field collection/garage/survey support.
- Agent for customer relationship and customer-side help.
- Manager for escalation, reassignment, and override.

Supervisory/view-only roles:

- Sales Manager.
- ASM.
- Zonal Head.
- Sales Head.
- Director.

Technical/admin roles:

- IT Super User manages users and hierarchy.
- Admin/Super Admin can administer the system but should not be relied on for normal claim handling.

## Permission Matrix

| Role | Customer communication | Claim handling | Document upload | Document QC | Status update | Surveyor/insurer details | DO/payment update | View claim stages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer | Own claim only | No | Own requested docs | No | No | View only | Accept/upload receipt | Own only |
| Agent | Yes, assigned customers | Assist only | Assist if allowed | No by default | No by default | View only | View only | Assigned/downline |
| Sales Manager | Escalation only | No by default | No by default | No | No | View only | View only | Downline |
| ASM | Escalation only | No | No | No | No | View only | View only | Downline |
| Zonal Head | Escalation only | No | No | No | No | View only | View only | Downline |
| Sales Head | Escalation only | No | No | No | No | View only | View only | Downline |
| Director | Executive only | No | No | No | No | View only | View only | Broad view |
| Claim Processor | Yes, official claim updates | Yes | Yes | Yes | Yes | Yes | Yes | Broad/assigned |
| Field Executive | Field coordination | Support | Yes | Limited/no | Task updates only | Field updates | No by default | Assigned/broad per policy |
| Manager | Escalation | Supervise | Yes | Yes | Yes/override | Yes/override | Yes/override | Broad |
| Admin | Admin support | Exceptional | Yes | Exceptional | Exceptional | Exceptional | Exceptional | Broad |
| Super Admin | Admin support | Exceptional | Yes | Exceptional | Exceptional | Exceptional | Exceptional | Broad |
| IT Super User | Access support only | No | No | No | No | No | No | Technical/broad if policy allows |

## Implementation Implication

The next refinement should separate:

1. Data visibility: who can see claim/customer records.
2. Workflow authority: who can move stages or update financial/insurer data.
3. Customer communication authority: who appears as customer contact.
4. Technical administration: who manages users/roles.

Current RLS mainly controls data visibility. Production still needs explicit app/server rules for workflow authority.


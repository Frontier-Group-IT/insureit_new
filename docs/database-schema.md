# Database Schema

The initial schema is implemented in `supabase/migrations/202606090001_initial_claimbridge_schema.sql`.

## Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Supabase Auth user profile and application role. |
| `customers` | Customer and fleet owner records. |
| `vehicles` | Commercial vehicle details linked to customers. |
| `policies` | Insurance policies linked to customers, vehicles, and insurers. |
| `claims` | Claim assistance case files and current status. |
| `claim_documents` | Private document metadata for uploaded claim files. |
| `claim_status_history` | Timeline of claim status transitions. |
| `claim_tasks` | Follow-up tasks for operations users. |
| `insurance_companies` | Insurer master data. |
| `garages` | Repair garage master data. |
| `surveyors` | Surveyor master data. |
| `notifications` | In-app notification records. |
| `audit_logs` | Audit trail for important changes. |

## Important indexes

The migration adds indexes for high-traffic lookups:

- `claims.claim_no`
- `vehicles.vehicle_no`
- `policies.policy_no`
- `claims.customer_id`
- `claims.current_status`
- Supporting foreign-key indexes for claim documents, tasks, notifications, and audit logs.

## Auth profile creation

The migration creates an `auth.users` trigger that inserts a matching `profiles` row when a Supabase Auth user is created. The role is read from Auth metadata when available and defaults to `customer`.

## Row Level Security

RLS is enabled on all application tables. Policies are scoped to authenticated users and separate internal operations roles from customer read/upload use cases.

Internal operations roles are:

- `super_admin`
- `admin`
- `manager`
- `claim_processor`
- `field_executive`

Customers can read their own customer-linked vehicles, policies, claims, documents, and claim history. Customer writes are limited to claim document metadata inserts in this first schema version.

## Storage

A private Supabase Storage bucket named `claim-documents` is created. Files should be stored with paths that can be matched to `claim_documents.storage_path` for authorization checks.

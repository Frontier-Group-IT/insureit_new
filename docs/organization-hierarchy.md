# InsureIt Organization Hierarchy

## Roles

Business hierarchy:

Director -> Sales Head -> Zonal Head -> ASM -> Sales Manager -> Agent -> Customer -> Vehicles

IT Super User is separate from the sales hierarchy. IT Super User can view and manage organization user profile records, assign roles, assign reporting managers, deactivate/reactivate users, and view the full organization tree.

Legacy operational roles remain supported: `admin`, `super_admin`, `manager`, `claim_processor`, and `field_executive`.

## Access Rules

Profiles are connected through `profiles.reporting_manager_id`.

Customers can be assigned to agents through `customers.assigned_agent_id`.

Business data access flows from customer access:

- If a user can access a customer, they can access that customer's vehicles, policies, claims, documents, claim history, and claim tasks.
- Customers can only access their own linked customer row and related records.
- Agents can access assigned customers.
- Sales Managers, ASMs, Zonal Heads, and Sales Heads access data under their downline.
- Directors, Admins, Super Admins, IT Super Users, and legacy operations roles keep broad business visibility.

## Safe User Management

The web and mobile user-management screens create users through the `create-user` Supabase Edge Function.

The service role key is used only inside the Edge Function. It is not exposed in frontend or mobile code.

Required Edge Function environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Only active `it_super_user`, `admin`, and `super_admin` callers can create users.

Default deletion behavior is safe deactivation using `profiles.is_active = false`.

## Screens Added

Web:

- `/users` for IT Super User, Admin, and Super Admin.
- `/organization` for IT Super User, Admin, Super Admin, Director, Sales Head, Zonal Head, ASM, and Sales Manager.
- `supabase/functions/create-user` creates the Supabase Auth user and matching profile record.

Mobile:

- `/it/dashboard` for IT Super User, Admin, and Super Admin profile management.

## Manual Testing Checklist

Database/RLS:

- IT Super User can see all profiles.
- Director can see business hierarchy data.
- Sales Head, Zonal Head, ASM, and Sales Manager can see only downline data.
- Agent can see assigned customers only.
- Customer can see only own data.
- Claim document storage remains private.

Web:

- IT Super User opens Users page.
- IT Super User creates login users, edits profile records, and deactivates/reactivates users.
- IT Super User opens Organization Tree.
- Restricted hierarchy users cannot see unrelated records.

Mobile:

- IT Super User logs in and opens IT dashboard.
- IT Super User can edit and deactivate profile records.
- Staff hierarchy users route to staff dashboard.
- Customer dashboard, report accident, upload documents, and signed document access still work.

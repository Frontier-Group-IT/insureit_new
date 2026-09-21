-- Add the Sales Executive internal staff role.
--
-- Sales Executive is intentionally minimal:
-- - Policy Register: read-only, scoped in application code to final policies
--   originating from Policy Intakes submitted by the same profile.
-- - Policy Intake: view/create own intakes.
-- - No direct Add Policy, External Policy, Vehicle, Customer, Claims, Reports,
--   Accounts, Administration, Dashboard or intermediary workspace permission.
--
-- PostgreSQL enum values must exist before employee invitations can persist the
-- new profile role.

alter type public.app_role add value if not exists 'sales_executive';

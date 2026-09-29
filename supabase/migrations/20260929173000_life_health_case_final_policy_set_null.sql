-- Preserve Life/Health case audit history when an IT Super User permanently
-- deletes the policy created from that case.
--
-- The case remains intact; only its pointer to the deleted policy is cleared.
-- Other policy dependencies (claims, reconciliation, invoice lines, partner
-- payables, policy intakes, etc.) retain their existing delete protections.

alter table public.life_health_cases
  drop constraint if exists life_health_cases_final_policy_id_fkey;

alter table public.life_health_cases
  add constraint life_health_cases_final_policy_id_fkey
  foreign key (final_policy_id)
  references public.policies(id)
  on delete set null;

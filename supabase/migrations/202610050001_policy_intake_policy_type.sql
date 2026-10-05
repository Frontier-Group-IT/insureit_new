alter table public.policy_intake_requests
  add column if not exists policy_type text;

alter table public.policy_intake_requests
  drop constraint if exists policy_intake_requests_policy_type_check;

alter table public.policy_intake_requests
  add constraint policy_intake_requests_policy_type_check
  check (policy_type is null or policy_type in ('motor', 'non_motor', 'life', 'health'));

comment on column public.policy_intake_requests.policy_type is
  'Policy intake category. Nullable for historical records; new intakes use motor, non_motor, life, or health.';

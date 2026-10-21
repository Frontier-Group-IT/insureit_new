-- Allow claim intimation without a recorded insurance policy.
-- Keep the exactly-one-source rule whenever a policy association exists.
-- Policy-less drafts must remain under manual coverage verification.
begin;
alter table public.claims drop constraint if exists claims_exactly_one_policy_source;
alter table public.claims add constraint claims_at_most_one_policy_source
  check (not (policy_id is not null and external_policy_id is not null));
comment on constraint claims_at_most_one_policy_source on public.claims
  is 'Permits policy-less claim intimation; prevents simultaneous internal and external policy associations. Coverage must be verified before approval.';
commit;

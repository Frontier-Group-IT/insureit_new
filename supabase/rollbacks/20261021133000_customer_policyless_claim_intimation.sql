-- WARNING: Only run if no policy-less claims remain, otherwise this constraint will fail.
begin;
drop trigger if exists prevent_duplicate_active_policyless_claim_insert on public.claims;
drop function if exists public.prevent_duplicate_active_policyless_claim_insert();
alter table public.claims drop constraint if exists claims_at_most_one_policy_source;
alter table public.claims add constraint claims_exactly_one_policy_source check (((policy_id is not null) and (external_policy_id is null)) or ((policy_id is null) and (external_policy_id is not null)));
commit;

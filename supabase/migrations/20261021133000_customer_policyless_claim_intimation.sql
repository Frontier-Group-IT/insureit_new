-- Allow claim intimation without a recorded insurance policy.
-- Keep the exactly-one-source rule whenever a policy association exists.
-- Policy-less drafts must remain under manual coverage verification.
begin;
alter table public.claims drop constraint if exists claims_exactly_one_policy_source;
alter table public.claims add constraint claims_at_most_one_policy_source
  check (not (policy_id is not null and external_policy_id is not null));
comment on constraint claims_at_most_one_policy_source on public.claims
  is 'Permits policy-less claim intimation; prevents simultaneous internal and external policy associations. Coverage must be verified before approval.';

-- Serialize policy-less claim creation by vehicle, preserving the same
-- one-open-claim behavior as the existing internal/external policy triggers.
create or replace function public.prevent_duplicate_active_policyless_claim_insert()
returns trigger language plpgsql security definer set search_path = public as $
begin
  if new.policy_id is not null or new.external_policy_id is not null or new.vehicle_id is null then return new; end if;
  if coalesce(new.current_status::text, '') in ('Settled', 'Closed', 'Claim Complete', 'Rejected') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('policyless:' || new.vehicle_id::text, 0));
  if exists (
    select 1 from public.claims existing
    where existing.vehicle_id = new.vehicle_id
      and existing.customer_id = new.customer_id
      and existing.policy_id is null
      and existing.external_policy_id is null
      and coalesce(existing.current_status::text, '') not in ('Settled', 'Closed', 'Claim Complete', 'Rejected')
  ) then
    raise exception 'A claim is already in progress for this vehicle without a linked policy.' using errcode = 'P0001';
  end if;
  return new;
end;
$;
drop trigger if exists prevent_duplicate_active_policyless_claim_insert on public.claims;
create trigger prevent_duplicate_active_policyless_claim_insert before insert on public.claims
for each row execute function public.prevent_duplicate_active_policyless_claim_insert();
commit;

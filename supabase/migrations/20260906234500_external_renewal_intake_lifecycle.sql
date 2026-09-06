begin;

create or replace function public.sync_external_renewal_from_policy_intake()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.final_policy_id is null then
    return new;
  end if;

  if old.final_policy_id is not distinct from new.final_policy_id then
    return new;
  end if;

  update public.external_renewal_opportunities o
  set
    opportunity_status = 'won',
    next_follow_up_at = null,
    updated_at = now()
  from public.external_renewal_policy_intake_links l
  where l.intake_id = new.id
    and l.opportunity_id = o.id
    and l.partner_id = o.partner_id
    and o.is_active
    and o.opportunity_status <> 'duplicate';

  return new;
end;
$$;

revoke all on function public.sync_external_renewal_from_policy_intake() from public, anon, authenticated;
grant execute on function public.sync_external_renewal_from_policy_intake() to service_role;

drop trigger if exists sync_external_renewal_from_policy_intake_trigger on public.policy_intake_requests;
create trigger sync_external_renewal_from_policy_intake_trigger
after update of final_policy_id on public.policy_intake_requests
for each row
when (new.final_policy_id is not null and old.final_policy_id is distinct from new.final_policy_id)
execute function public.sync_external_renewal_from_policy_intake();

update public.external_renewal_opportunities o
set
  opportunity_status = 'won',
  next_follow_up_at = null,
  updated_at = now()
from public.external_renewal_policy_intake_links l
join public.policy_intake_requests i on i.id = l.intake_id
where l.opportunity_id = o.id
  and l.partner_id = o.partner_id
  and i.final_policy_id is not null
  and o.is_active
  and o.opportunity_status <> 'duplicate'
  and o.opportunity_status <> 'won';

commit;

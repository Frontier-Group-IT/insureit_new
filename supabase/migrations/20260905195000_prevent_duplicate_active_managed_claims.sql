create or replace function public.prevent_duplicate_active_managed_claim_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.policy_id is null then
    return new;
  end if;

  if coalesce(new.current_status, '') in ('Settled', 'Closed', 'Claim Complete') then
    return new;
  end if;

  -- Serialize claim creation for the same policy so rapid/repeated submits cannot race.
  perform pg_advisory_xact_lock(hashtextextended(new.policy_id::text, 0));

  if exists (
    select 1
    from public.claims existing
    where existing.policy_id = new.policy_id
      and coalesce(existing.current_status, '') not in ('Settled', 'Closed', 'Claim Complete')
  ) then
    raise exception 'Claim already in progress for this policy.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_active_managed_claim_insert on public.claims;

create trigger prevent_duplicate_active_managed_claim_insert
before insert on public.claims
for each row
execute function public.prevent_duplicate_active_managed_claim_insert();

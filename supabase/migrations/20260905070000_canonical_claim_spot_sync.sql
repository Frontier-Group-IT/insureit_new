-- Canonicalize the current Spot Intimation timestamps on the claims row.
-- claim_stage_details / claim_milestones remain audit/history sources.

alter table public.claims
  add column if not exists spot_intimation_at timestamptz;

-- Backfill canonical Spot Intimation timestamps from the latest internal stage history.
with latest_stage as (
  select distinct on (claim_id)
    claim_id,
    nullif(details->>'spot_intimation_at', '')::timestamptz as spot_intimation_at
  from public.claim_stage_details
  where nullif(details->>'spot_intimation_at', '') is not null
  order by claim_id, created_at desc
)
update public.claims as c
set spot_intimation_at = latest_stage.spot_intimation_at
from latest_stage
where c.id = latest_stage.claim_id
  and c.spot_intimation_at is null;

-- Backfill self-managed claims from the canonical Spot Intimation milestone when needed.
with latest_milestone as (
  select distinct on (claim_id)
    claim_id,
    nullif(details->>'spot_intimation_at', '')::timestamptz as spot_intimation_at
  from public.claim_milestones
  where milestone_key = 'spot_intimation'
    and nullif(details->>'spot_intimation_at', '') is not null
  order by claim_id, coalesce(completed_at, created_at) desc
)
update public.claims as c
set spot_intimation_at = latest_milestone.spot_intimation_at
from latest_milestone
where c.id = latest_milestone.claim_id
  and c.spot_intimation_at is null;

-- User-confirmed correction for SIBL/1012.
-- 03 Sep 2026 19:00 IST = 2026-09-03 13:30:00+00.
update public.claims
set accident_at = '2026-09-03 13:30:00+00'::timestamptz
where claim_no = 'SIBL/1012'
  and accident_at is distinct from '2026-09-03 13:30:00+00'::timestamptz;

create or replace function public.sync_claim_spot_from_stage_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incident_at timestamptz;
  v_spot_intimation_at timestamptz;
  v_location text;
begin
  if new.details is null then
    return new;
  end if;

  if coalesce(new.details->>'milestone_key', '') <> 'spot_intimation'
     and not (new.details ? 'incident_at')
     and not (new.details ? 'accident_at')
     and not (new.details ? 'spot_intimation_at') then
    return new;
  end if;

  begin
    v_incident_at := coalesce(
      nullif(new.details->>'incident_at', '')::timestamptz,
      nullif(new.details->>'accident_at', '')::timestamptz
    );
  exception when others then
    v_incident_at := null;
  end;

  begin
    v_spot_intimation_at := nullif(new.details->>'spot_intimation_at', '')::timestamptz;
  exception when others then
    v_spot_intimation_at := null;
  end;

  v_location := coalesce(
    nullif(new.details->>'location', ''),
    nullif(new.details->>'accident_location', '')
  );

  update public.claims
  set
    accident_at = coalesce(v_incident_at, accident_at),
    spot_intimation_at = coalesce(v_spot_intimation_at, spot_intimation_at),
    accident_location = coalesce(v_location, accident_location)
  where id = new.claim_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_claim_spot_from_stage_details on public.claim_stage_details;
create trigger trg_sync_claim_spot_from_stage_details
after insert or update of details on public.claim_stage_details
for each row
execute function public.sync_claim_spot_from_stage_details();

create or replace function public.sync_claim_spot_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incident_at timestamptz;
  v_spot_intimation_at timestamptz;
  v_location text;
begin
  if new.milestone_key <> 'spot_intimation' or new.details is null then
    return new;
  end if;

  begin
    v_incident_at := coalesce(
      nullif(new.details->>'incident_at', '')::timestamptz,
      nullif(new.details->>'accident_at', '')::timestamptz
    );
  exception when others then
    v_incident_at := null;
  end;

  begin
    v_spot_intimation_at := nullif(new.details->>'spot_intimation_at', '')::timestamptz;
  exception when others then
    v_spot_intimation_at := null;
  end;

  v_location := coalesce(
    nullif(new.details->>'location', ''),
    nullif(new.details->>'accident_location', '')
  );

  update public.claims
  set
    accident_at = coalesce(v_incident_at, accident_at),
    spot_intimation_at = coalesce(v_spot_intimation_at, spot_intimation_at),
    accident_location = coalesce(v_location, accident_location)
  where id = new.claim_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_claim_spot_from_milestone on public.claim_milestones;
create trigger trg_sync_claim_spot_from_milestone
after insert or update of details on public.claim_milestones
for each row
execute function public.sync_claim_spot_from_milestone();

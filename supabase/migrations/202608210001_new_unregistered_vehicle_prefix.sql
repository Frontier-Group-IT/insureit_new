begin;

-- Safety preflight: every registration-pending vehicle must have a usable chassis,
-- and every NEW-<chassis> target must be unique before any row is changed.
do $$
declare
  v_missing bigint;
  v_duplicate_targets bigint;
  v_existing_target_conflicts bigint;
begin
  select count(*)
    into v_missing
  from public.vehicles v
  where v.registration_status = 'registration_pending'
    and regexp_replace(upper(coalesce(v.chassis_no, '')), '[^A-Z0-9]', '', 'g') = '';

  if v_missing > 0 then
    raise exception 'NEW vehicle prefix migration aborted: % registration-pending vehicle(s) have no usable chassis number.', v_missing;
  end if;

  select count(*)
    into v_duplicate_targets
  from (
    select regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g') as chassis_key
    from public.vehicles v
    where v.registration_status = 'registration_pending'
    group by 1
    having count(*) > 1
  ) duplicates;

  if v_duplicate_targets > 0 then
    raise exception 'NEW vehicle prefix migration aborted: % duplicate normalized chassis target(s) exist.', v_duplicate_targets;
  end if;

  select count(*)
    into v_existing_target_conflicts
  from public.vehicles pending
  join public.vehicles other
    on other.id <> pending.id
   and other.vehicle_no = 'NEW-' || regexp_replace(upper(pending.chassis_no), '[^A-Z0-9]', '', 'g')
  where pending.registration_status = 'registration_pending';

  if v_existing_target_conflicts > 0 then
    raise exception 'NEW vehicle prefix migration aborted: % NEW-<chassis> target vehicle number(s) are already in use.', v_existing_target_conflicts;
  end if;
end;
$$;

-- Keep the canonical temporary vehicle number synchronized to the current chassis.
-- registration_status is authoritative; PENDING-/NEW- recognition is retained only
-- for safe transition/repair of legacy rows.
create or replace function public.sync_pending_vehicle_no_from_chassis()
returns trigger
language plpgsql
as $$
declare
  normalized_chassis text;
begin
  if new.registration_status = 'registration_pending'
     or coalesce(new.vehicle_no, '') like 'PENDING-%'
     or coalesce(new.vehicle_no, '') like 'NEW-%' then
    normalized_chassis := regexp_replace(upper(coalesce(new.chassis_no, '')), '[^A-Z0-9]', '', 'g');

    if normalized_chassis <> '' then
      new.vehicle_no := 'NEW-' || normalized_chassis;
      new.vehicle_no_normalized := null;
    end if;
  end if;

  return new;
end;
$$;

-- Change only the vehicle-specific temporary identifier inside the existing policy
-- onboarding RPC. This intentionally does not touch unrelated Partner/POSP/MISP
-- PENDING-* identities.
do $$
declare
  v_definition text;
  v_old text := 'v_vehicle_reference := case when v_unregistered then ''PENDING-'' || left(v_chassis, 20) else v_registration end;';
  v_new text := 'v_vehicle_reference := case when v_unregistered then ''NEW-'' || left(v_chassis, 20) else v_registration end;';
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure)
    into v_definition;

  if position(v_new in v_definition) > 0 then
    null;
  elsif position(v_old in v_definition) > 0 then
    execute replace(v_definition, v_old, v_new);
  else
    raise exception 'NEW vehicle prefix migration aborted: expected onboard_motor_policy vehicle-reference statement was not found.';
  end if;
end;
$$;

-- Backfill from the authoritative current chassis, not by replacing the old prefix.
update public.vehicles v
set vehicle_no = 'NEW-' || regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g'),
    vehicle_no_normalized = null,
    updated_at = now()
where v.registration_status = 'registration_pending';

-- In-transaction assertions: if any invariant fails, the entire migration rolls back.
do $$
declare
  v_pending bigint;
  v_new bigint;
  v_old bigint;
  v_mismatch bigint;
begin
  select count(*) into v_pending
  from public.vehicles
  where registration_status = 'registration_pending';

  select count(*) into v_new
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no like 'NEW-%';

  select count(*) into v_old
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no like 'PENDING-%';

  select count(*) into v_mismatch
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no is distinct from 'NEW-' || regexp_replace(upper(chassis_no), '[^A-Z0-9]', '', 'g');

  if v_new <> v_pending or v_old <> 0 or v_mismatch <> 0 then
    raise exception 'NEW vehicle prefix migration verification failed: pending=%, new=%, old=%, mismatch=%', v_pending, v_new, v_old, v_mismatch;
  end if;
end;
$$;

commit;

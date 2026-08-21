begin;

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
      new.vehicle_no := 'PENDING-' || normalized_chassis;
      new.vehicle_no_normalized := null;
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  v_definition text;
  v_new text := 'v_vehicle_reference := case when v_unregistered then ''NEW-'' || left(v_chassis, 20) else v_registration end;';
  v_old text := 'v_vehicle_reference := case when v_unregistered then ''PENDING-'' || left(v_chassis, 20) else v_registration end;';
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure)
    into v_definition;

  if position(v_old in v_definition) > 0 then
    null;
  elsif position(v_new in v_definition) > 0 then
    execute replace(v_definition, v_new, v_old);
  else
    raise exception 'Rollback aborted: expected onboard_motor_policy vehicle-reference statement was not found.';
  end if;
end;
$$;

update public.vehicles v
set vehicle_no = 'PENDING-' || regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g'),
    vehicle_no_normalized = null,
    updated_at = now()
where v.registration_status = 'registration_pending';

do $$
declare
  v_pending bigint;
  v_pending_prefix bigint;
  v_new_prefix bigint;
  v_mismatch bigint;
begin
  select count(*) into v_pending
  from public.vehicles
  where registration_status = 'registration_pending';

  select count(*) into v_pending_prefix
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no like 'PENDING-%';

  select count(*) into v_new_prefix
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no like 'NEW-%';

  select count(*) into v_mismatch
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no is distinct from 'PENDING-' || regexp_replace(upper(chassis_no), '[^A-Z0-9]', '', 'g');

  if v_pending_prefix <> v_pending or v_new_prefix <> 0 or v_mismatch <> 0 then
    raise exception 'Rollback verification failed: pending=%, pending_prefix=%, new_prefix=%, mismatch=%', v_pending, v_pending_prefix, v_new_prefix, v_mismatch;
  end if;
end;
$$;

commit;

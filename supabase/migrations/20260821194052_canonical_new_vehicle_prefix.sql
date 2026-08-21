begin;

-- NEW-<normalized chassis> is the canonical internal identifier for vehicles
-- whose permanent registration number has not been issued.
do $$
declare
  v_missing bigint;
  v_duplicate_targets bigint;
  v_existing_target_conflicts bigint;
begin
  select count(*)
    into v_missing
  from public.vehicles vehicle
  where (
      vehicle.registration_status = 'registration_pending'
      or vehicle.vehicle_no like 'PENDING-%'
      or vehicle.vehicle_no like 'NEW-%'
    )
    and regexp_replace(upper(coalesce(vehicle.chassis_no, '')), '[^A-Z0-9]', '', 'g') = '';

  if v_missing > 0 then
    raise exception 'Canonical NEW vehicle migration aborted: % temporary vehicle(s) have no usable chassis number.', v_missing;
  end if;

  select count(*)
    into v_duplicate_targets
  from (
    select regexp_replace(upper(vehicle.chassis_no), '[^A-Z0-9]', '', 'g') as chassis_key
    from public.vehicles vehicle
    where vehicle.registration_status = 'registration_pending'
      or vehicle.vehicle_no like 'PENDING-%'
      or vehicle.vehicle_no like 'NEW-%'
    group by 1
    having count(*) > 1
  ) duplicate_chassis;

  if v_duplicate_targets > 0 then
    raise exception 'Canonical NEW vehicle migration aborted: % duplicate normalized chassis target(s) exist.', v_duplicate_targets;
  end if;

  select count(*)
    into v_existing_target_conflicts
  from public.vehicles temporary_vehicle
  join public.vehicles other
    on other.id <> temporary_vehicle.id
   and other.vehicle_no = 'NEW-' || regexp_replace(upper(temporary_vehicle.chassis_no), '[^A-Z0-9]', '', 'g')
  where temporary_vehicle.registration_status = 'registration_pending'
     or temporary_vehicle.vehicle_no like 'PENDING-%'
     or temporary_vehicle.vehicle_no like 'NEW-%';

  if v_existing_target_conflicts > 0 then
    raise exception 'Canonical NEW vehicle migration aborted: % NEW-<chassis> target(s) are already used by another vehicle.', v_existing_target_conflicts;
  end if;
end;
$$;

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

drop trigger if exists vehicles_sync_pending_vehicle_no_from_chassis on public.vehicles;

create trigger vehicles_sync_pending_vehicle_no_from_chassis
before insert or update of chassis_no, registration_status, vehicle_no
on public.vehicles
for each row
execute function public.sync_pending_vehicle_no_from_chassis();

-- Keep the onboarding RPC aligned even if the later PENDING migration was applied.
do $$
declare
  v_definition text;
  v_pending_statement text := 'v_vehicle_reference := case when v_unregistered then ''PENDING-'' || left(v_chassis, 20) else v_registration end;';
  v_new_statement text := 'v_vehicle_reference := case when v_unregistered then ''NEW-'' || left(v_chassis, 20) else v_registration end;';
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure)
    into v_definition;

  if position(v_new_statement in v_definition) > 0 then
    null;
  elsif position(v_pending_statement in v_definition) > 0 then
    execute replace(v_definition, v_pending_statement, v_new_statement);
  else
    raise exception 'Canonical NEW vehicle migration aborted: onboarding vehicle-reference statement was not found.';
  end if;
end;
$$;

update public.vehicles vehicle
set vehicle_no = 'NEW-' || regexp_replace(upper(vehicle.chassis_no), '[^A-Z0-9]', '', 'g'),
    vehicle_no_normalized = null,
    registration_status = 'registration_pending',
    updated_at = now()
where vehicle.registration_status = 'registration_pending'
   or vehicle.vehicle_no like 'PENDING-%'
   or vehicle.vehicle_no like 'NEW-%';

do $$
declare
  v_temporary bigint;
  v_new bigint;
  v_pending bigint;
  v_mismatch bigint;
begin
  select count(*) into v_temporary
  from public.vehicles
  where registration_status = 'registration_pending';

  select count(*) into v_new
  from public.vehicles
  where registration_status = 'registration_pending'
    and vehicle_no like 'NEW-%';

  select count(*) into v_pending
  from public.vehicles
  where vehicle_no like 'PENDING-%';

  select count(*) into v_mismatch
  from public.vehicles
  where registration_status = 'registration_pending'
    and (
      vehicle_no is distinct from 'NEW-' || regexp_replace(upper(chassis_no), '[^A-Z0-9]', '', 'g')
      or vehicle_no_normalized is not null
    );

  if v_new <> v_temporary or v_pending <> 0 or v_mismatch <> 0 then
    raise exception 'Canonical NEW vehicle verification failed: temporary=%, new=%, pending_prefix=%, mismatch=%',
      v_temporary, v_new, v_pending, v_mismatch;
  end if;
end;
$$;

comment on function public.sync_pending_vehicle_no_from_chassis() is
  'Keeps registration-pending vehicle identity canonical as NEW-<normalized chassis>; PENDING- is accepted only as a legacy transition input.';

commit;

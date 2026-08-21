-- Keep registration-pending vehicle identity aligned with its current chassis number.
-- A pending vehicle is identified internally as PENDING-<normalized chassis>.

create or replace function public.sync_pending_vehicle_no_from_chassis()
returns trigger
language plpgsql
as $$
declare
  normalized_chassis text;
begin
  if new.registration_status = 'registration_pending'
     or coalesce(new.vehicle_no, '') like 'PENDING-%' then
    normalized_chassis := regexp_replace(upper(coalesce(new.chassis_no, '')), '[^A-Z0-9]', '', 'g');

    if normalized_chassis <> '' then
      new.vehicle_no := 'PENDING-' || normalized_chassis;
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

-- Repair existing stale registration-pending identifiers where the current
-- normalized chassis implies a different PENDING-* vehicle number.
update public.vehicles v
set vehicle_no = 'PENDING-' || regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g'),
    updated_at = now()
where (v.registration_status = 'registration_pending' or v.vehicle_no like 'PENDING-%')
  and nullif(regexp_replace(upper(coalesce(v.chassis_no, '')), '[^A-Z0-9]', '', 'g'), '') is not null
  and v.vehicle_no <> 'PENDING-' || regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g')
  and not exists (
    select 1
    from public.vehicles other
    where other.id <> v.id
      and other.vehicle_no = 'PENDING-' || regexp_replace(upper(v.chassis_no), '[^A-Z0-9]', '', 'g')
  );

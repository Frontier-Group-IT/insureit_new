-- No stale registration-pending vehicle identifiers should remain.
select id, vehicle_no, chassis_no, registration_status
from public.vehicles
where (registration_status = 'registration_pending' or vehicle_no like 'PENDING-%')
  and nullif(regexp_replace(upper(coalesce(chassis_no, '')), '[^A-Z0-9]', '', 'g'), '') is not null
  and vehicle_no <> 'PENDING-' || regexp_replace(upper(chassis_no), '[^A-Z0-9]', '', 'g');

-- The trigger must exist and be enabled.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.vehicles'::regclass
  and tgname = 'vehicles_sync_pending_vehicle_no_from_chassis';

-- Post-deploy verification for NEW-<normalized chassis> temporary vehicle numbers.

select
  count(*) filter (where registration_status = 'registration_pending') as registration_pending_count,
  count(*) filter (where registration_status = 'registration_pending' and vehicle_no like 'NEW-%') as new_prefix_count,
  count(*) filter (where registration_status = 'registration_pending' and vehicle_no like 'PENDING-%') as old_prefix_count,
  count(*) filter (
    where registration_status = 'registration_pending'
      and vehicle_no is distinct from 'NEW-' || regexp_replace(upper(chassis_no), '[^A-Z0-9]', '', 'g')
  ) as mismatch_count,
  count(*) filter (
    where registration_status = 'registration_pending'
      and coalesce(vehicle_no_normalized, '') <> ''
  ) as pending_with_normalized_vehicle_no
from public.vehicles;

select vehicle_no, count(*) as duplicate_count
from public.vehicles
group by vehicle_no
having count(*) > 1;

select upper(chassis_no) as chassis_no, count(*) as duplicate_count
from public.vehicles
where chassis_no is not null and btrim(chassis_no) <> ''
group by upper(chassis_no)
having count(*) > 1;

select count(*) as broken_policy_vehicle_links
from public.policies p
left join public.vehicles v on v.id = p.vehicle_id
where p.vehicle_id is not null and v.id is null;

select count(*) as broken_claim_vehicle_links
from public.claims c
left join public.vehicles v on v.id = c.vehicle_id
where c.vehicle_id is not null and v.id is null;

select
  position('v_vehicle_reference := case when v_unregistered then ''NEW-'' || left(v_chassis, 20) else v_registration end;' in pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure)) > 0
  as onboarding_uses_new_prefix,
  position('new.vehicle_no := ''NEW-'' || normalized_chassis;' in pg_get_functiondef('public.sync_pending_vehicle_no_from_chassis()'::regprocedure)) > 0
  as chassis_sync_uses_new_prefix;

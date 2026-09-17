-- Keep the canonical vehicle class fields synchronized across all write paths.
-- vehicle_type is the current source of truth used by Vehicle edit/onboarding.

create or replace function public.sync_vehicle_class_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vehicle_type is null then
    return new;
  end if;

  new.vehicle_class_code := new.vehicle_type;
  new.vehicle_class_description := case new.vehicle_type
    when 'TWP' then 'Two Wheeler'
    when 'PCP' then 'Private Car'
    when 'PCV' then 'Passenger Carrying Vehicle'
    when 'GCV' then 'Goods Carrying Vehicle'
    when 'CPM' then 'Contractor Plant & Machinery'
    when 'MISD' then 'Miscellaneous Vehicle'
    else new.vehicle_class_description
  end;

  return new;
end;
$$;

drop trigger if exists sync_vehicle_class_fields_trigger on public.vehicles;
create trigger sync_vehicle_class_fields_trigger
before insert or update of vehicle_type on public.vehicles
for each row
execute function public.sync_vehicle_class_fields();

-- Repair existing records where Vehicle edit/onboarding updated vehicle_type but
-- older class metadata remained stale or null. This keeps Policy pages that read
-- vehicle_class_code consistent with the Vehicle master immediately after apply.
update public.vehicles
set
  vehicle_class_code = vehicle_type,
  vehicle_class_description = case vehicle_type
    when 'TWP' then 'Two Wheeler'
    when 'PCP' then 'Private Car'
    when 'PCV' then 'Passenger Carrying Vehicle'
    when 'GCV' then 'Goods Carrying Vehicle'
    when 'CPM' then 'Contractor Plant & Machinery'
    when 'MISD' then 'Miscellaneous Vehicle'
    else vehicle_class_description
  end
where vehicle_type in ('TWP', 'PCP', 'PCV', 'GCV', 'CPM', 'MISD')
  and (
    vehicle_class_code is distinct from vehicle_type
    or vehicle_class_description is distinct from case vehicle_type
      when 'TWP' then 'Two Wheeler'
      when 'PCP' then 'Private Car'
      when 'PCV' then 'Passenger Carrying Vehicle'
      when 'GCV' then 'Goods Carrying Vehicle'
      when 'CPM' then 'Contractor Plant & Machinery'
      when 'MISD' then 'Miscellaneous Vehicle'
      else vehicle_class_description
    end
  );

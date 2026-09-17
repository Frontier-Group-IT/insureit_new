do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'sync_vehicle_class_fields_trigger'
      and tgrelid = 'public.vehicles'::regclass
      and not tgisinternal
  ) then
    raise exception 'sync_vehicle_class_fields_trigger is missing';
  end if;

  if exists (
    select 1
    from public.vehicles
    where vehicle_type in ('TWP', 'PCP', 'PCV', 'GCV', 'CPM', 'MISD')
      and vehicle_class_code is distinct from vehicle_type
  ) then
    raise exception 'vehicles still contain mismatched vehicle_type and vehicle_class_code values';
  end if;

  if exists (
    select 1
    from public.vehicles
    where vehicle_type in ('TWP', 'PCP', 'PCV', 'GCV', 'CPM', 'MISD')
      and vehicle_class_description is distinct from case vehicle_type
        when 'TWP' then 'Two Wheeler'
        when 'PCP' then 'Private Car'
        when 'PCV' then 'Passenger Carrying Vehicle'
        when 'GCV' then 'Goods Carrying Vehicle'
        when 'CPM' then 'Contractor Plant & Machinery'
        when 'MISD' then 'Miscellaneous Vehicle'
      end
  ) then
    raise exception 'vehicles still contain mismatched vehicle class descriptions';
  end if;
end;
$$;

select
  count(*) filter (where vehicle_type = vehicle_class_code) as synchronized_rows,
  count(*) filter (where vehicle_type is distinct from vehicle_class_code) as mismatched_rows
from public.vehicles
where vehicle_type in ('TWP', 'PCP', 'PCV', 'GCV', 'CPM', 'MISD');

create or replace function public.enforce_single_active_policy_per_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_current_active boolean;
  has_date_overlap boolean;
  policy_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if new.vehicle_id is null or new.start_date is null or new.end_date is null then
    return new;
  end if;

  select exists (
    select 1 from public.policies p
    where p.vehicle_id = new.vehicle_id
      and lower(coalesce(p.status, 'active')) = 'active'
      and p.start_date <= policy_today and p.end_date >= policy_today
      and (tg_table_name <> 'policies' or p.id <> new.id)
    union all
    select 1 from public.external_policies ep
    where ep.vehicle_id = new.vehicle_id
      and ep.start_date <= policy_today and ep.end_date >= policy_today
      and (tg_table_name <> 'external_policies' or ep.id <> new.id)
  ) into has_current_active;

  if has_current_active then
    raise exception 'This vehicle already has an active policy. A second policy cannot be added until the current policy expires.' using errcode = '23505';
  end if;

  select exists (
    select 1 from public.policies p
    where p.vehicle_id = new.vehicle_id
      and lower(coalesce(p.status, 'active')) = 'active'
      and new.start_date <= p.end_date and new.end_date >= p.start_date
      and (tg_table_name <> 'policies' or p.id <> new.id)
    union all
    select 1 from public.external_policies ep
    where ep.vehicle_id = new.vehicle_id
      and new.start_date <= ep.end_date and new.end_date >= ep.start_date
      and (tg_table_name <> 'external_policies' or ep.id <> new.id)
  ) into has_date_overlap;

  if has_date_overlap then
    raise exception 'This vehicle already has a policy covering part of the selected policy period.' using errcode = '23505';
  end if;
  return new;
end;
$$;

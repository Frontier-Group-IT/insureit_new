-- Store operational compliance fields on the vehicle master record.
-- Insurance expiry remains canonical in public.policies.end_date.

alter table public.vehicles
  add column if not exists gvw_kg numeric(10,2),
  add column if not exists registration_date date,
  add column if not exists fitness_expiry_date date,
  add column if not exists puc_expiry_date date,
  add column if not exists road_tax_expiry_date date,
  add column if not exists national_permit_expiry_date date,
  add column if not exists local_permit_expiry_date date;

drop function if exists public.create_customer_vehicle(uuid, text, text, text, text, integer);
drop function if exists public.create_customer_vehicle(
  uuid, text, text, text, text, integer, numeric, date, date, date, date, date, date
);
drop function if exists public.create_customer_vehicle(
  uuid, text, text, text, text, integer, text, text, text, numeric, date, date, date, date, date, date
);

create or replace function public.create_customer_vehicle(
  p_customer_id uuid,
  p_vehicle_no text,
  p_vehicle_type text,
  p_make text,
  p_model text default null,
  p_year integer default null,
  p_chassis_no text default null,
  p_engine_no text default null,
  p_permit_no text default null,
  p_gvw_kg numeric default null,
  p_registration_date date default null,
  p_fitness_expiry_date date default null,
  p_puc_expiry_date date default null,
  p_road_tax_expiry_date date default null,
  p_national_permit_expiry_date date default null,
  p_local_permit_expiry_date date default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.vehicles;
  cleaned_vehicle_no text := upper(regexp_replace(coalesce(p_vehicle_no, ''), '\s+', '', 'g'));
  cleaned_vehicle_type text := nullif(btrim(coalesce(p_vehicle_type, '')), '');
  cleaned_make text := nullif(btrim(coalesce(p_make, '')), '');
  cleaned_model text := nullif(btrim(coalesce(p_model, '')), '');
  cleaned_chassis_no text := nullif(upper(regexp_replace(coalesce(p_chassis_no, ''), '\s+', '', 'g')), '');
  cleaned_engine_no text := nullif(upper(regexp_replace(coalesce(p_engine_no, ''), '\s+', '', 'g')), '');
  cleaned_permit_no text := nullif(upper(regexp_replace(coalesce(p_permit_no, ''), '\s+', '', 'g')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to add vehicles for this customer.';
  end if;

  if cleaned_vehicle_no = '' then
    raise exception 'Vehicle number is required.';
  end if;

  if cleaned_vehicle_type is null then
    raise exception 'Vehicle type is required.';
  end if;

  if cleaned_make is null then
    raise exception 'Vehicle manufacturer is required.';
  end if;

  if p_year is not null and (p_year < 1950 or p_year > extract(year from now())::integer + 1) then
    raise exception 'Enter a valid manufacturing year.';
  end if;

  if p_gvw_kg is not null and p_gvw_kg <= 0 then
    raise exception 'Enter a valid GVW.';
  end if;

  insert into public.vehicles (
    customer_id,
    vehicle_no,
    vehicle_type,
    make,
    model,
    year,
    chassis_no,
    engine_no,
    permit_no,
    gvw_kg,
    registration_date,
    fitness_expiry_date,
    puc_expiry_date,
    road_tax_expiry_date,
    national_permit_expiry_date,
    local_permit_expiry_date
  ) values (
    p_customer_id,
    cleaned_vehicle_no,
    cleaned_vehicle_type,
    cleaned_make,
    cleaned_model,
    p_year,
    cleaned_chassis_no,
    cleaned_engine_no,
    cleaned_permit_no,
    p_gvw_kg,
    p_registration_date,
    p_fitness_expiry_date,
    p_puc_expiry_date,
    p_road_tax_expiry_date,
    p_national_permit_expiry_date,
    p_local_permit_expiry_date
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_vehicle(
  uuid, text, text, text, text, integer, text, text, text, numeric, date, date, date, date, date, date
) from public;
grant execute on function public.create_customer_vehicle(
  uuid, text, text, text, text, integer, text, text, text, numeric, date, date, date, date, date, date
) to authenticated;

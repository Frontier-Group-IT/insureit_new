-- Create vehicles through a validated RPC so Group parent accounts can add
-- fleet records for their own account or linked child accounts without
-- depending on direct table insert RLS behavior.

create or replace function public.create_customer_vehicle(
  p_customer_id uuid,
  p_vehicle_no text,
  p_vehicle_type text,
  p_make text,
  p_model text default null,
  p_year integer default null
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

  insert into public.vehicles (
    customer_id,
    vehicle_no,
    vehicle_type,
    make,
    model,
    year
  ) values (
    p_customer_id,
    cleaned_vehicle_no,
    cleaned_vehicle_type,
    cleaned_make,
    cleaned_model,
    p_year
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_vehicle(uuid, text, text, text, text, integer) from public;
grant execute on function public.create_customer_vehicle(uuid, text, text, text, text, integer) to authenticated;

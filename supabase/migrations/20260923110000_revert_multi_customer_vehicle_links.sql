begin;

-- Revert PR #2262 behavior while preserving the link table as dormant rollback
-- evidence. The app and RPCs return to one canonical vehicle -> one customer.

drop policy if exists "vehicles linked customer read" on public.vehicles;
drop policy if exists "vehicle customer links read accessible customer" on public.vehicle_customer_links;
revoke select on table public.vehicle_customer_links from authenticated;
drop function if exists public.can_access_linked_vehicle(uuid);

create or replace function public.can_access_vehicle(viewer_id uuid, target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicles v
    where v.id = target_vehicle_id
      and (
        public.can_access_customer(viewer_id, v.customer_id)
        or (viewer_id = auth.uid() and public.can_access_customer(v.customer_id))
        or (viewer_id = auth.uid() and public.can_view_customer_via_intermediary(viewer_id, v.customer_id))
      )
  );
$$;

revoke all on function public.can_access_vehicle(uuid,uuid) from public, anon;
grant execute on function public.can_access_vehicle(uuid,uuid) to authenticated, service_role;

create or replace function public.create_customer_vehicle(
  p_customer_id uuid,
  p_vehicle_no text,
  p_vehicle_type text default null,
  p_make text default null,
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
  p_local_permit_expiry_date date default null,
  p_fuel_type text default null
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
  cleaned_fuel_type text := nullif(btrim(coalesce(p_fuel_type, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to add vehicles for this customer.';
  end if;
  if cleaned_vehicle_no = '' then raise exception 'RC number is required.'; end if;
  if cleaned_make is null then raise exception 'Vehicle manufacturer is required.'; end if;
  if cleaned_model is null then raise exception 'Vehicle model is required.'; end if;
  if p_year is null or p_year < 1950 or p_year > extract(year from now())::integer + 1 then
    raise exception 'Enter a valid manufacturing year.';
  end if;
  if p_gvw_kg is not null and p_gvw_kg <= 0 then raise exception 'Enter a valid capacity.'; end if;

  insert into public.vehicles (
    customer_id, vehicle_no, vehicle_type, make, model, year, chassis_no, engine_no, permit_no, gvw_kg, fuel_type,
    registration_date, fitness_expiry_date, puc_expiry_date, road_tax_expiry_date, national_permit_expiry_date, local_permit_expiry_date
  ) values (
    p_customer_id, cleaned_vehicle_no, cleaned_vehicle_type, cleaned_make, cleaned_model, p_year, cleaned_chassis_no, cleaned_engine_no, cleaned_permit_no, p_gvw_kg, cleaned_fuel_type,
    p_registration_date, p_fitness_expiry_date, p_puc_expiry_date, p_road_tax_expiry_date, p_national_permit_expiry_date, p_local_permit_expiry_date
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_vehicle(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text) from public, anon;
grant execute on function public.create_customer_vehicle(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text) to authenticated, service_role;

create or replace function public.create_customer_vehicle_v2(
  p_customer_id uuid,
  p_vehicle_no text,
  p_vehicle_type text default null,
  p_make text default null,
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
  p_local_permit_expiry_date date default null,
  p_fuel_type text default null,
  p_engine_capacity_cc numeric default null,
  p_seating_capacity integer default null
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
  cleaned_fuel_type text := nullif(btrim(coalesce(p_fuel_type, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to add vehicles for this customer.';
  end if;
  if cleaned_vehicle_no = '' then raise exception 'RC number is required.'; end if;
  if cleaned_make is null then raise exception 'Vehicle manufacturer is required.'; end if;
  if cleaned_model is null then raise exception 'Vehicle model is required.'; end if;
  if p_year is null or p_year < 1950 or p_year > extract(year from now())::integer + 1 then
    raise exception 'Enter a valid manufacturing year.';
  end if;
  if p_gvw_kg is not null and p_gvw_kg <= 0 then raise exception 'Enter a valid GVW.'; end if;
  if p_engine_capacity_cc is not null and p_engine_capacity_cc <= 0 then raise exception 'Enter a valid engine capacity.'; end if;
  if p_seating_capacity is not null and p_seating_capacity <= 0 then raise exception 'Enter a valid seating capacity.'; end if;

  insert into public.vehicles (
    customer_id, vehicle_no, vehicle_type, make, model, year,
    chassis_no, engine_no, permit_no, gvw_kg, engine_capacity_cc, seating_capacity, fuel_type,
    registration_date, fitness_expiry_date, puc_expiry_date, road_tax_expiry_date,
    national_permit_expiry_date, local_permit_expiry_date
  ) values (
    p_customer_id, cleaned_vehicle_no, cleaned_vehicle_type, cleaned_make, cleaned_model, p_year,
    cleaned_chassis_no, cleaned_engine_no, cleaned_permit_no, p_gvw_kg, p_engine_capacity_cc, p_seating_capacity, cleaned_fuel_type,
    p_registration_date, p_fitness_expiry_date, p_puc_expiry_date, p_road_tax_expiry_date,
    p_national_permit_expiry_date, p_local_permit_expiry_date
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_vehicle_v2(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text,numeric,integer) from public, anon;
grant execute on function public.create_customer_vehicle_v2(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text,numeric,integer) to authenticated, service_role;

create or replace function public.create_customer_external_policy(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_insurance_company_id uuid,
  p_policy_no text,
  p_policy_type text,
  p_start_date date,
  p_end_date date,
  p_premium_amount numeric default null,
  p_insured_declared_value numeric default null
)
returns public.external_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.external_policies;
  cleaned_policy_no text := upper(nullif(btrim(coalesce(p_policy_no, '')), ''));
  cleaned_policy_type text := nullif(btrim(coalesce(p_policy_type, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to add policies for this customer.';
  end if;
  if cleaned_policy_no is null then raise exception 'Policy number is required.'; end if;
  if cleaned_policy_type is null then raise exception 'Policy type is required.'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid policy start and end date.';
  end if;
  if p_premium_amount is not null and p_premium_amount < 0 then raise exception 'Premium amount cannot be negative.'; end if;
  if p_insured_declared_value is not null and p_insured_declared_value < 0 then raise exception 'IDV cannot be negative.'; end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.customer_id = p_customer_id
  ) then
    raise exception 'Select a valid vehicle for this customer.';
  end if;
  if not exists (select 1 from public.insurance_companies c where c.id = p_insurance_company_id) then
    raise exception 'Select a valid insurer.';
  end if;

  insert into public.external_policies (
    customer_id, vehicle_id, insurance_company_id, policy_no, policy_type,
    start_date, end_date, premium_amount, insured_declared_value, added_by, added_via
  ) values (
    p_customer_id, p_vehicle_id, p_insurance_company_id, cleaned_policy_no, cleaned_policy_type,
    p_start_date, p_end_date, p_premium_amount, p_insured_declared_value, auth.uid(), 'customer_app'
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) from public, anon;
grant execute on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) to authenticated, service_role;

commit;

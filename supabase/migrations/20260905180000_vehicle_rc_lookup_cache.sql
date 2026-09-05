create table if not exists public.vehicle_rc_lookup_cache (
  registration_number_normalized text primary key,
  provider text not null default 'authbridge',
  service_code text not null default 'detailed_rc_372',
  raw_response jsonb not null,
  normalized_details jsonb not null,
  transaction_id text,
  fetched_at timestamptz not null default now(),
  last_served_at timestamptz not null default now(),
  expires_at timestamptz not null,
  mapper_version text not null default '2026-09-05-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_rc_lookup_cache_registration_check
    check (registration_number_normalized = upper(regexp_replace(registration_number_normalized, '[^A-Za-z0-9]', '', 'g')))
);

comment on table public.vehicle_rc_lookup_cache is
  'Server-only cache of paid RC provider responses. Raw provider data must never be exposed directly to customer clients.';
comment on column public.vehicle_rc_lookup_cache.raw_response is
  'Original AuthBridge payload retained server-side for the configured cache period/reuse policy; may contain private provider data.';

alter table public.vehicle_rc_lookup_cache enable row level security;
revoke all on table public.vehicle_rc_lookup_cache from public, anon, authenticated;
grant all on table public.vehicle_rc_lookup_cache to service_role;

create index if not exists vehicle_rc_lookup_cache_expires_at_idx
  on public.vehicle_rc_lookup_cache (expires_at);

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
as $function$
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
$function$;

revoke all on function public.create_customer_vehicle_v2(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text,numeric,integer) from public, anon;
grant execute on function public.create_customer_vehicle_v2(uuid,text,text,text,text,integer,text,text,text,numeric,date,date,date,date,date,date,text,numeric,integer) to authenticated, service_role;

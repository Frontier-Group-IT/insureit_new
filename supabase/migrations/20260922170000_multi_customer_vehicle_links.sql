begin;

create table if not exists public.vehicle_customer_links (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  relationship_type text not null default 'associated',
  is_primary boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, customer_id),
  constraint vehicle_customer_links_relationship_type_check
    check (relationship_type in ('primary', 'associated'))
);

create index if not exists vehicle_customer_links_customer_idx
  on public.vehicle_customer_links(customer_id, vehicle_id);

insert into public.vehicle_customer_links (
  vehicle_id,
  customer_id,
  relationship_type,
  is_primary,
  created_by
)
select
  v.id,
  v.customer_id,
  'primary',
  true,
  null
from public.vehicles v
where v.customer_id is not null
on conflict (vehicle_id, customer_id) do update
set
  relationship_type = 'primary',
  is_primary = true;

alter table public.vehicle_customer_links enable row level security;

revoke all on table public.vehicle_customer_links from public, anon;
grant select on table public.vehicle_customer_links to authenticated;
grant all on table public.vehicle_customer_links to service_role;

drop policy if exists "vehicle customer links read accessible customer" on public.vehicle_customer_links;
create policy "vehicle customer links read accessible customer"
on public.vehicle_customer_links
for select
to authenticated
using (
  public.can_access_customer(customer_id)
  or public.can_access_customer(auth.uid(), customer_id)
  or public.can_view_customer_via_intermediary(auth.uid(), customer_id)
);

create or replace function public.can_access_linked_vehicle(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicle_customer_links link
    where link.vehicle_id = target_vehicle_id
      and (
        public.can_access_customer(link.customer_id)
        or public.can_access_customer(auth.uid(), link.customer_id)
        or public.can_view_customer_via_intermediary(auth.uid(), link.customer_id)
      )
  );
$$;

revoke all on function public.can_access_linked_vehicle(uuid) from public, anon;
grant execute on function public.can_access_linked_vehicle(uuid) to authenticated, service_role;

create or replace function public.can_access_vehicle(viewer_id uuid, target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicle_customer_links link
    where link.vehicle_id = target_vehicle_id
      and (
        public.can_access_customer(viewer_id, link.customer_id)
        or (viewer_id = auth.uid() and public.can_access_customer(link.customer_id))
        or (viewer_id = auth.uid() and public.can_view_customer_via_intermediary(viewer_id, link.customer_id))
      )
  )
  or exists (
    select 1
    from public.vehicles v
    where v.id = target_vehicle_id
      and public.can_access_customer(viewer_id, v.customer_id)
  );
$$;

drop policy if exists "vehicles linked customer read" on public.vehicles;
create policy "vehicles linked customer read"
on public.vehicles
for select
to authenticated
using (public.can_access_linked_vehicle(id));

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
  normalized_vehicle_no text := upper(regexp_replace(coalesce(p_vehicle_no, ''), '[^A-Za-z0-9]', '', 'g'));
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

  select v.*
  into result
  from public.vehicles v
  where v.vehicle_no_normalized = normalized_vehicle_no
     or upper(regexp_replace(coalesce(v.vehicle_no, ''), '[^A-Za-z0-9]', '', 'g')) = normalized_vehicle_no
  order by v.created_at asc
  limit 1;

  if found then
    insert into public.vehicle_customer_links(vehicle_id, customer_id, relationship_type, is_primary, created_by)
    values(result.id, p_customer_id, 'associated', false, auth.uid())
    on conflict (vehicle_id, customer_id) do nothing;
    return result;
  end if;

  begin
    insert into public.vehicles (
      customer_id, vehicle_no, vehicle_type, make, model, year, chassis_no, engine_no, permit_no, gvw_kg, fuel_type,
      registration_date, fitness_expiry_date, puc_expiry_date, road_tax_expiry_date, national_permit_expiry_date, local_permit_expiry_date
    ) values (
      p_customer_id, cleaned_vehicle_no, cleaned_vehicle_type, cleaned_make, cleaned_model, p_year, cleaned_chassis_no, cleaned_engine_no, cleaned_permit_no, p_gvw_kg, cleaned_fuel_type,
      p_registration_date, p_fitness_expiry_date, p_puc_expiry_date, p_road_tax_expiry_date, p_national_permit_expiry_date, p_local_permit_expiry_date
    ) returning * into result;
  exception
    when unique_violation then
      select v.*
      into result
      from public.vehicles v
      where v.vehicle_no_normalized = normalized_vehicle_no
         or upper(regexp_replace(coalesce(v.vehicle_no, ''), '[^A-Za-z0-9]', '', 'g')) = normalized_vehicle_no
      order by v.created_at asc
      limit 1;
      if not found then
        raise;
      end if;
  end;

  insert into public.vehicle_customer_links(vehicle_id, customer_id, relationship_type, is_primary, created_by)
  values(result.id, p_customer_id, case when result.customer_id = p_customer_id then 'primary' else 'associated' end, result.customer_id = p_customer_id, auth.uid())
  on conflict (vehicle_id, customer_id) do nothing;

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
  normalized_vehicle_no text := upper(regexp_replace(coalesce(p_vehicle_no, ''), '[^A-Za-z0-9]', '', 'g'));
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

  select v.*
  into result
  from public.vehicles v
  where v.vehicle_no_normalized = normalized_vehicle_no
     or upper(regexp_replace(coalesce(v.vehicle_no, ''), '[^A-Za-z0-9]', '', 'g')) = normalized_vehicle_no
  order by v.created_at asc
  limit 1;

  if found then
    insert into public.vehicle_customer_links(vehicle_id, customer_id, relationship_type, is_primary, created_by)
    values(result.id, p_customer_id, 'associated', false, auth.uid())
    on conflict (vehicle_id, customer_id) do nothing;
    return result;
  end if;

  begin
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
  exception
    when unique_violation then
      select v.*
      into result
      from public.vehicles v
      where v.vehicle_no_normalized = normalized_vehicle_no
         or upper(regexp_replace(coalesce(v.vehicle_no, ''), '[^A-Za-z0-9]', '', 'g')) = normalized_vehicle_no
      order by v.created_at asc
      limit 1;
      if not found then
        raise;
      end if;
  end;

  insert into public.vehicle_customer_links(vehicle_id, customer_id, relationship_type, is_primary, created_by)
  values(result.id, p_customer_id, case when result.customer_id = p_customer_id then 'primary' else 'associated' end, result.customer_id = p_customer_id, auth.uid())
  on conflict (vehicle_id, customer_id) do nothing;

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
as $
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
    select 1
    from public.vehicle_customer_links link
    where link.vehicle_id = p_vehicle_id
      and link.customer_id = p_customer_id
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
$;

revoke all on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) from public, anon;
grant execute on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) to authenticated, service_role;

commit;

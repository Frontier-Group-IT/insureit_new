-- Separate customer-recorded external policies from Sankalp business policies.
-- This migration is intentionally backward-compatible with the currently deployed app.

create table if not exists public.external_policies (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  insurance_company_id uuid not null references public.insurance_companies(id) on delete restrict,
  policy_no text not null,
  policy_type text not null,
  start_date date not null,
  end_date date not null,
  premium_amount numeric null,
  insured_declared_value numeric null,
  document_storage_path text null,
  added_by uuid null references public.profiles(id) on delete set null,
  added_via text not null default 'customer_app' check (added_via in ('customer_app', 'staff_recorded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_policies_date_check check (end_date >= start_date),
  constraint external_policies_premium_check check (premium_amount is null or premium_amount >= 0),
  constraint external_policies_idv_check check (insured_declared_value is null or insured_declared_value >= 0)
);

create unique index if not exists external_policies_customer_policy_no_uidx
  on public.external_policies(customer_id, upper(policy_no));
create index if not exists external_policies_customer_idx on public.external_policies(customer_id);
create index if not exists external_policies_vehicle_idx on public.external_policies(vehicle_id);
create index if not exists external_policies_expiry_idx on public.external_policies(end_date);

drop trigger if exists external_policies_updated_at on public.external_policies;
create trigger external_policies_updated_at
before update on public.external_policies
for each row execute function public.set_updated_at();

alter table public.external_policies enable row level security;

drop policy if exists "external policies accessible customer read" on public.external_policies;
create policy "external policies accessible customer read"
on public.external_policies for select
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

drop policy if exists "external policies accessible customer insert" on public.external_policies;
create policy "external policies accessible customer insert"
on public.external_policies for insert
to authenticated
with check (
  public.can_access_customer(auth.uid(), customer_id)
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.customer_id = customer_id
  )
);

drop policy if exists "external policies accessible customer update" on public.external_policies;
create policy "external policies accessible customer update"
on public.external_policies for update
to authenticated
using (public.can_access_customer(auth.uid(), customer_id))
with check (
  public.can_access_customer(auth.uid(), customer_id)
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.customer_id = customer_id
  )
);

drop policy if exists "external policies accessible customer delete" on public.external_policies;
create policy "external policies accessible customer delete"
on public.external_policies for delete
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

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
  ) then raise exception 'Select a valid vehicle for this customer.'; end if;
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

grant execute on function public.create_customer_external_policy(uuid,uuid,uuid,text,text,date,date,numeric,numeric) to authenticated;

alter table public.claims add column if not exists external_policy_id uuid null references public.external_policies(id) on delete restrict;
alter table public.claims alter column policy_id drop not null;

alter table public.claims drop constraint if exists claims_exactly_one_policy_source;
alter table public.claims add constraint claims_exactly_one_policy_source check (
  (policy_id is not null and external_policy_id is null)
  or (policy_id is null and external_policy_id is not null)
);
create index if not exists claims_external_policy_idx on public.claims(external_policy_id);

create or replace function public.create_self_managed_external_claim(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_external_policy_id uuid,
  p_accident_at timestamptz,
  p_driver_name text default null,
  p_driver_phone text default null,
  p_location text default null
)
returns table (claim_id uuid, claim_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.external_policies;
  v_claim public.claims;
  v_details jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to create a claim for this customer.';
  end if;
  if p_accident_at is null then raise exception 'Accident date and time are required.'; end if;
  if p_accident_at > now() then raise exception 'Accident date and time cannot be in the future.'; end if;

  select * into v_policy
  from public.external_policies ep
  where ep.id = p_external_policy_id
    and ep.customer_id = p_customer_id
    and ep.vehicle_id = p_vehicle_id;

  if not found then raise exception 'Select a valid external policy for this vehicle.'; end if;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'accident_at', p_accident_at,
    'driver_name', nullif(btrim(coalesce(p_driver_name, '')), ''),
    'driver_phone', nullif(btrim(coalesce(p_driver_phone, '')), ''),
    'location', nullif(btrim(coalesce(p_location, '')), ''),
    'external_policy_id', v_policy.id,
    'policy_no', v_policy.policy_no,
    'insurance_company_id', v_policy.insurance_company_id
  ));

  insert into public.claims (
    claim_no, customer_id, vehicle_id, policy_id, external_policy_id,
    insurance_company_id, current_status, accident_at, accident_location,
    accident_description, created_by, policy_service_source, claim_service_mode,
    assistance_status, self_management_acknowledged_at, self_management_acknowledged_by
  ) values (
    null, p_customer_id, p_vehicle_id, null, v_policy.id,
    v_policy.insurance_company_id, 'Accident Reported', p_accident_at,
    nullif(btrim(coalesce(p_location, '')), ''),
    null, auth.uid(), 'external', 'self_managed',
    'not_requested', now(), auth.uid()
  ) returning * into v_claim;

  insert into public.claim_milestones (
    claim_id, milestone_key, milestone_status, details, completed_at,
    recorded_by, recorded_by_actor
  ) values (
    v_claim.id, 'spot_intimation', 'completed', v_details, now(), auth.uid(), 'customer'
  );

  return query select v_claim.id, v_claim.claim_no;
end;
$$;

grant execute on function public.create_self_managed_external_claim(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;

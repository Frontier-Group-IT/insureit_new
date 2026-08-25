-- Broker-facing Non-Motor policy onboarding.
-- Non-Motor policies do not belong to a vehicle, so vehicle_id must be optional.
alter table public.policies
  alter column vehicle_id drop not null;

alter table public.policies
  add column if not exists business_line text,
  add column if not exists policy_product text,
  add column if not exists policy_status text default 'Active';

create table if not exists public.non_motor_policy_details (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null unique references public.policies(id) on delete cascade,
  category text not null,
  risk_title text,
  risk_location text,
  occupancy_type text,
  transit_from text,
  transit_to text,
  transit_mode text,
  nature_of_business text,
  liability_type text,
  employee_count integer,
  annual_wages numeric(14,2),
  annual_turnover numeric(14,2),
  sum_insured numeric(14,2),
  deductible numeric(14,2),
  net_premium numeric(14,2),
  gst_amount numeric(14,2),
  gross_premium numeric(14,2),
  proposal_number text,
  previous_insurer text,
  previous_policy_number text,
  previous_claims text,
  add_ons text,
  warranties text,
  special_conditions text,
  endorsements text,
  remarks text,
  risk_details jsonb not null default '{}'::jsonb,
  additional_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists non_motor_policy_details_category_idx
  on public.non_motor_policy_details(category);

create trigger non_motor_policy_details_updated_at
before update on public.non_motor_policy_details
for each row execute function public.set_updated_at();

alter table public.non_motor_policy_details enable row level security;

create policy "non motor policy details ops manage"
on public.non_motor_policy_details
for all to authenticated
using (public.is_operations_role())
with check (public.is_operations_role());

create policy "non motor policy details customer read"
on public.non_motor_policy_details
for select to authenticated
using (
  policy_id in (
    select p.id
    from public.policies p
    where p.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )
  )
);

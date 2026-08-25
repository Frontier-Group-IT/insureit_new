-- Broker-facing Non-Motor policy onboarding.
-- Non-Motor policies are policy records without a linked vehicle.

alter table public.policies
  alter column vehicle_id drop not null;

alter table public.policies
  add column if not exists policy_product text;

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
  annual_wages numeric(16,2),
  annual_turnover numeric(16,2),
  sum_insured numeric(16,2),
  deductible numeric(16,2),
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

create index if not exists non_motor_policy_details_risk_location_idx
  on public.non_motor_policy_details(risk_location);

drop trigger if exists non_motor_policy_details_updated_at on public.non_motor_policy_details;
create trigger non_motor_policy_details_updated_at
before update on public.non_motor_policy_details
for each row execute function public.set_updated_at();

alter table public.non_motor_policy_details enable row level security;

drop policy if exists "non motor policy details ops manage" on public.non_motor_policy_details;
create policy "non motor policy details ops manage"
on public.non_motor_policy_details
for all to authenticated
using (public.is_operations_role())
with check (public.is_operations_role());

drop policy if exists "non motor policy details customer read" on public.non_motor_policy_details;
create policy "non motor policy details customer read"
on public.non_motor_policy_details
for select to authenticated
using (
  exists (
    select 1
    from public.policies p
    join public.customers c on c.id = p.customer_id
    where p.id = non_motor_policy_details.policy_id
      and c.profile_id = auth.uid()
  )
);

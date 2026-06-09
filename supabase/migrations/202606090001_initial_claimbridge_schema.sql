-- ClaimBridge CV initial schema for commercial vehicle claim assistance.
create extension if not exists "pgcrypto";

create type public.app_role as enum (
  'super_admin',
  'admin',
  'manager',
  'claim_processor',
  'field_executive',
  'customer'
);

create type public.claim_status as enum (
  'Draft',
  'Accident Reported',
  'Documents Pending',
  'Documents Submitted',
  'Claim Intimated',
  'Surveyor Appointed',
  'Vehicle Inspected',
  'Estimate Submitted',
  'Approval Pending',
  'Repair Started',
  'Repair Completed',
  'Final Bill Submitted',
  'Settlement Under Process',
  'Settled',
  'Rejected',
  'Closed'
);

create type public.document_status as enum ('pending', 'verified', 'rejected');
create type public.task_status as enum ('open', 'in_progress', 'completed', 'cancelled');
create type public.notification_status as enum ('unread', 'read');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'app_role', ''),
    'customer'
  )::public.app_role;
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('super_admin', 'admin', 'manager');
$$;

create or replace function public.is_operations_role()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('super_admin', 'admin', 'manager', 'claim_processor', 'field_executive');
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  customer_code text unique not null,
  company_name text,
  contact_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  onboarding_status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurance_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  branch_name text,
  contact_email text,
  contact_phone text,
  claims_portal_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.garages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.surveyors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_no text,
  phone text,
  email text,
  insurance_company_id uuid references public.insurance_companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  vehicle_no text not null unique,
  vehicle_type text not null,
  make text,
  model text,
  year integer,
  chassis_no text,
  engine_no text,
  permit_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  insurance_company_id uuid not null references public.insurance_companies(id) on delete restrict,
  policy_no text not null unique,
  policy_type text not null,
  start_date date not null,
  end_date date not null,
  premium_amount numeric(12,2),
  insured_declared_value numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  policy_id uuid not null references public.policies(id) on delete restrict,
  insurance_company_id uuid references public.insurance_companies(id) on delete set null,
  garage_id uuid references public.garages(id) on delete set null,
  surveyor_id uuid references public.surveyors(id) on delete set null,
  current_status public.claim_status not null default 'Draft',
  accident_at timestamptz,
  accident_location text,
  accident_description text,
  estimated_loss numeric(12,2),
  approved_amount numeric(12,2),
  settlement_amount numeric(12,2),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_bucket text not null default 'claim-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  verification_status public.document_status not null default 'pending',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_status_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  from_status public.claim_status,
  to_status public.claim_status not null,
  notes text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_tasks (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status public.task_status not null default 'open',
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete cascade,
  title text not null,
  message text not null,
  status public.notification_status not null default 'unread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_profile_id_idx on public.customers(profile_id);
create index vehicles_customer_id_idx on public.vehicles(customer_id);
create index vehicles_vehicle_no_idx on public.vehicles(vehicle_no);
create index policies_customer_id_idx on public.policies(customer_id);
create index policies_vehicle_id_idx on public.policies(vehicle_id);
create index policies_policy_no_idx on public.policies(policy_no);
create index claims_claim_no_idx on public.claims(claim_no);
create index claims_customer_id_idx on public.claims(customer_id);
create index claims_vehicle_id_idx on public.claims(vehicle_id);
create index claims_current_status_idx on public.claims(current_status);
create index claim_documents_claim_id_idx on public.claim_documents(claim_id);
create index claim_status_history_claim_id_idx on public.claim_status_history(claim_id);
create index claim_tasks_claim_id_idx on public.claim_tasks(claim_id);
create index claim_tasks_assigned_to_idx on public.claim_tasks(assigned_to);
create index notifications_profile_id_idx on public.notifications(profile_id);
create index audit_logs_table_record_idx on public.audit_logs(table_name, record_id);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger insurance_companies_updated_at before update on public.insurance_companies for each row execute function public.set_updated_at();
create trigger garages_updated_at before update on public.garages for each row execute function public.set_updated_at();
create trigger surveyors_updated_at before update on public.surveyors for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger policies_updated_at before update on public.policies for each row execute function public.set_updated_at();
create trigger claims_updated_at before update on public.claims for each row execute function public.set_updated_at();
create trigger claim_documents_updated_at before update on public.claim_documents for each row execute function public.set_updated_at();
create trigger claim_status_history_updated_at before update on public.claim_status_history for each row execute function public.set_updated_at();
create trigger claim_tasks_updated_at before update on public.claim_tasks for each row execute function public.set_updated_at();
create trigger notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create trigger audit_logs_updated_at before update on public.audit_logs for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.policies enable row level security;
alter table public.claims enable row level security;
alter table public.claim_documents enable row level security;
alter table public.claim_status_history enable row level security;
alter table public.claim_tasks enable row level security;
alter table public.insurance_companies enable row level security;
alter table public.garages enable row level security;
alter table public.surveyors enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self read or ops" on public.profiles for select using (id = auth.uid() or public.is_operations_role());
create policy "profiles admin manage" on public.profiles for all using (public.is_admin_role()) with check (public.is_admin_role());

create policy "customers ops manage" on public.customers for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "customers self read" on public.customers for select using (profile_id = auth.uid());

create policy "vehicles ops manage" on public.vehicles for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "vehicles customer read" on public.vehicles for select using (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "policies ops manage" on public.policies for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "policies customer read" on public.policies for select using (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "claims ops manage" on public.claims for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "claims customer read" on public.claims for select using (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "claim documents ops manage" on public.claim_documents for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "claim documents customer read" on public.claim_documents for select using (customer_id in (select id from public.customers where profile_id = auth.uid()));
create policy "claim documents customer upload" on public.claim_documents for insert with check (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "claim history ops manage" on public.claim_status_history for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "claim history customer read" on public.claim_status_history for select using (claim_id in (select id from public.claims where customer_id in (select id from public.customers where profile_id = auth.uid())));

create policy "claim tasks ops manage" on public.claim_tasks for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "claim tasks assignee read" on public.claim_tasks for select using (assigned_to = auth.uid());

create policy "insurance companies ops manage" on public.insurance_companies for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "garages ops manage" on public.garages for all using (public.is_operations_role()) with check (public.is_operations_role());
create policy "surveyors ops manage" on public.surveyors for all using (public.is_operations_role()) with check (public.is_operations_role());

create policy "notifications recipient read" on public.notifications for select using (profile_id = auth.uid() or public.is_operations_role());
create policy "notifications ops manage" on public.notifications for all using (public.is_operations_role()) with check (public.is_operations_role());

create policy "audit logs admin read" on public.audit_logs for select using (public.is_admin_role());
create policy "audit logs ops insert" on public.audit_logs for insert with check (public.is_operations_role());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-documents',
  'claim-documents',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false;

create policy "claim document objects ops access"
on storage.objects for all
to authenticated
using (bucket_id = 'claim-documents' and public.is_operations_role())
with check (bucket_id = 'claim-documents' and public.is_operations_role());

create policy "claim document objects customer read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'claim-documents'
  and exists (
    select 1 from public.claim_documents cd
    where cd.storage_path = storage.objects.name
      and cd.customer_id in (select id from public.customers where profile_id = auth.uid())
  )
);

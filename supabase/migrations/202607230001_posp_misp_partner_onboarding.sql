-- Add first-class POSP and MISP onboarding support for the web portal.
-- Existing Dealership POSP/MISP flows remain untouched.

alter table public.customers
  drop constraint if exists customers_partner_type_check;

alter table public.customers
  add constraint customers_partner_type_check
  check (
    partner_type is null or partner_type in (
      'individual_proprietor',
      'dealership',
      'corporate',
      'group',
      'posp',
      'misp'
    )
  );

alter table public.customer_onboarding_applications
  drop constraint if exists customer_onboarding_applications_partner_type_check;

alter table public.customer_onboarding_applications
  add constraint customer_onboarding_applications_partner_type_check
  check (
    partner_type is null or partner_type in (
      'individual_proprietor',
      'dealership',
      'corporate',
      'group',
      'posp',
      'misp'
    )
  );

create table if not exists public.posp_misp_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.customer_onboarding_applications(id) on delete cascade,
  customer_id uuid unique references public.customers(id) on delete set null,
  partner_type text not null check (partner_type in ('posp', 'misp')),
  external_onboarding_id text,
  associate_name text,
  associate_id text,
  document_received_at date,
  pos_name text,
  misp_name text,
  address text,
  city text,
  state text,
  postal_code text,
  gst_number text,
  oem_name text,
  dp_name text,
  dp_phone text,
  dp_email text,
  dp_pan_number text,
  applicant_phone text,
  applicant_email text,
  date_of_birth date,
  aadhaar_last_four text,
  aadhaar_hash text,
  pan_number text,
  education_status text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  iib_remarks text,
  iib_upload_status text,
  iib_uploaded_at date,
  training_login_id text,
  training_password text,
  training_credentials_shared text,
  training_start_date date,
  training_end_date date,
  training_status text,
  training_certificate_number text,
  exam_status text,
  onboarding_date date,
  source text not null default 'manual' check (source in ('manual', 'excel_import')),
  import_batch_id uuid,
  import_row_number integer,
  raw_data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posp_misp_profiles_partner_type_idx
  on public.posp_misp_onboarding_profiles(partner_type);

create index if not exists posp_misp_profiles_application_idx
  on public.posp_misp_onboarding_profiles(application_id);

create index if not exists posp_misp_profiles_external_id_idx
  on public.posp_misp_onboarding_profiles(external_onboarding_id);

drop trigger if exists posp_misp_onboarding_profiles_updated_at
  on public.posp_misp_onboarding_profiles;
create trigger posp_misp_onboarding_profiles_updated_at
before update on public.posp_misp_onboarding_profiles
for each row execute function public.set_updated_at();

create table if not exists public.posp_misp_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_bucket text,
  storage_path text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'parsed' check (status in ('parsed', 'submitted', 'cancelled')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists posp_misp_import_batches_updated_at
  on public.posp_misp_import_batches;
create trigger posp_misp_import_batches_updated_at
before update on public.posp_misp_import_batches
for each row execute function public.set_updated_at();

create table if not exists public.posp_misp_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.posp_misp_import_batches(id) on delete cascade,
  sheet_name text not null check (sheet_name in ('POSP', 'MISP')),
  row_number integer not null,
  partner_type text not null check (partner_type in ('posp', 'misp')),
  source_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_errors text[] not null default '{}'::text[],
  application_id uuid references public.customer_onboarding_applications(id) on delete set null,
  error_message text,
  status text not null default 'parsed' check (status in ('parsed', 'invalid', 'submitted', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(import_batch_id, sheet_name, row_number)
);

create index if not exists posp_misp_import_rows_batch_idx
  on public.posp_misp_import_rows(import_batch_id, row_number);

drop trigger if exists posp_misp_import_rows_updated_at
  on public.posp_misp_import_rows;
create trigger posp_misp_import_rows_updated_at
before update on public.posp_misp_import_rows
for each row execute function public.set_updated_at();

alter table public.posp_misp_onboarding_profiles enable row level security;
alter table public.posp_misp_import_batches enable row level security;
alter table public.posp_misp_import_rows enable row level security;

drop policy if exists "Managers can manage POSP MISP profiles"
  on public.posp_misp_onboarding_profiles;
create policy "Managers can manage POSP MISP profiles"
on public.posp_misp_onboarding_profiles for all to authenticated
using (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
)
with check (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
);

drop policy if exists "Managers can manage POSP MISP import batches"
  on public.posp_misp_import_batches;
create policy "Managers can manage POSP MISP import batches"
on public.posp_misp_import_batches for all to authenticated
using (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
)
with check (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
);

drop policy if exists "Managers can manage POSP MISP import rows"
  on public.posp_misp_import_rows;
create policy "Managers can manage POSP MISP import rows"
on public.posp_misp_import_rows for all to authenticated
using (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
)
with check (
  public.current_app_role()::text in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  )
);

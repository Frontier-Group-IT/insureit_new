-- Application-first onboarding shared by the customer app and manager portal.
-- Existing customers remain valid; only new onboarding flows use these tables.

create table if not exists public.customer_onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  initiated_by uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('customer_app', 'manager_portal')),
  partner_type text check (
    partner_type is null or partner_type in (
      'individual_proprietor',
      'dealership',
      'corporate',
      'group'
    )
  ),
  status text not null default 'not_started' check (
    status in (
      'not_started',
      'in_progress',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'cancelled'
    )
  ),
  current_step smallint not null default 1 check (current_step between 1 and 4),
  applicant_phone text,
  applicant_email text,
  draft_data jsonb not null default '{}'::jsonb,
  customer_id uuid unique references public.customers(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_onboarding_active_profile_uidx
  on public.customer_onboarding_applications(profile_id)
  where profile_id is not null
    and status not in ('approved', 'rejected', 'cancelled');

create index if not exists customer_onboarding_status_idx
  on public.customer_onboarding_applications(status, created_at desc);

create index if not exists customer_onboarding_partner_type_idx
  on public.customer_onboarding_applications(partner_type, status);

drop trigger if exists customer_onboarding_applications_updated_at
  on public.customer_onboarding_applications;
create trigger customer_onboarding_applications_updated_at
before update on public.customer_onboarding_applications
for each row execute function public.set_updated_at();

create table if not exists public.customer_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.customer_onboarding_applications(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_bucket text not null default 'customer-documents',
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  verification_status text not null default 'pending' check (
    verification_status in ('pending', 'verified', 'rejected')
  ),
  rejection_reason text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, document_type)
);

create index if not exists customer_onboarding_documents_application_idx
  on public.customer_onboarding_documents(application_id);

drop trigger if exists customer_onboarding_documents_updated_at
  on public.customer_onboarding_documents;
create trigger customer_onboarding_documents_updated_at
before update on public.customer_onboarding_documents
for each row execute function public.set_updated_at();

alter table public.customer_onboarding_applications enable row level security;
alter table public.customer_onboarding_documents enable row level security;

drop policy if exists "Applicants can read own onboarding" on public.customer_onboarding_applications;
create policy "Applicants can read own onboarding"
on public.customer_onboarding_applications for select to authenticated
using (profile_id = auth.uid());

drop policy if exists "Applicants can create own onboarding" on public.customer_onboarding_applications;
create policy "Applicants can create own onboarding"
on public.customer_onboarding_applications for insert to authenticated
with check (
  profile_id = auth.uid()
  and initiated_by = auth.uid()
  and source = 'customer_app'
  and status in ('not_started', 'in_progress')
  and customer_id is null
);

drop policy if exists "Applicants can update own onboarding" on public.customer_onboarding_applications;
create policy "Applicants can update own onboarding"
on public.customer_onboarding_applications for update to authenticated
using (
  profile_id = auth.uid()
  and source = 'customer_app'
  and status in ('not_started', 'in_progress', 'changes_requested')
)
with check (
  profile_id = auth.uid()
  and initiated_by = auth.uid()
  and source = 'customer_app'
  and status in ('not_started', 'in_progress', 'submitted')
  and customer_id is null
);

drop policy if exists "Managers can manage onboarding applications" on public.customer_onboarding_applications;
create policy "Managers can manage onboarding applications"
on public.customer_onboarding_applications for all to authenticated
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

drop policy if exists "Applicants can read own onboarding documents" on public.customer_onboarding_documents;
create policy "Applicants can read own onboarding documents"
on public.customer_onboarding_documents for select to authenticated
using (
  exists (
    select 1 from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.profile_id = auth.uid()
  )
);

drop policy if exists "Applicants can create own onboarding documents" on public.customer_onboarding_documents;
create policy "Applicants can create own onboarding documents"
on public.customer_onboarding_documents for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and verification_status = 'pending'
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
);

drop policy if exists "Managers can manage onboarding documents" on public.customer_onboarding_documents;
create policy "Managers can manage onboarding documents"
on public.customer_onboarding_documents for all to authenticated
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

-- New auth identities receive a profile only. A customer is created after KYC finalization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.app_role;
  next_name text;
  next_phone text;
  next_email text;
begin
  next_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'app_role', ''),
    nullif(new.raw_user_meta_data ->> 'app_role', ''),
    'customer'
  )::public.app_role;
  next_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New user');
  next_phone := coalesce(nullif(new.phone, ''), nullif(new.raw_user_meta_data ->> 'phone', ''), '');
  next_email := coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data ->> 'email', ''));

  insert into public.profiles (id, role, full_name, phone, email)
  values (new.id, next_role, next_name, nullif(next_phone, ''), next_email)
  on conflict (id) do update
  set
    role = excluded.role,
    full_name = case
      when public.profiles.full_name in ('', 'New user') then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
    email = coalesce(public.profiles.email, excluded.email);

  return new;
end;
$$;

comment on table public.customer_onboarding_applications is
  'Resumable KYC applications. Approval creates the canonical customers row.';
comment on column public.customer_onboarding_applications.draft_data is
  'Non-secret onboarding draft fields. Raw Aadhaar values must never be persisted here.';

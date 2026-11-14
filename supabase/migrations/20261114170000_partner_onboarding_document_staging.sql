-- Intake-scoped document staging for Partner Life, Health and Non Motor onboarding.
-- This does not grant any direct client write or read access; all access runs
-- through authenticated, reviewer-scoped server endpoints.
create table if not exists public.policy_intake_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.policy_intake_requests(id) on delete cascade,
  business_line text not null check (business_line in ('Life', 'Health', 'Non Motor')),
  document_type text not null check (document_type in ('policy_copy','proposal_form','kyc','other_document')),
  storage_bucket text not null default 'policy-documents',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 4194304),
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intake_id,business_line,document_type)
);
create index if not exists idx_partner_onboarding_documents_intake
  on public.policy_intake_onboarding_documents(intake_id,business_line);
alter table public.policy_intake_onboarding_documents enable row level security;
revoke all on public.policy_intake_onboarding_documents from public, anon, authenticated;
grant select, insert, update, delete on public.policy_intake_onboarding_documents to service_role;

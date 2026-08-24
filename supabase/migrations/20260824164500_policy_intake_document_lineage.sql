create table if not exists public.policy_intake_documents (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.policy_intake_requests(id) on delete cascade,
  source_kind text not null check (source_kind in ('original','replacement')),
  storage_bucket text not null default 'policy-documents',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_policy_intake_documents_intake_created
  on public.policy_intake_documents(intake_id, created_at desc);
create unique index if not exists idx_policy_intake_documents_current
  on public.policy_intake_documents(intake_id) where is_current;

alter table public.policy_intake_documents enable row level security;
revoke all on public.policy_intake_documents from anon, authenticated;
grant all on public.policy_intake_documents to service_role;

alter table public.policy_documents
  add column if not exists source_intake_id uuid references public.policy_intake_requests(id) on delete set null,
  add column if not exists source_intake_document_id uuid references public.policy_intake_documents(id) on delete set null,
  add column if not exists is_official boolean not null default true;

create index if not exists idx_policy_documents_source_intake on public.policy_documents(source_intake_id);
create unique index if not exists idx_policy_documents_official_copy
  on public.policy_documents(policy_id, document_type)
  where is_official;

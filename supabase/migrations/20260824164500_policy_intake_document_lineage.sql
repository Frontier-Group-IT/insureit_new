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

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  document_type text not null default 'policy_copy',
  source_intake_id uuid references public.policy_intake_requests(id) on delete set null,
  source_intake_document_id uuid references public.policy_intake_documents(id) on delete set null,
  storage_bucket text not null default 'policy-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  is_official boolean not null default true,
  attached_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_policy_documents_policy on public.policy_documents(policy_id, created_at desc);
create unique index if not exists idx_policy_documents_official_copy
  on public.policy_documents(policy_id) where document_type = 'policy_copy' and is_official;

alter table public.policy_documents enable row level security;
revoke all on public.policy_documents from anon, authenticated;
grant all on public.policy_documents to service_role;

create or replace function public.touch_policy_document_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_policy_document_updated_at on public.policy_documents;
create trigger trg_policy_document_updated_at
before update on public.policy_documents
for each row execute function public.touch_policy_document_updated_at();

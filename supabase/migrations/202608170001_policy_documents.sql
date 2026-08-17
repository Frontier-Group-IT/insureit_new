-- Add first-class policy copy/document storage for regular policies.
-- This migration is committed to GitHub only in PR #386 and is not applied automatically here.

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  document_type text not null default 'policy_copy',
  file_name text not null,
  storage_bucket text not null default 'policy-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_documents_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists policy_documents_policy_id_idx
  on public.policy_documents(policy_id);

create index if not exists policy_documents_uploaded_by_idx
  on public.policy_documents(uploaded_by);

drop trigger if exists policy_documents_updated_at on public.policy_documents;
create trigger policy_documents_updated_at
before update on public.policy_documents
for each row execute function public.set_updated_at();

alter table public.policy_documents enable row level security;

drop policy if exists "policy documents ops manage" on public.policy_documents;
create policy "policy documents ops manage"
on public.policy_documents for all
to authenticated
using (public.is_operations_role())
with check (
  public.is_operations_role()
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.policies p
    where p.id = policy_documents.policy_id
  )
);

drop policy if exists "policy documents customer read" on public.policy_documents;
create policy "policy documents customer read"
on public.policy_documents for select
to authenticated
using (
  exists (
    select 1
    from public.policies p
    join public.customers c on c.id = p.customer_id
    where p.id = policy_documents.policy_id
      and c.profile_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-documents',
  'policy-documents',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "policy document objects ops access" on storage.objects;
create policy "policy document objects ops access"
on storage.objects for all
to authenticated
using (
  bucket_id = 'policy-documents'
  and public.is_operations_role()
)
with check (
  bucket_id = 'policy-documents'
  and public.is_operations_role()
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.policies p
    where p.id = split_part(storage.objects.name, '/', 1)::uuid
  )
);

drop policy if exists "policy document objects customer read" on storage.objects;
create policy "policy document objects customer read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'policy-documents'
  and exists (
    select 1
    from public.policy_documents pd
    join public.policies p on p.id = pd.policy_id
    join public.customers c on c.id = p.customer_id
    where pd.storage_path = storage.objects.name
      and c.profile_id = auth.uid()
  )
);

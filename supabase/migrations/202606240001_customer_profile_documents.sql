create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  document_type text not null default 'Other',
  file_name text not null,
  storage_bucket text not null default 'customer-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_documents_customer_id_idx on public.customer_documents(customer_id);

alter table public.customer_documents enable row level security;

drop policy if exists "Customers can read own profile documents" on public.customer_documents;

create policy "Customers can read own profile documents"
on public.customer_documents
for select
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_documents.customer_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Customers can upload own profile documents" on public.customer_documents;

create policy "Customers can upload own profile documents"
on public.customer_documents
for insert
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_documents.customer_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Customers can delete own profile documents" on public.customer_documents;

create policy "Customers can delete own profile documents"
on public.customer_documents
for delete
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_documents.customer_id
      and c.profile_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('customer-documents', 'customer-documents', false)
on conflict (id) do nothing;

drop policy if exists "Customers can upload own files to customer-documents" on storage.objects;

create policy "Customers can upload own files to customer-documents"
on storage.objects
for insert
with check (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.customers c
    where c.profile_id = auth.uid()
      and (storage.foldername(name))[1] = c.id::text
  )
);

drop policy if exists "Customers can read own files from customer-documents" on storage.objects;

create policy "Customers can read own files from customer-documents"
on storage.objects
for select
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.customers c
    where c.profile_id = auth.uid()
      and (storage.foldername(name))[1] = c.id::text
  )
);

drop policy if exists "Customers can delete own files from customer-documents" on storage.objects;

create policy "Customers can delete own files from customer-documents"
on storage.objects
for delete
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.customers c
    where c.profile_id = auth.uid()
      and (storage.foldername(name))[1] = c.id::text
  )
);

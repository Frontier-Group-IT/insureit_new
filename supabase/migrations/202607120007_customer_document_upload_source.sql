alter table public.customer_documents
  add column if not exists upload_source text not null default 'customer_app',
  add column if not exists verified_by uuid null references public.profiles(id),
  add column if not exists verified_at timestamptz null,
  add column if not exists rejection_reason text null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'customer_documents'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%verification_status%'
  loop
    execute format('alter table public.customer_documents drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.customer_documents
  add constraint customer_documents_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected'));

alter table public.customer_documents
  drop constraint if exists customer_documents_upload_source_check;

alter table public.customer_documents
  add constraint customer_documents_upload_source_check
  check (upload_source in ('manager_portal', 'customer_app'));

update public.customer_documents
set upload_source = case
  when verification_status = 'verified' then 'manager_portal'
  else 'customer_app'
end
where upload_source is null;

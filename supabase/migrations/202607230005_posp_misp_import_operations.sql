-- Make POSP/MISP workbook imports observable, retryable and document-derived.

alter table public.posp_misp_import_batches
  drop constraint if exists posp_misp_import_batches_status_check;

alter table public.posp_misp_import_batches
  add constraint posp_misp_import_batches_status_check
  check (
    status in (
      'parsed',
      'processing',
      'partially_submitted',
      'submitted',
      'failed',
      'cancelled'
    )
  );

alter table public.posp_misp_import_batches
  add column if not exists pending_rows integer not null default 0,
  add column if not exists submitted_rows integer not null default 0,
  add column if not exists failed_rows integer not null default 0;

alter table public.posp_misp_import_rows
  drop constraint if exists posp_misp_import_rows_status_check;

alter table public.posp_misp_import_rows
  add constraint posp_misp_import_rows_status_check
  check (status in ('parsed', 'invalid', 'processing', 'submitted', 'failed'));

create index if not exists posp_misp_import_rows_batch_status_idx
  on public.posp_misp_import_rows(import_batch_id, status);

create table if not exists public.posp_misp_import_row_documents (
  id uuid primary key default gen_random_uuid(),
  import_row_id uuid not null references public.posp_misp_import_rows(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_row_id, document_type)
);

create index if not exists posp_misp_import_row_documents_row_idx
  on public.posp_misp_import_row_documents(import_row_id);

drop trigger if exists posp_misp_import_row_documents_updated_at
  on public.posp_misp_import_row_documents;
create trigger posp_misp_import_row_documents_updated_at
before update on public.posp_misp_import_row_documents
for each row execute function public.set_updated_at();

alter table public.posp_misp_import_row_documents enable row level security;

drop policy if exists "Managers can manage POSP MISP import row documents"
  on public.posp_misp_import_row_documents;
create policy "Managers can manage POSP MISP import row documents"
on public.posp_misp_import_row_documents for all to authenticated
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

create or replace function public.validate_posp_misp_external_onboarding_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.external_onboarding_id := nullif(upper(btrim(new.external_onboarding_id)), '');
  if new.external_onboarding_id is null then
    return new;
  end if;

  if new.external_onboarding_id !~ '^SIB/[0-9]{4}/(0[1-9]|1[0-2])/[0-9]{4}$' then
    raise exception 'External onboarding ID must use SIB/YYYY/MM/NNNN format.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.external_onboarding_id, 0));
  if exists (
    select 1
    from public.posp_misp_onboarding_profiles profile
    where profile.external_onboarding_id = new.external_onboarding_id
      and profile.id <> new.id
  ) then
    raise exception 'External onboarding ID already exists.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_posp_misp_external_onboarding_id_trigger
  on public.posp_misp_onboarding_profiles;
create trigger validate_posp_misp_external_onboarding_id_trigger
before insert or update of external_onboarding_id
on public.posp_misp_onboarding_profiles
for each row execute function public.validate_posp_misp_external_onboarding_id();

revoke all on function public.validate_posp_misp_external_onboarding_id() from public;

update public.posp_misp_import_batches batch
set
  total_rows = counts.total_rows,
  valid_rows = counts.valid_rows,
  invalid_rows = counts.invalid_rows,
  pending_rows = counts.pending_rows,
  submitted_rows = counts.submitted_rows,
  failed_rows = counts.failed_rows,
  status = case
    when counts.total_rows > 0 and counts.submitted_rows = counts.total_rows then 'submitted'
    when counts.submitted_rows > 0 then 'partially_submitted'
    when counts.failed_rows > 0 and counts.valid_rows = 0 then 'failed'
    else 'parsed'
  end
from (
  select
    import_batch_id,
    count(*)::integer as total_rows,
    count(*) filter (where status = 'parsed')::integer as valid_rows,
    count(*) filter (where status = 'invalid')::integer as invalid_rows,
    count(*) filter (where status in ('parsed', 'processing'))::integer as pending_rows,
    count(*) filter (where status = 'submitted')::integer as submitted_rows,
    count(*) filter (where status = 'failed')::integer as failed_rows
  from public.posp_misp_import_rows
  group by import_batch_id
) counts
where batch.id = counts.import_batch_id;

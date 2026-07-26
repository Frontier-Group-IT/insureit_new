begin;

create table if not exists public.intermediary_onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  initiated_by uuid,
  source text not null default 'manager_portal',
  requested_type text not null check (requested_type in ('posp','misp')),
  final_type text check (final_type is null or final_type in ('posp','misp','partner')),
  status text not null default 'submitted',
  current_step integer not null default 1,
  applicant_phone text,
  applicant_email text,
  draft_data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediary_onboarding_applications_status_idx
  on public.intermediary_onboarding_applications(status, updated_at desc);
create index if not exists intermediary_onboarding_applications_phone_idx
  on public.intermediary_onboarding_applications(applicant_phone);
create index if not exists intermediary_onboarding_applications_type_idx
  on public.intermediary_onboarding_applications(requested_type, status);

create table if not exists public.intermediary_onboarding_contacts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.intermediary_onboarding_applications(id) on delete cascade,
  contact_role text not null,
  full_name text,
  phone text,
  email text,
  is_designated_person boolean not null default false,
  login_required boolean not null default false,
  membership_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, contact_role)
);

create table if not exists public.intermediary_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.intermediary_onboarding_applications(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  verification_status text not null default 'pending',
  uploaded_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, document_type)
);

-- Preserve existing intermediary application IDs so links and PAN jobs remain stable.
insert into public.intermediary_onboarding_applications (
  id, profile_id, initiated_by, source, requested_type, final_type, status,
  current_step, applicant_phone, applicant_email, draft_data, submitted_at,
  reviewed_by, reviewed_at, completed_at, created_at, updated_at
)
select app.id, app.profile_id, app.initiated_by, app.source,
       app.partner_type, profile.final_account_type, app.status,
       app.current_step, app.applicant_phone, app.applicant_email,
       coalesce(app.draft_data, '{}'::jsonb), app.submitted_at,
       app.reviewed_by, app.reviewed_at, app.completed_at,
       app.created_at, app.updated_at
from public.customer_onboarding_applications app
left join public.posp_misp_onboarding_profiles profile on profile.application_id = app.id
where app.partner_type in ('posp','misp')
on conflict (id) do update set
  profile_id = excluded.profile_id,
  initiated_by = excluded.initiated_by,
  source = excluded.source,
  requested_type = excluded.requested_type,
  final_type = excluded.final_type,
  status = excluded.status,
  current_step = excluded.current_step,
  applicant_phone = excluded.applicant_phone,
  applicant_email = excluded.applicant_email,
  draft_data = excluded.draft_data,
  submitted_at = excluded.submitted_at,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  completed_at = excluded.completed_at,
  updated_at = excluded.updated_at;

insert into public.intermediary_onboarding_contacts (
  id, application_id, contact_role, full_name, phone, email,
  is_designated_person, login_required, membership_status, created_at, updated_at
)
select contact.id, contact.application_id, contact.contact_role, contact.full_name,
       contact.phone, contact.email,
       contact.contact_role in ('misp_dp','misp_primary_dp'),
       false, contact.membership_status, contact.created_at, contact.updated_at
from public.customer_onboarding_contacts contact
join public.intermediary_onboarding_applications app on app.id = contact.application_id
on conflict (id) do nothing;

insert into public.intermediary_onboarding_documents (
  id, application_id, document_type, file_name, storage_bucket, storage_path,
  mime_type, file_size, verification_status, uploaded_by, verified_by,
  verified_at, created_at, updated_at
)
select document.id, document.application_id, document.document_type,
       document.file_name, document.storage_bucket, document.storage_path,
       document.mime_type, document.file_size, document.verification_status,
       document.uploaded_by, document.verified_by, document.verified_at,
       document.created_at, document.updated_at
from public.customer_onboarding_documents document
join public.intermediary_onboarding_applications app on app.id = document.application_id
on conflict (id) do nothing;

-- Repoint intermediary-only relationships while preserving the application_id column name.
do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and rel.relname in ('posp_misp_onboarding_profiles','pan_verification_jobs','intermediaries','posp_misp_import_rows')
      and att.attname = 'application_id'
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.relname, r.conname);
  end loop;
end $$;

alter table public.posp_misp_onboarding_profiles
  add constraint posp_misp_profiles_intermediary_application_fk
  foreign key (application_id) references public.intermediary_onboarding_applications(id) on delete cascade;

alter table public.pan_verification_jobs
  add constraint pan_jobs_intermediary_application_fk
  foreign key (application_id) references public.intermediary_onboarding_applications(id) on delete cascade;

alter table public.intermediaries
  add constraint intermediaries_onboarding_application_fk
  foreign key (application_id) references public.intermediary_onboarding_applications(id) on delete set null;

-- Import rows may not have an application yet.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='posp_misp_import_rows' and column_name='application_id'
  ) then
    alter table public.posp_misp_import_rows
      add constraint posp_misp_import_rows_intermediary_application_fk
      foreign key (application_id) references public.intermediary_onboarding_applications(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

-- Move document synchronization to the dedicated intermediary document table.
drop trigger if exists trg_sync_intermediary_document on public.customer_onboarding_documents;
drop trigger if exists trg_sync_intermediary_document on public.intermediary_onboarding_documents;
create trigger trg_sync_intermediary_document
after insert or update on public.intermediary_onboarding_documents
for each row execute function public.sync_intermediary_document();

create or replace function public.sync_intermediary_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_intermediary_id uuid;
begin
  select intermediary_id into v_intermediary_id
  from public.intermediary_onboarding_applications app
  join public.intermediaries i on i.application_id = app.id
  where app.id = new.application_id
  limit 1;
  if v_intermediary_id is null then return new; end if;

  insert into public.intermediary_documents (
    intermediary_id, application_document_id, document_type, file_name,
    storage_bucket, storage_path, mime_type, file_size, verification_status,
    uploaded_by, verified_by, verified_at, updated_at
  ) values (
    v_intermediary_id, new.id, new.document_type, new.file_name,
    new.storage_bucket, new.storage_path, new.mime_type, new.file_size,
    new.verification_status, new.uploaded_by, new.verified_by, new.verified_at, now()
  )
  on conflict (intermediary_id, document_type) do update set
    application_document_id = excluded.application_document_id,
    file_name = excluded.file_name,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size = excluded.file_size,
    verification_status = excluded.verification_status,
    uploaded_by = excluded.uploaded_by,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now();
  return new;
end;
$$;

-- The intermediary master trigger must update the dedicated application record.
create or replace function public.sync_intermediary_application_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.intermediary_onboarding_applications
  set final_type = case when new.final_account_type = 'partner' then 'partner' else new.partner_type end,
      updated_at = now()
  where id = new.application_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_intermediary_application_link on public.posp_misp_onboarding_profiles;
create trigger trg_sync_intermediary_application_link
after insert or update of final_account_type, partner_type on public.posp_misp_onboarding_profiles
for each row execute function public.sync_intermediary_application_link();

create or replace function public.sync_intermediary_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_stage = 'completed' and old.workflow_stage is distinct from new.workflow_stage then
    update public.intermediary_onboarding_applications
    set status='approved', reviewed_by=coalesce(new.updated_by,reviewed_by),
        reviewed_at=coalesce(reviewed_at,now()), completed_at=coalesce(completed_at,now()), updated_at=now()
    where id=new.application_id;
  elsif new.partner_decision='do_not_proceed' and old.partner_decision is distinct from new.partner_decision then
    update public.intermediary_onboarding_applications
    set status='rejected', reviewed_by=coalesce(new.updated_by,reviewed_by),
        reviewed_at=coalesce(reviewed_at,now()), completed_at=coalesce(completed_at,now()), updated_at=now()
    where id=new.application_id;
  end if;
  return new;
end;
$$;

-- Dedicated queue RPC used by the intermediary onboarding page.
create or replace function public.get_intermediary_application_queue(
  p_query text default null,
  p_requested_type text default null,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid, partner_type text, source text, status text, applicant_phone text,
  applicant_name text, city text, external_onboarding_id text,
  document_count bigint, age_days integer, updated_at timestamptz, total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select app.id, app.requested_type as partner_type, app.source, app.status,
           app.applicant_phone,
           coalesce(profile.pos_name, profile.misp_name, profile.dp_name) as applicant_name,
           profile.city, profile.external_onboarding_id,
           count(document.id)::bigint as document_count,
           greatest(0, floor(extract(epoch from (now()-app.updated_at))/86400))::integer as age_days,
           app.updated_at
    from public.intermediary_onboarding_applications app
    left join public.posp_misp_onboarding_profiles profile on profile.application_id=app.id
    left join public.intermediary_onboarding_documents document on document.application_id=app.id
    where (p_requested_type is null or p_requested_type='' or app.requested_type=p_requested_type)
      and (p_status is null or p_status='' or app.status=p_status)
      and (p_query is null or p_query='' or
           coalesce(profile.pos_name,'') ilike '%'||p_query||'%' or
           coalesce(profile.misp_name,'') ilike '%'||p_query||'%' or
           coalesce(app.applicant_phone,'') ilike '%'||p_query||'%' or
           coalesce(profile.external_onboarding_id,'') ilike '%'||p_query||'%')
    group by app.id, profile.pos_name, profile.misp_name, profile.dp_name,
             profile.city, profile.external_onboarding_id
  ), numbered as (
    select filtered.*, count(*) over() as total_count
    from filtered
    order by updated_at desc
    offset greatest(0,(greatest(1,p_page)-1)*greatest(1,p_page_size))
    limit greatest(1,p_page_size)
  )
  select * from numbered;
$$;

grant execute on function public.get_intermediary_application_queue(text,text,text,integer,integer) to authenticated;

comment on table public.intermediary_onboarding_applications is 'Dedicated onboarding workflow for POSP, MISP and Business Associate conversion. Customer KYC does not write here.';
comment on table public.intermediary_onboarding_contacts is 'Contacts for intermediary onboarding only.';
comment on table public.intermediary_onboarding_documents is 'Common onboarding document set for POSP, MISP and Business Associates.';

commit;

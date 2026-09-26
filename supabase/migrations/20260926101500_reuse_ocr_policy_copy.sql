begin;

create table if not exists public.policy_ocr_document_staging (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  extracted_policy_no text,
  file_name text not null,
  storage_bucket text not null default 'policy-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_policy_id uuid references public.policies(id) on delete set null,
  constraint policy_ocr_document_staging_storage_unique unique (storage_bucket, storage_path)
);

create index if not exists policy_ocr_document_staging_match_idx
  on public.policy_ocr_document_staging (uploaded_by, consumed_at, created_at desc);

create index if not exists policy_ocr_document_staging_policy_no_idx
  on public.policy_ocr_document_staging (
    uploaded_by,
    (regexp_replace(upper(coalesce(extracted_policy_no, '')), '[^A-Z0-9]', '', 'g')),
    created_at desc
  )
  where consumed_at is null;

alter table public.policy_ocr_document_staging enable row level security;

create or replace function public.attach_staged_ocr_policy_copy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage public.policy_ocr_document_staging%rowtype;
  v_policy_no text := regexp_replace(upper(coalesce(new.policy_no, '')), '[^A-Z0-9]', '', 'g');
  v_candidate_count integer := 0;
begin
  if new.created_by is null then
    return new;
  end if;

  if exists (
    select 1 from public.policy_documents pd
    where pd.policy_id = new.id and pd.document_type = 'policy_copy'
  ) then
    return new;
  end if;

  if v_policy_no <> '' then
    select s.* into v_stage
    from public.policy_ocr_document_staging s
    where s.uploaded_by = new.created_by
      and s.consumed_at is null
      and s.created_at >= now() - interval '2 hours'
      and regexp_replace(upper(coalesce(s.extracted_policy_no, '')), '[^A-Z0-9]', '', 'g') = v_policy_no
    order by s.created_at desc
    limit 1
    for update skip locked;
  end if;

  -- If OCR could not read the policy number, only reuse a staged copy when there
  -- is exactly one unconsumed candidate for this operator. Never guess between
  -- multiple documents because that could attach the wrong customer's policy.
  if v_stage.id is null then
    select count(*) into v_candidate_count
    from public.policy_ocr_document_staging s
    where s.uploaded_by = new.created_by
      and s.consumed_at is null
      and s.created_at >= now() - interval '30 minutes';

    if v_candidate_count = 1 then
      select s.* into v_stage
      from public.policy_ocr_document_staging s
      where s.uploaded_by = new.created_by
        and s.consumed_at is null
        and s.created_at >= now() - interval '30 minutes'
      order by s.created_at desc
      limit 1
      for update skip locked;
    end if;
  end if;

  if v_stage.id is null then
    return new;
  end if;

  insert into public.policy_documents (
    policy_id,
    document_type,
    file_name,
    storage_bucket,
    storage_path,
    mime_type,
    file_size,
    uploaded_by
  ) values (
    new.id,
    'policy_copy',
    v_stage.file_name,
    v_stage.storage_bucket,
    v_stage.storage_path,
    v_stage.mime_type,
    v_stage.file_size,
    new.created_by
  )
  on conflict (storage_bucket, storage_path) do nothing;

  if found then
    update public.policy_ocr_document_staging
    set consumed_at = now(), consumed_policy_id = new.id
    where id = v_stage.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attach_staged_ocr_policy_copy on public.policies;
create trigger trg_attach_staged_ocr_policy_copy
after insert on public.policies
for each row execute function public.attach_staged_ocr_policy_copy();

commit;

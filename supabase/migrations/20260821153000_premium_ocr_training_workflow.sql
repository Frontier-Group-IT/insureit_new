begin;

alter table public.policy_ocr_training_labels
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists proposal jsonb,
  add column if not exists parser_id text,
  add column if not exists parser_version text,
  add column if not exists extraction_method text,
  add column if not exists proposed_at timestamptz,
  add column if not exists owner_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists owner_approved_at timestamptz;

alter table public.policy_ocr_training_labels
  drop constraint if exists policy_ocr_training_labels_status_check;
alter table public.policy_ocr_training_labels
  drop constraint if exists policy_ocr_training_labels_processing_status_check,
  drop constraint if exists policy_ocr_training_labels_attempts_check,
  drop constraint if exists policy_ocr_training_labels_separate_approval_check,
  drop constraint if exists policy_ocr_training_labels_approved_state_check;

update public.policy_ocr_training_labels
set status = 'reviewed'
where status = 'approved'
  and owner_approved_by is null;

alter table public.policy_ocr_training_labels
  add constraint policy_ocr_training_labels_status_check
    check (status in ('needs_review', 'reviewed', 'approved', 'rejected')),
  add constraint policy_ocr_training_labels_processing_status_check
    check (processing_status in ('pending', 'processing', 'ready', 'failed', 'exhausted')),
  add constraint policy_ocr_training_labels_attempts_check
    check (processing_attempts between 0 and 3),
  add constraint policy_ocr_training_labels_separate_approval_check
    check (
      owner_approved_by is null
      or (reviewed_by is not null and owner_approved_by <> reviewed_by)
    ),
  add constraint policy_ocr_training_labels_approved_state_check
    check (
      status <> 'approved'
      or (owner_approved_by is not null and owner_approved_at is not null)
    );

create index if not exists policy_ocr_training_labels_processing_idx
  on public.policy_ocr_training_labels(processing_status, next_attempt_at, created_at);

create table if not exists public.policy_ocr_training_candidates (
  id uuid primary key default gen_random_uuid(),
  training_label_id uuid not null unique
    references public.policy_ocr_training_labels(id) on delete cascade,
  candidate_payload jsonb not null,
  payload_checksum text not null,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.policy_ocr_training_candidates enable row level security;

drop policy if exists "policy OCR training labels operations manage"
  on public.policy_ocr_training_labels;

comment on table public.policy_ocr_training_labels is
  'Service-role-only OCR proposal and two-person review state. Contains approved Section 03 values, never raw OCR text or document bytes.';
comment on table public.policy_ocr_training_candidates is
  'Sanitized, owner-approved regression candidates. Candidate generation never modifies parser source.';

create or replace function public.queue_policy_ocr_training_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.document_type <> 'policy_copy' then
    return new;
  end if;

  insert into public.policy_ocr_training_labels (
    policy_document_id,
    processing_status,
    processing_attempts,
    next_attempt_at,
    status
  )
  values (new.id, 'pending', 0, now(), 'needs_review')
  on conflict (policy_document_id) do update
  set processing_status = 'pending',
      processing_attempts = 0,
      next_attempt_at = now(),
      lease_token = null,
      lease_expires_at = null,
      failure_code = null,
      proposal = null,
      parser_id = null,
      parser_version = null,
      extraction_method = null,
      proposed_at = null,
      insurer_name = null,
      policy_product = null,
      policy_number = null,
      valid_from = null,
      valid_upto = null,
      idv = null,
      od_premium = null,
      tp_premium = null,
      cpa_opted = null,
      cpa_premium = null,
      printed_net_premium = null,
      printed_gst = null,
      printed_gross_premium = null,
      evidence_note = null,
      status = 'needs_review',
      reviewed_by = null,
      reviewed_at = null,
      owner_approved_by = null,
      owner_approved_at = null,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists queue_policy_ocr_training_document
  on public.policy_documents;
create trigger queue_policy_ocr_training_document
after insert or update of storage_bucket, storage_path, mime_type, file_size
on public.policy_documents
for each row execute function public.queue_policy_ocr_training_document();

insert into public.policy_ocr_training_labels (
  policy_document_id,
  processing_status,
  processing_attempts,
  next_attempt_at,
  status
)
select document.id, 'pending', 0, now(), 'needs_review'
from public.policy_documents document
where document.document_type = 'policy_copy'
on conflict (policy_document_id) do nothing;

create or replace function public.claim_policy_ocr_training_jobs(
  p_limit integer default 2,
  p_lease_minutes integer default 4
)
returns table (
  label_id uuid,
  policy_document_id uuid,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select label.id
    from public.policy_ocr_training_labels label
    where label.processing_attempts < 3
      and (
        (
          label.processing_status in ('pending', 'failed')
          and label.next_attempt_at <= now()
        )
        or (
          label.processing_status = 'processing'
          and label.lease_expires_at < now()
        )
      )
    order by label.next_attempt_at, label.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 2), 3))
  ), claimed as (
    update public.policy_ocr_training_labels label
    set processing_status = 'processing',
        processing_attempts = label.processing_attempts + 1,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 4), 10))),
        failure_code = null,
        updated_at = now()
    from candidates
    where label.id = candidates.id
    returning label.id, label.policy_document_id, label.lease_token, label.processing_attempts
  )
  select
    claimed.id,
    claimed.policy_document_id,
    document.file_name,
    document.storage_bucket,
    document.storage_path,
    document.mime_type,
    document.file_size,
    claimed.lease_token,
    claimed.processing_attempts
  from claimed
  join public.policy_documents document on document.id = claimed.policy_document_id
  where document.document_type = 'policy_copy';
end;
$$;

create or replace function public.complete_policy_ocr_training_job(
  p_label_id uuid,
  p_lease_token uuid,
  p_proposal jsonb,
  p_parser_id text,
  p_parser_version text,
  p_extraction_method text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_proposal) is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(p_proposal) key
      where key not in ('fields', 'warnings')
    )
  then
    raise exception 'invalid_training_proposal';
  end if;

  update public.policy_ocr_training_labels
  set processing_status = 'ready',
      proposal = p_proposal,
      parser_id = left(nullif(trim(p_parser_id), ''), 120),
      parser_version = left(nullif(trim(p_parser_version), ''), 80),
      extraction_method = left(nullif(trim(p_extraction_method), ''), 80),
      proposed_at = now(),
      lease_token = null,
      lease_expires_at = null,
      failure_code = null,
      next_attempt_at = now(),
      status = 'needs_review',
      updated_at = now()
  where id = p_label_id
    and processing_status = 'processing'
    and lease_token = p_lease_token
    and lease_expires_at >= now();

  return found;
end;
$$;

create or replace function public.fail_policy_ocr_training_job(
  p_label_id uuid,
  p_lease_token uuid,
  p_failure_code text,
  p_retryable boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.policy_ocr_training_labels
  set processing_status = case
        when not p_retryable or processing_attempts >= 3 then 'exhausted'
        else 'failed'
      end,
      next_attempt_at = case
        when not p_retryable or processing_attempts >= 3 then now()
        when processing_attempts = 1 then now() + interval '5 minutes'
        else now() + interval '30 minutes'
      end,
      failure_code = left(coalesce(nullif(trim(p_failure_code), ''), 'processing_failed'), 80),
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_label_id
    and processing_status = 'processing'
    and lease_token = p_lease_token;

  return found;
end;
$$;

create or replace function public.approve_policy_ocr_training_candidate(
  p_label_id uuid,
  p_actor_id uuid,
  p_candidate_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label public.policy_ocr_training_labels%rowtype;
  v_candidate_id uuid;
begin
  select *
  into v_label
  from public.policy_ocr_training_labels
  where id = p_label_id
  for update;

  if not found or v_label.status <> 'reviewed' or v_label.reviewed_by is null then
    raise exception 'training_label_not_reviewed';
  end if;
  if v_label.reviewed_by = p_actor_id then
    raise exception 'training_label_self_approval_forbidden';
  end if;
  if jsonb_typeof(p_candidate_payload) is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(p_candidate_payload) key
      where key not in ('schema_version', 'parser_id', 'parser_version', 'ground_truth', 'evidence_labels')
    )
    or jsonb_typeof(p_candidate_payload -> 'ground_truth') is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(
        case
          when jsonb_typeof(p_candidate_payload -> 'ground_truth') = 'object'
            then p_candidate_payload -> 'ground_truth'
          else '{}'::jsonb
        end
      ) key
      where key not in (
        'insurer_name', 'policy_product', 'policy_number', 'valid_from', 'valid_upto',
        'idv', 'od_premium', 'tp_premium', 'cpa_opted', 'cpa_premium',
        'printed_net_premium', 'printed_gst', 'printed_gross_premium'
      )
    )
    or coalesce(p_candidate_payload #>> '{ground_truth,policy_number}', '') !~ '^SYN-[A-F0-9]{12}$'
  then
    raise exception 'invalid_training_candidate';
  end if;

  insert into public.policy_ocr_training_candidates (
    training_label_id,
    candidate_payload,
    payload_checksum,
    approved_by,
    approved_at
  )
  values (
    p_label_id,
    p_candidate_payload,
    md5(p_candidate_payload::text),
    p_actor_id,
    now()
  )
  on conflict (training_label_id) do update
  set candidate_payload = excluded.candidate_payload,
      payload_checksum = excluded.payload_checksum,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at
  returning id into v_candidate_id;

  update public.policy_ocr_training_labels
  set status = 'approved',
      owner_approved_by = p_actor_id,
      owner_approved_at = now(),
      updated_at = now()
  where id = p_label_id;

  return v_candidate_id;
end;
$$;

revoke all on function public.claim_policy_ocr_training_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_policy_ocr_training_job(uuid, uuid, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_policy_ocr_training_job(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_policy_ocr_training_jobs(integer, integer) to service_role;
grant execute on function public.complete_policy_ocr_training_job(uuid, uuid, jsonb, text, text, text) to service_role;
grant execute on function public.fail_policy_ocr_training_job(uuid, uuid, text, boolean) to service_role;
grant execute on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) to service_role;

commit;

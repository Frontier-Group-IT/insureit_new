-- Incident-limited recovery: 2026-11-27 before-conversion worker crash.
-- Vercel logged auto_booking_recovery_claim_unavailable at each claim time.
-- Existing nine Tata bundled PDFs were claimed BEFORE the failing recovery RPC,
-- and convertVerifiedAiIntake was never entered by those failed invocations.
-- This second immutable ledger never modifies/reopens the original attempt.
create table if not exists public.policy_intake_ai_stranded_claim_recovery (
  intake_id uuid primary key references public.policy_intake_requests(id),
  document_id uuid not null references public.policy_intake_documents(id),
  extraction_fingerprint text not null
    check (extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'),
  operator_profile_id uuid not null,
  state text not null default 'claimed'
    check (state in ('claimed','booked','review_required','uncertain')),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  policy_id uuid,
  failure_code text,
  check ((state='booked' and policy_id is not null)
    or (state<>'booked' and policy_id is null))
);
alter table public.policy_intake_ai_stranded_claim_recovery enable row level security;
revoke all on public.policy_intake_ai_stranded_claim_recovery from public, anon, authenticated;
grant select,insert,update on public.policy_intake_ai_stranded_claim_recovery to service_role;

create or replace function public.claim_ai_auto_booking_stranded_v1(
  p_operator_profile_id uuid,p_limit integer default 1
) returns table(intake_id uuid,document_id uuid,extraction_fingerprint text)
language plpgsql security invoker
set search_path to public,pg_catalog
as $$
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_operator_profile_id is null or p_limit <> 1
    then raise exception 'invalid_claim_parameters'; end if;
  return query
  with eligible as (
    select q.intake_id,q.document_id,q.extraction_fingerprint
    from public.policy_intake_ai_processing_queue q
    join public.policy_intake_requests i on i.id=q.intake_id
    join public.policy_intake_documents d on d.id=q.document_id
      and d.intake_id=i.id and d.is_current=true
      and d.storage_bucket=i.storage_bucket and d.storage_path=i.storage_path
    join public.policy_intake_ai_auto_booking_attempts a on a.intake_id=q.intake_id
      and a.document_id=q.document_id
      and a.extraction_fingerprint=q.extraction_fingerprint
    where i.intake_number in (
      'PIR-261127-D5408F','PIR-261127-6599F5',
      'PIR-261127-2FCC38','PIR-261127-CBF2A2',
      'PIR-261127-7254DB','PIR-261127-DFD3B1',
      'PIR-261127-4C5AA2','PIR-261127-CFF840',
      'PIR-261127-0383BA')
      and a.claimed_at >= timestamptz '2026-11-27 04:39:00+00'
      and a.claimed_at < timestamptz '2026-11-27 04:45:00+00'
      and a.state='claimed' and a.finished_at is null and a.policy_id is null
      and q.state='verified' and cardinality(q.exception_codes)=0
      and q.parser_id='tata_aig_two_wheeler_bundled_n8n_native_pdf'
      and q.checks_passed=18
      and q.extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'
      and i.policy_type='motor' and i.final_policy_id is null
      and i.status='ready_for_review' and i.assigned_to_profile_id is null
      and not exists (
        select 1 from public.policy_intake_onboarding_drafts draft
        where draft.intake_id=i.id)
      and not exists (
        select 1 from public.policy_intake_ai_stranded_claim_recovery past
        where past.intake_id=i.id)
    order by i.created_at,i.id limit p_limit
  ), inserted as (
    insert into public.policy_intake_ai_stranded_claim_recovery as recovery
      (intake_id,operator_profile_id,document_id,extraction_fingerprint)
    select candidate.intake_id,p_operator_profile_id,
      candidate.document_id,candidate.extraction_fingerprint
    from eligible candidate
    on conflict on constraint policy_intake_ai_stranded_claim_recovery_pkey do nothing
    returning recovery.intake_id,recovery.document_id,recovery.extraction_fingerprint
  )
  select inserted.intake_id,inserted.document_id,inserted.extraction_fingerprint
  from inserted;
end $$;

create or replace function public.finish_ai_auto_booking_stranded_v1(
  p_intake_id uuid,p_document_id uuid,p_fingerprint text,p_state text,
  p_policy_id uuid default null,p_failure_code text default null
) returns boolean language plpgsql security invoker
set search_path to public,pg_catalog
as $$
declare changed integer;
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_state not in ('booked','review_required','uncertain') then
    raise exception 'invalid_attempt_result'; end if;
  if p_state='booked' and (p_policy_id is null or p_failure_code is not null)
    then raise exception 'invalid_booked_result'; end if;
  if p_state<>'booked' and (p_policy_id is not null
    or p_failure_code is null or p_failure_code !~ '^[a-z0-9_]{1,80}$')
    then raise exception 'invalid_review_result'; end if;
  update public.policy_intake_ai_stranded_claim_recovery r
    set state=p_state,policy_id=p_policy_id,
        failure_code=p_failure_code,finished_at=now()
    where r.intake_id=p_intake_id and r.document_id=p_document_id
      and r.extraction_fingerprint=p_fingerprint and r.state='claimed';
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.claim_ai_auto_booking_stranded_v1(uuid,integer)
  from public,anon,authenticated;
revoke all on function public.finish_ai_auto_booking_stranded_v1(uuid,uuid,text,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.claim_ai_auto_booking_stranded_v1(uuid,integer)
  to service_role;
grant execute on function public.finish_ai_auto_booking_stranded_v1(uuid,uuid,text,text,uuid,text)
  to service_role;

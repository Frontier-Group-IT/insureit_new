-- Durable, one-attempt-per-intake automatic booking claim. Deliberately no
-- automatic retry after a write has possibly started, even on worker crashes.
-- Service role only; manual recovery requires a separately audited change.
begin;
create table if not exists public.policy_intake_ai_auto_booking_attempts (
  intake_id uuid primary key references public.policy_intake_requests(id) on delete restrict,
  document_id uuid not null,
  extraction_fingerprint text not null check (extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'),
  state text not null default 'claimed'
    check (state in ('claimed','booked','review_required','uncertain')),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  policy_id uuid,
  failure_code text,
  constraint ai_auto_booking_terminal_timestamp check (
    (state='claimed' and finished_at is null) or
    (state<>'claimed' and finished_at is not null)
  )
);
create index if not exists ai_auto_booking_attempts_state_idx
  on public.policy_intake_ai_auto_booking_attempts(state,claimed_at);
alter table public.policy_intake_ai_auto_booking_attempts enable row level security;
revoke all on public.policy_intake_ai_auto_booking_attempts from public,anon,authenticated;
grant select,insert,update on public.policy_intake_ai_auto_booking_attempts to service_role;

create or replace function public.claim_ai_auto_booking_v1(p_limit integer default 3)
returns table(intake_id uuid,document_id uuid,extraction_fingerprint text)
language plpgsql security invoker set search_path = public,pg_catalog as $$
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_limit < 1 or p_limit > 5 then raise exception 'invalid_claim_limit'; end if;
  return query
    with selected as (
      select q.intake_id,q.document_id,q.extraction_fingerprint
      from public.policy_intake_ai_processing_queue q
      join public.policy_intake_requests i on i.id=q.intake_id
      join public.policy_intake_documents d
        on d.id=q.document_id and d.intake_id=i.id and d.is_current=true
        and d.storage_bucket=i.storage_bucket and d.storage_path=i.storage_path
      where q.state='verified' and cardinality(q.exception_codes)=0
        and q.extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'
        and i.policy_type='motor'
        and i.final_policy_id is null
        -- Never silently take over an Intake already owned by a reviewer.
        and i.assigned_to_profile_id is null
        and i.status in ('ready_for_review','in_review','needs_attention','processing')
        and not exists (
          select 1 from public.policy_intake_ai_auto_booking_attempts a
          where a.intake_id=q.intake_id
        )
      order by i.created_at,i.id
      limit p_limit
    ), inserted as (
      insert into public.policy_intake_ai_auto_booking_attempts as a
        (intake_id,document_id,extraction_fingerprint)
      select s.intake_id,s.document_id,s.extraction_fingerprint from selected s
      on conflict (intake_id) do nothing
      returning a.intake_id,a.document_id,a.extraction_fingerprint
    )
    select a.intake_id,a.document_id,a.extraction_fingerprint from inserted a;
end;
$$;
revoke all on function public.claim_ai_auto_booking_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_ai_auto_booking_v1(integer) to service_role;

create or replace function public.finish_ai_auto_booking_v1(
 p_intake_id uuid,p_document_id uuid,p_fingerprint text,p_state text,
 p_policy_id uuid default null,p_failure_code text default null
) returns boolean language plpgsql security invoker
set search_path=public,pg_catalog as $$
declare changed integer;
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_state not in ('booked','review_required','uncertain')
      or p_failure_code !~ '^[a-z0-9_]{1,80}$' then
    -- Failure code is optional for confirmed bookings only.
    if not (p_state='booked' and p_failure_code is null) then
      raise exception 'invalid_attempt_result';
    end if;
  end if;
  if p_state='booked' and p_policy_id is null then
    raise exception 'policy_id_required';
  end if;
  update public.policy_intake_ai_auto_booking_attempts a
  set state=p_state,policy_id=p_policy_id,failure_code=p_failure_code,finished_at=now()
  where a.intake_id=p_intake_id and a.document_id=p_document_id
    and a.extraction_fingerprint=p_fingerprint and a.state='claimed';
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;
revoke all on function public.finish_ai_auto_booking_v1(uuid,uuid,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.finish_ai_auto_booking_v1(uuid,uuid,text,text,uuid,text)
 to service_role;
commit;

-- Recovery is a SECOND immutable attempt. Never delete or recycle the v1
-- ledger: uncertain/booked/claimed outcomes are explicitly ineligible.
-- Previous Liberty insured_name_mismatch is a pre-transaction validation
-- failure, fixed by the native-PDF evidence mapping in commit 6f338bd9.
create table if not exists public.policy_intake_ai_auto_booking_recovery_attempts (
 intake_id uuid primary key references public.policy_intake_requests(id),
 operator_profile_id uuid not null,
 document_id uuid not null references public.policy_intake_documents(id),
 extraction_fingerprint text not null
   check (extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'),
 recovery_reason text not null default 'liberty_insured_name_evidence_fixed'
   check (recovery_reason='liberty_insured_name_evidence_fixed'),
 state text not null default 'claimed'
   check (state in ('claimed','booked','review_required','uncertain')),
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 policy_id uuid,
 failure_code text,
 check ((state='booked' and policy_id is not null)
   or (state<>'booked' and policy_id is null))
);
alter table public.policy_intake_ai_auto_booking_recovery_attempts enable row level security;
revoke all on public.policy_intake_ai_auto_booking_recovery_attempts from public, anon, authenticated;
grant select,insert,update on public.policy_intake_ai_auto_booking_recovery_attempts to service_role;

create or replace function public.claim_ai_auto_booking_liberty_recovery_v1(
 p_operator_profile_id uuid,p_limit integer default 3
) returns table(intake_id uuid,document_id uuid,extraction_fingerprint text)
 language plpgsql security invoker
 set search_path to public,pg_catalog
as $$
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_operator_profile_id is null or p_limit < 1 or p_limit > 3
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
   where q.state='verified' and cardinality(q.exception_codes)=0
     and q.parser_id='liberty_two_wheeler_tp_native_pdf'
     and q.checks_passed=18
     and q.extraction_fingerprint ~ '^[0-9a-fA-F]{64}$'
     and a.state='review_required' and a.failure_code='insured_name_mismatch'
     and a.policy_id is null and a.finished_at is not null
     and i.policy_type='motor' and i.final_policy_id is null
     and i.assigned_to_profile_id is null
     and i.status in ('ready_for_review','in_review','needs_attention','processing')
     and not exists (
       select 1 from public.policy_intake_ai_auto_booking_recovery_attempts r
       where r.intake_id=q.intake_id
     )
   order by i.created_at,i.id limit p_limit
 ), inserted as (
   insert into public.policy_intake_ai_auto_booking_recovery_attempts as r
     (intake_id,operator_profile_id,document_id,extraction_fingerprint)
   select e.intake_id,p_operator_profile_id,e.document_id,e.extraction_fingerprint
   from eligible e
   on conflict (intake_id) do nothing
   returning r.intake_id,r.document_id,r.extraction_fingerprint
 )
 select r.intake_id,r.document_id,r.extraction_fingerprint from inserted r;
end $$;

create or replace function public.finish_ai_auto_booking_liberty_recovery_v1(
 p_intake_id uuid,p_document_id uuid,p_fingerprint text,p_state text,
 p_policy_id uuid default null,p_failure_code text default null
) returns boolean language plpgsql security invoker
 set search_path to public,pg_catalog
as $$
declare changed integer;
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_state not in ('booked','review_required','uncertain') then raise exception 'invalid_attempt_result'; end if;
 if p_state='booked' and (p_policy_id is null or p_failure_code is not null)
   then raise exception 'invalid_booked_result'; end if;
 if p_state<>'booked' and (p_policy_id is not null
    or p_failure_code is null or p_failure_code !~ '^[a-z0-9_]{1,80}$')
   then raise exception 'invalid_review_result'; end if;
 update public.policy_intake_ai_auto_booking_recovery_attempts r
   set state=p_state,policy_id=p_policy_id,
     failure_code=p_failure_code,finished_at=now()
 where r.intake_id=p_intake_id and r.document_id=p_document_id
   and r.extraction_fingerprint=p_fingerprint and r.state='claimed';
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.claim_ai_auto_booking_liberty_recovery_v1(uuid,integer) from public,anon,authenticated;
revoke all on function public.finish_ai_auto_booking_liberty_recovery_v1(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_ai_auto_booking_liberty_recovery_v1(uuid,integer) to service_role;
grant execute on function public.finish_ai_auto_booking_liberty_recovery_v1(uuid,uuid,text,text,uuid,text) to service_role;

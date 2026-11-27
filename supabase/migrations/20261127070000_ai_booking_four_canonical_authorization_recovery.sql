-- Four exact, independently reviewed canonical authorization failures.
-- No existing claim or recovery ledger is changed; no Tata AIG intake is eligible.
-- Worker deployment is a separate release gate. Claims are immutable/exactly-once.
create table if not exists public.policy_intake_ai_canonical_recovery_attempts (
 intake_id uuid primary key references public.policy_intake_requests(id),
 operator_profile_id uuid not null,
 document_id uuid not null references public.policy_intake_documents(id),
 extraction_fingerprint text not null check (extraction_fingerprint ~ '^[a-fA-F0-9]{64}$'),
 recovery_reason text not null default 'canonical_claim_authorization_fix'
   check (recovery_reason='canonical_claim_authorization_fix'),
 state text not null default 'claimed'
   check (state in ('claimed','booked','review_required','uncertain')),
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 policy_id uuid,
 failure_code text,
 check ((state='booked' and policy_id is not null)
   or (state<>'booked' and policy_id is null))
);
alter table public.policy_intake_ai_canonical_recovery_attempts enable row level security;
revoke all on public.policy_intake_ai_canonical_recovery_attempts from public,anon,authenticated;
grant select,insert,update on public.policy_intake_ai_canonical_recovery_attempts to service_role;

create or replace function public.claim_ai_auto_booking_canonical_recovery_v1(
 p_operator_profile_id uuid,p_limit integer default 4
) returns table(intake_id uuid,document_id uuid,extraction_fingerprint text)
language plpgsql security invoker
set search_path to public,pg_catalog
as $$
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_operator_profile_id is null or p_limit < 1 or p_limit > 4
 then raise exception 'invalid_claim_parameters'; end if;
 return query
 with eligible as (
  select q.intake_id,q.document_id,q.extraction_fingerprint
  from public.policy_intake_requests i
  join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
  join public.policy_intake_documents d on d.id=q.document_id
    and d.intake_id=i.id and d.is_current=true
    and d.storage_bucket=i.storage_bucket and d.storage_path=i.storage_path
  join public.policy_intake_ai_auto_booking_attempts a on a.intake_id=i.id
    and a.document_id=q.document_id and a.extraction_fingerprint=q.extraction_fingerprint
  join public.policy_intake_onboarding_drafts draft on draft.intake_id=i.id
  left join public.policy_intake_ai_auto_booking_recovery_attempts ar on ar.intake_id=i.id
  where i.id in (
    'ba05c92f-f318-47d8-a558-25fe704928c3'::uuid,
    'fc1940fc-4dcb-47cb-a6a9-8fbedb5a2b52'::uuid,
    'de17caf2-b747-4dce-97a1-d1d40e87a1b6'::uuid,
    '18f8eb14-0414-48d8-899d-1939a56ddf9e'::uuid)
    and i.policy_type='motor' and i.status='in_review'
    and i.assigned_to_profile_id is null and i.final_policy_id is null
    and draft.revision >= 1
    and q.state='verified' and cardinality(q.exception_codes)=0
    and q.extraction_fingerprint ~ '^[a-fA-F0-9]{64}$'
    and a.operator_profile_id=p_operator_profile_id
    and a.state='review_required' and a.finished_at is not null
    and a.policy_id is null
    and (
      (i.id='18f8eb14-0414-48d8-899d-1939a56ddf9e'::uuid
       and q.parser_id='icici_3005_n8n_native_pdf'
       and q.checks_passed=13
       and a.failure_code='canonical_booking_review'
       and ar.intake_id is null)
      or
      (i.id in (
        'ba05c92f-f318-47d8-a558-25fe704928c3'::uuid,
        'fc1940fc-4dcb-47cb-a6a9-8fbedb5a2b52'::uuid,
        'de17caf2-b747-4dce-97a1-d1d40e87a1b6'::uuid)
       and q.parser_id='liberty_two_wheeler_tp_native_pdf'
       and q.checks_passed=18
       and a.failure_code='insured_name_mismatch'
       and ar.state='review_required'
       and ar.failure_code='canonical_booking_review'
       and ar.finished_at is not null and ar.policy_id is null
       and ar.operator_profile_id=p_operator_profile_id
       and ar.document_id=q.document_id
       and ar.extraction_fingerprint=q.extraction_fingerprint)
    )
    and not exists (select 1 from public.policy_intake_ai_stranded_claim_recovery s
                    where s.intake_id=i.id)
    and not exists (select 1 from public.policy_intake_ai_canonical_recovery_attempts previous
                    where previous.intake_id=i.id)
  order by i.created_at,i.id limit p_limit
 ), inserted as (
  insert into public.policy_intake_ai_canonical_recovery_attempts as c
   (intake_id,operator_profile_id,document_id,extraction_fingerprint)
  select e.intake_id,p_operator_profile_id,e.document_id,e.extraction_fingerprint from eligible e
  on conflict on constraint policy_intake_ai_canonical_recovery_attempts_pkey do nothing
  returning c.intake_id,c.document_id,c.extraction_fingerprint
 )
 select inserted.intake_id,inserted.document_id,inserted.extraction_fingerprint from inserted;
end $$;

create or replace function public.finish_ai_auto_booking_canonical_recovery_v1(
 p_intake_id uuid,p_document_id uuid,p_fingerprint text,p_state text,
 p_policy_id uuid default null,p_failure_code text default null
) returns boolean
language plpgsql security invoker
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
 update public.policy_intake_ai_canonical_recovery_attempts c
 set state=p_state,policy_id=p_policy_id,failure_code=p_failure_code,finished_at=now()
 where c.intake_id=p_intake_id and c.document_id=p_document_id
   and c.extraction_fingerprint=p_fingerprint and c.state='claimed';
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.claim_ai_auto_booking_canonical_recovery_v1(uuid,integer)
 from public,anon,authenticated;
revoke all on function public.finish_ai_auto_booking_canonical_recovery_v1(uuid,uuid,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.claim_ai_auto_booking_canonical_recovery_v1(uuid,integer) to service_role;
grant execute on function public.finish_ai_auto_booking_canonical_recovery_v1(uuid,uuid,text,text,uuid,text) to service_role;

-- Canonical finalizer: keep every original document, draft, ownership and
-- transaction guard. Extend only the verified active-claim authorization test.
create or replace function public.finalize_policy_intake_motor_v1(
 p_intake_id uuid,p_payload jsonb,p_expected_revision integer
) returns jsonb language plpgsql security definer
set search_path to public
as $$
declare
 v_actor uuid;
 v_intake public.policy_intake_requests%rowtype;
 v_draft public.policy_intake_onboarding_drafts%rowtype;
 v_policy_result jsonb;
 v_policy_id uuid;
 v_document public.policy_intake_documents%rowtype;
begin
 v_actor:=nullif(p_payload #>> '{meta,requestedBy}','')::uuid;
 if v_actor is null then raise exception 'Policy Intake finalization requires an authenticated actor.'; end if;
 select * into v_intake from public.policy_intake_requests where id=p_intake_id for update;
 if v_intake.id is null then raise exception 'Policy Intake not found.'; end if;
 if v_intake.status<>'in_review' then raise exception 'Policy Intake is not in review.'; end if;
 if v_intake.assigned_to_profile_id is distinct from v_actor then
  if v_intake.assigned_to_profile_id is not null or
   (not exists (
     select 1 from public.policy_intake_ai_auto_booking_attempts a
     join public.policy_intake_ai_processing_queue q on q.intake_id=a.intake_id
     join public.policy_intake_documents d on d.id=a.document_id
     where a.intake_id=p_intake_id and a.operator_profile_id=v_actor
       and a.state='claimed'
       and q.state='verified' and cardinality(q.exception_codes)=0
       and q.document_id=a.document_id
       and q.extraction_fingerprint=a.extraction_fingerprint
       and d.intake_id=p_intake_id and d.is_current=true
       and d.storage_bucket=v_intake.storage_bucket
       and d.storage_path=v_intake.storage_path
   ) and not exists (
     select 1 from public.policy_intake_ai_canonical_recovery_attempts c
     join public.policy_intake_ai_processing_queue q on q.intake_id=c.intake_id
     join public.policy_intake_documents d on d.id=c.document_id
     where c.intake_id=p_intake_id and c.operator_profile_id=v_actor
       and c.state='claimed'
       and c.recovery_reason='canonical_claim_authorization_fix'
       and q.state='verified' and cardinality(q.exception_codes)=0
       and q.document_id=c.document_id
       and q.extraction_fingerprint=c.extraction_fingerprint
       and d.intake_id=p_intake_id and d.is_current=true
       and d.storage_bucket=v_intake.storage_bucket
       and d.storage_path=v_intake.storage_path
   )) then
    raise exception 'Policy Intake requires an explicitly assigned reviewer or an active verified automation claim.';
  end if;
 end if;
 if v_intake.final_policy_id is not null then raise exception 'Policy Intake is already finalized.'; end if;
 select * into v_draft from public.policy_intake_onboarding_drafts where intake_id=p_intake_id for update;
 if v_draft.intake_id is null then raise exception 'Policy Intake draft is missing.'; end if;
 if v_draft.revision<>p_expected_revision then raise exception 'Policy Intake draft changed. Reload before finalizing.'; end if;
 v_policy_result:=public.onboard_motor_policy_commercial_status_v2(p_payload);
 v_policy_id:=nullif(v_policy_result->>'policyId','')::uuid;
 if coalesce((v_policy_result->>'ok')::boolean,false) is not true or v_policy_id is null
 then raise exception 'Policy booking did not return a valid policy.'; end if;
 select * into v_document from public.policy_intake_documents
 where intake_id=p_intake_id and is_current
 order by created_at desc limit 1;
 if v_document.id is null then raise exception 'Current Policy Intake document is missing.'; end if;
 insert into public.policy_documents(
  policy_id,document_type,file_name,storage_bucket,storage_path,
  mime_type,file_size,uploaded_by,source_intake_id,source_intake_document_id
 ) values (
  v_policy_id,'policy_copy',v_document.file_name,v_document.storage_bucket,
  v_document.storage_path,v_document.mime_type,v_document.file_size,
  v_actor,p_intake_id,v_document.id
 )
 on conflict(storage_bucket,storage_path) do update
 set policy_id=excluded.policy_id,
     document_type=excluded.document_type,
     source_intake_id=excluded.source_intake_id,
     source_intake_document_id=excluded.source_intake_document_id,
     uploaded_by=excluded.uploaded_by,
     updated_at=now();
 update public.policy_intake_requests
 set status='completed',final_policy_id=v_policy_id,finalized_by_profile_id=v_actor,
     finalized_at=now(),attention_reason=null where id=p_intake_id;
 delete from public.policy_intake_onboarding_drafts where intake_id=p_intake_id;
 return v_policy_result;
end; $$;

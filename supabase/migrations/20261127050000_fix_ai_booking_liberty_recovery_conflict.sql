-- Repair SQLSTATE 42702: RETURNS TABLE intake_id is a PL/pgSQL variable,
-- so ON CONFLICT (intake_id) was ambiguous. The constraint is unambiguous.
-- Preserve SECURITY INVOKER and all eligibility/one-time safety guards.
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
   on conflict on constraint policy_intake_ai_auto_booking_recovery_attempts_pkey do nothing
   returning r.intake_id,r.document_id,r.extraction_fingerprint
 )
 select r.intake_id,r.document_id,r.extraction_fingerprint from inserted r;
end $$;


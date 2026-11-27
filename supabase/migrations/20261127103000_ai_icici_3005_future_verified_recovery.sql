-- Future verified ICICI 3005 source-only auto-booking claim authorization recovery.
-- Applies once to Nov 27+ verified 13/13 ICICI intakes with original terminal
-- canonical_booking_review, no prior other recovery, exact current PDF/hash,
-- no actor mismatch or final policy and no assigned reviewer. Bounded by the
-- existing one-attempt PK ledger, standard booking checks and worker auth.
-- Original historical allowlisted case with prior canonical recovery remains.
-- Never claims uncertain, arbitrary insurers, pre-Nov-27 intakes, or Tata AIG.
CREATE OR REPLACE FUNCTION public.claim_ai_auto_booking_icici_recovery_v1(p_operator_profile_id uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(intake_id uuid, document_id uuid, extraction_fingerprint text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_operator_profile_id is null or p_limit < 1 or p_limit > 3 then
   raise exception 'invalid_claim_parameters'; end if;
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
  left join public.policy_intake_ai_canonical_recovery_attempts c on c.intake_id=i.id
  where (i.id in (
    '0e14ab20-85da-4327-950f-231fdd2fe7cf'::uuid,
    '99f5ec77-0937-4d5a-beca-3caae2e033f3'::uuid,
    '18f8eb14-0414-48d8-899d-1939a56ddf9e'::uuid,
    'b7e66412-fea7-4526-883a-9c8987fc2181'::uuid)
    or (i.created_at >= '2026-11-27 00:00:00+00'::timestamptz
        and c.intake_id is null))
   and i.policy_type='motor'
   and i.status='in_review'
   and i.final_policy_id is null
   and i.assigned_to_profile_id is null
   and draft.revision>=1
   and q.parser_id='icici_3005_n8n_native_pdf'
   and q.checks_passed=13
   and q.state='verified'
   and cardinality(q.exception_codes)=0
   and q.extraction_fingerprint ~ '^[a-fA-F0-9]{64}$'
   and a.operator_profile_id=p_operator_profile_id
   and a.state='review_required'
   and a.failure_code='canonical_booking_review'
   and a.finished_at is not null
   and a.policy_id is null
   and (
    (i.id='18f8eb14-0414-48d8-899d-1939a56ddf9e'::uuid
     and c.state='review_required'
     and c.failure_code='canonical_booking_review'
     and c.finished_at is not null
     and c.policy_id is null
     and c.document_id=q.document_id
     and c.extraction_fingerprint=q.extraction_fingerprint
     and c.operator_profile_id=p_operator_profile_id)
    or
    (i.created_at >= '2026-11-27 00:00:00+00'::timestamptz
     and c.intake_id is null)
   )
   and not exists (select 1 from public.policy_intake_ai_auto_booking_recovery_attempts lr where lr.intake_id=i.id)
   and not exists (select 1 from public.policy_intake_ai_stranded_claim_recovery sr where sr.intake_id=i.id)
   and not exists (select 1 from public.policy_intake_ai_icici_recovery_attempts past where past.intake_id=i.id)
  order by i.created_at,i.id limit p_limit
 ), inserted as (
  insert into public.policy_intake_ai_icici_recovery_attempts as ir
    (intake_id,operator_profile_id,document_id,extraction_fingerprint)
  select e.intake_id,p_operator_profile_id,e.document_id,e.extraction_fingerprint from eligible e
  on conflict on constraint policy_intake_ai_icici_recovery_attempts_pkey do nothing
  returning ir.intake_id,ir.document_id,ir.extraction_fingerprint
 )
 select inserted.intake_id,inserted.document_id,inserted.extraction_fingerprint from inserted;
end $function$
;

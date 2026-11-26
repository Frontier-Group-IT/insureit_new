-- Allow existing atomic canonical booking and policy-copy linking to finalize
-- an unassigned verified Intake ONLY when the authorized operator owns its
-- still-claimed durable automation attempt. Manual review ownership unchanged.
CREATE OR REPLACE FUNCTION public.finalize_policy_intake_motor_v1(p_intake_id uuid, p_payload jsonb, p_expected_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid; v_intake public.policy_intake_requests%rowtype; v_draft public.policy_intake_onboarding_drafts%rowtype;
  v_policy_result jsonb; v_policy_id uuid; v_document public.policy_intake_documents%rowtype;
begin
  v_actor:=nullif(p_payload #>> '{meta,requestedBy}','')::uuid;
  if v_actor is null then raise exception 'Policy Intake finalization requires an authenticated actor.'; end if;
  select * into v_intake from public.policy_intake_requests where id=p_intake_id for update;
  if v_intake.id is null then raise exception 'Policy Intake not found.'; end if;
  if v_intake.status<>'in_review' then raise exception 'Policy Intake is not in review.'; end if;
  -- Manual review still requires the assigned reviewer. Automated finalization
  -- is permitted ONLY for an unassigned Intake with a durable, still-claimed
  -- booking attempt held by the same verified automation actor, against the
  -- unchanged current source PDF and verified n8n extraction.
  if v_intake.assigned_to_profile_id is distinct from v_actor then
    if v_intake.assigned_to_profile_id is not null or not exists (
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
    ) then
      raise exception 'Policy Intake requires an explicitly assigned reviewer or an active verified automation claim.';
    end if;
  end if;
  if v_intake.final_policy_id is not null then raise exception 'Policy Intake is already finalized.'; end if;
  select * into v_draft from public.policy_intake_onboarding_drafts where intake_id=p_intake_id for update;
  if v_draft.intake_id is null then raise exception 'Policy Intake draft is missing.'; end if;
  if v_draft.revision<>p_expected_revision then raise exception 'Policy Intake draft changed. Reload before finalizing.'; end if;

  v_policy_result:=public.onboard_motor_policy_commercial_status_v2(p_payload);
  v_policy_id:=nullif(v_policy_result->>'policyId','')::uuid;
  if coalesce((v_policy_result->>'ok')::boolean,false) is not true or v_policy_id is null then raise exception 'Policy booking did not return a valid policy.'; end if;

  select * into v_document from public.policy_intake_documents where intake_id=p_intake_id and is_current order by created_at desc limit 1;
  if v_document.id is null then raise exception 'Current Policy Intake document is missing.'; end if;

  insert into public.policy_documents(policy_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by,source_intake_id,source_intake_document_id)
  values(v_policy_id,'policy_copy',v_document.file_name,v_document.storage_bucket,v_document.storage_path,v_document.mime_type,v_document.file_size,v_actor,p_intake_id,v_document.id)
  on conflict(storage_bucket,storage_path) do update set policy_id=excluded.policy_id,document_type=excluded.document_type,source_intake_id=excluded.source_intake_id,source_intake_document_id=excluded.source_intake_document_id,uploaded_by=excluded.uploaded_by,updated_at=now();

  update public.policy_intake_requests set status='completed',final_policy_id=v_policy_id,finalized_by_profile_id=v_actor,finalized_at=now(),attention_reason=null where id=p_intake_id;
  delete from public.policy_intake_onboarding_drafts where intake_id=p_intake_id;
  return v_policy_result;
end; $function$;

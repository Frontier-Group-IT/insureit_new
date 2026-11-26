-- Fix PL/pgSQL ambiguous output parameter "intake_id" in ON CONFLICT.
-- The previous function could not claim any eligible intake, despite its
-- Vercel cron being invoked. Only disambiguate the conflict target.
-- Preserve service-role enforcement, queue evidence, reviewer-ownership hold,
-- immutable claim semantics and all existing canonical booking rules.
create or replace function public.claim_ai_auto_booking_v1(p_operator_profile_id uuid,p_limit integer default 3)
returns table(intake_id uuid,document_id uuid,extraction_fingerprint text)
language plpgsql security invoker set search_path = public,pg_catalog as $$
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_limit < 1 or p_limit > 5 or p_operator_profile_id is null
    then raise exception 'invalid_claim_parameters'; end if;
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
        (intake_id,operator_profile_id,document_id,extraction_fingerprint)
      select s.intake_id,p_operator_profile_id,s.document_id,s.extraction_fingerprint from selected s
      on conflict on constraint policy_intake_ai_auto_booking_attempts_pkey do nothing
      returning a.intake_id,a.document_id,a.extraction_fingerprint
    )
    select a.intake_id,a.document_id,a.extraction_fingerprint from inserted a;
end;
$$;

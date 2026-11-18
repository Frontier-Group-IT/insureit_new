-- ICICI 3005 Bundled and 3005/O OD: lease-bound, parser-aware verified OCR sync.
-- This function never creates customers, vehicles or policies and never alters
-- an Intake with an existing draft/manual OCR or an already-registered policy.
-- v1 is retained for backwards compatibility; deploy this migration BEFORE
-- deploying the queue worker that invokes v2.
create or replace function public.sync_verified_ai_intake_ocr_v2(
  p_intake_id uuid,
  p_document_id uuid,
  p_lease_id uuid,
  p_parser_revision text,
  p_parser_id text,
  p_parser_version text,
  p_verified_fields jsonb,
  p_checks_passed integer
) returns boolean
language plpgsql
set search_path to 'public','pg_catalog'
as $function$
declare
  v_updated uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_checks_passed <> 13
     or p_parser_revision is null
     or length(p_parser_revision) < 1 or length(p_parser_revision) > 80
     or not (
       (p_parser_id='icici_3005_n8n_native_pdf' and p_parser_version='bridge-v1')
       or (p_parser_id='icici_3005_od_n8n_native_pdf' and p_parser_version='bridge-od-v1')
     )
     or p_verified_fields is null
     or jsonb_typeof(p_verified_fields) <> 'array'
     or jsonb_array_length(p_verified_fields) < 12
     or jsonb_array_length(p_verified_fields) > 80 then
    return false;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='policy_number'
      and (
        (p_parser_id='icici_3005_n8n_native_pdf'
         and f->>'value' ~ '^3005/[0-9]{7,12}/[0-9]{2}/[A-Z0-9]{3}$')
        or (p_parser_id='icici_3005_od_n8n_native_pdf'
         and f->>'value' ~ '^3005/O/[0-9]{7,12}/[0-9]{2}/[A-Z0-9]{3}$')
      )
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='insured_name'
      and length(btrim(coalesce(f->>'value',''))) between 2 and 160
  ) then
    return false;
  end if;

  update public.policy_intake_requests i
  set status='ready_for_review', ocr_status='completed',
      ocr_fields=p_verified_fields,ocr_warnings='[]'::jsonb,
      ocr_parser_id=p_parser_id,ocr_parser_version=p_parser_version,
      attention_reason=null
  where i.id=p_intake_id
    and i.status='processing'
    and i.policy_type='motor'
    and i.final_policy_id is null
    and i.ocr_status in ('pending','processing','failed')
    and coalesce(i.ocr_fields,'[]'::jsonb)='[]'::jsonb
    and not exists (
      select 1 from public.policy_intake_onboarding_drafts draft
      where draft.intake_id=i.id
    )
    and exists (
      select 1 from public.policy_intake_ai_processing_queue q
      where q.intake_id=i.id and q.document_id=p_document_id
        and q.lease_id=p_lease_id and q.state='processing'
        and q.parser_revision=p_parser_revision
        and q.leased_until>now()
    )
    and exists (
      select 1 from public.policy_intake_documents d
      where d.id=p_document_id and d.intake_id=i.id
        and d.is_current=true
        and d.storage_bucket=i.storage_bucket
        and d.storage_path=i.storage_path
        and d.mime_type='application/pdf'
    )
  returning i.id into v_updated;

  return v_updated is not null;
end;
$function$;

revoke all on function public.sync_verified_ai_intake_ocr_v2(
  uuid,uuid,uuid,text,text,text,jsonb,integer
) from public,anon,authenticated;
grant execute on function public.sync_verified_ai_intake_ocr_v2(
  uuid,uuid,uuid,text,text,text,jsonb,integer
) to service_role;

comment on function public.sync_verified_ai_intake_ocr_v2(
  uuid,uuid,uuid,text,text,text,jsonb,integer
) is 'Atomic lease/document/revision gated 13-check ICICI 3005/3005O OCR sync. No policy booking.';

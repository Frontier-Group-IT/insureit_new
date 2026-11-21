-- Tata AIG third-party-only OCR synchronization.
-- Accepts only the two separately validated 16-check parsers and only an unchanged,
-- current, unbooked motor intake with no OCR/draft. No policy/customer booking.
create or replace function public.sync_verified_ai_intake_tata_tp_ocr_v1(
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
set search_path = public, pg_catalog
as $function$
declare v_updated uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_checks_passed <> 16
    or p_parser_revision is null
    or length(p_parser_revision) not between 1 and 80
    or not (
      (p_parser_id = 'tata_aig_private_car_liability_only_n8n_native_pdf'
       and p_parser_version = 'tata-aig-tp-v1')
      or (p_parser_id = 'tata_aig_private_car_three_year_tp_n8n_native_pdf'
       and p_parser_version = 'tata-aig-3y-tp-v1')
    )
    or p_verified_fields is null or jsonb_typeof(p_verified_fields) <> 'array'
    or jsonb_array_length(p_verified_fields) not between 23 and 30 then
    return false;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='policy_number'
      and f->>'value' ~ '^[0-9]{10} [0-9]{2} [0-9]{2}$'
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='insurer_name'
      and f->>'value'='TATA AIG GENERAL INSURANCE COMPANY LIMITED'
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='policy_product'
      and f->>'value'='Third-Party Only'
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='insured_name'
      and length(btrim(coalesce(f->>'value',''))) between 2 and 160
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='vehicle_chassis_number'
      and f->>'value' ~ '^[A-Z0-9]{12,25}$'
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='third_party_start_date'
      and f->>'value' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
  ) or not exists (
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='third_party_end_date'
      and f->>'value' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
  ) then
    return false;
  end if;

  update public.policy_intake_requests i
  set status='ready_for_review', ocr_status='completed',
      ocr_fields=p_verified_fields, ocr_warnings='[]'::jsonb,
      ocr_parser_id=p_parser_id, ocr_parser_version=p_parser_version,
      attention_reason=null
  where i.id=p_intake_id
    and i.status='processing' and i.policy_type='motor'
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
        and q.parser_revision=p_parser_revision and q.leased_until>now()
    )
    and exists (
      select 1 from public.policy_intake_documents d
      where d.id=p_document_id and d.intake_id=i.id
        and d.is_current=true
        and d.storage_bucket=i.storage_bucket
        and d.storage_path=i.storage_path and d.mime_type='application/pdf'
    )
  returning i.id into v_updated;
  return v_updated is not null;
end;
$function$;
revoke all on function public.sync_verified_ai_intake_tata_tp_ocr_v1(uuid,uuid,uuid,text,text,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.sync_verified_ai_intake_tata_tp_ocr_v1(uuid,uuid,uuid,text,text,text,jsonb,integer) to service_role;

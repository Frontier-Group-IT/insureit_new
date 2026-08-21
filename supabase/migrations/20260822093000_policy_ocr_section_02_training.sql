begin;

alter table public.policy_ocr_training_labels
  add column if not exists section_02_reference jsonb;

comment on table public.policy_ocr_training_labels is
  'Service-role-only OCR proposal and single-operator confirmation state. Contains saved Section 02/03 comparison references, never raw OCR text or document bytes.';
comment on column public.policy_ocr_training_labels.section_02_reference is
  'Protected saved vehicle reference used for OCR comparison. Raw identifiers must never be copied into candidates, logs, fixtures, or source control.';

create or replace function public.approve_policy_ocr_training_candidate(
  p_label_id uuid,
  p_actor_id uuid,
  p_candidate_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label public.policy_ocr_training_labels%rowtype;
  v_candidate_id uuid;
begin
  select * into v_label
  from public.policy_ocr_training_labels
  where id = p_label_id
  for update;

  if not found or v_label.status <> 'reviewed' or v_label.reviewed_by is null then
    raise exception 'training_label_not_confirmed';
  end if;
  if jsonb_typeof(p_candidate_payload) is distinct from 'object'
    or p_candidate_payload ->> 'schema_version' is distinct from 'policy_ocr_training_candidate_v2'
    or exists (
      select 1 from jsonb_object_keys(
        case when jsonb_typeof(p_candidate_payload) = 'object' then p_candidate_payload else '{}'::jsonb end
      ) key
      where key not in ('schema_version', 'parser_id', 'parser_version', 'ground_truth', 'evidence_labels')
    )
    or jsonb_typeof(p_candidate_payload -> 'ground_truth') is distinct from 'object'
    or jsonb_typeof(p_candidate_payload -> 'evidence_labels') is distinct from 'object'
    or exists (
      select 1 from jsonb_object_keys(
        case when jsonb_typeof(p_candidate_payload -> 'ground_truth') = 'object'
          then p_candidate_payload -> 'ground_truth' else '{}'::jsonb end
      ) key
      where key not in ('section_02', 'section_03')
    )
    or jsonb_typeof(p_candidate_payload #> '{ground_truth,section_02}') is distinct from 'object'
    or jsonb_typeof(p_candidate_payload #> '{ground_truth,section_03}') is distinct from 'object'
    or exists (
      select 1 from jsonb_object_keys(
        case when jsonb_typeof(p_candidate_payload #> '{ground_truth,section_02}') = 'object'
          then p_candidate_payload #> '{ground_truth,section_02}' else '{}'::jsonb end
      ) key
      where key not in (
        'vehicle_registration_status', 'vehicle_registration_number', 'vehicle_class',
        'vehicle_make', 'vehicle_model', 'vehicle_fuel_type', 'vehicle_manufacturing_year',
        'vehicle_capacity', 'vehicle_chassis_number', 'vehicle_engine_number',
        'vehicle_rto_name', 'vehicle_rto_state'
      )
    )
    or exists (
      select 1 from jsonb_object_keys(
        case when jsonb_typeof(p_candidate_payload #> '{ground_truth,section_03}') = 'object'
          then p_candidate_payload #> '{ground_truth,section_03}' else '{}'::jsonb end
      ) key
      where key not in (
        'insurer_name', 'policy_product', 'policy_number', 'valid_from', 'valid_upto',
        'idv', 'od_premium', 'tp_premium', 'cpa_opted', 'cpa_premium',
        'printed_net_premium', 'printed_gst', 'printed_gross_premium'
      )
    )
    or coalesce(p_candidate_payload #>> '{ground_truth,section_03,policy_number}', '') !~ '^SYN-[A-F0-9]{12}$'
    or (
      coalesce(p_candidate_payload #>> '{ground_truth,section_02,vehicle_registration_number}', '') <> ''
      and p_candidate_payload #>> '{ground_truth,section_02,vehicle_registration_number}' !~ '^SYNREG[A-F0-9]{12}$'
    )
    or (
      coalesce(p_candidate_payload #>> '{ground_truth,section_02,vehicle_chassis_number}', '') <> ''
      and p_candidate_payload #>> '{ground_truth,section_02,vehicle_chassis_number}' !~ '^SYNCHASSIS[A-F0-9]{12}$'
    )
    or (
      coalesce(p_candidate_payload #>> '{ground_truth,section_02,vehicle_engine_number}', '') <> ''
      and p_candidate_payload #>> '{ground_truth,section_02,vehicle_engine_number}' !~ '^SYNENGINE[A-F0-9]{12}$'
    )
  then
    raise exception 'invalid_training_candidate';
  end if;

  insert into public.policy_ocr_training_candidates (
    training_label_id, candidate_payload, payload_checksum, approved_by, approved_at
  ) values (
    p_label_id, p_candidate_payload, md5(p_candidate_payload::text), p_actor_id, now()
  )
  on conflict (training_label_id) do update
  set candidate_payload = excluded.candidate_payload,
      payload_checksum = excluded.payload_checksum,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at
  returning id into v_candidate_id;

  update public.policy_ocr_training_labels
  set status = 'approved',
      owner_approved_by = p_actor_id,
      owner_approved_at = now(),
      updated_at = now()
  where id = p_label_id;

  return v_candidate_id;
end;
$$;

create or replace function public.approve_policy_ocr_database_comparison(
  p_label_id uuid,
  p_actor_id uuid,
  p_reference jsonb,
  p_candidate_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_processing_status text;
  v_candidate_id uuid;
begin
  if jsonb_typeof(p_reference) is distinct from 'object'
    or exists (
      select 1 from jsonb_object_keys(
        case when jsonb_typeof(p_reference) = 'object' then p_reference else '{}'::jsonb end
      ) key
      where key not in (
        'vehicle_registration_status', 'vehicle_registration_number', 'vehicle_class',
        'vehicle_make', 'vehicle_model', 'vehicle_fuel_type', 'vehicle_manufacturing_year',
        'vehicle_capacity', 'vehicle_chassis_number', 'vehicle_engine_number',
        'vehicle_rto_name', 'vehicle_rto_state',
        'insurer_name', 'policy_product', 'policy_number', 'valid_from', 'valid_upto',
        'idv', 'od_premium', 'tp_premium', 'cpa_opted', 'cpa_premium',
        'printed_net_premium', 'printed_gst', 'printed_gross_premium'
      )
    )
  then
    raise exception 'invalid_training_reference';
  end if;

  select processing_status into v_processing_status
  from public.policy_ocr_training_labels
  where id = p_label_id
  for update;

  if not found or v_processing_status <> 'ready' then
    raise exception 'training_proposal_not_ready';
  end if;

  update public.policy_ocr_training_labels
  set section_02_reference = jsonb_strip_nulls(jsonb_build_object(
        'vehicle_registration_status', p_reference -> 'vehicle_registration_status',
        'vehicle_registration_number', p_reference -> 'vehicle_registration_number',
        'vehicle_class', p_reference -> 'vehicle_class',
        'vehicle_make', p_reference -> 'vehicle_make',
        'vehicle_model', p_reference -> 'vehicle_model',
        'vehicle_fuel_type', p_reference -> 'vehicle_fuel_type',
        'vehicle_manufacturing_year', p_reference -> 'vehicle_manufacturing_year',
        'vehicle_capacity', p_reference -> 'vehicle_capacity',
        'vehicle_chassis_number', p_reference -> 'vehicle_chassis_number',
        'vehicle_engine_number', p_reference -> 'vehicle_engine_number',
        'vehicle_rto_name', p_reference -> 'vehicle_rto_name',
        'vehicle_rto_state', p_reference -> 'vehicle_rto_state'
      )),
      insurer_name = nullif(trim(p_reference ->> 'insurer_name'), ''),
      policy_product = nullif(trim(p_reference ->> 'policy_product'), ''),
      policy_number = nullif(trim(p_reference ->> 'policy_number'), ''),
      valid_from = nullif(p_reference ->> 'valid_from', '')::date,
      valid_upto = nullif(p_reference ->> 'valid_upto', '')::date,
      idv = nullif(p_reference ->> 'idv', '')::numeric,
      od_premium = nullif(p_reference ->> 'od_premium', '')::numeric,
      tp_premium = nullif(p_reference ->> 'tp_premium', '')::numeric,
      cpa_opted = nullif(p_reference ->> 'cpa_opted', '')::boolean,
      cpa_premium = nullif(p_reference ->> 'cpa_premium', '')::numeric,
      printed_net_premium = nullif(p_reference ->> 'printed_net_premium', '')::numeric,
      printed_gst = nullif(p_reference ->> 'printed_gst', '')::numeric,
      printed_gross_premium = nullif(p_reference ->> 'printed_gross_premium', '')::numeric,
      evidence_note = 'Existing Section 02 and Section 03 database values used as comparison reference.',
      status = 'reviewed',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      owner_approved_by = null,
      owner_approved_at = null,
      updated_at = now()
  where id = p_label_id;

  v_candidate_id := public.approve_policy_ocr_training_candidate(
    p_label_id, p_actor_id, p_candidate_payload
  );
  return v_candidate_id;
end;
$$;

revoke all on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.approve_policy_ocr_database_comparison(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) to service_role;
grant execute on function public.approve_policy_ocr_database_comparison(uuid, uuid, jsonb, jsonb) to service_role;

commit;

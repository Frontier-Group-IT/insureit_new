begin;

alter table public.policy_ocr_training_labels
  drop constraint if exists policy_ocr_training_labels_separate_approval_check;

comment on table public.policy_ocr_training_labels is
  'Service-role-only OCR proposal and single-operator confirmation state. Contains approved Section 03 values, never raw OCR text or document bytes.';
comment on table public.policy_ocr_training_candidates is
  'Sanitized, operator-approved regression candidates. Candidate generation never modifies parser source.';

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
  select *
  into v_label
  from public.policy_ocr_training_labels
  where id = p_label_id
  for update;

  if not found or v_label.status <> 'reviewed' or v_label.reviewed_by is null then
    raise exception 'training_label_not_confirmed';
  end if;
  if jsonb_typeof(p_candidate_payload) is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(p_candidate_payload) key
      where key not in ('schema_version', 'parser_id', 'parser_version', 'ground_truth', 'evidence_labels')
    )
    or jsonb_typeof(p_candidate_payload -> 'ground_truth') is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(
        case
          when jsonb_typeof(p_candidate_payload -> 'ground_truth') = 'object'
            then p_candidate_payload -> 'ground_truth'
          else '{}'::jsonb
        end
      ) key
      where key not in (
        'insurer_name', 'policy_product', 'policy_number', 'valid_from', 'valid_upto',
        'idv', 'od_premium', 'tp_premium', 'cpa_opted', 'cpa_premium',
        'printed_net_premium', 'printed_gst', 'printed_gross_premium'
      )
    )
    or coalesce(p_candidate_payload #>> '{ground_truth,policy_number}', '') !~ '^SYN-[A-F0-9]{12}$'
  then
    raise exception 'invalid_training_candidate';
  end if;

  insert into public.policy_ocr_training_candidates (
    training_label_id,
    candidate_payload,
    payload_checksum,
    approved_by,
    approved_at
  )
  values (
    p_label_id,
    p_candidate_payload,
    md5(p_candidate_payload::text),
    p_actor_id,
    now()
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
      select 1
      from jsonb_object_keys(p_reference) key
      where key not in (
        'insurer_name', 'policy_product', 'policy_number', 'valid_from', 'valid_upto',
        'idv', 'od_premium', 'tp_premium', 'cpa_opted', 'cpa_premium',
        'printed_net_premium', 'printed_gst', 'printed_gross_premium'
      )
    )
  then
    raise exception 'invalid_training_reference';
  end if;

  select processing_status
  into v_processing_status
  from public.policy_ocr_training_labels
  where id = p_label_id
  for update;

  if not found or v_processing_status <> 'ready' then
    raise exception 'training_proposal_not_ready';
  end if;

  update public.policy_ocr_training_labels
  set insurer_name = nullif(trim(p_reference ->> 'insurer_name'), ''),
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
      evidence_note = 'Existing Section 03 database values used as comparison reference.',
      status = 'reviewed',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      owner_approved_by = null,
      owner_approved_at = null,
      updated_at = now()
  where id = p_label_id;

  v_candidate_id := public.approve_policy_ocr_training_candidate(
    p_label_id,
    p_actor_id,
    p_candidate_payload
  );
  return v_candidate_id;
end;
$$;

revoke all on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.approve_policy_ocr_database_comparison(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.approve_policy_ocr_training_candidate(uuid, uuid, jsonb) to service_role;
grant execute on function public.approve_policy_ocr_database_comparison(uuid, uuid, jsonb, jsonb) to service_role;

commit;

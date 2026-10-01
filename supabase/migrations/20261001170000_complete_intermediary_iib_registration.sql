begin;

create or replace function public.complete_intermediary_iib_registration(
  p_application_id uuid,
  p_actor_id uuid,
  p_iib_reference text default null,
  p_registered_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.intermediary_onboarding_applications%rowtype;
  v_assignment public.intermediary_training_exam_assignments%rowtype;
  v_profile public.posp_misp_onboarding_profiles%rowtype;
  v_packet public.intermediary_iib_submission_packets%rowtype;
  v_registration_id uuid;
  v_registered_at timestamptz;
  v_registered_date date;
  v_reference text;
  v_updated integer;
begin
  if p_application_id is null or p_actor_id is null then
    raise exception 'Application and actor are required';
  end if;

  select *
  into v_application
  from public.intermediary_onboarding_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Intermediary onboarding application not found';
  end if;

  if v_application.final_type not in ('posp', 'misp') then
    raise exception 'IIB registration is available only for POSP/MISP applications';
  end if;

  select *
  into v_assignment
  from public.intermediary_training_exam_assignments
  where application_id = p_application_id
  for update;

  if not found then
    raise exception 'Training and examination assignment not found';
  end if;

  if v_assignment.training_status <> 'completed' then
    raise exception 'Training must be completed before IIB registration';
  end if;
  if v_assignment.exam_status <> 'passed' then
    raise exception 'Examination must be passed before IIB registration';
  end if;
  if v_assignment.agreement_status <> 'signed' then
    raise exception 'Agreement must be signed before IIB registration';
  end if;

  select *
  into v_profile
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then
    raise exception 'POSP/MISP onboarding profile not found';
  end if;

  select *
  into v_packet
  from public.intermediary_iib_submission_packets
  where application_id = p_application_id
  for update;

  if not found then
    raise exception 'IIB submission packet not found';
  end if;

  if v_packet.status not in ('handoff_started', 'submitted', 'registered') then
    raise exception 'Prepare the IIB portal handoff before completing registration';
  end if;
  if cardinality(coalesce(v_packet.missing_fields, '{}'::text[])) > 0 then
    raise exception 'IIB submission packet still has missing fields';
  end if;

  v_registration_id := coalesce(v_application.registration_record_id, v_profile.registration_record_id);
  if v_registration_id is null then
    select id
    into v_registration_id
    from public.intermediary_registrations
    where application_id = p_application_id
    order by created_at desc, id desc
    limit 1
    for update;
  end if;

  if v_registration_id is null then
    raise exception 'Intermediary registration record not found';
  end if;

  v_registered_date := coalesce(p_registered_on, current_date);
  v_registered_at := case
    when p_registered_on is null or p_registered_on = current_date then now()
    else (v_registered_date::timestamp + time '12:00') at time zone 'Asia/Kolkata'
  end;
  v_reference := nullif(btrim(coalesce(p_iib_reference, '')), '');

  update public.intermediary_iib_submission_packets
  set status = 'registered',
      submitted_at = coalesce(submitted_at, v_registered_at),
      submission_reference = coalesce(v_reference, submission_reference),
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediary_training_exam_assignments
  set iib_registration_status = 'registered',
      iib_submission_started_at = coalesce(iib_submission_started_at, v_packet.handoff_started_at, v_registered_at),
      iib_submitted_at = coalesce(iib_submitted_at, v_registered_at),
      iib_registered_at = coalesce(iib_registered_at, v_registered_at),
      iib_last_error = null,
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediary_onboarding_applications
  set registration_status = 'iib_registered',
      status = 'approved',
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, v_registered_at),
      completed_at = coalesce(completed_at, v_registered_at),
      current_step = greatest(current_step, 6),
      draft_data = jsonb_set(
        coalesce(draft_data, '{}'::jsonb),
        '{iib_submission_packet}',
        coalesce(draft_data -> 'iib_submission_packet', '{}'::jsonb)
          || jsonb_build_object(
            'status', 'registered',
            'registered_at', v_registered_at,
            'registration_reference', v_reference
          ),
        true
      ),
      updated_at = now()
  where id = p_application_id;

  update public.intermediary_registrations
  set registration_status = 'iib_registered',
      training_status = 'completed',
      exam_status = 'passed',
      agreement_status = 'signed',
      iib_status = 'registered',
      iib_reference = coalesce(v_reference, iib_reference),
      activated_at = coalesce(activated_at, v_registered_at),
      updated_at = now()
  where id = v_registration_id;

  update public.posp_misp_onboarding_profiles
  set iib_upload_status = 'uploaded',
      iib_uploaded = true,
      iib_uploaded_at = coalesce(iib_uploaded_at, v_registered_date),
      iib_completed_at = coalesce(iib_completed_at, v_registered_at),
      workflow_stage = 'completed',
      registration_record_id = coalesce(registration_record_id, v_registration_id),
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediaries
  set account_status = 'active',
      iib_status = 'cleared',
      compliance_status = 'approved',
      registration_status = 'iib_registered',
      activated_at = coalesce(activated_at, v_registered_at),
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id
    and intermediary_type in ('posp', 'misp');

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Intermediary account record not found';
  end if;

  return jsonb_build_object(
    'status', 'registered',
    'application_id', p_application_id,
    'registration_record_id', v_registration_id,
    'registered_at', v_registered_at,
    'iib_reference', v_reference
  );
end;
$$;

revoke all on function public.complete_intermediary_iib_registration(uuid, uuid, text, date) from public;
revoke all on function public.complete_intermediary_iib_registration(uuid, uuid, text, date) from anon;
revoke all on function public.complete_intermediary_iib_registration(uuid, uuid, text, date) from authenticated;
grant execute on function public.complete_intermediary_iib_registration(uuid, uuid, text, date) to service_role;

commit;

begin;

create or replace function public.issue_legacy_partner_identity(
  p_application_id uuid,
  p_actor_id uuid,
  p_partner_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id text := upper(trim(p_partner_id));
  v_pan text;
  v_aadhaar_hash text;
  v_existing uuid;
begin
  if v_partner_id is null or v_partner_id = '' then
    raise exception 'Existing Partner ID is required';
  end if;
  if v_partner_id like 'PENDING-%' then
    raise exception 'Temporary Partner IDs cannot be activated';
  end if;

  select pan_number, aadhaar_hash
    into v_pan, v_aadhaar_hash
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then raise exception 'Onboarding profile not found'; end if;
  if v_pan is null or v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'A valid PAN is required'; end if;
  if v_aadhaar_hash is null then raise exception 'A valid Aadhaar is required'; end if;

  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where partner_id = v_partner_id and application_id <> p_application_id
  limit 1;
  if v_existing is not null then raise exception 'This Partner ID is already in use'; end if;

  v_existing := null;
  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where upper(pan_number) = upper(v_pan)
    and application_id <> p_application_id
    and partner_id is not null
  limit 1;
  if v_existing is not null then raise exception 'A Partner already exists with this PAN'; end if;

  v_existing := null;
  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where aadhaar_hash = v_aadhaar_hash
    and application_id <> p_application_id
    and partner_id is not null
  limit 1;
  if v_existing is not null then raise exception 'A Partner already exists with this Aadhaar'; end if;

  if exists (
    select 1 from public.intermediaries
    where intermediary_code = v_partner_id
      and application_id <> p_application_id
  ) then
    raise exception 'This Partner ID is already in use';
  end if;

  update public.posp_misp_onboarding_profiles
  set partner_id = v_partner_id,
      partner_status = 'active_partner',
      partner_activated_at = now(),
      final_account_type = 'partner',
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediary_onboarding_applications
  set final_type = 'partner',
      partner_status = 'active_partner',
      partner_activated_at = now(),
      registration_status = 'partner_active',
      updated_at = now()
  where id = p_application_id;

  insert into public.intermediaries(
    application_id,
    intermediary_type,
    intermediary_code,
    account_status,
    registration_status,
    created_at,
    updated_at
  )
  values (
    p_application_id,
    'partner',
    v_partner_id,
    'active',
    'partner_active',
    now(),
    now()
  )
  on conflict (intermediary_code) do update
    set application_id = excluded.application_id,
        intermediary_type = excluded.intermediary_type,
        account_status = excluded.account_status,
        registration_status = excluded.registration_status,
        updated_at = excluded.updated_at;

  return v_partner_id;
end;
$$;

create or replace function public.normalize_legacy_misp_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_type text;
  v_activation timestamptz;
begin
  if tg_table_name = 'posp_misp_onboarding_profiles' then
    select source,
           requested_type,
           nullif(draft_data->>'legacy_original_activation_date','')::timestamptz
      into v_source, v_type, v_activation
    from public.intermediary_onboarding_applications
    where id = new.application_id;

    if v_source = 'legacy_manual' and v_type = 'misp' then
      new.training_status := 'completed';
      new.exam_status := 'passed';
      new.training_start_date := coalesce(new.training_start_date, v_activation, new.onboarding_date, now());
      new.training_end_date := coalesce(new.training_end_date, v_activation, new.onboarding_date, now());
    end if;
    return new;
  end if;

  if tg_table_name = 'intermediary_registrations' then
    select source,
           requested_type,
           nullif(draft_data->>'legacy_original_activation_date','')::timestamptz
      into v_source, v_type, v_activation
    from public.intermediary_onboarding_applications
    where id = new.application_id;

    if v_source = 'legacy_manual' and v_type = 'misp' then
      new.training_status := 'completed';
      new.exam_status := 'passed';
    end if;
    return new;
  end if;

  if tg_table_name = 'intermediary_training_exam_assignments' then
    select source,
           requested_type,
           nullif(draft_data->>'legacy_original_activation_date','')::timestamptz
      into v_source, v_type, v_activation
    from public.intermediary_onboarding_applications
    where id = new.application_id;

    if v_source = 'legacy_manual' and v_type = 'misp' then
      new.training_title := coalesce(nullif(new.training_title, 'Not applicable'), 'Historical MISP training');
      new.training_status := 'completed';
      new.training_assigned_at := coalesce(new.training_assigned_at, v_activation, now());
      new.training_started_at := coalesce(new.training_started_at, v_activation, now());
      new.training_completed_at := coalesce(new.training_completed_at, v_activation, now());
      new.exam_title := coalesce(nullif(new.exam_title, 'Not applicable'), 'Historical MISP examination');
      new.exam_status := 'passed';
      new.exam_completed_at := coalesce(new.exam_completed_at, v_activation, now());
      new.exam_passed_at := coalesce(new.exam_passed_at, v_activation, now());
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_legacy_misp_profile_completion on public.posp_misp_onboarding_profiles;
create trigger normalize_legacy_misp_profile_completion
before insert or update on public.posp_misp_onboarding_profiles
for each row execute function public.normalize_legacy_misp_completion();

drop trigger if exists normalize_legacy_misp_registration_completion on public.intermediary_registrations;
create trigger normalize_legacy_misp_registration_completion
before insert or update on public.intermediary_registrations
for each row execute function public.normalize_legacy_misp_completion();

drop trigger if exists normalize_legacy_misp_assignment_completion on public.intermediary_training_exam_assignments;
create trigger normalize_legacy_misp_assignment_completion
before insert or update on public.intermediary_training_exam_assignments
for each row execute function public.normalize_legacy_misp_completion();

commit;

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
    requested_type,
    intermediary_code,
    account_status,
    registration_status,
    created_at,
    updated_at
  )
  values (
    p_application_id,
    'partner',
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
        requested_type = excluded.requested_type,
        account_status = excluded.account_status,
        registration_status = excluded.registration_status,
        updated_at = excluded.updated_at;

  return v_partner_id;
end;
$$;

-- Repair any historical Partner register rows created before requested_type was populated.
update public.intermediaries
set requested_type = 'partner',
    updated_at = now()
where intermediary_type = 'partner'
  and requested_type is null;

commit;

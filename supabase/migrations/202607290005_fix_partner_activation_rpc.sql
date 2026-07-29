begin;

create or replace function public.issue_partner_identity(p_application_id uuid, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id text;
  v_partner_type text;
  v_partner_category text;
  v_pan text;
  v_aadhaar_hash text;
  v_existing uuid;
begin
  select partner_type,
         upper(pan_number),
         case when partner_type = 'misp' then dp_aadhaar_hash else aadhaar_hash end,
         partner_id
    into v_partner_type, v_pan, v_aadhaar_hash, v_partner_id
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then
    raise exception 'Onboarding profile not found';
  end if;

  if v_partner_id is not null then
    return v_partner_id;
  end if;

  if v_pan is null or v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'A valid PAN is required';
  end if;

  if v_aadhaar_hash is null then
    raise exception 'A valid Aadhaar is required';
  end if;

  v_partner_category := case when v_partner_type = 'misp' then 'business' else 'individual' end;

  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where upper(pan_number) = v_pan
    and application_id <> p_application_id
    and partner_id is not null
  limit 1;

  if v_existing is not null then
    raise exception 'A Partner already exists with this PAN';
  end if;

  v_existing := null;
  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where (case when partner_type = 'misp' then dp_aadhaar_hash else aadhaar_hash end) = v_aadhaar_hash
    and application_id <> p_application_id
    and partner_id is not null
  limit 1;

  if v_existing is not null then
    raise exception 'A Partner already exists with this Aadhaar';
  end if;

  v_partner_id := public.next_partner_identity();

  update public.posp_misp_onboarding_profiles
  set partner_id = v_partner_id,
      partner_category = v_partner_category,
      partner_status = 'active_partner',
      partner_activated_at = now(),
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediary_onboarding_applications
  set partner_category = v_partner_category,
      partner_status = 'active_partner',
      partner_activated_at = now(),
      updated_at = now()
  where id = p_application_id;

  if not exists (
    select 1 from public.intermediaries where intermediary_code = v_partner_id
  ) then
    insert into public.intermediaries(
      application_id,
      intermediary_type,
      intermediary_code,
      account_status,
      registration_status,
      created_at,
      updated_at
    ) values (
      p_application_id,
      'partner',
      v_partner_id,
      'active',
      'partner_active',
      now(),
      now()
    );
  end if;

  return v_partner_id;
end;
$$;

commit;

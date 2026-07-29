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
  v_year text := to_char(current_date, 'YYYY');
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtext('issue_partner_identity'));

  select partner_id,
         partner_type,
         upper(pan_number),
         coalesce(aadhaar_hash, dp_aadhaar_hash)
    into v_partner_id, v_partner_type, v_pan, v_aadhaar_hash
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then
    raise exception 'Onboarding profile not found for application %', p_application_id;
  end if;

  if v_partner_id is not null then
    return v_partner_id;
  end if;

  if v_pan is null or v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'A valid PAN is required before Partner activation';
  end if;

  if v_aadhaar_hash is null then
    raise exception 'A valid Aadhaar is required before Partner activation';
  end if;

  if exists (
    select 1
    from public.posp_misp_onboarding_profiles
    where application_id <> p_application_id
      and partner_id is not null
      and upper(pan_number) = v_pan
  ) then
    raise exception 'A Partner already exists with this PAN';
  end if;

  if exists (
    select 1
    from public.posp_misp_onboarding_profiles
    where application_id <> p_application_id
      and partner_id is not null
      and coalesce(aadhaar_hash, dp_aadhaar_hash) = v_aadhaar_hash
  ) then
    raise exception 'A Partner already exists with this Aadhaar';
  end if;

  select coalesce(max((regexp_match(partner_id, '^PART-' || v_year || '-([0-9]+)$'))[1]::integer), 0) + 1
    into v_next
  from public.posp_misp_onboarding_profiles
  where partner_id like 'PART-' || v_year || '-%';

  v_partner_id := 'PART-' || v_year || '-' || lpad(v_next::text, 5, '0');
  v_partner_category := case when v_partner_type = 'misp' then 'business' else 'individual' end;

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

  return v_partner_id;
end;
$$;

revoke all on function public.issue_partner_identity(uuid, uuid) from public;
grant execute on function public.issue_partner_identity(uuid, uuid) to service_role;

commit;

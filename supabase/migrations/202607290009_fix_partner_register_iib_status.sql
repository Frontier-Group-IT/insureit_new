begin;

create or replace function public.sync_partner_intermediary(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_intermediary_id uuid;
begin
  select
    p.application_id,
    p.partner_id,
    p.partner_type,
    p.external_onboarding_id,
    coalesce(nullif(p.misp_name, ''), nullif(p.pos_name, ''), 'Unnamed Partner') as display_name,
    coalesce(p.dp_phone, p.applicant_phone) as mobile,
    coalesce(p.dp_email, p.applicant_email) as email,
    p.city
  into v_profile
  from public.posp_misp_onboarding_profiles p
  where p.application_id = p_application_id
    and p.partner_id is not null;

  if not found then
    raise exception 'Active Partner profile not found for application %', p_application_id;
  end if;

  select id
  into v_intermediary_id
  from public.intermediaries
  where application_id = p_application_id
    and intermediary_type = 'partner'
  limit 1;

  if v_intermediary_id is null then
    insert into public.intermediaries (
      application_id,
      intermediary_code,
      onboarding_id,
      intermediary_type,
      requested_type,
      display_name,
      mobile,
      email,
      city,
      iib_status,
      compliance_status,
      account_status,
      portal_access_status,
      visibility_level,
      created_at,
      updated_at
    ) values (
      v_profile.application_id,
      v_profile.partner_id,
      v_profile.external_onboarding_id,
      'partner',
      v_profile.partner_type,
      v_profile.display_name,
      v_profile.mobile,
      v_profile.email,
      v_profile.city,
      'pending',
      'pending',
      'active',
      'not_created',
      'internal',
      now(),
      now()
    )
    returning id into v_intermediary_id;
  else
    update public.intermediaries
    set intermediary_code = v_profile.partner_id,
        onboarding_id = v_profile.external_onboarding_id,
        requested_type = v_profile.partner_type,
        display_name = v_profile.display_name,
        mobile = v_profile.mobile,
        email = v_profile.email,
        city = v_profile.city,
        iib_status = 'pending',
        compliance_status = 'pending',
        account_status = 'active',
        updated_at = now()
    where id = v_intermediary_id;
  end if;

  return v_intermediary_id;
end;
$$;

revoke all on function public.sync_partner_intermediary(uuid) from public;
grant execute on function public.sync_partner_intermediary(uuid) to service_role;

do $$
declare
  r record;
begin
  for r in
    select application_id
    from public.posp_misp_onboarding_profiles
    where partner_id is not null
      and partner_status = 'active_partner'
  loop
    perform public.sync_partner_intermediary(r.application_id);
  end loop;
end;
$$;

commit;

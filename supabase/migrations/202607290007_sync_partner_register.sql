begin;

create or replace function public.sync_partner_intermediary(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_existing_id uuid;
begin
  select
    p.application_id,
    p.partner_id,
    p.partner_type,
    p.external_onboarding_id,
    case when p.partner_type = 'misp' then coalesce(p.misp_name, p.dp_name, 'Business Partner') else coalesce(p.pos_name, p.dp_name, 'Individual Partner') end as display_name,
    case when p.partner_type = 'misp' then p.dp_phone else p.applicant_phone end as mobile,
    case when p.partner_type = 'misp' then p.dp_email else p.applicant_email end as email,
    p.city,
    p.iib_remarks
  into v_profile
  from public.posp_misp_onboarding_profiles p
  where p.application_id = p_application_id
    and p.partner_id is not null;

  if not found then
    return;
  end if;

  select id into v_existing_id
  from public.intermediaries
  where application_id = p_application_id
    and intermediary_type = 'partner'
  limit 1;

  if v_existing_id is null then
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
      coalesce(v_profile.iib_remarks, 'pending'),
      'pending',
      'active',
      'not_created',
      'internal',
      now(),
      now()
    );
  else
    update public.intermediaries
    set intermediary_code = v_profile.partner_id,
        onboarding_id = v_profile.external_onboarding_id,
        requested_type = v_profile.partner_type,
        display_name = v_profile.display_name,
        mobile = v_profile.mobile,
        email = v_profile.email,
        city = v_profile.city,
        iib_status = coalesce(v_profile.iib_remarks, iib_status),
        account_status = 'active',
        updated_at = now()
    where id = v_existing_id;
  end if;
end;
$$;

create or replace function public.handle_partner_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is not null then
    perform public.sync_partner_intermediary(new.application_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_partner_intermediary on public.posp_misp_onboarding_profiles;
create trigger trg_sync_partner_intermediary
after insert or update of partner_id, partner_status, pos_name, misp_name, applicant_phone, applicant_email, dp_name, dp_phone, dp_email, city
on public.posp_misp_onboarding_profiles
for each row
execute function public.handle_partner_profile_sync();

do $$
declare
  r record;
begin
  for r in
    select application_id
    from public.posp_misp_onboarding_profiles
    where partner_id is not null
  loop
    perform public.sync_partner_intermediary(r.application_id);
  end loop;
end;
$$;

commit;

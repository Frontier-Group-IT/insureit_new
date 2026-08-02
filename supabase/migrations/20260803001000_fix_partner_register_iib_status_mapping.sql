begin;

create or replace function public.sync_partner_intermediary(
  p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_existing_id uuid;
  v_account_context text;
begin
  select
    p.application_id,
    p.partner_id,
    p.partner_type,
    p.external_onboarding_id,
    case
      when p.partner_type = 'misp'
        then coalesce(p.misp_name, p.dp_name, 'Business Partner')
      else coalesce(p.pos_name, p.dp_name, 'Individual Partner')
    end as display_name,
    case when p.partner_type = 'misp' then p.dp_phone else p.applicant_phone end as mobile,
    case when p.partner_type = 'misp' then p.dp_email else p.applicant_email end as email,
    p.city,
    coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') as account_context
  into v_profile
  from public.posp_misp_onboarding_profiles p
  join public.intermediary_onboarding_applications a
    on a.id = p.application_id
  where p.application_id = p_application_id
    and p.partner_id is not null;

  if not found then
    return;
  end if;

  v_account_context := v_profile.account_context;

  if v_account_context in ('posp', 'misp') then
    insert into public.intermediary_register_cleanup_audit (
      intermediary_id,
      cleanup_reason,
      snapshot
    )
    select
      i.id,
      'partner_row_attached_to_child_application',
      to_jsonb(i)
    from public.intermediaries i
    where i.application_id = p_application_id
      and i.intermediary_type = 'partner'
    on conflict (intermediary_id, cleanup_reason) do nothing;

    delete from public.intermediaries
    where application_id = p_application_id
      and intermediary_type = 'partner';
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
      'pending',
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
        iib_status = case
          when iib_status in ('pending', 'checking', 'cleared', 'existing_record', 'invalid', 'failed')
            then iib_status
          else 'pending'
        end,
        account_status = 'active',
        updated_at = now()
    where id = v_existing_id;
  end if;
end;
$$;

revoke all on function public.sync_partner_intermediary(uuid) from public;
revoke all on function public.sync_partner_intermediary(uuid) from anon;
revoke all on function public.sync_partner_intermediary(uuid) from authenticated;
grant execute on function public.sync_partner_intermediary(uuid) to service_role;

commit;

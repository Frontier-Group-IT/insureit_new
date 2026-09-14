begin;

-- Snapshot the existing Partner/Employee identity behavior under a private helper.
-- The body below is the pre-existing partner_app_current_identity implementation.
create or replace function public.partner_app_legacy_current_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_portal_account_id uuid;
  v_intermediary_id uuid;
  v_intermediary_type text;
  v_intermediary_code text;
  v_intermediary_name text;
  v_partner_id uuid;
  v_partner_code text;
  v_partner_name text;
  v_profile_id uuid;
  v_profile_role text;
  v_employee_id uuid;
  v_employee_code text;
  v_employee_name text;
  v_employee_designation text;
begin
  if v_auth_user_id is null then
    return null;
  end if;

  select
    ipa.id,
    ipa.intermediary_id,
    i.intermediary_type,
    i.intermediary_code,
    i.display_name
  into
    v_portal_account_id,
    v_intermediary_id,
    v_intermediary_type,
    v_intermediary_code,
    v_intermediary_name
  from public.intermediary_portal_accounts ipa
  join public.intermediaries i on i.id = ipa.intermediary_id
  where ipa.auth_user_id = v_auth_user_id
    and ipa.status = 'active'
  limit 1;

  select
    p.id,
    p.role::text,
    p.employee_id,
    e.employee_code,
    e.full_name,
    e.designation
  into
    v_profile_id,
    v_profile_role,
    v_employee_id,
    v_employee_code,
    v_employee_name,
    v_employee_designation
  from public.profiles p
  join public.employees e on e.id = p.employee_id
  where p.id = v_auth_user_id
    and p.is_active = true
    and e.employment_status = 'active'
  limit 1;

  if v_portal_account_id is not null and v_profile_id is not null then
    raise exception 'Ambiguous INSUREIT Partner identity for authenticated user'
      using errcode = '28000';
  end if;

  if v_portal_account_id is not null then
    v_partner_id := public.partner_app_resolve_partner_family(v_intermediary_id);

    if v_partner_id is null then
      raise exception 'Intermediary account does not resolve to one active permanent Partner family'
        using errcode = '28000';
    end if;

    select p.partner_code, p.display_name
    into v_partner_code, v_partner_name
    from public.partners p
    where p.id = v_partner_id;

    return jsonb_build_object(
      'actor_kind', 'intermediary',
      'auth_user_id', v_auth_user_id,
      'portal_account_id', v_portal_account_id,
      'intermediary_id', v_intermediary_id,
      'intermediary_type', v_intermediary_type,
      'intermediary_code', v_intermediary_code,
      'display_name', v_intermediary_name,
      'partner_id', v_partner_id,
      'partner_code', v_partner_code,
      'partner_name', v_partner_name
    );
  end if;

  if v_profile_id is not null then
    return jsonb_build_object(
      'actor_kind', 'employee',
      'auth_user_id', v_auth_user_id,
      'profile_id', v_profile_id,
      'role', v_profile_role,
      'employee_id', v_employee_id,
      'employee_code', v_employee_code,
      'display_name', v_employee_name,
      'designation', v_employee_designation
    );
  end if;

  return null;
end;
$$;

revoke all on function public.partner_app_legacy_current_identity() from public, anon, authenticated;
grant execute on function public.partner_app_legacy_current_identity() to service_role;

-- Public/current identity now checks the explicit Group/Branch mapping first and
-- otherwise delegates to the exact legacy behavior above.
create or replace function public.partner_app_current_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_access public.portal_access_identities%rowtype;
  v_group_code text;
  v_group_name text;
  v_partner_code text;
  v_partner_name text;
begin
  select i.*
  into v_access
  from public.portal_access_identities i
  join public.profiles p on p.id = i.profile_id
  where i.profile_id = auth.uid()
    and i.status = 'active'
    and p.is_active = true
  limit 1;

  if found then
    if v_access.entity_type = 'group' then
      select g.group_code, g.group_name
      into v_group_code, v_group_name
      from public.intermediary_groups g
      where g.id = v_access.entity_id
        and g.status = 'active';

      if not found then
        return null;
      end if;

      return jsonb_build_object(
        'actor_kind', 'intermediary',
        'auth_user_id', auth.uid(),
        'portal_account_id', null,
        'intermediary_id', v_access.entity_id,
        'intermediary_type', 'group',
        'intermediary_code', v_group_code,
        'display_name', v_group_name,
        'partner_id', null,
        'partner_code', null,
        'partner_name', v_group_name,
        'portal_access_type', 'group',
        'portal_access_entity_id', v_access.entity_id,
        'group_id', v_access.entity_id,
        'group_code', v_group_code,
        'group_name', v_group_name,
        'login_email', v_access.login_email
      );
    end if;

    select p.partner_code, p.display_name
    into v_partner_code, v_partner_name
    from public.partners p
    join public.partner_branch_profiles b on b.partner_id = p.id
    where p.id = v_access.entity_id
      and p.partner_status = 'active_partner'
    limit 1;

    if not found then
      return null;
    end if;

    return jsonb_build_object(
      'actor_kind', 'intermediary',
      'auth_user_id', auth.uid(),
      'portal_account_id', null,
      'intermediary_id', v_access.entity_id,
      'intermediary_type', 'branch',
      'intermediary_code', v_partner_code,
      'display_name', v_partner_name,
      'partner_id', v_access.entity_id,
      'partner_code', v_partner_code,
      'partner_name', v_partner_name,
      'portal_access_type', 'branch',
      'portal_access_entity_id', v_access.entity_id,
      'login_email', v_access.login_email
    );
  end if;

  return public.partner_app_legacy_current_identity();
end;
$$;

-- Keep the convenience wrapper aligned with the canonical identity function.
create or replace function public.partner_portal_current_identity()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.partner_app_current_identity();
$$;

revoke all on function public.partner_app_current_identity() from public, anon;
revoke all on function public.partner_portal_current_identity() from public, anon;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;
grant execute on function public.partner_portal_current_identity() to authenticated, service_role;

commit;

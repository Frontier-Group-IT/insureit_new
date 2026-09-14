begin;

-- Preserve the exact Partner/Employee identity implementation that is live when
-- this migration is applied. Renaming the function keeps its OID/body intact,
-- so this feature cannot overwrite a newer legacy Partner identity contract.
do $$
begin
  if to_regprocedure('public.partner_app_legacy_current_identity()') is not null then
    raise exception 'partner_app_legacy_current_identity already exists';
  end if;

  if to_regprocedure('public.partner_app_current_identity()') is null then
    raise exception 'partner_app_current_identity is required';
  end if;

  alter function public.partner_app_current_identity()
    rename to partner_app_legacy_current_identity;
end;
$$;

revoke all on function public.partner_app_legacy_current_identity() from public, anon, authenticated;
grant execute on function public.partner_app_legacy_current_identity() to service_role;

-- Canonical identity resolver: explicit Group/Branch access first; otherwise
-- delegate to the untouched legacy Partner/Employee implementation above.
create function public.partner_app_current_identity()
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

-- Convenience alias for callers that want to make the broader portal identity
-- contract explicit. Existing Partner callers can keep using the canonical RPC.
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

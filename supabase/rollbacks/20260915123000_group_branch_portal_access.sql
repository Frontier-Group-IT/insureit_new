begin;

-- Restore the pre-feature Partner/Employee identity function.
create or replace function public.partner_app_current_identity()
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
  if v_auth_user_id is null then return null; end if;

  select ipa.id, ipa.intermediary_id, i.intermediary_type, i.intermediary_code, i.display_name
  into v_portal_account_id, v_intermediary_id, v_intermediary_type, v_intermediary_code, v_intermediary_name
  from public.intermediary_portal_accounts ipa
  join public.intermediaries i on i.id = ipa.intermediary_id
  where ipa.auth_user_id = v_auth_user_id and ipa.status = 'active'
  limit 1;

  select p.id, p.role::text, p.employee_id, e.employee_code, e.full_name, e.designation
  into v_profile_id, v_profile_role, v_employee_id, v_employee_code, v_employee_name, v_employee_designation
  from public.profiles p
  join public.employees e on e.id = p.employee_id
  where p.id = v_auth_user_id and p.is_active = true and e.employment_status = 'active'
  limit 1;

  if v_portal_account_id is not null and v_profile_id is not null then
    raise exception 'Ambiguous INSUREIT Partner identity for authenticated user' using errcode = '28000';
  end if;

  if v_portal_account_id is not null then
    v_partner_id := public.partner_app_resolve_partner_family(v_intermediary_id);
    if v_partner_id is null then
      raise exception 'Intermediary account does not resolve to one active permanent Partner family' using errcode = '28000';
    end if;
    select p.partner_code, p.display_name into v_partner_code, v_partner_name
    from public.partners p where p.id = v_partner_id;
    return jsonb_build_object(
      'actor_kind','intermediary','auth_user_id',v_auth_user_id,'portal_account_id',v_portal_account_id,
      'intermediary_id',v_intermediary_id,'intermediary_type',v_intermediary_type,
      'intermediary_code',v_intermediary_code,'display_name',v_intermediary_name,
      'partner_id',v_partner_id,'partner_code',v_partner_code,'partner_name',v_partner_name
    );
  end if;

  if v_profile_id is not null then
    return jsonb_build_object(
      'actor_kind','employee','auth_user_id',v_auth_user_id,'profile_id',v_profile_id,'role',v_profile_role,
      'employee_id',v_employee_id,'employee_code',v_employee_code,'display_name',v_employee_name,
      'designation',v_employee_designation
    );
  end if;
  return null;
end;
$$;

-- Restore the pre-feature commercial scope implementation.
create or replace function public.partner_app_commercial_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_identity jsonb;
  v_actor_kind text;
  v_partner_id uuid;
  v_partner_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_owner_employee_id uuid;
  v_profile_id uuid;
  v_role text;
  v_employee_id uuid;
  v_employee_scope jsonb;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
begin
  v_identity := public.partner_app_current_identity();
  if v_identity is null then return null; end if;
  v_actor_kind := v_identity ->> 'actor_kind';

  if v_actor_kind = 'intermediary' then
    v_partner_id := (v_identity ->> 'partner_id')::uuid;
    v_partner_ids := array[v_partner_id];
    v_intermediary_ids := public.partner_app_partner_family_intermediary_ids(v_partner_id);
    v_owner_employee_id := public.intermediary_group_partner_owner_employee(v_partner_id);
    select coalesce(array_agg(m.group_id order by m.group_id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_group_memberships m
    join public.intermediary_groups g on g.id = m.group_id and g.status = 'active'
    where m.partner_id = v_partner_id and m.effective_to is null;
    return jsonb_build_object(
      'actor_kind','intermediary','scope_mode','partner_family',
      'employee_ids',case when v_owner_employee_id is null then '[]'::jsonb else to_jsonb(array[v_owner_employee_id]) end,
      'partner_ids',to_jsonb(v_partner_ids),'intermediary_ids',to_jsonb(v_intermediary_ids),'group_ids',to_jsonb(v_group_ids)
    );
  end if;

  if v_actor_kind <> 'employee' then return null; end if;
  v_profile_id := (v_identity ->> 'profile_id')::uuid;
  v_role := v_identity ->> 'role';
  v_employee_id := (v_identity ->> 'employee_id')::uuid;
  v_employee_scope := public.partner_app_employee_intermediary_scope(v_profile_id, v_role, v_employee_id);

  if coalesce(v_employee_scope ->> 'access','none') = 'none' then
    return jsonb_build_object('actor_kind','employee','scope_mode','none','employee_ids','[]'::jsonb,'partner_ids','[]'::jsonb,'intermediary_ids','[]'::jsonb,'group_ids','[]'::jsonb);
  end if;

  v_scope_mode := v_employee_scope ->> 'scope_mode';
  if v_scope_mode <> 'organization' then
    select coalesce(array_agg(value::uuid order by value::uuid), array[]::uuid[])
    into v_employee_ids from jsonb_array_elements_text(v_employee_scope -> 'employee_ids') value;
  end if;

  if v_scope_mode = 'organization' then
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[]) into v_partner_ids
    from public.partners p where p.partner_status = 'active_partner';
    select coalesce(array_agg(g.id order by g.id), array[]::uuid[]) into v_group_ids
    from public.intermediary_groups g where g.status = 'active';
  else
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[]) into v_partner_ids
    from public.partners p
    where p.partner_status = 'active_partner' and public.intermediary_group_partner_owner_employee(p.id) = any(v_employee_ids);
    select coalesce(array_agg(g.id order by g.id), array[]::uuid[]) into v_group_ids
    from public.intermediary_groups g where g.status = 'active' and g.owner_employee_id = any(v_employee_ids);
  end if;

  select coalesce(array_agg(distinct i.id order by i.id), array[]::uuid[])
  into v_intermediary_ids
  from public.intermediaries i
  where (
    i.intermediary_type = 'partner' and exists (
      select 1 from public.partners p where p.id = any(v_partner_ids) and p.source_application_id = i.application_id
    )
  ) or (
    i.intermediary_type in ('posp','misp') and exists (
      select 1 from public.posp_misp_onboarding_profiles op
      where op.id = i.onboarding_profile_id and op.partner_record_id = any(v_partner_ids)
    )
  );

  return jsonb_build_object(
    'actor_kind','employee','scope_mode',v_scope_mode,
    'employee_ids',case when v_scope_mode = 'organization' then '[]'::jsonb else to_jsonb(v_employee_ids) end,
    'partner_ids',to_jsonb(v_partner_ids),'intermediary_ids',to_jsonb(v_intermediary_ids),'group_ids',to_jsonb(v_group_ids)
  );
end;
$$;

revoke all on function public.partner_app_current_identity() from public, anon;
revoke all on function public.partner_app_commercial_scope() from public, anon;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;
grant execute on function public.partner_app_commercial_scope() to authenticated, service_role;

drop function if exists public.partner_portal_current_identity();
drop function if exists public.partner_app_legacy_current_identity();
drop function if exists public.partner_portal_scoped_partner_ids();
drop function if exists public.partner_portal_access_context();
drop trigger if exists portal_access_identity_validate_target on public.portal_access_identities;
drop function if exists public.portal_access_identity_validate_target();
drop table if exists public.portal_access_identities;

commit;

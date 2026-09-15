begin;

-- Restore the access-context implementation that preceded the hardening release.
create or replace function public.partner_portal_access_context()
returns table (
  account_type text,
  entity_id uuid,
  login_email text,
  scoped_partner_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_identity public.portal_access_identities%rowtype;
begin
  select i.* into v_identity
  from public.portal_access_identities i
  where i.profile_id = auth.uid()
    and i.status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  if v_identity.entity_type = 'branch' then
    return query
    select
      'branch'::text,
      v_identity.entity_id,
      v_identity.login_email,
      array[v_identity.entity_id]::uuid[];
    return;
  end if;

  return query
  with member_partners as (
    select distinct m.partner_id
    from public.intermediary_group_memberships m
    where m.group_id = v_identity.entity_id
      and m.effective_to is null
  ), scoped as (
    select mp.partner_id as id from member_partners mp
    union
    select p.id
    from public.partners p
    join member_partners mp on mp.partner_id = p.parent_partner_id
  )
  select
    'group'::text,
    v_identity.entity_id,
    v_identity.login_email,
    coalesce(array_agg(distinct scoped.id) filter (where scoped.id is not null), '{}'::uuid[])
  from scoped;
end;
$$;

revoke all on function public.partner_portal_access_context() from public;
grant execute on function public.partner_portal_access_context() to authenticated;

-- Restore the commercial-scope implementation introduced by PR #1827.
create or replace function public.partner_app_commercial_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_access_context record;
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
  select c.account_type, c.entity_id, c.scoped_partner_ids
  into v_access_context
  from public.partner_portal_access_context() c
  limit 1;

  if found then
    v_partner_ids := coalesce(v_access_context.scoped_partner_ids, array[]::uuid[]);

    if v_access_context.account_type = 'group' then
      v_group_ids := array[v_access_context.entity_id];
    else
      select coalesce(array_agg(m.group_id order by m.group_id), array[]::uuid[])
      into v_group_ids
      from public.intermediary_group_memberships m
      join public.intermediary_groups g
        on g.id = m.group_id
       and g.status = 'active'
      where m.partner_id = v_access_context.entity_id
        and m.effective_to is null;
    end if;

    select coalesce(array_agg(distinct i.id order by i.id), array[]::uuid[])
    into v_intermediary_ids
    from public.intermediaries i
    where (
      i.intermediary_type = 'partner'
      and exists (
        select 1 from public.partners p
        where p.id = any(v_partner_ids)
          and p.source_application_id = i.application_id
      )
    )
    or (
      i.intermediary_type in ('posp', 'misp')
      and exists (
        select 1 from public.posp_misp_onboarding_profiles op
        where op.id = i.onboarding_profile_id
          and op.partner_record_id = any(v_partner_ids)
      )
    );

    select coalesce(array_agg(distinct owner_id order by owner_id), array[]::uuid[])
    into v_employee_ids
    from (
      select public.intermediary_group_partner_owner_employee(p.id) as owner_id
      from public.partners p
      where p.id = any(v_partner_ids)
    ) owners
    where owner_id is not null;

    return jsonb_build_object(
      'actor_kind', 'intermediary',
      'scope_mode', case when v_access_context.account_type = 'group' then 'hierarchy' else 'self' end,
      'employee_ids', to_jsonb(v_employee_ids),
      'partner_ids', to_jsonb(v_partner_ids),
      'intermediary_ids', to_jsonb(v_intermediary_ids),
      'group_ids', to_jsonb(v_group_ids),
      'portal_access_type', v_access_context.account_type,
      'portal_access_entity_id', v_access_context.entity_id
    );
  end if;

  v_identity := public.partner_app_current_identity();
  if v_identity is null then
    return null;
  end if;

  v_actor_kind := v_identity ->> 'actor_kind';
  if v_actor_kind = 'intermediary' then
    v_partner_id := (v_identity ->> 'partner_id')::uuid;
    v_partner_ids := array[v_partner_id];
    v_intermediary_ids := public.partner_app_partner_family_intermediary_ids(v_partner_id);
    v_owner_employee_id := public.intermediary_group_partner_owner_employee(v_partner_id);

    select coalesce(array_agg(m.group_id order by m.group_id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_group_memberships m
    join public.intermediary_groups g
      on g.id = m.group_id
     and g.status = 'active'
    where m.partner_id = v_partner_id
      and m.effective_to is null;

    return jsonb_build_object(
      'actor_kind', 'intermediary',
      'scope_mode', 'partner_family',
      'employee_ids', case when v_owner_employee_id is null then '[]'::jsonb else to_jsonb(array[v_owner_employee_id]) end,
      'partner_ids', to_jsonb(v_partner_ids),
      'intermediary_ids', to_jsonb(v_intermediary_ids),
      'group_ids', to_jsonb(v_group_ids)
    );
  end if;

  if v_actor_kind <> 'employee' then
    return null;
  end if;

  v_profile_id := (v_identity ->> 'profile_id')::uuid;
  v_role := v_identity ->> 'role';
  v_employee_id := (v_identity ->> 'employee_id')::uuid;
  v_employee_scope := public.partner_app_employee_intermediary_scope(v_profile_id, v_role, v_employee_id);

  if coalesce(v_employee_scope ->> 'access', 'none') = 'none' then
    return jsonb_build_object(
      'actor_kind', 'employee', 'scope_mode', 'none',
      'employee_ids', '[]'::jsonb, 'partner_ids', '[]'::jsonb,
      'intermediary_ids', '[]'::jsonb, 'group_ids', '[]'::jsonb
    );
  end if;

  v_scope_mode := v_employee_scope ->> 'scope_mode';
  if v_scope_mode <> 'organization' then
    select coalesce(array_agg(value::uuid order by value::uuid), array[]::uuid[])
    into v_employee_ids
    from jsonb_array_elements_text(v_employee_scope -> 'employee_ids') value;
  end if;

  if v_scope_mode = 'organization' then
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[])
    into v_partner_ids from public.partners p where p.partner_status = 'active_partner';
    select coalesce(array_agg(g.id order by g.id), array[]::uuid[])
    into v_group_ids from public.intermediary_groups g where g.status = 'active';
  else
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[])
    into v_partner_ids
    from public.partners p
    where p.partner_status = 'active_partner'
      and public.intermediary_group_partner_owner_employee(p.id) = any(v_employee_ids);
    select coalesce(array_agg(g.id order by g.id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_groups g
    where g.status = 'active'
      and g.owner_employee_id = any(v_employee_ids);
  end if;

  select coalesce(array_agg(distinct i.id order by i.id), array[]::uuid[])
  into v_intermediary_ids
  from public.intermediaries i
  where (
    i.intermediary_type = 'partner'
    and exists (
      select 1 from public.partners p
      where p.id = any(v_partner_ids)
        and p.source_application_id = i.application_id
    )
  )
  or (
    i.intermediary_type in ('posp', 'misp')
    and exists (
      select 1 from public.posp_misp_onboarding_profiles op
      where op.id = i.onboarding_profile_id
        and op.partner_record_id = any(v_partner_ids)
    )
  );

  return jsonb_build_object(
    'actor_kind', 'employee',
    'scope_mode', v_scope_mode,
    'employee_ids', case when v_scope_mode = 'organization' then '[]'::jsonb else to_jsonb(v_employee_ids) end,
    'partner_ids', to_jsonb(v_partner_ids),
    'intermediary_ids', to_jsonb(v_intermediary_ids),
    'group_ids', to_jsonb(v_group_ids)
  );
end;
$$;

revoke all on function public.partner_app_commercial_scope() from public, anon;
grant execute on function public.partner_app_commercial_scope() to authenticated, service_role;

commit;

-- Partner App compatibility for Group -> Partner -> Branch.
--
-- A Branch remains scoped to its own Partner family, but it inherits the root
-- Partner's Group ID for Group-level metadata/schemes. Employee commercial
-- scope remains based on the existing intermediary employee assignment and
-- does not gain sibling Partner access merely because a business Group exists.

create or replace function public.partner_app_commercial_scope()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_identity jsonb;
  v_actor_kind text;
  v_partner_id uuid;
  v_group_lookup_partner_id uuid;
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
  if v_identity is null then
    return null;
  end if;

  v_actor_kind := v_identity ->> 'actor_kind';

  if v_actor_kind = 'intermediary' then
    v_partner_id := (v_identity ->> 'partner_id')::uuid;
    v_partner_ids := array[v_partner_id];
    v_intermediary_ids := public.partner_app_partner_family_intermediary_ids(v_partner_id);
    v_owner_employee_id := public.intermediary_group_partner_owner_employee(v_partner_id);

    select coalesce(partner.parent_partner_id, partner.id)
      into v_group_lookup_partner_id
    from public.partners partner
    where partner.id = v_partner_id;

    v_group_lookup_partner_id := coalesce(v_group_lookup_partner_id, v_partner_id);

    select coalesce(array_agg(m.group_id order by m.group_id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_group_memberships m
    join public.intermediary_groups g
      on g.id = m.group_id
     and g.status = 'active'
    where m.partner_id = v_group_lookup_partner_id
      and m.effective_to is null;

    return jsonb_build_object(
      'actor_kind', 'intermediary',
      'scope_mode', 'partner_family',
      'employee_ids',
        case
          when v_owner_employee_id is null then '[]'::jsonb
          else to_jsonb(array[v_owner_employee_id])
        end,
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

  v_employee_scope := public.partner_app_employee_intermediary_scope(
    v_profile_id,
    v_role,
    v_employee_id
  );

  if coalesce(v_employee_scope ->> 'access', 'none') = 'none' then
    return jsonb_build_object(
      'actor_kind', 'employee',
      'scope_mode', 'none',
      'employee_ids', '[]'::jsonb,
      'partner_ids', '[]'::jsonb,
      'intermediary_ids', '[]'::jsonb,
      'group_ids', '[]'::jsonb
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
    into v_partner_ids
    from public.partners p
    where p.partner_status = 'active_partner';

    select coalesce(array_agg(g.id order by g.id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_groups g
    where g.status = 'active';
  else
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[])
    into v_partner_ids
    from public.partners p
    where p.partner_status = 'active_partner'
      and public.intermediary_group_partner_owner_employee(p.id) = any(v_employee_ids);

    -- Preserve the existing security boundary for employee actors. Business
    -- Groups can contain Partners owned by different employees, so exposing a
    -- business Group ID here would make Group-snapshot OR conditions grant
    -- sibling Partner policies. Only legacy employee-owned Groups participate
    -- in this employee Group-ID shortcut; business-Group policies remain
    -- reachable through the employee's own rm/intermediary scope.
    select coalesce(array_agg(g.id order by g.id), array[]::uuid[])
    into v_group_ids
    from public.intermediary_groups g
    where g.status = 'active'
      and coalesce(g.group_mode, 'legacy_employee') = 'legacy_employee'
      and g.owner_employee_id = any(v_employee_ids);
  end if;

  select coalesce(array_agg(distinct i.id order by i.id), array[]::uuid[])
  into v_intermediary_ids
  from public.intermediaries i
  where (
    i.intermediary_type = 'partner'
    and exists (
      select 1
      from public.partners p
      where p.id = any(v_partner_ids)
        and p.source_application_id = i.application_id
    )
  )
  or (
    i.intermediary_type in ('posp', 'misp')
    and exists (
      select 1
      from public.posp_misp_onboarding_profiles op
      where op.id = i.onboarding_profile_id
        and op.partner_record_id = any(v_partner_ids)
    )
  );

  return jsonb_build_object(
    'actor_kind', 'employee',
    'scope_mode', v_scope_mode,
    'employee_ids',
      case
        when v_scope_mode = 'organization' then '[]'::jsonb
        else to_jsonb(v_employee_ids)
      end,
    'partner_ids', to_jsonb(v_partner_ids),
    'intermediary_ids', to_jsonb(v_intermediary_ids),
    'group_ids', to_jsonb(v_group_ids)
  );
end;
$function$;

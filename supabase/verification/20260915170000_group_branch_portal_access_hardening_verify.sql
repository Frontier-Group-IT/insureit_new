do $$
declare
  v_context_def text;
  v_scope_def text;
begin
  if to_regprocedure('public.partner_portal_access_context()') is null then
    raise exception 'partner_portal_access_context is missing';
  end if;
  if to_regprocedure('public.partner_app_commercial_scope()') is null then
    raise exception 'partner_app_commercial_scope is missing';
  end if;
  if to_regprocedure('public.partner_app_legacy_current_identity()') is null then
    raise exception 'partner_app_legacy_current_identity is missing';
  end if;

  select pg_get_functiondef('public.partner_portal_access_context()'::regprocedure)
    into v_context_def;
  select pg_get_functiondef('public.partner_app_commercial_scope()'::regprocedure)
    into v_scope_def;

  if v_context_def not ilike '%join public.profiles%is_active = true%' then
    raise exception 'access context does not revalidate active profiles';
  end if;
  if v_context_def not ilike '%partner.partner_status = ''active_partner''%' then
    raise exception 'access context does not revalidate active Branch targets';
  end if;
  if v_context_def not ilike '%g.status = ''active''%' then
    raise exception 'access context does not revalidate active Group targets';
  end if;
  if v_context_def not ilike '%partner_branch_profiles%' then
    raise exception 'access context does not require a Branch profile';
  end if;

  if v_scope_def not ilike '%coalesce(partner.parent_partner_id, partner.id)%' then
    raise exception 'Branch parent Partner Group inheritance is not preserved';
  end if;
  if v_scope_def not ilike '%partner_app_legacy_current_identity()%' then
    raise exception 'legacy Partner/Employee identity fallback is not preserved';
  end if;
  if v_scope_def not ilike '%coalesce(g.group_mode, ''legacy_employee'') = ''legacy_employee''%' then
    raise exception 'legacy employee Group security boundary is not preserved';
  end if;

  if has_function_privilege('anon', 'public.partner_portal_access_context()', 'EXECUTE') then
    raise exception 'anon must not execute partner_portal_access_context';
  end if;
  if not has_function_privilege('authenticated', 'public.partner_portal_access_context()', 'EXECUTE') then
    raise exception 'authenticated must execute partner_portal_access_context';
  end if;
  if has_function_privilege('anon', 'public.partner_app_commercial_scope()', 'EXECUTE') then
    raise exception 'anon must not execute partner_app_commercial_scope';
  end if;
end
$$;

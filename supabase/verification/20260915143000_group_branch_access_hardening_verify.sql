-- Verification for Group/Branch access hardening.
-- Read-only: verifies the corrected contracts are installed without requiring
-- any production access identities to exist.

do $$
declare
  access_def text;
  identity_def text;
  scope_def text;
begin
  if to_regclass('public.portal_access_identities') is null then
    raise exception 'portal_access_identities_missing';
  end if;

  if to_regprocedure('public.partner_portal_access_context()') is null
     or to_regprocedure('public.partner_app_current_identity()') is null
     or to_regprocedure('public.partner_app_legacy_current_identity()') is null
     or to_regprocedure('public.partner_app_commercial_scope()') is null then
    raise exception 'group_branch_access_function_missing';
  end if;

  select pg_get_functiondef('public.partner_portal_access_context()'::regprocedure)
  into access_def;
  select pg_get_functiondef('public.partner_app_current_identity()'::regprocedure)
  into identity_def;
  select pg_get_functiondef('public.partner_app_commercial_scope()'::regprocedure)
  into scope_def;

  if access_def not ilike '%pr.is_active = true%'
     or access_def not ilike '%g.status = ''active''%'
     or access_def not ilike '%p.partner_status = ''active_partner''%'
     or access_def not ilike '%partner_branch_profiles%' then
    raise exception 'portal_access_activity_revalidation_missing';
  end if;

  if identity_def not ilike '%''profile_id'', auth.uid()%' then
    raise exception 'mapped_identity_profile_submitter_missing';
  end if;

  if scope_def not ilike '%coalesce(p.parent_partner_id, p.id)%'
     or scope_def not ilike '%partner_app_legacy_current_identity()%'
     or scope_def not ilike '%coalesce(g.group_mode, ''legacy_employee'') = ''legacy_employee''%' then
    raise exception 'legacy_partner_scope_compatibility_missing';
  end if;

  if has_function_privilege('anon', 'public.partner_app_current_identity()', 'EXECUTE')
     or has_function_privilege('anon', 'public.partner_app_commercial_scope()', 'EXECUTE')
     or has_function_privilege('anon', 'public.partner_portal_access_context()', 'EXECUTE') then
    raise exception 'anonymous_partner_access_not_blocked';
  end if;

  if not has_function_privilege('authenticated', 'public.partner_app_current_identity()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.partner_app_commercial_scope()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.partner_portal_access_context()', 'EXECUTE') then
    raise exception 'authenticated_partner_access_missing';
  end if;
end;
$$;

select
  (select count(*) from public.partners) as partner_count,
  (select count(*) from public.intermediary_groups) as group_count,
  (select count(*) from public.intermediary_group_memberships) as membership_count,
  (select count(*) from public.intermediary_portal_accounts) as partner_portal_account_count,
  (select count(*) from public.portal_access_identities) as group_branch_access_count;

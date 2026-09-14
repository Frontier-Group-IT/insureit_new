-- INSUREIT Group / Branch portal access verification.
-- Run only after the feature migrations are applied to a non-production or approved target.

select
  to_regclass('public.portal_access_identities') as portal_access_table;

select
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'portal_access_identity_validate_target',
    'partner_portal_access_context',
    'partner_portal_scoped_partner_ids',
    'partner_portal_current_identity',
    'partner_app_legacy_current_identity',
    'partner_app_current_identity',
    'partner_app_commercial_scope'
  )
order by p.proname;

-- Existing Partner accounts are intentionally not backfilled into the new mapping.
select
  count(*) as group_branch_access_rows,
  count(*) filter (where entity_type = 'group') as group_access_rows,
  count(*) filter (where entity_type = 'branch') as branch_access_rows,
  count(*) filter (where status = 'active') as active_access_rows
from public.portal_access_identities;

-- Every explicit Group mapping must still point to an active Group.
select i.id as invalid_group_mapping
from public.portal_access_identities i
left join public.intermediary_groups g
  on g.id = i.entity_id
 and g.status = 'active'
where i.entity_type = 'group'
  and g.id is null;

-- Every explicit Branch mapping must still point to an existing Branch partner row.
select i.id as invalid_branch_mapping
from public.portal_access_identities i
left join public.partner_branch_profiles b on b.partner_id = i.entity_id
where i.entity_type = 'branch'
  and b.partner_id is null;

-- Disabled mappings must not produce active portal access context for their profile.
-- Runtime identity/scope should additionally be exercised with dedicated test users
-- before production activation: Group -> member Partners + Branches; Branch -> self only;
-- legacy Partner -> unchanged partner_family scope.

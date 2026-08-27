-- INSUREIT Partner identity/scope verification.
-- Run after the migration has been applied.

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
    'partner_app_resolve_partner_family',
    'partner_app_partner_family_intermediary_ids',
    'partner_app_employee_intermediary_scope',
    'partner_app_current_identity',
    'partner_app_commercial_scope'
  )
order by p.proname;

select
  i.intermediary_type,
  count(*) as intermediary_rows,
  count(public.partner_app_resolve_partner_family(i.id)) as resolved_partner_family,
  count(*) - count(public.partner_app_resolve_partner_family(i.id)) as unresolved_partner_family
from public.intermediaries i
where i.intermediary_type in ('partner', 'posp', 'misp')
group by i.intermediary_type
order by i.intermediary_type;

select
  count(*) as portal_accounts,
  count(*) filter (where status = 'active') as active_portal_accounts
from public.intermediary_portal_accounts;

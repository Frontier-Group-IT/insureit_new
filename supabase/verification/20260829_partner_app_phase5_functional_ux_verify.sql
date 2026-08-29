-- INSUREIT Partner Phase 5 functional UX contract verification.
select
  p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'partner_app_policy_summary',
    'partner_app_list_policies',
    'partner_app_renewal_summary',
    'partner_app_customer_detail',
    'partner_app_policy_detail',
    'partner_app_claim_detail',
    'partner_app_customer_in_scope',
    'partner_app_policy_in_scope',
    'partner_app_claim_in_scope'
  )
order by p.proname;

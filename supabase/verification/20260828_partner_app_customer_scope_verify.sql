-- Partner app customer scope verification.

select
  p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('partner_app_customer_summary','partner_app_list_customers')
order by p.proname;

select
  count(*) as total_customers,
  count(*) filter(where lead_source_intermediary_id is not null) as attributed,
  count(*) filter(where lead_source_intermediary_id is null) as unattributed,
  count(*) filter(where lead_source_intermediary_id is not null and public.partner_app_resolve_partner_family(lead_source_intermediary_id) is not null) as family_resolved
from public.customers;

-- Partner app claims scope verification.

select
  p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('partner_app_claim_summary','partner_app_list_claims')
order by p.proname;

select
  count(*) as total_claims,
  count(*) filter(where c.lead_source_intermediary_id is not null) as commercially_attributed,
  count(*) filter(where c.lead_source_intermediary_id is null) as commercially_unattributed
from public.claims cl
join public.customers c on c.id=cl.customer_id;

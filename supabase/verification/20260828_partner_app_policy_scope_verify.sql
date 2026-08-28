-- INSUREIT Partner policy scope verification.

select
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('partner_app_policy_summary', 'partner_app_list_policies')
order by p.proname;

select
  count(*) as total_policies,
  count(*) filter (where intermediary_code is not null and btrim(intermediary_code) <> '') as with_intermediary_code,
  count(*) filter (where rm_employee_id is not null) as with_rm_employee_id
from public.policies;

select
  count(*) as unmatched_distinct_policy_intermediary_codes
from (
  select distinct p.intermediary_code
  from public.policies p
  left join public.intermediaries i on i.intermediary_code = p.intermediary_code
  where p.intermediary_code is not null
    and i.id is null
) unmatched;

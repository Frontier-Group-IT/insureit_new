-- INSUREIT Partner Phase 4 Learn/Stories verification.
select
  p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'partner_app_learning_today',
    'partner_app_submit_learning_answer',
    'partner_app_stories'
  )
order by p.proname;

select
  c.relname,
  c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('partner_learning_cards','partner_learning_attempts')
order by c.relname;

-- INSUREIT Partner Policy Intake submitter verification.

select
  column_name,
  is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='policy_intake_requests'
  and column_name in ('submitted_by_profile_id','submitted_by_portal_account_id')
order by column_name;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.policy_intake_requests'::regclass
  and conname='policy_intake_requests_exactly_one_submitter_check';

select
  count(*) as existing_intakes,
  count(*) filter(where submitted_by_profile_id is not null) as employee_submissions,
  count(*) filter(where submitted_by_portal_account_id is not null) as portal_submissions
from public.policy_intake_requests;

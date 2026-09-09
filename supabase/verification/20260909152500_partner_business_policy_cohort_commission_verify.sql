-- Verify the Partner date-range business contract still has the intended grants
-- and that Commission Earned is tied to the same policy cohort as Policies Sold.
with fn as (
  select pg_get_functiondef(to_regprocedure('public.partner_app_business_range(date,date)')) as definition
)
select
  to_regprocedure('public.partner_app_business_range(date,date)') is not null as function_exists,
  has_function_privilege('authenticated', 'public.partner_app_business_range(date,date)', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', 'public.partner_app_business_range(date,date)', 'EXECUTE') as anon_can_execute,
  position('range_policy_cohort' in definition) > 0 as shared_policy_cohort_present,
  position('join range_policy_cohort rpc on rpc.id=pip.policy_id' in definition) > 0 as payout_joins_policy_cohort,
  position('upper(coalesce(pip.intermediary_code' in definition) > 0 as self_payout_scope_present,
  position('commission_earned' in definition) > 0 as commission_field_present
from fn;

-- Expected:
-- function_exists = true
-- authenticated_can_execute = true
-- anon_can_execute = false
-- shared_policy_cohort_present = true
-- payout_joins_policy_cohort = true
-- self_payout_scope_present = true
-- commission_field_present = true
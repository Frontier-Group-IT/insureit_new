-- Verify the Partner app date-range business summary contract exists with the intended grants.
select
  to_regprocedure('public.partner_app_business_range(date,date)') is not null as function_exists,
  has_function_privilege('authenticated', 'public.partner_app_business_range(date,date)', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', 'public.partner_app_business_range(date,date)', 'EXECUTE') as anon_can_execute;

-- Expected:
-- function_exists = true
-- authenticated_can_execute = true
-- anon_can_execute = false

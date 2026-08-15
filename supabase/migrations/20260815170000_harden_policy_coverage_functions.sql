-- Policy coverage helpers are internal database implementation details.
-- They are used by the policy overlap trigger and must not be exposed as client-callable RPCs.

revoke execute on function public.enforce_single_active_policy_per_vehicle() from public, anon, authenticated;
revoke execute on function public.policy_coverage_components(text) from public, anon, authenticated;

grant execute on function public.enforce_single_active_policy_per_vehicle() to service_role;
grant execute on function public.policy_coverage_components(text) to service_role;

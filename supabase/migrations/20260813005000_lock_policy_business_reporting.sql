revoke execute on function public.get_policy_business_report(uuid[], date, date, uuid, text, text, integer, integer) from public;
revoke execute on function public.get_policy_business_report(uuid[], date, date, uuid, text, text, integer, integer) from anon;
revoke execute on function public.get_policy_business_report(uuid[], date, date, uuid, text, text, integer, integer) from authenticated;
grant execute on function public.get_policy_business_report(uuid[], date, date, uuid, text, text, integer, integer) to service_role;
